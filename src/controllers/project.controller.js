const Project = require('../models/Project');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { emitToUser } = require('../socket/socket');

// ... (rest of imports or code)

// ...



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
