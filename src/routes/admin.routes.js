const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const adminController = require('../controllers/admin.controller');

// Protect all routes
router.use(protect);
router.use(restrictTo('SuperAdmin'));

router.get('/stats', adminController.getDashboardStats);

module.exports = router;
