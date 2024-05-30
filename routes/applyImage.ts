import express from "express";
import config from "config";
import {isConnected} from "../services/dbConnector";
import {Picture} from "../models/picture";
const router = express.Router();
const debugApplyImage = require('debug')('app:applyImage');

const MATRIX_URL: string = config.get('matrixUrl');

const BRIGHTNESS: number = 20;
const MIN_BRIGHTNESS: number = 1;
const MAX_BRIGHTNESS: number = 255;
const SPEED: number = 500;
const MIN_SPEED: number = 0;
const MAX_SPEED: number = 60000;

let backgroundAnimationFrames: string[] = [];
let backgroundAnimationIntervalTime: number = 250;
let backgroundAnimationInterval: NodeJS.Timeout;
let backgroundAnimationStep: number = 0;

router.post('/apply/:uuid', async (req, res) => {
    if (!isConnected()) {
        return res.status(500).send('Database connection is not established.');
    }

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
        speed = 500;
    }else {
        if (speed < MIN_SPEED) {
            speed = MIN_SPEED;
        }else if (speed > MAX_SPEED) {
            speed = MAX_SPEED;
        }
    }

    backgroundAnimationIntervalTime = speed;


    let picture = await Picture.findOne({uuid: uuid}).select('data animated');

    if (!picture) {
        return res.status(404).send('The image was not found.');
    }

    await sendBrightnessToMatrix(brightness);

    try{
        if (picture.animated){
            await sendAnimationToMatrix(picture.data, speed);
        }else{
            await sendPictureToMatrix(picture.data[0]);
        }
    } catch (err){
        debugApplyImage('Error sending data to matrix: ' + err);
        return res.status(500).send('Error sending data to matrix.');
    }

    debugApplyImage('The image was applied.');
    res.send('The image was applied.');

 });

async function sendPictureToMatrix(body: string){
    await fetch(MATRIX_URL + '/setPicture', {
        method: 'POST',
        body: body,
        headers: {'Content-Type': 'application/json'}
    });
}

async function sendAnimationToMatrix(body: string[], speed: number){
    for (let i = 0; i < body.length; i++){
        body[i] = body[i].replace('-1', speed.toString());
        await fetch(MATRIX_URL + '/setAnimationFragment', {
            method: 'POST',
            body: body[i],
            headers: {'Content-Type': 'application/json'}
        });
    }
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