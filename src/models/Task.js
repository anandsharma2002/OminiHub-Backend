const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please provide a task title'],
        trim: true,
    },
    description: {
        type: String,
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium',
    },
    status: {
        type: String,
        enum: ['To Do', 'In Progress', 'Done'],
        default: 'To Do',
    },
    deadline: {
        type: Date,
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
    },
    conversation: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        message: String,
        timestamp: { type: Date, default: Date.now }
    }],
    aiSuggestions: {
        type: String, // Stores AI analysis
    },
    // Hierarchy Fields
    parentTask: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        default: null,
    },
    type: {
        type: String,
        enum: ['Heading', 'Sub-Heading', 'Task'],
        default: 'Task',
    },
    // Ticket Board Fields
    isTicket: {
        type: Boolean,
        default: false,
    },
    ticket: { // Link to the Ticket document if it exists
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Task', taskSchema);
