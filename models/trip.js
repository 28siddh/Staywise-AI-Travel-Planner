const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const tripSchema = new Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    location: String,
    days: Number,
    budget: Number,
    style: String,
    tripData: Object, // This will store the entire AI-generated JSON
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Trip", tripSchema);