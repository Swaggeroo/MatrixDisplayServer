import express from "express";
import config from "config";
import {isConnected} from "../services/dbConnector";
import {Picture} from "../models/picture";
const router = express.Router();
const debugApplyImage = require('debug')('app:applyImage');

const WLED_URL: string = config.get('wledUrl');
const BRIGHTNESS: number = 20;

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
        if (brightness < 15) {
            brightness = 15;
        }

        if (brightness > 255) {
            brightness = 255;
        }
    }

    if (isNaN(speed)) {
        speed = 500;
    }else {
        if (speed < 250) {
            speed = 250;
        }
    }

    backgroundAnimationIntervalTime = speed;


    let picture = await Picture.findOne({uuid: uuid}).select('frames');

    if (!picture) {
        return res.status(404).send('The image was not found.');
    }

    if (backgroundAnimationInterval) {
        clearInterval(backgroundAnimationInterval);
    }

    let frames = picture.frames;
    if (frames.length === 1) {
        sendToWLED(frames[0], brightness).then(() => {
            debugApplyImage('Image applied: ' + uuid);
            res.send('The image was applied.');
        }).catch(error => {
            debugApplyImage('Failed to apply image: ' + uuid + ' - ' + error);
            res.status(500).send('Failed to apply the image.');
        });
    }else{
        debugApplyImage('Applying animation: ' + uuid);
        backgroundAnimationFrames = frames;
        backgroundAnimationStep = 0;
        backgroundAnimationInterval = setInterval(async () => {
            if(backgroundAnimationStep >= backgroundAnimationFrames.length) {
                backgroundAnimationStep = 0;
            }
            try{
                await sendToWLED(backgroundAnimationFrames[backgroundAnimationStep], brightness);
                backgroundAnimationStep++;
            }catch (error) {
                debugApplyImage('Failed to apply image: ' + uuid + ' - ' + error);
            }
            backgroundAnimationStep++;
        }, backgroundAnimationIntervalTime);
        res.send('The animation is being applied.');
    }

 });

async function sendToWLED(frame: string, brightness: number) {
    let requests: Promise<Response>[] = [];

    frame.split(';').forEach((frame) => {
        frame = frame.replace("\"?\"", brightness.toString());
        requests.push(sendToWLEDFragment(frame));
    });

    await Promise.all(requests);
}

async function sendToWLEDFragment(jsonString: string) {
    return fetch(WLED_URL + '/json/state', {
        method: 'POST',
        body: jsonString,
        headers: {'Content-Type': 'application/json'}
    });
}

export { router };