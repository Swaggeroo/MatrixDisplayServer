import express from "express";
import {v4 as uuidv4} from "uuid";
import sharp from 'sharp';
import fs from 'fs';
import config from "config";
import {isConnected} from "../services/dbConnector";
import {Picture} from "../models/picture";

const router = express.Router();
const debugUpload = require('debug')('app:upload');


const HEIGHT: number = config.get('height');
const WIDTH: number = config.get('width');
const UPLOAD_DIR: string = config.get('uploadDir');
const DEST_DIR: string = config.get('imageDir');
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

        //TODO advanced processing issue #4

        if (!isConnected()) {
            debugUpload('Database connection is not established.');
            return;
        }

        const picture = new Picture({
            uuid: uuid,
            name: name,
            animated: false
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

    //const frames = await gifFrames({ url: UPLOAD_DIR + file, frames: 'all', outputType: 'png', cumulative: true });
    await sharp(UPLOAD_DIR + file, { animated: true })
        .resize(WIDTH, HEIGHT)
        .gif()
        .toFile(DEST_DIR + uuid + ".gif");

    const picture = new Picture({
        uuid: uuid,
        name: name,
        animated: true
    });

    await picture.save();

    //delete original file
    await fs.unlinkSync(UPLOAD_DIR + file);

    debugUpload('GIF processing finished: ' + uuid + ' - ' + name);
}

export { router };