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
const MAX_PIXELS: number = WIDTH*HEIGHT/4;

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

        //TODO advanced processing issue #4

        if (!isConnected()) {
            debugUpload('Database connection is not established.');
            return;
        }

        const picture = new Picture({
            uuid: uuid,
            name: name,
            animated: false,
            frames: [pixelsToFrameAll(getPixels(DEST_DIR + uuid + ".png"))]
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

    let frameStrings: string[] = [];

    let pixelsPre: Pixel[] = [];
    let pixels = getPixels(TMP_DIR + uuid + "_" + 0 + ".png");
    let frame = pixelsToFrameAll(pixels);
    frameStrings.push(frame);

    for (let i = 1; i < results.shape[0]; i++) {
        pixelsPre = getPixels(TMP_DIR + uuid + "_" + (i-1) + ".png");
        pixels = getPixels(TMP_DIR + uuid + "_" + i + ".png");
        frame = getBestFrameMethode(pixelsPre, pixels);
        frameStrings.push(frame);

        fs.unlinkSync(TMP_DIR + uuid + "_" + (i-1) + ".png");
    }

    fs.unlinkSync(TMP_DIR + uuid + "_" + (results.shape[0]-1) + ".png");

    const picture = new Picture({
        uuid: uuid,
        name: name,
        animated: true,
        frames: frameStrings
    });

    await picture.save();

    //delete original file
    fs.unlinkSync(UPLOAD_DIR + file);

    debugUpload('GIF processing finished: ' + uuid + ' - ' + name);
}

function pixelsToFrameAll(pixels: Pixel[]): string {
    const frameFragmentCount: number = pixels.length / MAX_PIXELS;
    let frameFragments: string[] = [];

    for (let i = 0; i < frameFragmentCount; i++) {
        let jsonString = '{"on":true,"bri":"?","seg":{"i":[]}}';
        let jsonObject = JSON.parse(jsonString);

        jsonObject.seg.i.push(MAX_PIXELS*i);

        for (let j = MAX_PIXELS*i; j < MAX_PIXELS*(i+1); j++) {
            if (pixels[j].alpha === 0) {
                jsonObject.seg.i.push("000000");
            }else {
                jsonObject.seg.i.push(pixels[j].red.toString(16).padStart(2, '0') + pixels[j].green.toString(16).padStart(2, '0') + pixels[j].blue.toString(16).padStart(2, '0'));
            }
        }

        frameFragments.push(JSON.stringify(jsonObject));
    }

    return frameFragments.join(';');
}

function pixelsToFrameDiff(pixelsPre: Pixel[], pixels: Pixel[]): string {
    let diffPixels: Pixel[] = [];

    for (let i = 0; i < pixels.length; i++) {
        if (pixels[i].red !== pixelsPre[i].red || pixels[i].green !== pixelsPre[i].green || pixels[i].blue !== pixelsPre[i].blue) {
            diffPixels.push(pixels[i]);
        }
    }

    const frameFragmentCount: number = diffPixels.length / MAX_PIXELS;
    let frameFragments: string[] = [];

    for (let i = 0; i < frameFragmentCount; i++) {
        let jsonString = '{"on":true,"bri":"?","seg":{"i":[]}}';
        let jsonObject = JSON.parse(jsonString);

        //TODO ranges instead of single pixels

        for (let j = MAX_PIXELS*i; j < MAX_PIXELS*(i+1) && j < diffPixels.length; j++) {
            jsonObject.seg.i.push(diffPixels[j].id);

            if (diffPixels[j].alpha === 0) {
                jsonObject.seg.i.push("000000");
            }else {
                jsonObject.seg.i.push(diffPixels[j].red.toString(16).padStart(2, '0') + diffPixels[j].green.toString(16).padStart(2, '0') + diffPixels[j].blue.toString(16).padStart(2, '0'));
            }
        }

        frameFragments.push(JSON.stringify(jsonObject));
    }

    return frameFragments.join(';');
}

function getBestFrameMethode(pixelsPre: Pixel[], pixels: Pixel[]): string {
    const diffFrames = pixelsToFrameDiff(pixelsPre, pixels);
    const allFrames = pixelsToFrameAll(pixels);

    return diffFrames.length < allFrames.length ? diffFrames : allFrames;
}

export { router };