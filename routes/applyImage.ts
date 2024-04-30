import express from "express";
import config from "config";
import {isConnected} from "../services/dbConnector";
import {Picture} from "../models/picture";
const router = express.Router();
const debugApplyImage = require('debug')('app:applyImage');

const WLED_URL: string = config.get('wledUrl');
const BRIGHTNESS: number = 20;

router.post('/apply/:uuid', async (req, res) => {
    if (!isConnected()) {
        return res.status(500).send('Database connection is not established.');
    }

    const uuid = req.params.uuid;
    let brightness: number = Number(req.query.brightness);

    if (isNaN(brightness)) {
        brightness = BRIGHTNESS;
    }else {
        if (brightness < 15) {
            brightness = 15;
        }

        if (brightness > 255) {
            brightness = 255;
        }
    }

    let picture = await Picture.findOne({uuid: uuid}).select('frames');

    if (!picture) {
        return res.status(404).send('The image was not found.');
    }

    let requests: Promise<Response>[] = [];

    let frames = picture.frames;
    if (frames.length === 1) {
        frames[0].split(';').forEach((frame) => {
            frame = frame.replace("\"?\"", brightness.toString());
            requests.push(sendToWLED(frame));
        });

        Promise.all(requests).then(() => {
            debugApplyImage('Image applied: ' + uuid);
            res.send('The image was applied.');
        }).catch(error => {
            debugApplyImage('Failed to apply image: ' + uuid + ' - ' + error);
            res.status(500).send('Failed to apply the image.');
        });
    }else{
        debugApplyImage('Animated images are not supported yet.');
    }

 });

async function sendToWLED(jsonString: string) {
    return fetch(WLED_URL + '/json/state', {
        method: 'POST',
        body: jsonString,
        headers: {'Content-Type': 'application/json'}
    });
}

export { router };