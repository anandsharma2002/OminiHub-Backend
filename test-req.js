const axios = require('axios');

const testSignup = async () => {
    try {
        console.log('Attempting Signup with KNOWN duplicate/failing data...');
        const res = await axios.post('http://localhost:5000/api/auth/signup', {
            username: 'testuser',
            email: 'test@example.com',
            password: 'password'
        });
        console.log('Signup Success:', res.data);
    } catch (error) {
        console.error('Signup Failed Status:', error.response ? error.response.status : 'No Response');
        console.error('Signup Failed Data:', error.response ? error.response.data : error.message);
    }
};

testSignup();
