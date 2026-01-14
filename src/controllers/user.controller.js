const User = require('../models/User');

// @desc    Search users by username or email
// @route   GET /api/users/search
// @access  Private
exports.searchUsers = async (req, res, next) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ status: 'fail', message: 'Please provide a search query' });
        }

        // Case-insensitive search for username or email
        // Exclude the current user from results (optional, but good UX)
        // Adjust regex to match either username OR email OR starting of firstName/lastName
        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
                { firstName: { $regex: query, $options: 'i' } },
                { lastName: { $regex: query, $options: 'i' } }
            ]
        })
            .select('firstName lastName username email role profile') // Exclude password and other sensitive fields
            .limit(10);

        res.status(200).json({
            status: 'success',
            results: users.length,
            data: {
                users
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get user profile by ID
// @route   GET /api/users/:id/profile
// @access  Private
exports.getUserProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id)
            .select('firstName lastName username email role profile createdAt projects'); // Select public fields

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        res.status(200).json({
            status: 'success',
            data: {
                user
            }
        });
    } catch (error) {
        next(error);
    }
};
