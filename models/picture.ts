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
    },
    animated: {
        type: Boolean,
        required: true
    },
    frameCount: {
        type: Number,
        required: true,
        default: 0
    },
    data: {
        type: [String],
        required: true
    }
});

const Picture = mongoose.model('Picture', pictureSchema);

export { Picture };