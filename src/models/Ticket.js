const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
        unique: true, // One task corresponds to one ticket on the board
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    column: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BoardColumn',
        required: true,
    },
    assignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    deadline: {
        type: Date,
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium',
    },
    ticketId: {
        type: String,
        unique: true,
        required: true,
        default: () => Math.floor(100000 + Math.random() * 900000).toString()
    },
    order: {
        type: Number,
        default: 0, // For drag and drop ordering within the column
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Ticket', ticketSchema);
