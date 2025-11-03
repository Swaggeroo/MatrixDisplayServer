import express from "express";
import {v4 as uuidv4} from "uuid";
import sharp from 'sharp';
import fs from 'fs';
import config from "config";
import {isConnected} from "../services/dbConnector";
import {Picture} from "../models/picture";
import {getPixels, Pixel} from "../utils/imageAnalysis";
import path from "path";
import {spawn} from "node:child_process";
const router = express.Router();
const debugUpload = require('debug')('app:upload');


const HEIGHT: number = config.get('height');
const WIDTH: number = config.get('width');
const UPLOAD_DIR: string = config.get('uploadDir');
const DEST_DIR: string = config.get('imageDir');
const TMP_DIR: string = config.get('tmpDir');
const ACCEPTED_MIME_TYPES: string[] = ["image/png", "image/gif"];

router.post('/upload', async (req, res) => {
    if (!isConnected()) {
        return res.status(500).send('Database connection is not established.');
    }

    if (!req.files || Object.keys(req.files).length === 0 || !req.files['pictures']) {
        return res.status(400).send('No files were uploaded.');
    }

    if (!req.body.title) {
        return res.status(400).send('No title was provided.');
    }

    let files = req.files['pictures'];
    let title = req.body.title;

    if (title.length < 3 || title.length > 30) {
        return res.status(400).send('Title must be between 3 and 30 characters long.');
    }

    const alphanumericRegex = /^[a-z0-9 ]+$/i;
    if (!alphanumericRegex.test(title)) {
        return res.status(400).send('Title must be alphanumeric and can include spaces.');
    }

    if (!Array.isArray(files)) {
        files = [files];
    }

    //Sadly its to complex to handle multiple files plus naming
    //Not changing away from array to avoid breaking changes
    if (files.length > 1){
        return res.status(400).send('Only one file can be uploaded at a time.');
    }

    let uuids: String[] = [];

    const movePromises = files.map(file => {
        return new Promise((resolve, reject) => {
            if (!ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
                let err = 'File type not supported: ' + file.mimetype + ' Supported types: ' + ACCEPTED_MIME_TYPES;
                reject(err);
                return;
            }

            let uuid = uuidv4();
            file.mv(UPLOAD_DIR + uuid + "_" + title + "." +file.mimetype.split("/")[1], function (err) {
                if (err) {
                    debugUpload('File upload error: ' + err);
                    reject(err);
                } else {
                    debugUpload('File uploaded: ' + uuid);
                    uuids.push(uuid);
                    resolve(uuid);
                }
            });
        });
    });

    try {
        await Promise.all(movePromises);
    } catch (err) {
        return res.status(500).send(err);
    }

    res.send({ message: 'File(s) uploaded!', uuids: uuids });

    processFiles().then(() => {
        debugUpload('Images processing started.');
    });
});

async function processFiles(): Promise<void>{
    fs.readdir(UPLOAD_DIR, async (err, files) => {
        if (err) {
            debugUpload('Error reading directory: ' + err);
            return;
        }

        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            let uuid = file.split('_')[0];
            let name = file.split('_').slice(1).join("_").split('.')[0];

            let extension = file.split('.').pop()!.toLowerCase();

            if (extension === 'png') {
                await imageProcessing(file, uuid, name);
            }else if (extension === 'gif') {
                await gifProcessing(file, uuid, name);
            }else {
                debugUpload('Unsupported file extension: ' + extension);
            }
        }
    });
}


async function imageProcessing(file: string, uuid: string, name: string): Promise<void> {
    try {
        debugUpload('Image processing started: ' + uuid + ' - ' + name);

        await sharp(UPLOAD_DIR + file)
            .resize(WIDTH, HEIGHT)
            .toFile(DEST_DIR + uuid + ".png");

        if (!isConnected()) {
            debugUpload('Database connection is not established.');
            return;
        }

        const picture = new Picture({
            uuid: uuid,
            name: name,
            animated: false,
            data: [pixelsToPicture(await getPixels(DEST_DIR + uuid + ".png"))]
        });

        await picture.save();

        //delete original file
        fs.unlinkSync(UPLOAD_DIR + file);

        debugUpload('Image processing finished: ' + uuid + ' - ' + name);
    } catch (err) {
        debugUpload('Image processing error: ' + err);
    }
}

