const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io; // Hold the io instance

// Map to store userId -> [socketId]
// A user might have multiple tabs open, so we map to an array or Set
const userSockets = new Map();

const initializeSocket = (socketIoInstance) => {
    io = socketIoInstance;

    io.use(async (socket, next) => {
        // Authentication Middleware for Socket
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            
            if (!token) {
                return next(new Error('Authentication error: Token required'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');

            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            // Attach user to socket
            socket.user = user;
            next();
        } catch (error) {
            console.error("Socket Auth Error:", error.message);
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}, User: ${socket.user.username}`);

        const userId = socket.user._id.toString();

        // Add to userSockets map
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);

        // Join a room named after the userId for easy emitting
        socket.join(userId);

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            if (userSockets.has(userId)) {
                userSockets.get(userId).delete(socket.id);
                if (userSockets.get(userId).size === 0) {
                    userSockets.delete(userId);
                }
            }
        });
    });
};

// Helper function to emit event to specific user
const emitToUser = (userId, event, data) => {
    if (!io) return;
    // We can simply emit to the room named userId
    io.to(userId.toString()).emit(event, data);
};

module.exports = {
    initializeSocket,
    emitToUser
};
