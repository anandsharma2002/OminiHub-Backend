const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const testRoutes = require('./routes/test.routes');
const authRoutes = require('./routes/auth.routes');
const docRoutes = require('./routes/doc.routes');
const userRoutes = require('./routes/user.routes');
const githubRoutes = require('./routes/github.routes');
const socialRoutes = require('./routes/social.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: true, // Allow any origin in dev
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api', testRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/users', userRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 Handler
app.use((req, res, next) => {
    res.status(404).json({ status: 'fail', message: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
    });
});

module.exports = app;
