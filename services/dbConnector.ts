const mongoose = require('mongoose').default;
const debugDB = require('debug')('app:db');

let db = mongoose.connection;
let connected = false;

//reconnect on disconnect
db.on('disconnected', function() {
    debugDB('MongoDB connection error! - Retry in 15 seconds');
    connected = false;
    setTimeout(connect, 15000);
});

//close connection on exit
process.on('SIGINT', function() {
    db.close(function () {
        debugDB('Force to close the MongoDB connection');
        connected = false;
        process.exit(0);
    });
});

function connect(){
    const user = process.env.MONGO_USER;
    const password = process.env.MONGO_PASS;
    const url = process.env.MONGO_URL;

    if (!url) {
        debugDB('FATAL ERROR: mongoUrl is not defined.');
        process.exit(1);
    }

    if (!user || !password) {
        debugDB('Info: No user or password provided. Trying to connect without authentication.');
    }

    debugDB("Trying to connect to MongoDB with "+ user + " at " + url);
    mongoose.connect(url, {
        "authSource": "admin",
        "user": user,
        "pass": password
    })
        .then(() => {debugDB('Connected to MongoDB('+url+')...'); connected = true})
        .catch((err: unknown) => {debugDB('Could not connect to MongoDB(' + url + ')...', err); connected = false});
}

function isConnected(){
    return connected;
}

export { connect, isConnected}