async function runFfmpegExtractFrames(
    inputGif: string,
    outputPattern: string
): Promise<number> {
    // Build ffmpeg args to extract all frames as PNGs
    // Use -vsync 0 to avoid duplications in some gifs. :contentReference[oaicite:1]{index=1}
    const args = [
        "-i", inputGif,
        "-fps_mode", "passthrough",
        outputPattern
    ];

    await new Promise<void>((resolve, reject) => {
        const proc = spawn("ffmpeg", args, { stdio: "inherit" });
        proc.on("error", reject);
        proc.on("exit", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg exited with code ${code}`));
        });
    });

    // Now count how many files got written
    const files = fs.readdirSync(path.dirname(outputPattern));
    const regex = new RegExp(
        path.basename(outputPattern)
            .replace("%d", "(\\d+)")
            .replace(".", "\\.")
    );
    const frameFiles = files.filter(f => regex.test(f));
    return frameFiles.length;
}

async function gifProcessing(file: string, uuid: string, name: string): Promise<void> {
    debugUpload(`GIF processing started: ${uuid} - ${name}`);

    const inputPath  = path.join(UPLOAD_DIR, file);
    const gifPath    = path.join(DEST_DIR, `${uuid}.gif`);

    await sharp(inputPath, { animated: true })
        .resize(WIDTH, HEIGHT)
        .gif()
        .toFile(gifPath);

    const tmpPattern = path.join(TMP_DIR, `${uuid}_%d.png`);
    let frameCount = await runFfmpegExtractFrames(gifPath, tmpPattern);

    let pixels: Pixel[][] = [];

    for (let i = 1; i <= frameCount; i++) {
        pixels[i-1] = await getPixels(path.join(TMP_DIR, `${uuid}_${i}.png`));
        fs.unlinkSync(path.join(TMP_DIR, `${uuid}_${i}.png`));
    }

    const picture = new Picture({
        uuid: uuid,
        name: name,
        animated: true,
        frameCount: frameCount,
        data: pixelsToAnimation(pixels, frameCount),
    });

    await picture.save();

    //delete original file
    fs.unlinkSync(inputPath);

    debugUpload(`GIF processing finished: ${uuid} - ${name}`);
}

function pixelsToPicture(pixels: Pixel[]): string {
    let jsonString = '{"picture":[]}';
    let jsonObject = JSON.parse(jsonString);

    for (let i = 0; i < pixels.length; i++) {
        if (pixels[i].alpha < 255) {
            jsonObject.picture.push([0, 0, 0]);
        }else {
            jsonObject.picture.push([pixels[i].red, pixels[i].green, pixels[i].blue]);
        }
    }

    return JSON.stringify(jsonObject);
}

function pixelsToAnimation(pixels: Pixel[][], frameCount: number): string[] {
    let data: string[] = [];

    for (let i = 0; i <= frameCount; i++) {
        let jsonString = '{"frameCount":' + frameCount + ',"frameFragment":' + i + ',"frameDelay":-1,"frame":[]}';
        let jsonObject = JSON.parse(jsonString);

        if (i === 0){
            jsonObject.frame = getAnimationFrame(pixels[0]);
        }else if (i === frameCount) {
            jsonObject.frame = pixelsToFrameDiff(pixels[frameCount-1], pixels[0]);
        }else {
            jsonObject.frame = (pixelsToFrameDiff(pixels[i-1], pixels[i]));
        }

        data.push(JSON.stringify(jsonObject));
    }

    return data;
}

function getAnimationFrame(pixels: Pixel[]): number[][] {
    let frame: number[][] = [];

    for (let i = 0; i < pixels.length; i++) {
        if (pixels[i].alpha < 255) {
            frame.push([pixels[i].id, 0, 0, 0]);
        }else {
            frame.push([pixels[i].id, pixels[i].red, pixels[i].green, pixels[i].blue]);
        }
    }

    return frame;
}

function pixelsToFrameDiff(pixelsPre: Pixel[], pixels: Pixel[]): number[][] {
    let diffPixels: Pixel[] = [];

    for (let i = 0; i < pixels.length; i++) {
        if (pixels[i].red !== pixelsPre[i].red || pixels[i].green !== pixelsPre[i].green || pixels[i].blue !== pixelsPre[i].blue || pixels[i].alpha !== pixelsPre[i].alpha) {
            diffPixels.push(pixels[i]);
        }
    }

    return getAnimationFrame(diffPixels);
}

export { router };