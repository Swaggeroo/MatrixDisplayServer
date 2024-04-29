import express from "express";
import fs from "fs";
import config from "config";
import path from 'path';
const router = express.Router();
const debugManagement = require('debug')('app:management');

const IMAGE_DIR: string = config.get('imageDir');

router.get('/', (req, res) => {
    //get all uuids
    const files = fs.readdirSync(IMAGE_DIR);
    let uuids = files.map(file => {
        return file.split('.')[0];
    });

    debugManagement('Files listed: ' + uuids);
    res.send(uuids);
});

router.get('/picture/:uuid', (req, res) => {
    const uuid = req.params.uuid;
    const file = path.resolve(`${IMAGE_DIR}/${uuid}.png`);

    if (!fs.existsSync(file)) {
        return res.status(404).send('The image with the given UUID was not found.');
    }

    debugManagement('File sent: ' + uuid);
    res.sendFile(file);
});

router.delete('/picture/:uuid', (req, res) => {
    const uuid = req.params.uuid;
    const file = path.resolve(`${IMAGE_DIR}/${uuid}.png`);

    if (!fs.existsSync(file)) {
        return res.status(404).send('The image with the given UUID was not found.');
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
