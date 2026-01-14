const mongoose = require('mongoose');

const documentationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a document name'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    privacy: {
        type: String,
        enum: ['public', 'private'],
        default: 'private',
    },
    filePath: {
        type: String,
        required: true, // Supabase storage path
    },
    fileType: {
        type: String,
    },
    fileSize: {
        type: Number, // in bytes
    },
    downloadUrl: {
        type: String,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Documentation', documentationSchema);
