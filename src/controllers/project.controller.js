const Project = require('../models/Project');
const User = require('../models/User');
const Notification = require('../models/Notification');
const BoardColumn = require('../models/BoardColumn');
const Ticket = require('../models/Ticket');
const Task = require('../models/Task');
const { emitToUser } = require('../socket/socket');

// Calculate Project Progress Helper
const calculateProjectProgress = async (projectId) => {
    // 1. Get Columns and calculate weights
    const columns = await BoardColumn.find({ project: projectId }).sort({ order: 1 });
    let columnWeights = {};
    if (columns.length > 1) {
        const step = 100 / (columns.length - 1);
        columns.forEach((col, index) => {
            columnWeights[col._id.toString()] = index * step;
        });
    } else if (columns.length === 1) {
        columnWeights[columns[0]._id.toString()] = 0;
    }

    // 2. Get All Tasks and Tickets
    const tasks = await Task.find({ project: projectId });
    const tickets = await Ticket.find({ project: projectId });
    const ticketMap = new Map();
    tickets.forEach(t => ticketMap.set(t.task.toString(), t));

    // 3. Build Parent Map to check for children
    const parentMap = new Set();
    tasks.forEach(t => {
        if (t.parentTask) parentMap.add(t.parentTask.toString());
    });

    let totalProgressSum = 0;
    let totalCount = 0;
    let completedCount = 0;
    let pendingCount = 0;

    for (const task of tasks) {
        let isCountable = false;

        // Condition 1: It is a Ticket
        if (task.isTicket) {
            isCountable = true;
        }
        // Condition 2: It is a Task (non-ticket)
        else if (task.type === 'Task') {
            isCountable = true;
        }
        // Condition 3: Heading/Sub-Heading with NO children
        else if ((task.type === 'Heading' || task.type === 'Sub-Heading') && !parentMap.has(task._id.toString())) {
            isCountable = true;
        }

        if (isCountable) {
            totalCount++;
            let p = 0;

            if (task.isTicket && ticketMap.has(task._id.toString())) {
                const ticket = ticketMap.get(task._id.toString());
                const colId = ticket.column.toString();
                p = columnWeights[colId] !== undefined ? columnWeights[colId] : 0;
            } else {
                // Fallback for non-board items
                if (task.status === 'Done') p = 100;
                else if (task.status === 'In Progress') p = 50;
                else p = 0;
            }
            totalProgressSum += p;
            if (p >= 100) completedCount++; // >= 100 just in case
            else pendingCount++;
        }
    }

    return {
        progress: totalCount > 0 ? Math.round(totalProgressSum / totalCount) : 0,
        total: totalCount,
        completed: completedCount,
        pending: pendingCount
    };
};

