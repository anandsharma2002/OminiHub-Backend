const Task = require('../models/Task');
const Project = require('../models/Project');
const Ticket = require('../models/Ticket');
const { emitToRoom } = require('../socket/socket');

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

        // Broadcast to project room
        emitToRoom(`project_${projectId}`, 'task_created', task);

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

                    if (updatedTicket) {
                        emitToRoom(`project_${task.project}`, 'ticket_updated', updatedTicket);
                    }
                } catch (err) {
                    console.error("Ticket sync error:", err);
                }
            }
        }

        emitToRoom(`project_${task.project}`, 'task_updated', task);

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

        // Emit for main task
        emitToRoom(`project_${task.project}`, 'task_deleted', { taskId: task._id, projectId: task.project });

        // Emit for subtasks if any
        subtasks.forEach(sub => {
            emitToRoom(`project_${sub.project}`, 'task_deleted', { taskId: sub._id, projectId: sub.project });
        });

        res.send(task);
    } catch (error) {
        res.status(500).send(error);
    }
};
