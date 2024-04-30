// libs/middleware
const debugStartup = require('debug')('app:startup');
const debugUnknownRoute = require('debug')('app:unknownRoute');
const morgan = require('morgan');
import express from 'express';
import helmet from "helmet";
import fileUpload from "express-fileupload";
import fs from "fs";
import config from "config";
const cors = require('cors');

//services
const { connect } = require('./services/dbConnector');

//routes
const fileProcessing = require('./routes/fileProcessing');
const fileManagement = require('./routes/fileManagement');
const applyImage = require('./routes/applyImage');
const integrity = require('./routes/integrity');

const app = express();

//default middleware
app.use(fileUpload())
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(helmet());
app.use(cors());

//create uploads folder
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

//create images folder
const imagesDir = './images';
if (!fs.existsSync(imagesDir)){
    fs.mkdirSync(imagesDir);
}

//routes
app.use('/api', fileProcessing);
app.use('/api', fileManagement);
app.use('/api', applyImage);
app.use('/api', integrity);

app.use('/pictures', express.static('images'));

//read config
debugStartup(config.get('name'));

connect();

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