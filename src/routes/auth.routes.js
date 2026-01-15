const express = require('express');
const { signup, login, getMe, verifyEmail, forgotPassword, resetPassword, changePassword } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword', resetPassword);
router.put('/changepassword', protect, changePassword);
router.get('/me', protect, getMe);

module.exports = router;
