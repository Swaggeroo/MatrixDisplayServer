import express from "express";
import {v4 as uuidv4} from "uuid";
import sharp from 'sharp';
import fs from 'fs';
import config from "config";
import {isConnected} from "../services/dbConnector";
import {Picture} from "../models/picture";
import {getPixels, Pixel} from "../utils/imageAnalysis";

const extractFrames = require('gif-extract-frames');

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

    let files = req.files['pictures'];

    if (!Array.isArray(files)) {
        files = [files];
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
            file.mv(UPLOAD_DIR + uuid + "_" + file.name.split(".")[0] + "." +file.mimetype.split("/")[1], function (err) {
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
            data: [pixelsToPicture(getPixels(DEST_DIR + uuid + ".png"))]
        });

        await picture.save();

        //delete original file
        fs.unlinkSync(UPLOAD_DIR + file);

        debugUpload('Image processing finished: ' + uuid + ' - ' + name);
    } catch (err) {
        debugUpload('Image processing error: ' + err);
    }
}

async function gifProcessing(file: string, uuid: string, name: string): Promise<void> {
    debugUpload('GIF processing started: ' + uuid + ' - ' + name);

    await sharp(UPLOAD_DIR + file, { animated: true })
        .resize(WIDTH, HEIGHT)
        .gif()
        .toFile(DEST_DIR + uuid + ".gif");

    const results = await extractFrames({
        input: DEST_DIR + uuid + ".gif",
        output: TMP_DIR + uuid + "_%d.png"
    })

    let pixels: Pixel[][] = [];

    for (let i = 0; i < results.shape[0]; i++) {
        pixels[i] = getPixels(TMP_DIR + uuid + "_" + i + ".png");
        fs.unlinkSync(TMP_DIR + uuid + "_" + (i) + ".png");
    }

    const picture = new Picture({
        uuid: uuid,
        name: name,
        animated: true,
        frameCount: results.shape[0],
        data: pixelsToAnimation(pixels, results.shape[0]),
    });

    await picture.save();

    //delete original file
    fs.unlinkSync(UPLOAD_DIR + file);

    debugUpload('GIF processing finished: ' + uuid + ' - ' + name);
}

function pixelsToPicture(pixels: Pixel[]): string {
    let jsonString = '{"picture":[]}';
    let jsonObject = JSON.parse(jsonString);

    for (let i = 0; i < pixels.length; i++) {
        if (pixels[i].alpha === 0) {
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
        if (pixels[i].alpha === 0) {
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
        if (pixels[i].red !== pixelsPre[i].red || pixels[i].green !== pixelsPre[i].green || pixels[i].blue !== pixelsPre[i].blue) {
            diffPixels.push(pixels[i]);
        }
    }

    return getAnimationFrame(diffPixels);
}

export { router };