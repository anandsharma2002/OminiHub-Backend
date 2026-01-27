require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const checkAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const admin = await User.findOne({ email: 'admin@omnihub.com' });

        if (admin) {
            console.log('Admin user FOUND:');
            console.log(JSON.stringify(admin, null, 2));
        } else {
            console.log('Admin user NOT FOUND');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

checkAdmin();
