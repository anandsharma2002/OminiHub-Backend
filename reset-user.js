require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const resetUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const email = 'testuser@example.com';
        const username = 'testuser';

        // Delete existing
        await User.deleteOne({ email });
        await User.deleteOne({ username });
        console.log('Deleted existing test user');

        // Create new
        const user = await User.create({
            username,
            email,
            password: 'password', // will be hashed by pre-save hook
            role: 'User'
        });

        console.log('Created fresh test user:', user.email);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

resetUser();
