const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/email');
const crypto = require('crypto');

// Generate JWT Token
const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });
};

// Send Token Response
const sendTokenResponse = (user, statusCode, res) => {
    const token = signToken(user._id);

    const options = {
        expires: new Date(
            Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
    };

    if (process.env.NODE_ENV === 'production') {
        options.secure = true;
    }

    user.password = undefined; // Remove password from output

    res
        .status(statusCode)
        .cookie('token', token, options)
        .json({
            status: 'success',
            token,
            data: {
                user,
            },
        });
};

// @desc    Register a user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res, next) => {
    try {
        const { firstName, lastName, username, email, password, role } = req.body;

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationCodeExpire = Date.now() + 10 * 60 * 1000; // 10 mins

        const user = await User.create({
            firstName,
            lastName,
            username,
            email,
            password,
            role,
            verificationCode,
            verificationCodeExpire,
            isVerified: false
        });

        const message = `
        <h1>Email Verification</h1>
        <p>Your verification code is: <strong>${verificationCode}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        `;

        try {
            await sendEmail({
                email: user.email,
                subject: 'OmniHub Email Verification',
                message,
            });

            res.status(200).json({
                status: 'success',
                message: 'Verification code sent to email',
            });
        } catch (emailError) {
            // Rollback user creation if email fails
            await User.findByIdAndDelete(user._id);
            console.error('Signup Verification Email Failed:', emailError);
            // Return specific error to help user understand (e.g., Sandbox limitation)
            const errorMessage = emailError?.body?.message || emailError.message || JSON.stringify(emailError);
            return next(new Error('Email could not be sent: ' + errorMessage));
        }

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ status: 'fail', message: 'Email or Username already exists' });
        }
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, username, password } = req.body;

        // Support email, username, or generic 'identifier' field
        const identifier = email || username || req.body.identifier;

        // Validate input
        if (!identifier || !password) {
            return res.status(400).json({ status: 'fail', message: 'Please provide email/username and password' });
        }

        const identifierLower = identifier.toLowerCase();
        console.log(`Login attempt for: ${identifierLower}`);

        // Check for user (Email or Username)
        // Check if input looks like an email
        const isEmail = /^\S+@\S+\.\S+$/.test(identifier);

        let query;
        if (isEmail) {
            query = { email: identifierLower };
        } else {
            // Case-insensitive username search
            query = { username: { $regex: new RegExp(`^${identifier}$`, 'i') } };
        }

        const user = await User.findOne(query).select('+password');

        if (!user) {
            console.log('Login failed: User not found');
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials' });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            console.log('Login failed: Password incorrect');
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials' });
        }

        if (!user.isVerified) {
            console.log('Login failed: User not verified');
            return res.status(401).json({ status: 'fail', message: 'Please verify your email to login' });
        }

        // Update Streaks
        const today = new Date();
        const lastLogin = user.streaks.lastActive ? new Date(user.streaks.lastActive) : null;

        if (!lastLogin) {
            // First time login
            user.streaks.current = 1;
        } else {
            const isSameDay = today.toDateString() === lastLogin.toDateString();

            if (!isSameDay) {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const isYesterday = yesterday.toDateString() === lastLogin.toDateString();

                if (isYesterday) {
                    // Consecutive day
                    user.streaks.current += 1;
                } else {
                    // Break in streak
                    user.streaks.current = 1;
                }
            }
            // If same day, do nothing (keep current streak)
        }

        // Update Highest Streak
        if (user.streaks.current > user.streaks.highest) {
            user.streaks.highest = user.streaks.current;
        }

        user.streaks.lastActive = today;
        await user.save({ validateBeforeSave: false });

        console.log(`Login successful. Streak: ${user.streaks.current}, Max: ${user.streaks.highest}`);
        sendTokenResponse(user, 200, res);
    } catch (error) {
        next(error);
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({
            status: 'success',
            data: {
                user,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Verify Email
// @route   POST /api/auth/verify-email
// @access  Public
exports.verifyEmail = async (req, res, next) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ status: 'fail', message: 'Please provide email and code' });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            verificationCode: code,
            verificationCodeExpire: { $gt: Date.now() }
        }).select('+verificationCode +verificationCodeExpire');

        if (!user) {
            return res.status(400).json({ status: 'fail', message: 'Invalid or expired token' });
        }

        user.isVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpire = undefined;
        await user.save();

        sendTokenResponse(user, 200, res);

    } catch (error) {
        next(error);
    }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        console.log(`Forgot Password requested for: ${email}`);

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            console.log('User not found');
            return res.status(404).json({ status: 'fail', message: 'There is no user with that email' });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationCodeExpire = Date.now() + 10 * 60 * 1000; // 10 mins

        user.verificationCode = verificationCode;
        user.verificationCodeExpire = verificationCodeExpire;
        await user.save({ validateBeforeSave: false });
        console.log(`Verification code generated for ${user.email}: ${verificationCode}`);

        const message = `
        <h1>Password Reset</h1>
        <p>Your password reset code is: <strong>${verificationCode}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        `;

        try {
            await sendEmail({
                email: user.email,
                subject: 'OmniHub Password Reset Token',
                message,
            });
            console.log('Email sent successfully');

            res.status(200).json({
                status: 'success',
                message: 'Reset token sent to email',
            });
        } catch (err) {
            console.error('Email send warning:', err);
            user.verificationCode = undefined;
            user.verificationCodeExpire = undefined;
            await user.save({ validateBeforeSave: false });
            return next(new Error('Email could not be sent'));
        }

    } catch (error) {
        console.error('Forgot Password Critical Error:', error);
        next(error);
    }
};

// @desc    Reset Password
// @route   PUT /api/auth/resetpassword
// @access  Public
exports.resetPassword = async (req, res, next) => {
    try {
        const { email, code, password } = req.body;

        const user = await User.findOne({
            email: email.toLowerCase(),
            verificationCode: code,
            verificationCodeExpire: { $gt: Date.now() }
        }).select('+verificationCode +verificationCodeExpire');

        if (!user) {
            return res.status(400).json({ status: 'fail', message: 'Invalid or expired token' });
        }

        user.password = password;
        user.isVerified = true; // Implicitly verify user since they verified email OTP
        user.verificationCode = undefined;
        user.verificationCodeExpire = undefined;
        await user.save({ validateBeforeSave: false }); // Bypass validation for legacy/incomplete users

        console.log(`Password reset successfully for: ${user.email}`);
        sendTokenResponse(user, 200, res);

    } catch (error) {
        console.error('Reset Password Error:', error);
        next(error);
    }
};

// @desc    Change Password
// @route   PUT /api/auth/changepassword
// @access  Private
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user.id).select('+password');

        if (!(await user.matchPassword(currentPassword))) {
            return res.status(401).json({ status: 'fail', message: 'Incorrect current password' });
        }

        user.password = newPassword;
        await user.save();

        sendTokenResponse(user, 200, res);

    } catch (error) {
        next(error);
    }
};
