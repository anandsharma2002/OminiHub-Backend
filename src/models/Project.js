const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a project name'],
        trim: true,
    },
    image: {
        type: String, // URL from Supabase
    },
    githubRepo: {
        type: String,
    },
    hostedUrl: {
        type: String,
    },
    description: {
        type: String,
    },
    projectType: {
        type: String, // e.g., 'Web App', 'Mobile App'
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    contributors: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        role: {
            type: String,
            enum: ['Admin', 'Editor', 'Viewer'],
            default: 'Editor',
        },
        status: {
            type: String,
            enum: ['Pending', 'Accepted', 'Ignored'],
            default: 'Pending',
        },
        permissions: [String] // Optional: granular permissions
    }],
    githubRepo: {
        type: String, // Full repo name e.g., "owner/repo"
    },
    tasks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
    }],
    isPublic: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Project', projectSchema);
