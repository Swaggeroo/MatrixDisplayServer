import express from "express";
import fs from "fs";
import config from "config";
import path from "path";
import { PNG } from 'pngjs';
const router = express.Router();
const debugApplyImage = require('debug')('app:applyImage');

const IMAGE_DIR: string = config.get('imageDir');
const WLED_URL: string = config.get('wledUrl');
const HEIGHT: number = config.get('height');
const WIDTH: number = config.get('width');

router.post('/apply/:uuid', (req, res) => {
    const uuid = req.params.uuid;
    const file = path.resolve(`${IMAGE_DIR}/${uuid}.png`);

    if (!fs.existsSync(file)) {
        return res.status(404).send('The image with the given UUID was not found.');
    }

    // Read the image file into a Buffer
    const imageData = fs.readFileSync(file);

    //TODO
    let jsonString = '{"seg":{"i":[]}}';
    let jsonObject = JSON.parse(jsonString);

    // Parse the image buffer
    const png = PNG.sync.read(imageData);

    // Get the pixels
    const pixels = [];
    for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
            const idx = (png.width * y + x) << 2;
            const pixel = {
                red: png.data[idx],
                green: png.data[idx + 1],
                blue: png.data[idx + 2],
                alpha: png.data[idx + 3]
            };
            pixels.push(pixel);
        }
    }

    jsonObject.seg.i = pixels.map(pixel => {
        if (pixel.alpha === 0) {
            return "#000000";
        }else {
            return "#" + pixel.red.toString(16).padStart(2, '0') + pixel.green.toString(16).padStart(2, '0') + pixel.blue.toString(16).padStart(2, '0');
        }
    })

    // Send the JSON object to the WLED device
    fetch(WLED_URL + '/json/state', {
        method: 'POST',
        body: JSON.stringify(jsonObject),
        headers: {'Content-Type': 'application/json'}
    }).then(r => {
        if (r.ok) {
            debugApplyImage('Image applied: ' + uuid);
            res.send('The image was applied.');
        } else {
            debugApplyImage('Failed to apply image: ' + uuid + ' - ' + r.statusText);
            res.status(500).send('Failed to apply the image.');
        }
    }).catch(error => {
        debugApplyImage('Failed to apply image: ' + uuid + ' - ' + error);
        res.status(500).send('Failed to apply the image.');
    })

 });

module.exports = router;