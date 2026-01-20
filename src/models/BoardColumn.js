const mongoose = require('mongoose');

const boardColumnSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    order: {
        type: Number,
        default: 0, // Order of the column on the board
    },
    isDefault: {
        type: Boolean,
        default: false, // Start, Closed columns might be default
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('BoardColumn', boardColumnSchema);
