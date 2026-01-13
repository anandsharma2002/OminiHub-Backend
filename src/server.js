require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const supabasePool = require('./config/supabase');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    // Connect to MongoDB
    await connectDB();

    // Supabase connection is pool-based, so it lazy-connects, but we initialized it.

    app.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
};

startServer();
