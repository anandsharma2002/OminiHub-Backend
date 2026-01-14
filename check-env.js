require('dotenv').config();

const required = [
    'MONGO_URI',
    'JWT_SECRET',
    'JWT_EXPIRE',
    'COOKIE_EXPIRE',
    'SUPABASE_URL',
    'SUPABASE_KEY'
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
    console.error('Missing ENV variables:', missing.join(', '));
    process.exit(1);
} else {
    console.log('All required ENV variables are present.');
    console.log('JWT_EXPIRE:', process.env.JWT_EXPIRE);
    console.log('COOKIE_EXPIRE:', process.env.COOKIE_EXPIRE);
    process.exit(0);
}
