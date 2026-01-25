const Task = require('../models/Task');
const Project = require('../models/Project');
const Ticket = require('../models/Ticket');

// Create a new task (Heading, Sub-Heading, or Task)
exports.createTask = async (req, res) => {
    try {
        const { title, description, project: projectId, parentTask, type, deadline, assignedTo } = req.body;

        const task = new Task({
            title,
            description,
            project: projectId,
            parentTask: parentTask || null,
            type: type || 'Task',
            deadline,
            assignedTo // ObjectId of user
        });

        await task.save();

        const io = req.app.get('io');
        io.emit('task_created', task);

        res.status(201).send(task);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
};

// Get tasks for a project
exports.getProjectTasks = async (req, res) => {
    try {
        const tasks = await Task.find({ project: req.params.projectId })
            .populate('assignedTo', 'username avatar')
            .populate({
                path: 'ticket',
                populate: { path: 'column', select: 'name' }
            })
            .sort({ createdAt: 1 }); // Or sort by order if implementing drag ranking in list

        // Frontend will handle the hierarchy construction
        res.send(tasks);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Update task
exports.updateTask = async (req, res) => {
    try {
        const updates = Object.keys(req.body);
        const allowedUpdates = ['title', 'description', 'status', 'deadline', 'assignedTo', 'priority', 'progress'];
        const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).send({ error: 'Invalid updates!' });
        }

        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).send();

        updates.forEach((update) => task[update] = req.body[update]);
        await task.save();

        // Sync with Ticket
        if (task.isTicket) {
            const ticketUpdates = {};
            if (updates.includes('priority')) ticketUpdates.priority = task.priority;
            if (updates.includes('deadline')) ticketUpdates.deadline = task.deadline;
            if (updates.includes('assignedTo')) ticketUpdates.assignee = task.assignedTo;

            if (Object.keys(ticketUpdates).length > 0) {
                try {
                    const updatedTicket = await Ticket.findOneAndUpdate({ task: task._id }, ticketUpdates, { new: true })
                        .populate('assignee')
                        .populate('task');
                    const io = req.app.get('io');
                    if (io && updatedTicket) {
                        io.emit('ticket_updated', updatedTicket);
                    }
                } catch (err) {
                    console.error("Ticket sync error:", err);
                }
            }
        }

        const io = req.app.get('io');
        io.emit('task_updated', task);

        res.send(task);
    } catch (error) {
        console.error("Update Task Error:", error);
        res.status(400).send(error);
    }
};

// Delete task
exports.deleteTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).send();

        // Find all subtasks
        const subtasks = await Task.find({ parentTask: task._id });
        const taskIdsToDelete = [task._id, ...subtasks.map(t => t._id)];

        // Delete tasks
        await Task.deleteMany({ _id: { $in: taskIdsToDelete } });

        // Delete associated tickets
        await Ticket.deleteMany({ task: { $in: taskIdsToDelete } });

        const io = req.app.get('io');
        // Emit for main task
        io.emit('task_deleted', { taskId: task._id, projectId: task.project });
        // Emit for subtasks if any
        subtasks.forEach(sub => {
            io.emit('task_deleted', { taskId: sub._id, projectId: sub.project });
        });

        // Also emit ticket_deleted just in case board listens to it (or future proofing)
        // We can't easily get deleted ticket IDs without querying first, but typically board will reload or filter out tickets where task is null? 
        // Actually, if we delete the ticket document, the board won't see it on refresh. 
        // Real-time: The board needs to know a ticket is gone. 
        // Let's emit a generic board_update or specific ticket_deleted if we knew the IDs.
        // For now, let's rely on standard refresh or if Board listens to task_deleted?
        // I will add 'board_updated' emission if helpful, but let's stick to cleaning DB first.

        res.send(task);
    } catch (error) {
        res.status(500).send(error);
    }
};
