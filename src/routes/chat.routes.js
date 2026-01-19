const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middlewares/auth.middleware');

// All routes are protected
router.use(protect);

router.get('/unread-count', chatController.getUnreadCount);
router.get('/conversations', chatController.getConversations);
router.get('/:conversationId/messages', chatController.getMessages);
router.post('/message', chatController.sendMessage);
router.put('/:conversationId/seen', chatController.markSeen);

module.exports = router;
