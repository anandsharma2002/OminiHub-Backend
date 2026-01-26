const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;

if (!supabaseUrl || (!supabaseKey && !supabaseServiceKey)) {
    console.error('⚠️ Supabase Config Missing: SUPABASE_URL or Keys not found in .env');
    console.error('👉 ACTION REQUIRED: Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_KEY.');
    // Mock Supabase client to prevent crash
    supabase = {
        storage: {
            from: () => ({
                upload: async () => ({ error: { message: 'Supabase not configured' } }),
                remove: async () => ({ error: { message: 'Supabase not configured' } }),
                createSignedUrl: async () => ({ error: { message: 'Supabase not configured' } }),
                getPublicUrl: () => ({ data: { publicUrl: '' } }),
                list: async () => ({ error: { message: 'Supabase not configured' } })
            })
        }
    };
} else {
    try {
        // Prefer Service Role Key for backend operations (Bypasses RLS)
        const keyToUse = supabaseServiceKey || supabaseKey;
        if (!supabaseServiceKey) {
            console.warn('⚠️ Using Client Key (Anon). RLS policies may block backend uploads. Recommend adding SUPABASE_SERVICE_ROLE_KEY.');
        }
        supabase = createClient(supabaseUrl, keyToUse);
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
