const axios = require('axios');

const API_URL = 'http://localhost:5000/api/auth';

const testAuth = async () => {
    try {
        // 1. Signup
        console.log('--- Testing Signup ---');
        const signupData = {
            username: `testuser_${Date.now()}`,
            email: `test${Date.now()}@example.com`,
            password: 'mystrongpassword',
            role: 'User'
        };

        let token;
        try {
            const signupRes = await axios.post(`${API_URL}/signup`, signupData);
            console.log('Signup Success:', signupRes.data.status);
            token = signupRes.data.token;
            console.log('Token Received');
        } catch (err) {
            console.error('Signup Failed:', err.response ? err.response.data : err.message);
            return;
        }

        // 2. Login
        console.log('\n--- Testing Login ---');
        try {
            const loginRes = await axios.post(`${API_URL}/login`, {
                email: signupData.email,
                password: signupData.password
            });
            console.log('Login Success:', loginRes.data.status);
            if (loginRes.data.token !== token) {
                console.log('Note: New token generated on login');
                token = loginRes.data.token;
            }
        } catch (err) {
            console.error('Login Failed:', err.response ? err.response.data : err.message);
        }

        // 3. Protected Route (Get Me)
        console.log('\n--- Testing Protected Route (/me) ---');
        try {
            const meRes = await axios.get(`${API_URL}/me`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            console.log('Get Me Success:', meRes.data.status);
            console.log('User ID:', meRes.data.data.user._id);
            console.log('Role:', meRes.data.data.user.role);
        } catch (err) {
            console.error('Get Me Failed:', err.response ? err.response.data : err.message);
        }

    } catch (err) {
        console.error('Unexpected Error:', err.message);
    }
};

testAuth();
