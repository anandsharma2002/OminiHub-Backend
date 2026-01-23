const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { chat } = require('../controllers/ai.controller');

router.post('/chat', protect, chat);

module.exports = router;
