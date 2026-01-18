const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;

if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️ Supabase Config Missing: SUPABASE_URL or SUPABASE_KEY not found in .env');
    console.error('👉 ACTION REQUIRED: Go to your Render Dashboard -> Service -> Environment and add SUPABASE_URL and SUPABASE_KEY.');
    // Mock Supabase client to prevent crash
    supabase = {
        storage: {
            from: () => ({
                upload: async () => ({ error: { message: 'Supabase not configured' } }),
                remove: async () => ({ error: { message: 'Supabase not configured' } }),
                createSignedUrl: async () => ({ error: { message: 'Supabase not configured' } })
            })
        }
    };
} else {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
    } catch (error) {
        console.error('⚠️ Supabase Client Init Error:', error.message);
        supabase = {
            storage: {
                from: () => ({
                    upload: async () => ({ error: { message: 'Supabase Client Error' } }),
                    remove: async () => ({ error: { message: 'Supabase Client Error' } }),
                    createSignedUrl: async () => ({ error: { message: 'Supabase Client Error' } })
                })
            }
        };
    }
}

module.exports = supabase;
