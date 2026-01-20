const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['follow_request', 'follow_accepted', 'project_invite', 'project_invite_response'],
        required: true
    },
    message: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    link: {
        type: String // Optional link to redirect
    },
    metadata: {
        type: Object // Flexible storage for related IDs
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId
        // Can reference FollowRequest or any future entity
    }
}, {
    timestamps: true
});

// Index for fetching a user's notifications quickly
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
