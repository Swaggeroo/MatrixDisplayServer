import express from "express";
import fs from "fs";
import config from "config";
import path from "path";
import {Pixel, getPixels} from "../utils/imageAnalysis";
const router = express.Router();
const debugApplyImage = require('debug')('app:applyImage');

const IMAGE_DIR: string = config.get('imageDir');
const WLED_URL: string = config.get('wledUrl');
const HEIGHT: number = config.get('height');
const WIDTH: number = config.get('width');
const INCREMENT: number = WIDTH*HEIGHT/4;
const BRIGHTNESS: number = 20;

router.post('/apply/:uuid', (req, res) => {
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

    const file = path.resolve(`${IMAGE_DIR}/${uuid}.png`);

    if (!fs.existsSync(file)) {
        return res.status(404).send('The image with the given UUID was not found.');
    }

    const pixels: Pixel[] = getPixels(file);

    let requests = [];

    for (let i = 0; i < 4; i++) {
        let jsonString = '{"on":true,"bri":'+brightness+',"seg":{"i":[]}}';
        let jsonObject = JSON.parse(jsonString);

        jsonObject.seg.i.push(INCREMENT*i);

        for (let j = INCREMENT*i; j < INCREMENT*(i+1); j++) {
            if (pixels[j].alpha === 0) {
                jsonObject.seg.i.push("000000");
            }else {
                jsonObject.seg.i.push(pixels[j].red.toString(16).padStart(2, '0') + pixels[j].green.toString(16).padStart(2, '0') + pixels[j].blue.toString(16).padStart(2, '0'));
            }
        }

        requests.push(sendToWLED(JSON.stringify(jsonObject)));
    }

    Promise.all(requests).then(() => {
        debugApplyImage('Image applied: ' + uuid);
        res.send('The image was applied.');
    }).catch(error => {
        debugApplyImage('Failed to apply image: ' + uuid + ' - ' + error);
        res.status(500).send('Failed to apply the image.');
    });
 });

async function sendToWLED(jsonString: string) {
    return fetch(WLED_URL + '/json/state', {
        method: 'POST',
        body: jsonString,
        headers: {'Content-Type': 'application/json'}
    });
}

export { router };