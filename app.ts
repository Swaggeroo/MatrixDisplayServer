// libs/middleware
const debugStartup = require('debug')('app:startup');
const debugUnknownRoute = require('debug')('app:unknownRoute');
const morgan = require('morgan');
import express, {response} from 'express';
import helmet from "helmet";
import fileUpload from "express-fileupload";
import fs from "fs";
import config from "config";
const cors = require('cors');

//routes
const fileProcessing = require('./routes/fileProcessing');
const fileManagement = require('./routes/fileManagement');
const applyImage = require('./routes/applyImage');

//models
//const {Game} = require("./models/game");

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

//read config
debugStartup(config.get('name'));

//connect to database
//let db = mongoose.connection;
//global.connected = false

//reconnect on disconnect
//db.on('disconnected', function() {
//    debugDB('MongoDB connection error! - Retry in 15 seconds');
//    global.connected = false;
//    setTimeout(connect, 15000);
//});

//close connection on exit
//process.on('SIGINT', function() {
//    db.close(function () {
//        debugDB('Force to close the MongoDB connection');
//        global.connected = false;
//        process.exit(0);
//    });
//});

//connect to db
//connect();

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


//function connect(){
//    const user = process.env.mongoUser;
//    const password = process.env.mongoPassword;
//    const url = process.env.mongoUrl;
//
//    if (!url) {
//        debugStartup('FATAL ERROR: mongoUrl is not defined.');
//        process.exit(1);
//    }
//
//    debugDB("Trying to connect to MongoDB with "+ user +" - "+password)
//    mongoose.connect(url, {
//        "authSource": "admin",
//        "user": user,
//        "pass": password,
//        "useNewUrlParser": true,
//        "useUnifiedTopology": true
//    })
//        .then(() => {debugDB('Connected to MongoDB('+url+')...'); global.connected = true})
//        .catch(err => {debugDB('Could not connect to MongoDB(' + url + ')...', err); global.connected = false});
//}