// libs/middleware
const debugStartup = require('debug')('app:startup');
const debugUnknownRoute = require('debug')('app:unknownRoute');
const morgan = require('morgan');
import express from 'express';
import helmet from "helmet";
import fileUpload from "express-fileupload";
import fs from "fs";
import config from "config";
import cors from "cors";

//services
import {connect as connectDB} from "./services/dbConnector";

//routes
import {router as fileProcessing} from './routes/fileProcessing';
import {router as fileManagement} from './routes/fileManagement';
import {router as applyImage} from './routes/applyImage';
import {router as integrity} from './routes/integrity';

const app = express();

if (process.env.TRUST_PROXY) app.set('trust proxy', true);

//default middleware
app.use(fileUpload())
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(helmet({crossOriginResourcePolicy: false,}));
app.use(cors());

//create uploads folder
const UPLOAD_DIR = './'+config.get('uploadDir');
if (!fs.existsSync(UPLOAD_DIR)){
    fs.mkdirSync(UPLOAD_DIR);
}

//create images folder
const IMAGES_DIR = './'+config.get('imageDir');
if (!fs.existsSync(IMAGES_DIR)){
    fs.mkdirSync(IMAGES_DIR);
}

//create images folder
const TMP_DIR = './'+config.get('tmpDir');
if (!fs.existsSync(TMP_DIR)){
    fs.mkdirSync(TMP_DIR);
}

//routes
app.use('/api', fileProcessing);
app.use('/api', fileManagement);
app.use('/api', applyImage);
app.use('/api', integrity);

app.use('/pictures', express.static('images'));

//read config
debugStartup(config.get('name'));

connectDB();

//enable logging for not covered routes
if(app.get('env') === 'development'){
    app.use(morgan("tiny",{
        "stream": {
            write: function(str: String) { debugUnknownRoute(str.replace("\n","")); }
        }
    }));
    debugStartup('Morgan enabled...');
}


//start application
const port = process.env.PORT || 3000;
app.listen(port, () => debugStartup(`Listening on port ${port}...`));