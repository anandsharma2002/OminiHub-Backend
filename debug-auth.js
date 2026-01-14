const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:5000/api';

const runDebug = async () => {
    const timestamp = Date.now();
    const newUser = {
        firstName: 'Debug',
        lastName: 'User',
        username: `debug_${timestamp}`,
        email: `debug_${timestamp}@test.com`,
        password: 'password123'
    };

    try {
        console.log(`[1] Attempting Signup for ${newUser.username} at ${BASE_URL}/auth/signup...`);
        const signupRes = await axios.post(`${BASE_URL}/auth/signup`, newUser);
        console.log('✅ Signup Success:', signupRes.status);

        console.log(`[2] Attempting Login for ${newUser.email}...`);
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: newUser.email,
            password: newUser.password
        });
        console.log('✅ Login Success:', loginRes.status);
        console.log('Token received:', !!loginRes.data.token);

        console.log('[3] Attempting Login with WRONG password...');
        try {
            await axios.post(`${BASE_URL}/auth/login`, {
                email: newUser.email,
                password: 'wrongpassword'
            });
            console.log('❌ Login with wrong password SHOULD have failed but succeeded.');
        } catch (err) {
            console.log('✅ Login with wrong password failed as expected:', err.response?.status);
        }

    } catch (error) {
        console.error('❌ Debug Failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('❗ Connection Refused! The server is NOT running or not listening on port 5000.');
        }
        if (error.response) {
            console.error('Response:', error.response.status, JSON.stringify(error.response.data));
        }
    }
};

runDebug();
