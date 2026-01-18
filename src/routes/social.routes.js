const express = require('express');
const router = express.Router();
const socialController = require('../controllers/social.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect); // All routes require authentication

router.post('/follow/:id', socialController.sendFollowRequest);
router.post('/request/:id/respond', socialController.respondToFollowRequest);

router.get('/followers/:id', socialController.getFollowers);
router.get('/following/:id', socialController.getFollowing);
router.get('/status/:id', socialController.getFollowStatus);

// Unfollow
router.post('/follow/:id/unfollow', socialController.unfollowUser);

// Remove follower
router.post('/followers/:id/remove', socialController.removeFollower);


module.exports = router;
