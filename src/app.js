const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const testRoutes = require('./routes/test.routes');
const authRoutes = require('./routes/auth.routes');
const docRoutes = require('./routes/doc.routes');
const userRoutes = require('./routes/user.routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: ['https://anandsharma2002.github.io', 'http://localhost:5173'],
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api', testRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/users', userRoutes);

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
