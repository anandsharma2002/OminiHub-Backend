const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { emitToRoom, emitToUser } = require('../socket/socket');

// @desc    Get all conversations for current user
// @route   GET /api/chat/conversations
// @access  Private
exports.getConversations = async (req, res, next) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id
        })
            .populate('participants', 'username firstName lastName profile.image')
            .sort({ 'lastMessage.createdAt': -1 });

        res.status(200).json({
            status: 'success',
            data: { conversations }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get messages for a conversation
// @route   GET /api/chat/:conversationId/messages
// @access  Private
exports.getMessages = async (req, res, next) => {
    try {
        const { conversationId } = req.params;

        // Check if user is participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        if (!conversation.participants.includes(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const messages = await Message.find({ conversationId })
            .sort({ createdAt: 1 }); // Oldest first for chat history

        res.status(200).json({
            status: 'success',
            data: { messages }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Send a message
// @route   POST /api/chat/message
// @access  Private
exports.sendMessage = async (req, res, next) => {
    try {
        const { recipientId, text, conversationId } = req.body;
        let chatId = conversationId;

        // 1. Validate Recipient
        if (!recipientId && !chatId) {
            return res.status(400).json({ message: 'Recipient or Conversation ID required' });
        }

        // 2. Find or Create Conversation
        if (!chatId) {
            // Check Access Control: Must follow each other (A follows B OR B follows A)
            // Actually request says: "User A can only send message ... if user A is following user B or if user B is following usre A"
            // So: Directional check.

            const currentUser = await User.findById(req.user._id);
            const recipientUser = await User.findById(recipientId);

            if (!recipientUser) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Check following status
            const isAFollowingB = currentUser.following.includes(recipientId);
            const isBFollowingA = recipientUser.following.includes(req.user._id);

            if (!isAFollowingB && !isBFollowingA) {
                return res.status(403).json({ message: 'You must follow the user or they must follow you to message.' });
            }

            // Try to find existing conversation
            const existingConv = await Conversation.findOne({
                participants: { $all: [req.user._id, recipientId], $size: 2 }
            });

            if (existingConv) {
                chatId = existingConv._id;
            } else {
                // Create new
                const newConv = await Conversation.create({
                    participants: [req.user._id, recipientId],
                    unreadCounts: {
                        [req.user._id]: 0,
                        [recipientId]: 0 // Will increment below
                    }
                });
                chatId = newConv._id;
            }
        }

        // 3. Create Message
        const message = await Message.create({
            conversationId: chatId,
            sender: req.user._id,
            text,
            seenBy: [req.user._id] // Sender has seen it
        });

        // 4. Update Conversation (Last Message + Unread Count)
        const conversation = await Conversation.findById(chatId);

        // Identify recipient (the other participant)
        const recipient = conversation.participants.find(p => p.toString() !== req.user._id.toString());

        // Increment recipient's unread count
        const currentUnread = conversation.unreadCounts.get(recipient.toString()) || 0;
        conversation.unreadCounts.set(recipient.toString(), currentUnread + 1);

        conversation.lastMessage = {
            text,
            sender: req.user._id,
            createdAt: message.createdAt,
            seenBy: [req.user._id]
        };

        await conversation.save();

        // 5. Real-time Emission
        // To Recipient: New Message & Badge Update
        // We emit to recipient's ROOM (their userId)
        emitToUser(recipient, 'new_message', {
            message,
            conversationId: chatId,
            senderId: req.user._id
        });

        // Also emit notification_update for badge count
        emitToUser(recipient, 'notification_update', {
            type: 'chat',
            count: currentUnread + 1 // New total for this conversation? 
            // Better to emit event telling them to increment total unread?
            // Or easier: User fetches total on load, and we just say "ping"
        });

        // To Sender: Confirm sent (optimistic UI might handle this, but good for sync)
        // If sender has multiple tabs open
        emitToUser(req.user._id, 'new_message', {
            message,
            conversationId: chatId
        });

        // Populate the conversation to return it
        await conversation.populate('participants', 'username firstName lastName profile.image');

        res.status(201).json({
            status: 'success',
            data: { 
                message, 
                conversationId: chatId,
                conversation // Return full object
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark messages as seen
// @route   PUT /api/chat/:conversationId/seen
// @access  Private
exports.markSeen = async (req, res, next) => {
    try {
        const { conversationId } = req.params;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: 'Not found' });

        // Update all messages in this conversation where seenBy DOES NOT include me
        await Message.updateMany(
            { conversationId, seenBy: { $ne: req.user._id } },
            { $addToSet: { seenBy: req.user._id } }
        );

        // Reset Unread Count for me
        conversation.unreadCounts.set(req.user._id.toString(), 0);

        // Update lastMessage seenBy if applicable
        if (conversation.lastMessage && !conversation.lastMessage.seenBy.includes(req.user._id)) {
            conversation.lastMessage.seenBy.push(req.user._id);
        }

        await conversation.save();

        // Emit 'message_seen' event to the OTHER participant(s)
        const otherParticipants = conversation.participants.filter(p => p.toString() !== req.user._id.toString());
        otherParticipants.forEach(p => {
            emitToUser(p, 'message_seen', {
                conversationId,
                seenByUserId: req.user._id
            });
        });

        res.status(200).json({ status: 'success' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get total count of conversations with unread messages
// @route   GET /api/chat/unread-count
// @access  Private
exports.getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user._id.toString();
        // Count conversations where 'unreadCounts.{userId}' > 0
        const count = await Conversation.countDocuments({
            [`unreadCounts.${userId}`]: { $gt: 0 }
        });

        res.status(200).json({
            status: 'success',
            data: { count }
        });
    } catch (error) {
        next(error);
    }
};
