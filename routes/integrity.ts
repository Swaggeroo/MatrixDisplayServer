import express from "express";
import fs from "fs";
import config from "config";
import path from 'path';
const router = express.Router();
const debugIntegrity = require('debug')('app:integrity');

const { isConnected } = require('../services/dbConnector');
const { Picture } = require('../models/picture');

const IMAGE_DIR: string = config.get('imageDir');

router.get('/checkIntegrity', async (req, res) => {
    if (!isConnected()) {
        return res.status(500).send('Database connection is not established.');
    }

    debugIntegrity('Checking integrity...');

    //Missing DB entries
    const uuids = fs.readdirSync(IMAGE_DIR).map(file => {
        return file.split('.')[0];
    });

    let pictures = await Picture.find({uuid: {$in: uuids}});

    let missingDBEntries = uuids.filter(uuid => {
        return !pictures.some((picture: any) => {
            return picture.uuid === uuid;
        });
    });

    for (let i = 0; i < missingDBEntries.length; i++) {
        let file = path.resolve(`${IMAGE_DIR}/${missingDBEntries[i]}.png`);
        fs.unlinkSync(file);
        debugIntegrity('Deleted file: ' + missingDBEntries[i]);
    }

    //Missing files
    pictures = await Picture.find();
    let missingFiles = pictures.filter((picture: any) => {
        return !fs.existsSync(path.resolve(`${IMAGE_DIR}/${picture.uuid}.png`));
    });

    for (let i = 0; i < missingFiles.length; i++) {
        await Picture.findOneAndDelete({uuid: missingFiles[i].uuid});
        debugIntegrity('Deleted DB entry: ' + missingFiles[i].uuid);
    }

    debugIntegrity('Integrity check finished.');
    debugIntegrity('Cleaned: Files: ' + missingDBEntries.length + ' DB entries: ' + missingFiles.length);

    res.send({"status":"Cleaned", missingDBEntries, missingFiles});
});


export {router};