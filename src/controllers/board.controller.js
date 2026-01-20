const BoardColumn = require('../models/BoardColumn');
const Ticket = require('../models/Ticket');
const Task = require('../models/Task');

// Get Board (Columns + Tickets)
exports.getBoard = async (req, res) => {
    try {
        const { projectId } = req.params;

        // Get columns
        const columns = await BoardColumn.find({ project: projectId }).sort({ order: 1 });

        // Define default columns if none exist
        if (columns.length === 0) {
            const defaultCols = [
                { project: projectId, name: 'Start', order: 0, isDefault: true },
                { project: projectId, name: 'In Progress', order: 1 },
                { project: projectId, name: 'Closed', order: 2, isDefault: true }
            ];
            const createdCols = await BoardColumn.insertMany(defaultCols);
            columns.push(...createdCols);
        }

        // Get tickets
        const tickets = await Ticket.find({ project: projectId })
            .populate({
                path: 'task',
                select: 'title description assignedTo deadline priority status'
            })
            .populate('assignee', 'username avatar');

        res.send({ columns, tickets });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Create Column
exports.createColumn = async (req, res) => {
    try {
        const { projectId, name } = req.body;
        // Find max order
        const lastCol = await BoardColumn.findOne({ project: projectId }).sort({ order: -1 });
        const order = lastCol ? lastCol.order + 1 : 0;

        const column = new BoardColumn({ project: projectId, name, order });
        await column.save();
        res.status(201).send(column);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
};

// Convert Task to Ticket (or create new ticket from scratch)
exports.createTicket = async (req, res) => {
    try {
        const { taskId, projectId, columnId } = req.body;

        let task = await Task.findById(taskId);
        if (!task) return res.status(404).send({ message: 'Task not found' });

        if (task.isTicket) return res.status(400).send({ message: 'Task is already a ticket' });

        // Default to first column if not specified
        let colId = columnId;
        if (!colId) {
            let firstCol = await BoardColumn.findOne({ project: projectId }).sort({ order: 1 });

            // If no columns exist, create defaults
            if (!firstCol) {
                const defaultCols = [
                    { project: projectId, name: 'Start', order: 0, isDefault: true },
                    { project: projectId, name: 'In Progress', order: 1 },
                    { project: projectId, name: 'Closed', order: 2, isDefault: true }
                ];
                const createdCols = await BoardColumn.insertMany(defaultCols);
                firstCol = createdCols.find(c => c.order === 0) || createdCols[0];
            }

            colId = firstCol._id;
        }

        const ticket = new Ticket({
            task: taskId,
            project: projectId,
            column: colId,
            assignee: task.assignedTo,
            deadline: task.deadline,
            priority: task.priority
        });

        await ticket.save();

        // Update task
        task.isTicket = true;
        task.ticket = ticket._id;
        await task.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('task_updated', task);
        }

        res.status(201).send(ticket);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
};

// Move Ticket (Drag & Drop)
exports.moveTicket = async (req, res) => {
    try {
        const { ticketId, newColumnId, newOrder } = req.body;

        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return res.status(404).send({ message: 'Ticket not found' });

        ticket.column = newColumnId;
        ticket.order = newOrder; // Need to handle re-ordering logic for other tickets in same column ideally

        await ticket.save();
        res.send(ticket);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
};

// Delete Ticket (Remove from Board)
exports.deleteTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findByIdAndDelete(req.params.ticketId);
        if (!ticket) return res.status(404).send({ message: 'Ticket not found' });

        // Update task
        if (ticket.task) {
            await Task.findByIdAndUpdate(ticket.task, { isTicket: false, ticket: null });

            // Emit task update so task list sees it's no longer a ticket
            const task = await Task.findById(ticket.task);
            const io = req.app.get('io');
            if (io) {
                io.emit('task_updated', task);
                io.emit('ticket_deleted', { ticketId: ticket._id, projectId: ticket.project });
            }
        } else {
            const io = req.app.get('io');
            if (io) io.emit('ticket_deleted', { ticketId: ticket._id, projectId: ticket.project });
        }

        res.send({ message: 'Ticket deleted' });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Delete Column
exports.deleteColumn = async (req, res) => {
    try {
        const { columnId } = req.params;
        const column = await BoardColumn.findByIdAndDelete(columnId);
        if (!column) return res.status(404).send({ message: 'Column not found' });

        await Ticket.deleteMany({ column: columnId });

        res.send({ message: 'Column deleted' });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Move Column (Reorder)
exports.moveColumn = async (req, res) => {
    try {
        const { columnId, newOrder } = req.body;
        const column = await BoardColumn.findById(columnId);
        if (!column) return res.status(404).send({ message: 'Column not found' });

        const projectId = column.project;

        // Bulk update other columns to maintain order
        if (newOrder > column.order) {
            // Moving down: shift items between old and new order UP by 1 (actually wait, logic check)
            // If dragging from index 0 to 2:
            // 0 (target) -> 2
            // 1 -> 0 (-1)
            // 2 -> 1 (-1)
            await BoardColumn.updateMany(
                { project: projectId, order: { $gt: column.order, $lte: newOrder } },
                { $inc: { order: -1 } }
            );
        } else if (newOrder < column.order) {
            // Moving up: shift items between new and old order DOWN by 1
            await BoardColumn.updateMany(
                { project: projectId, order: { $gte: newOrder, $lt: column.order } },
                { $inc: { order: 1 } }
            );
        }

        column.order = newOrder;
        await column.save();

        res.send(column);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};
