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
let currentBrightness: number = BRIGHTNESS;
let currentSpeed: number = SPEED;

router.post('/apply/:uuid', async (req, res) => {
    if (!isConnected()) {
        return res.status(500).send('Database connection is not established.');
    }

    if (applyingImage){
        return res.status(400).send('Another image is currently being applied.');
    }
    applyingImage = true;

    const uuid = req.params.uuid;

    let picture = await Picture.findOne({uuid: uuid}).select('data animated');

    if (!picture) {
        applyingImage = false;
        return res.status(404).send('The image was not found.');
    }

    if (picture.animated){
        await sendAnimationToMatrix(picture.data, res);
    }else{
        await sendPictureToMatrix(picture.data[0], res);
    }

    applyingImage = false;
    debugApplyImage('The image was applied.');
 });

router.post('/setBrightness', async (req, res) => {
    let brightness: number = Number(req.query.brightness);

    if (isNaN(brightness)) {
        return res.status(400).send('Brightness is not a number.');
    }

    if (brightness < MIN_BRIGHTNESS) {
        brightness = MIN_BRIGHTNESS;
    }else if (brightness > MAX_BRIGHTNESS) {
        brightness = MAX_BRIGHTNESS;
    }

    try {
        await sendBrightnessToMatrix(brightness);
    }catch (err){
        debugApplyImage('Error sending brightness to matrix: ' + err);
        return res.status(500).send('Error sending brightness to matrix.');
    }

    currentBrightness = brightness;

    res.send('Brightness set to ' + brightness);
});

router.post('/setSpeed', async (req, res) => {
    let speed: number = Number(req.query.speed);

    if (isNaN(speed)) {
        return res.status(400).send('Speed is not a number.');
    }

    if (speed < MIN_SPEED) {
        speed = MIN_SPEED;
    }else if (speed > MAX_SPEED) {
        speed = MAX_SPEED;
    }

    try {
        await sendSpeedToMatrix(speed);
    }catch (err){
        debugApplyImage('Error sending speed to matrix: ' + err);
        return res.status(500).send('Error sending speed to matrix.');
    }

    currentSpeed = speed;

    res.send('Speed set to ' + speed);
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
        res.write('Error sending data to matrix.');
        res.status(500);
        res.end();
        return;
    }


    res.write('1 of 1');
    res.end();
}

async function sendAnimationToMatrix(body: string[], res: any){
    try {
        for (let i = 0; i < body.length; i++){
            body[i] = body[i].replace('-1', currentSpeed.toString());
            res.write(i + ' of ' + body.length + '\n');
            await fetch(MATRIX_URL + '/setAnimationFragment', {
                method: 'POST',
                body: body[i],
                headers: {'Content-Type': 'application/json'}
            });
        }
    }catch (err){
        debugApplyImage('Error sending data to matrix: ' + err);
        res.write('Error sending data to matrix.');
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

async function sendSpeedToMatrix(speed: number){
    let body = "{\"frameDelay\":" + speed + "}";
    await fetch(MATRIX_URL + '/setSpeed', {
        method: 'POST',
        body: body,
        headers: {'Content-Type': 'application/json'}
    });
}

export { router };