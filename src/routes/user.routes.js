const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');

// Search users (Private)
router.get('/search', protect, userController.searchUsers);

// Get user profile (Private - requires login to view others)
router.get('/:id/profile', protect, userController.getUserProfile);

module.exports = router;
