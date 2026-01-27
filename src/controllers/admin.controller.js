const User = require('../models/User');
const Project = require('../models/Project');
const Documentation = require('../models/Documentation');
const { getActiveUserCount } = require('../socket/socket');

// @desc    Get Admin Dashboard Statistics
// @route   GET /api/admin/stats
// @access  Private (SuperAdmin)
exports.getDashboardStats = async (req, res, next) => {
    try {
        const [userCount, projectCount, docCount] = await Promise.all([
            User.countDocuments(),
            Project.countDocuments(),
            Documentation.countDocuments()
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                totalUsers: userCount,
                totalProjects: projectCount,
                totalDocuments: docCount,
                activeUsers: getActiveUserCount()
            }
        });
    } catch (error) {
        next(error);
    }
};
