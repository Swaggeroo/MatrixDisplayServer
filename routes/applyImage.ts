import express from "express";
import config from "config";
import {isConnected} from "../services/dbConnector";
import {Picture} from "../models/picture";
const router = express.Router();
const debugApplyImage = require('debug')('app:applyImage');

const MATRIX_URL: string = process.env.MATRIX_URL ?? config.get('matrixUrl');

const BRIGHTNESS: number = 20;
const MIN_BRIGHTNESS: number = 1;
const MAX_BRIGHTNESS: number = 255;
const SPEED: number = 500;
const MIN_SPEED: number = 0;
const MAX_SPEED: number = 60000;

let applyingImage: boolean = false;

router.post('/apply/:uuid', async (req, res) => {
    if (!isConnected()) {
        return res.status(500).send('Database connection is not established.');
    }

    if (applyingImage){
        return res.status(400).send('Another image is currently being applied.');
    }
    applyingImage = true;

    const uuid = req.params.uuid;
    let brightness: number = Number(req.query.brightness);
    let speed: number = Number(req.query.speed);

    if (isNaN(brightness)) {
        brightness = BRIGHTNESS;
    }else {
        if (brightness < MIN_BRIGHTNESS) {
            brightness = MIN_BRIGHTNESS;
        }else if (brightness > MAX_BRIGHTNESS) {
            brightness = MAX_BRIGHTNESS;
        }
    }

    if (isNaN(speed)) {
        speed = SPEED;
    }else {
        if (speed < MIN_SPEED) {
            speed = MIN_SPEED;
        }else if (speed > MAX_SPEED) {
            speed = MAX_SPEED;
        }
    }


    let picture = await Picture.findOne({uuid: uuid}).select('data animated');

    if (!picture) {
        applyingImage = false;
        return res.status(404).send('The image was not found.');
    }

    await sendBrightnessToMatrix(brightness);

    if (picture.animated){
        await sendAnimationToMatrix(picture.data, speed, res);
    }else{
        await sendPictureToMatrix(picture.data[0], res);
    }

    applyingImage = false;
    debugApplyImage('The image was applied.');
 });

async function sendPictureToMatrix(body: string, res: any){
    res.write('0 of 1\n');
    res.write('0 of 1\n');

    try {
        await fetch(MATRIX_URL + '/setPicture', {
            method: 'POST',
            body: body,
            headers: {'Content-Type': 'application/json'}
        });
    }catch (err){
        debugApplyImage('Error sending data to matrix: ' + err);
        res.write('1 of 1');
        res.status(500);
        res.end();
        return;
    }


    res.write('1 of 1');
    res.end();
}

async function sendAnimationToMatrix(body: string[], speed: number, res: any){
    try {
        for (let i = 0; i < body.length; i++){
            body[i] = body[i].replace('-1', speed.toString());
            res.write(i + ' of ' + body.length + '\n');
            await fetch(MATRIX_URL + '/setAnimationFragment', {
                method: 'POST',
                body: body[i],
                headers: {'Content-Type': 'application/json'}
            });
        }
    }catch (err){
        debugApplyImage('Error sending data to matrix: ' + err);
        res.write(body.length+' of '+body.length);
        res.status(500);
        res.end();
        return;
    }

    res.write(body.length+' of '+body.length);
    res.end();
}

async function sendBrightnessToMatrix(brightness: number){
    let body = "{\"brightness\":" + brightness + "}";
    await fetch(MATRIX_URL + '/setBrightness', {
        method: 'POST',
        body: body,
        headers: {'Content-Type': 'application/json'}
    });
}

export { router };