// Get Projects Progress Summary
exports.getProjectsProgress = async (req, res) => {
    try {
        const projects = await Project.find({
            $or: [
                { owner: req.user._id },
                { 'contributors.user': req.user._id, 'contributors.status': 'Accepted' }
            ]
        }).populate('owner', 'username email').sort({ updatedAt: -1 });

        const progressData = await Promise.all(projects.map(async (project) => {
            const stats = await calculateProjectProgress(project._id);
            return {
                ...project.toObject(),
                progress: stats.progress,
                stats
            };
        }));

        res.send(progressData);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Get Single Project Progress
exports.getProjectProgress = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findById(id).select('name description projectType owner contributors');

        if (!project) return res.status(404).send({ message: 'Project not found' });

        // Simple access check (optional depending on UX, but usually dashboard lists accessible designs)
        // If they called this, they likely have it in their list or it's public? 
        // Strict check:
        const isOwner = project.owner.toString() === req.user._id.toString();
        const isContributor = project.contributors.some(c => c.user.toString() === req.user._id.toString() && c.status === 'Accepted');

        if (!isOwner && !isContributor) return res.status(403).send({ message: 'Access denied' });

        const stats = await calculateProjectProgress(id);

        res.send({
            ...project.toObject(),
            progress: stats.progress,
            stats
        });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};



// Create a new project
exports.createProject = async (req, res) => {
    try {
        const { name, description, githubRepo } = req.body;
        const project = new Project({
            name,
            description,
            githubRepo,
            owner: req.user._id,
        });
        await project.save();
        res.status(201).send(project);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
};

// Get all projects for the user (owned + contributed)
exports.getProjects = async (req, res) => {
    try {
        const projects = await Project.find({
            $or: [
                { owner: req.user._id },
                { 'contributors.user': req.user._id, 'contributors.status': 'Accepted' }
            ]
        }).populate('owner', 'username email').sort({ updatedAt: -1 });
        res.send(projects);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Get a single project details
exports.getProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('owner', 'username email')
            .populate('contributors.user', 'username email');

        if (!project) {
            return res.status(404).send({ message: 'Project not found' });
        }

        // Check access
        const isOwner = project.owner._id.toString() === req.user._id.toString();
        const isContributor = project.contributors.some(c => c.user._id.toString() === req.user._id.toString() && c.status === 'Accepted');

        if (!isOwner && !isContributor) {
            return res.status(403).send({ message: 'Access denied' });
        }

        res.send(project);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Invite a user to the project
exports.inviteUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const project = await Project.findById(req.params.id);

        if (!project) return res.status(404).send({ message: 'Project not found' });
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).send({ message: 'Only owner can invite' });
        }

        // Check if already invited or member
        const existing = project.contributors.find(c => c.user.toString() === userId);
        if (existing) {
            if (existing.status === 'Pending') return res.status(400).send({ message: 'User already invited' });
            if (existing.status === 'Accepted') return res.status(400).send({ message: 'User already a contributor' });
        }

        project.contributors.push({ user: userId, status: 'Pending' });
        await project.save();

        // Create Notification
        const notification = await Notification.create({
            recipient: userId,
            sender: req.user._id,
            type: 'project_invite',
            message: `You have been invited to join project: ${project.name}`,
            link: `/projects/${project._id}`,
            metadata: {
                projectId: project._id,
                projectName: project.name
            }
        });

        // Emit Socket Event for Notification
        await notification.populate('sender', 'username profile firstName lastName');
        emitToUser(userId, 'new_notification', notification);

        // Emit Project Update to Owner (to see Pending status immediately) and Invitee
        emitToUser(project.owner, 'project_updated', { projectId: project._id });
        emitToUser(userId, 'project_updated', { projectId: project._id });

        res.send(project);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Accept or Reject invitation
exports.respondToInvitation = async (req, res) => {
    try {
        const { projectId, status } = req.body; // status: 'Accepted' or 'Ignored'
        if (!['Accepted', 'Ignored'].includes(status)) {
            return res.status(400).send({ message: 'Invalid status' });
        }

        const project = await Project.findById(projectId);
        if (!project) return res.status(404).send({ message: 'Project not found' });

        const contributorIndex = project.contributors.findIndex(c => c.user.toString() === req.user._id.toString());

        if (contributorIndex === -1) {
            return res.status(404).send({ message: 'Invitation not found' });
        }

        if (status === 'Ignored') {
            project.contributors.splice(contributorIndex, 1);
        } else {
            project.contributors[contributorIndex].status = status;
        }

        await project.save();

        // Notify Project Owner about response
        const notification = await Notification.create({
            recipient: project.owner,
            sender: req.user._id,
            type: 'project_invite_response', // Changed to avoid showing buttons
            message: `${req.user.username} ${status.toLowerCase()} the invitation to ${project.name}`,
            link: `/projects/${project._id}`,
            isRead: false
        });
        await notification.populate('sender', 'username profile firstName lastName');
        emitToUser(project.owner, 'new_notification', notification);

        // Emit socket update to project room or specific users so UI updates in real-time
        // Assuming there is a room for project or we notify owner directly
        // Better: emit 'project_updated' to the project room if we had one joined
        // For now, let's emit to owner and the user responding
        emitToUser(project.owner, 'project_updated', { projectId: project._id });
        emitToUser(req.user._id, 'project_updated', { projectId: project._id });

        res.send({ message: `Invitation ${status.toLowerCase()}` });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Remove Contributor
exports.removeContributor = async (req, res) => {
    try {
        const { projectId, userId } = req.body;
        const project = await Project.findById(projectId);

        if (!project) return res.status(404).send({ message: 'Project not found' });

        // Only owner can remove
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).send({ message: 'Only owner can remove contributors' });
        }

        project.contributors = project.contributors.filter(c => c.user.toString() !== userId);
        await project.save();

        // Notify removed user
        emitToUser(userId, 'project_updated', { projectId: project._id, action: 'removed' });
        emitToUser(req.user._id, 'project_updated', { projectId: project._id });

        res.send({ message: 'Contributor removed' });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Get pending invitations for user
exports.getInvitations = async (req, res) => {
    try {
        const projects = await Project.find({
            'contributors.user': req.user._id,
            'contributors.status': 'Pending'
        }).populate('owner', 'username');
        res.send(projects);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Update Project (Owner Only)
exports.updateProject = async (req, res) => {
    try {
        const { name, description, githubRepo, isPublic, projectType, hostedUrl, image } = req.body;
        const project = await Project.findById(req.params.id);

        if (!project) return res.status(404).send({ message: 'Project not found' });

        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).send({ message: 'Only owner can update project' });
        }

        project.name = name || project.name;
        project.description = description !== undefined ? description : project.description;
        project.githubRepo = githubRepo !== undefined ? githubRepo : project.githubRepo;
        project.isPublic = isPublic !== undefined ? isPublic : project.isPublic;
        project.projectType = projectType || project.projectType;
        project.hostedUrl = hostedUrl || project.hostedUrl;
        project.image = image || project.image;

        await project.save();
        res.send(project);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
};

// Delete Project (Owner Only)
exports.deleteProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) return res.status(404).send({ message: 'Project not found' });

        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).send({ message: 'Only owner can delete project' });
        }

        await Project.findByIdAndDelete(req.params.id);

        res.send({ message: 'Project deleted successfully' });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};
