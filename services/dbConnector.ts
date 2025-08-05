const mongoose = require('mongoose').default;
const debugDB = require('debug')('app:db');

let db = mongoose.connection;
let connected = false;
let connecting = false;

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

async function connect(){
    if (connected || connecting) {
        debugDB('Already connected or connecting to MongoDB. Skipping connect call.');
        return;
    }
    connecting = true;
    const user = process.env.MONGO_USER;
    const password = process.env.MONGO_PASS;
    const url = process.env.MONGO_URL;

    if (!url) {
        debugDB('FATAL ERROR: MONGO_URL is not defined.');
        process.exit(1);
    }

    if (!user || !password) {
        debugDB('Info: No user or password provided. Trying to connect without authentication.');
    }

    // Disconnect if already connected or connecting
    if (mongoose.connection.readyState !== 0) {
        debugDB('Disconnecting existing MongoDB connection before reconnecting...');
        try {
            await mongoose.disconnect();
            debugDB('Successfully disconnected from MongoDB.');
        } catch (err) {
            debugDB('Error disconnecting from MongoDB:', err);
        }
    }

    debugDB("Trying to connect to MongoDB with "+ user + " at " + url);
    mongoose.connect(url, {
        "authSource": "admin",
        "user": user,
        "pass": password
    })
        .then(() => {
            debugDB('Connected to MongoDB('+url+')...');
            connected = true;
            connecting = false;
        })
        .catch((err: unknown) => {
            debugDB('Could not connect to MongoDB(' + url + ')...', err);
            connected = false;
            connecting = false;
        });
}

function isConnected(){
    return connected;
}

export { connect, isConnected}