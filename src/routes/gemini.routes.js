const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware'); // Check exact name of your auth middleware
const geminiController = require('../controllers/gemini.controller');

// All routes protected
router.use(protect);

router.post('/chat', geminiController.chat);
router.get('/history', geminiController.getHistory);
router.delete('/history/:id', geminiController.deleteChat);

module.exports = router;
