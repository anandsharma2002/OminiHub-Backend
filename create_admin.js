require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const existingAdmin = await User.findOne({ email: 'admin@omnihub.com' });
        if (existingAdmin) {
            console.log('Admin already exists');
            return;
        }

        const adminUser = await User.create({
            username: 'superadmin',
            email: 'admin@omnihub.com',
            password: 'password123',
            role: 'SuperAdmin',
            firstName: 'Super',
            lastName: 'Admin',
            profile: {
                bio: 'The architect of OmniHub',
            },
        });

        console.log('Admin user created successfully');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

createAdmin();
