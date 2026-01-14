const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

const runTest = async () => {
    try {
        console.log('--- Testing Signup ---');
        const uniqueId = Date.now();
        const newUser = {
            username: `user_${uniqueId}`,
            email: `user_${uniqueId}@test.com`,
            password: 'password123',
            firstName: 'Test',
            lastName: 'User'
        };

        let res = await axios.post(`${BASE_URL}/auth/signup`, newUser);
        console.log('Signup Status:', res.status);
        console.log('User Created:', res.data.data.user.username);
        const token = res.data.token;

        console.log('\n--- Testing Search ---');
        const searchQuery = 'test';
        res = await axios.get(`${BASE_URL}/users/search?query=${searchQuery}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Search Status:', res.status);
        console.log('Found Users:', res.data.results);
        const searchedUser = res.data.data.users[0];
        console.log('First Result:', searchedUser.firstName, searchedUser.lastName);

        console.log('\n--- Testing Get Profile ---');
        res = await axios.get(`${BASE_URL}/users/${searchedUser._id}/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Profile Status:', res.status);
        console.log('Profile Data Found:', res.data.data.user.username);

    } catch (error) {
        console.error('Test Failed:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data));
        } else if (error.request) {
            console.error('No response received. Server might be down or not reachable.');
        } else {
            console.error('Error setup:', error.message);
        }
    }
};

runTest();
