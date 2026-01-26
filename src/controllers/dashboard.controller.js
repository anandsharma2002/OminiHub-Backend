const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const Documentation = require('../models/Documentation');
const catchAsync = require('../utils/catchAsync');

exports.getDashboardStats = catchAsync(async (req, res, next) => {
    const userId = req.user.id;

    // Execute queries in parallel for performance
    const [projectCount, taskCount, completedTaskCount, docCount, user] = await Promise.all([
        // Active Projects (where user is owner OR contributor)
        Project.countDocuments({
            $or: [
                { owner: userId },
                { 'contributors.user': userId }
            ]
        }),

        // Active Tasks (assigned to user, not Done)
        Task.countDocuments({ assignedTo: userId, status: { $ne: 'Done' } }),

        // Completed Tasks (assigned to user, Done) - for calculation if needed, or total tasks
        Task.countDocuments({ assignedTo: userId, status: 'Done' }),

        // My Documents
        Documentation.countDocuments({ user: userId }),

        // User details for streak
        User.findById(userId).select('streaks')
    ]);

    // Calculate task completion rate
    const totalTasks = taskCount + completedTaskCount;
    const completionRate = totalTasks > 0 ? Math.round((completedTaskCount / totalTasks) * 100) : 0;

    res.status(200).json({
        status: 'success',
        data: {
            activeProjects: projectCount,
            pendingTasks: taskCount,
            completionRate,
            totalDocs: docCount,
            streak: user.streaks.current || 0,
            maxStreak: user.streaks.highest || 0
        }
    });
});

exports.getDashboardProjects = catchAsync(async (req, res, next) => {
    const userId = req.user.id;

    const projects = await Project.find({
        $or: [
            { owner: userId },
            { 'contributors.user': userId }
        ]
    })
        .sort({ updatedAt: -1 })
        .limit(3)
        .select('name status color updatedAt');

    res.status(200).json({
        status: 'success',
        results: projects.length,
        data: projects
    });
});

exports.getDashboardTasks = catchAsync(async (req, res, next) => {
    const userId = req.user.id;

    const tasks = await Task.find({
        assignedTo: userId,
        status: { $ne: 'Done' }
    })
        .sort({ priority: -1, deadline: 1 }) // High priority first, then earliest deadline
        .limit(5)
        .populate('project', 'name color')
        .select('title priority deadline status project');

    res.status(200).json({
        status: 'success',
        results: tasks.length,
        data: tasks
    });
});

exports.getDashboardActivity = catchAsync(async (req, res, next) => {
    // This is a placeholder for activity feed. 
    // In a real app, you might have an 'Activity' model.
    // For now, we can return empty or simple recent actions if we had an Activity Log.
    // We will return recent modified docs as a proxy for "Activity" for now.

    const userId = req.user.id;
    const recentDocs = await Documentation.find({ user: userId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('name fileType updatedAt');

    res.status(200).json({
        status: 'success',
        data: recentDocs
    });
});
