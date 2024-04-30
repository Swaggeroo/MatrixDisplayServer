import * as mongoose from "mongoose";

const pictureSchema = new mongoose.Schema({
    uuid: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    }
});

const Picture = mongoose.model('Picture', pictureSchema);

export { Picture };