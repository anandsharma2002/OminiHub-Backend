const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['Task', 'Project', 'System'],
        default: 'System',
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    link: {
        type: String, // URL to redirect
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Notification', notificationSchema);
