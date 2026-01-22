const User = require('../models/User');
const FollowRequest = require('../models/FollowRequest');
const Notification = require('../models/Notification');
const { emitToUser, emitToRoom } = require('../socket/socket');

// @desc    Send a follow request
// @route   POST /api/social/follow/:id
// @access  Private
exports.sendFollowRequest = async (req, res, next) => {
    try {
        const recipientId = req.params.id;
        const requesterId = req.user.id;

        if (recipientId === requesterId) {
            return res.status(400).json({ status: 'fail', message: 'You cannot follow yourself' });
        }

        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        // Check if already following (Robust String comparison)
        const isAlreadyFollowing = recipient.followers.some(id => id.toString() === requesterId);
        if (isAlreadyFollowing) {
            return res.status(400).json({ status: 'fail', message: 'You are already following this user' });
        }

        // Check for ANY existing request (pending, accepted, rejected)
        const existingRequest = await FollowRequest.findOne({
            requester: requesterId,
            recipient: recipientId
        });

        if (existingRequest) {
            if (existingRequest.status === 'pending') {
                return res.status(400).json({ status: 'fail', message: 'Follow request already pending' });
            } else {
                // If status is 'accepted' or 'rejected', delete it to allow new request
                await FollowRequest.findByIdAndDelete(existingRequest._id);
            }
        }

        // Create Request
        const newRequest = await FollowRequest.create({
            requester: requesterId,
            recipient: recipientId
        });

        // Create Notification
        const notification = await Notification.create({
            recipient: recipientId,
            sender: requesterId,
            type: 'follow_request',
            message: `${req.user.username} sent you a follow request`,
            relatedId: newRequest._id
        });

        // Real-time Notification
        emitToUser(recipientId, 'new_notification', notification);

        // Real-time Follow Update (to update buttons immediately if they are online)
        emitToUser(recipientId, 'follow_update', { userId: requesterId });

        // Broadcast to profile viewers
        emitToRoom(`profile_${recipientId}`, 'follow_update', { userId: recipientId });
        emitToRoom(`profile_${requesterId}`, 'follow_update', { userId: requesterId });

        res.status(200).json({
            status: 'success',
            message: 'Follow request sent successfully'
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Unfollow a user
// @route   POST /api/social/follow/:id/unfollow
// @access  Private
exports.unfollowUser = async (req, res, next) => {
    try {
        const recipientId = req.params.id;
        const requesterId = req.user.id;

        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        const requester = await User.findById(requesterId);

        // Remove from recipient's followers
        recipient.followers.pull(requesterId);
        await recipient.save();

        // Remove from requester's following
        requester.following.pull(recipientId);
        await requester.save();

        // Optional: Remove pending request if any
        await FollowRequest.findOneAndDelete({
            requester: requesterId,
            recipient: recipientId
        });

        // Emit updates
        emitToUser(recipientId, 'follow_update', { userId: requesterId });
        emitToUser(requesterId, 'follow_update', { userId: recipientId });

        // Broadcast to profile viewers
        emitToRoom(`profile_${recipientId}`, 'follow_update', { userId: recipientId });
        emitToRoom(`profile_${requesterId}`, 'follow_update', { userId: requesterId });

        res.status(200).json({
            status: 'success',
            message: 'Unfollowed successfully'
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Remove a follower
// @route   POST /api/social/followers/:id/remove
// @access  Private
exports.removeFollower = async (req, res, next) => {
    try {
        const followerId = req.params.id;
        const currentUserId = req.user.id;

        const follower = await User.findById(followerId);
        if (!follower) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        const currentUser = await User.findById(currentUserId);

        // Remove follower from current user's followers list
        currentUser.followers.pull(followerId);
        await currentUser.save();

        // Remove current user from follower's following list
        follower.following.pull(currentUserId);
        await follower.save();

        // CRITICAL: Delete the associated FollowRequest so they can request again
        await FollowRequest.findOneAndDelete({
            requester: followerId,
            recipient: currentUserId
        });

        // Emit updates to the removed follower
        emitToUser(followerId, 'follow_update', { userId: currentUserId });

        // Broadcast to profile viewers
        emitToRoom(`profile_${currentUserId}`, 'follow_update', { userId: currentUserId });
        emitToRoom(`profile_${followerId}`, 'follow_update', { userId: followerId });

        res.status(200).json({
            status: 'success',
            message: 'Follower removed successfully'
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Respond to follow request (Accept/Reject)
// @route   POST /api/social/request/:id/respond
// @access  Private
exports.respondToFollowRequest = async (req, res, next) => {
    try {
        const requestId = req.params.id;
        const { status } = req.body; // 'accepted' or 'rejected'
        const userId = req.user.id;

        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ status: 'fail', message: 'Invalid status' });
        }

        const request = await FollowRequest.findById(requestId).populate('requester');

        if (!request) {
            return res.status(404).json({ status: 'fail', message: 'Request not found' });
        }

        // Check availability
        if (request.recipient.toString() !== userId) {
            return res.status(403).json({ status: 'fail', message: 'Not authorized to respond to this request' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ status: 'fail', message: 'Request already processed' });
        }

        request.status = status;
        await request.save();

        if (status === 'accepted') {
            // Update Followers/Following lists
            const requester = await User.findById(request.requester._id);
            const recipient = await User.findById(userId);

            // Add requester to recipient's followers
            recipient.followers.push(requester._id);
            await recipient.save();

            // Add recipient to requester's following
            requester.following.push(recipient._id);
            await requester.save();

            // Create Notification for Requester
            const notification = await Notification.create({
                recipient: requester._id,
                sender: userId,
                type: 'follow_accepted',
                message: `${recipient.username} accepted your follow request`,
                relatedId: request._id
            });

            // Emit to Requester
            emitToUser(requester._id, 'new_notification', notification);
            emitToUser(requester._id, 'follow_update', { userId: userId });

            // Broadcast to profile viewers (Requester and Recipient)
            emitToRoom(`profile_${userId}`, 'follow_update', { userId: userId });
            emitToRoom(`profile_${requester._id}`, 'follow_update', { userId: requester._id });
        }

        // Emit to Recipient (current user) to update their list/counts
        emitToUser(userId, 'follow_update', { userId: request.requester._id });

        res.status(200).json({
            status: 'success',
            message: `Follow request ${status}`
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Get Followers
// @route   GET /api/social/followers/:id
// @access  Private
exports.getFollowers = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).populate('followers', 'username firstName lastName profile');

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        res.status(200).json({
            status: 'success',
            count: user.followers.length,
            data: user.followers
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Following
// @route   GET /api/social/following/:id
// @access  Private
exports.getFollowing = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).populate('following', 'username firstName lastName profile');

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        res.status(200).json({
            status: 'success',
            count: user.following.length,
            data: user.following
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Follow Status (Check if I am following or requested user)
// @route   GET /api/social/status/:id
// @access  Private
exports.getFollowStatus = async (req, res, next) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.user.id;

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        const isFollowing = targetUser.followers.includes(currentUserId);

        let hasPendingRequest = false;
        if (!isFollowing) {
            const pendingRequest = await FollowRequest.findOne({
                requester: currentUserId,
                recipient: targetUserId,
                status: 'pending'
            });
            if (pendingRequest) hasPendingRequest = true;
        }

        res.status(200).json({
            status: 'success',
            data: {
                isFollowing,
                hasPendingRequest
            }
        });

    } catch (error) {
        next(error);
    }
};
