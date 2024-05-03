import express from "express";
import fs from "fs";
import config from "config";
import path from 'path';
const router = express.Router();
const debugIntegrity = require('debug')('app:integrity');

import {Picture} from '../models/picture';
import {isConnected} from "../services/dbConnector";

const IMAGE_DIR: string = config.get('imageDir');

router.get('/checkIntegrity', async (req, res) => {
    if (!isConnected()) {
        return res.status(500).send('Database connection is not established.');
    }

    debugIntegrity('Checking integrity...');

    const files = fs.readdirSync(IMAGE_DIR);
    //Missing DB entries
    const uuids = files.map(file => {
        return file.split('.')[0];
    });

    let pictures = await Picture.find({uuid: {$in: uuids}});

    let missingDatabaseEntriesUUID = uuids.filter(uuid => {
        return !pictures.some((picture: any) => {
            return picture.uuid === uuid;
        });
    });

    for (let i = 0; i < missingDatabaseEntriesUUID.length; i++) {
        try{
            let uuidPath = files.find((file)=>{
                return file.startsWith(missingDatabaseEntriesUUID[i]);
            });

            let file = path.resolve(`${IMAGE_DIR}${uuidPath!}`);
            fs.unlinkSync(file);
            debugIntegrity('Deleted file: ' + uuidPath);
        }catch (err){
            debugIntegrity('Error deleting file: ' + missingDatabaseEntriesUUID[i] + ' ' + err);
        }
    }

    //Missing files
    await Picture.deleteMany({uuid: {$nin: uuids}});

    debugIntegrity('Integrity check finished.');
    debugIntegrity('Cleaned: Files');

    res.send({"status":"Cleaned"});
});


export {router};