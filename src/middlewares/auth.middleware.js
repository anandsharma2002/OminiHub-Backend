const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
    let token;

    try {
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1];
        }
        // else if (req.cookies.token) {
        //   token = req.cookies.token;
        // }

        // Make sure token exists
        if (!token) {
            return res.status(401).json({ status: 'fail', message: 'Not authorized to access this route' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log(decoded);

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ status: 'fail', message: 'The user belonging to this token no longer does exist.' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ status: 'fail', message: 'Not authorized to access this route' });
    }
};

// Grant access to specific roles
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'fail',
                message: 'User role is not authorized to access this route'
            });
        }
        next();
    };
};
