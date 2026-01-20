const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/', protect, taskController.createTask);
router.get('/project/:projectId', protect, taskController.getProjectTasks);
router.patch('/:id', protect, taskController.updateTask);
router.delete('/:id', protect, taskController.deleteTask);

module.exports = router;
