const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// Protect all routes
router.use(protect);

router.get('/stats', dashboardController.getDashboardStats);
router.get('/projects', dashboardController.getDashboardProjects);
router.get('/tasks', dashboardController.getDashboardTasks);
router.get('/activity', dashboardController.getDashboardActivity);

module.exports = router;
