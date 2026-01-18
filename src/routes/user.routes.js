const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

// Search users (Private)
router.get('/search', protect, userController.searchUsers);

// Get user profile (Private - requires login to view others)
router.get('/:id/profile', protect, userController.getUserProfile);

// Update user profile (Private)
router.put('/profile', protect, upload.single('profileImage'), userController.updateUserProfile);

module.exports = router;
