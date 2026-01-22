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

        const io = req.app.get('io');
        if (io) {
            io.emit('column_created', column);
        }

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
            const populatedTicket = await Ticket.findById(ticket._id).populate('task').populate('assignee');
            io.emit('ticket_created', populatedTicket);
        }

        res.status(201).send(ticket);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
};

// Move Ticket (Drag & Drop)
// Move Ticket (Drag & Drop)
exports.moveTicket = async (req, res) => {
    try {
        const { ticketId, newColumnId, newOrder } = req.body;

        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return res.status(404).send({ message: 'Ticket not found' });

        const oldColumnId = ticket.column.toString();
        const oldOrder = ticket.order;
        const projectId = ticket.project;

        // 1. If moving within the SAME column
        if (oldColumnId === newColumnId) {
            if (newOrder > oldOrder) {
                // Moving down: Decrement order of items in between
                await Ticket.updateMany(
                    { column: newColumnId, order: { $gt: oldOrder, $lte: newOrder } },
                    { $inc: { order: -1 } }
                );
            } else if (newOrder < oldOrder) {
                // Moving up: Increment order of items in between
                await Ticket.updateMany(
                    { column: newColumnId, order: { $gte: newOrder, $lt: oldOrder } },
                    { $inc: { order: 1 } }
                );
            }
            ticket.order = newOrder;
            await ticket.save();
        }
        // 2. Moving to DIFFERENT column
        else {
            // A. Remove from OLD column (Decrement order of items below it)
            await Ticket.updateMany(
                { column: oldColumnId, order: { $gt: oldOrder } },
                { $inc: { order: -1 } }
            );

            // B. Make space in NEW column (Increment order of items at/below insertion point)
            await Ticket.updateMany(
                { column: newColumnId, order: { $gte: newOrder } },
                { $inc: { order: 1 } }
            );

            // C. Move ticket
            ticket.column = newColumnId;
            ticket.order = newOrder;
            await ticket.save();
        }

        const io = req.app.get('io');
        if (io) {
            // Populate (CRITICAL for frontend crash prevention)
            const populatedTicket = await Ticket.findById(ticket._id)
                .populate({
                    path: 'task',
                    select: 'title description assignedTo deadline priority status'
                })
                .populate('assignee', 'username avatar');

            // Emit updated ticket
            io.emit('ticket_updated', populatedTicket);

            // Should properly we emit 'tickets_reordered' or just refresh?
            // Sending 'ticket_updated' for the moved ticket is enough for frontend to put it in place 
            // IF frontend refetches or the socket event includes context.
            // But optimal way: frontend needs to know reordering happened.
            // My frontend listener listens to `ticket_updated`.
            // But that only updates the single ticket.
            // It won't update the neighbors who got their `order` changed!

            // Force refetch might be safer, OR broadcast all affected tickets.
            // Simple approach: Emit 'board_updated' or similar to trigger refetch?
            // Or just emit all tickets for the project?
            // Let's rely on frontend logic which did optimistic update correctly. 
            // BUT if another user is watching, they will see the moved ticket update, but NOT the neighbors shift.
            // So neighbors will have conflicting orders locally until refetch.
            // Better: Emit a special event `tickets_reordered` with projectId.

            // To be safe and instant:
            io.emit('board_refetch_needed', { projectId });
        }

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

        const io = req.app.get('io');
        if (io) {
            io.emit('column_deleted', { columnId, projectId: column.project });
        }

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
            // Moving down
            await BoardColumn.updateMany(
                { project: projectId, order: { $gt: column.order, $lte: newOrder } },
                { $inc: { order: -1 } }
            );
        } else if (newOrder < column.order) {
            // Moving up
            await BoardColumn.updateMany(
                { project: projectId, order: { $gte: newOrder, $lt: column.order } },
                { $inc: { order: 1 } }
            );
        }

        column.order = newOrder;
        await column.save();

        const io = req.app.get('io');
        if (io) {
            // Fetch all columns regarding this project and emit them, or just emit event to refetch
            const allColumns = await BoardColumn.find({ project: projectId }).sort({ order: 1 });
            io.emit('columns_reordered', { projectId, columns: allColumns });
        }

        res.send(column);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};
