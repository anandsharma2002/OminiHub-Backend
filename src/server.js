require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const supabasePool = require('./config/supabase');
const { initializeSocket } = require('./socket/socket');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    // Connect to MongoDB
    await connectDB();

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.io
    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:5173", // Allow requests from frontend
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Setup Socket Logic
    initializeSocket(io);

    // Make io accessible to our router
    app.set('io', io);

    // Supabase connection is pool-based, so it lazy-connects, but we initialized it.

    server.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        console.log(`Socket.io initialized`);
    });
};

startServer();
