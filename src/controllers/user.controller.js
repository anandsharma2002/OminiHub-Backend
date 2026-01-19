const User = require('../models/User');
const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

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
            .select('firstName lastName username email role profile createdAt projects isGithubPublic visibleRepositories followers following'); // Select public fields

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

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        // Update basic fields
        if (req.body.firstName) user.firstName = req.body.firstName;
        if (req.body.lastName) user.lastName = req.body.lastName;
        if (req.body.bio) user.profile.bio = req.body.bio;

        // Update social links
        if (req.body.socialLinks) {
            try {
                // If it's a string (from FormData), parse it
                const links = typeof req.body.socialLinks === 'string'
                    ? JSON.parse(req.body.socialLinks)
                    : req.body.socialLinks;
                user.profile.socialLinks = links;
            } catch (e) {
                console.error('Error parsing socialLinks:', e);
                // Maintain existing links or handle error
            }
        }

        // Handle Image Upload
        if (req.file) {
            const file = req.file;
            const fileExt = file.originalname.split('.').pop();
            const fileName = `${user._id}-${Date.now()}.${fileExt}`;

            // Upload to Supabase
            const { data, error } = await supabase
                .storage
                .from('ProfileImages')
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });

            if (error) {
                console.error('Supabase Upload Error:', error);
                // Continue without updating image or return error?
                // Let's log it and maybe warn user, but try to update other fields.
            } else {
                // Get Public URL
                const { data: { publicUrl } } = supabase
                    .storage
                    .from('ProfileImages')
                    .getPublicUrl(fileName);

                user.profile.image = publicUrl;
            }
        }

        await user.save();

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

const { emitToRoom } = require('../socket/socket');

// ... existing imports ...

// ... existing functions ...

// @desc    Toggle GitHub visibility
// @route   PUT /api/users/github-visibility
// @access  Private
exports.toggleGithubVisibility = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        // Toggle the value
        user.isGithubPublic = !user.isGithubPublic;
        await user.save();

        // Emit socket event to profile room
        emitToRoom('profile_' + user._id, 'github_update', { userId: user._id });

        res.status(200).json({
            status: 'success',
            data: {
                isGithubPublic: user.isGithubPublic
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle Repository Visibility
// @route   PUT /api/users/github-repos
// @access  Private
exports.toggleRepoVisibility = async (req, res, next) => {
    try {
        const { repoId } = req.body; // Expecting repoId (string)

        if (!repoId) {
            return res.status(400).json({ status: 'fail', message: 'Repository ID is required' });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        // Initialize array if undefined
        if (!user.visibleRepositories) {
            user.visibleRepositories = [];
        }

        const index = user.visibleRepositories.indexOf(repoId);

        if (index > -1) {
            // Repo exists, remove it (Toggle OFF)
            user.visibleRepositories.splice(index, 1);
        } else {
            // Repo doesn't exist, add it (Toggle ON)
            user.visibleRepositories.push(repoId);
            // Auto-enable Global Visibility if it was OFF
            if (!user.isGithubPublic) {
                user.isGithubPublic = true;
            }
        }

        await user.save();

        // Emit socket event
        emitToRoom('profile_' + user._id, 'github_update', { userId: user._id });

        res.status(200).json({
            status: 'success',
            data: {
                visibleRepositories: user.visibleRepositories,
                isGithubPublic: user.isGithubPublic
            }
        });
    } catch (error) {
        next(error);
    }
};
