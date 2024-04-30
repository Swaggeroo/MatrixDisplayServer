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
            if (file.mimetype !== 'image/png') {  // Check the MIME type
                let err = 'Invalid file type. Only PNG files are allowed.';
                reject(err);
                return;
            }

            let uuid = uuidv4();
            file.mv(UPLOAD_DIR + uuid + "_" + file.name.split(".")[0] + ".png", function (err) {
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

    processImages().then(() => {
        debugUpload('Images processing started.');
    });
});

async function processImages(): Promise<void>{
    fs.readdir(UPLOAD_DIR, async (err, files) => {
        if (err) {
            debugUpload('Error reading directory: ' + err);
            return;
        }

        let imageFiles = files.filter(file => file.endsWith('.png'));

        files.filter(file => !file.endsWith('.png')).forEach(file => {
            fs.unlinkSync(UPLOAD_DIR+file);
        });

        for (let i = 0; i < imageFiles.length; i++) {
            let file = imageFiles[i];
            let uuid = file.split('_')[0];
            let name = file.split('_').slice(1).join("_").split('.')[0];

            try {
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
                    name: name
                });

                await picture.save();

                //delete original file
                fs.unlinkSync(UPLOAD_DIR + file);

                debugUpload('File processed: ' + uuid + ' - ' + name);
            } catch (err) {
                debugUpload('Error processing file: ' + uuid + ' - ' + err);
            }
        }
    });
}

export { router };