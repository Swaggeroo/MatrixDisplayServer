import express from "express";
import fs from "fs";
import config from "config";
import path from 'path';

import {isConnected} from "../services/dbConnector";
import {Picture} from "../models/picture";

const router = express.Router();
const debugManagement = require('debug')('app:management');

const IMAGE_DIR: string = config.get('imageDir');
const BASE_URL: string = config.get('baseUrl');

router.get('/', (req, res) => {
    //get all uuids
    const files = fs.readdirSync(IMAGE_DIR);
    let uuids = files.map(file => {
        return file.split('.')[0];
    });

    debugManagement('Files listed: ' + uuids);
    res.send(uuids);
});

router.get('/picture/:uuid', async (req, res) => {
    if (!isConnected()) {
        return res.status(500).send('Database connection is not established.');
    }

    const uuid = req.params.uuid;

    let picture = await Picture.findOne({uuid: uuid});

    if (!picture) {
        debugManagement('Picture not found: ' + uuid);
        return res.status(404).send('The image with the given UUID was not found.');
    }

    debugManagement('Picture sent: ' + uuid);
    res.send({url: BASE_URL + "pictures/" + picture.uuid + ".png", name: picture.name});
});

router.delete('/picture/:uuid', async (req, res) => {
    if (!isConnected()) {
        return res.status(500).send('Database connection is not established.');
    }

    const uuid = req.params.uuid;
    const file = path.resolve(`${IMAGE_DIR}/${uuid}.png`);

    let picture = await Picture.findOneAndDelete({uuid: uuid});
    if (!picture) {
        debugManagement('Picture not found: ' + uuid);
        return res.status(404).send('The image with the given UUID was not found.');
    }

    if (!fs.existsSync(file)) {
        debugManagement('File not found: ' + uuid);
        return res.status(500).send('The image file was not found.');
    }

    fs.unlinkSync(file);
    debugManagement('File deleted: ' + uuid);
    res.send('The image was deleted.');
});

router.get('/random', (req, res) => {
    //get all uuids
    const files = fs.readdirSync(IMAGE_DIR);
    let uuids = files.map(file => {
        return file.split('.')[0];
    });

    const randomIndex = Math.floor(Math.random() * uuids.length);

    res.send(uuids[randomIndex]);
});


module.exports = router;
