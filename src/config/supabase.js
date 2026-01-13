const { Pool } = require('pg');

let supabasePool;

try {
    if (process.env.SUPABASE_DB_URL) {
        supabasePool = new Pool({
            connectionString: process.env.SUPABASE_DB_URL,
        });

        // Test connection on startup (optional, doing it in test route mostly)
        supabasePool.on('error', (err, client) => {
            console.error('Unexpected error on idle Supabase client', err);
        });
    } else {
        console.warn('SUPABASE_DB_URL not found in environment variables.');
    }
} catch (error) {
    console.error('Supabase Pool Initialization Error:', error);
}

module.exports = supabasePool;
