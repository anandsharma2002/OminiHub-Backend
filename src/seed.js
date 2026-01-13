require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Project = require('./models/Project');
const Task = require('./models/Task');
const connectDB = require('./config/db');

const seedData = async () => {
    try {
        await connectDB();

        console.log('Cleaning up existing data...');
        await User.deleteMany();
        await Project.deleteMany();
        await Task.deleteMany();

        console.log('Creating Admin User...');
        const adminUser = await User.create({
            username: 'superadmin',
            email: 'admin@omnihub.com',
            password: 'password123',
            role: 'SuperAdmin',
            profile: {
                bio: 'The architect of OmniHub',
            },
        });
        console.log(`User created: ${adminUser.username} (${adminUser._id})`);

        console.log('Creating Sample Project...');
        const sampleProject = await Project.create({
            name: 'OmniHub Backend',
            description: 'The robust backend operational system.',
            owner: adminUser._id,
            projectType: 'Backend',
        });
        console.log(`Project created: ${sampleProject.name} (${sampleProject._id})`);

        console.log('Creating Sample Task...');
        const sampleTask = await Task.create({
            title: 'Initialize Database',
            description: 'Setup schemas and models.',
            priority: 'High',
            project: sampleProject._id,
            assignedTo: adminUser._id,
        });
        console.log(`Task created: ${sampleTask.title}`);

        console.log('Data seeding completed successfully.');
        process.exit();
    } catch (error) {
        console.error(`Error with data seeding: ${error.message}`);
        process.exit(1);
    }
};

seedData();
