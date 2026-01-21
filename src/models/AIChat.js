const mongoose = require('mongoose');

const AIChatSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        default: 'New Chat'
    },
    history: [
        {
            role: {
                type: String,
                enum: ['user', 'model'],
                required: true
            },
            parts: [{ text: String }]
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('AIChat', AIChatSchema);
