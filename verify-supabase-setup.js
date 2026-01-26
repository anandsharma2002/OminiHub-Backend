require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const logFile = 'verify_output.log';

function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\r\n');
}

// Ensure log file is fresh
fs.writeFileSync(logFile, '');

log('--- Verifying Supabase Config ---');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) log('❌ SUPABASE_URL is missing in .env');
else log('✅ SUPABASE_URL is present');

if (!key) log('❌ SUPABASE_KEY is missing in .env');
else log('✅ SUPABASE_KEY is present');

const activeKey = serviceKey || key;

if (url && activeKey) {
    log('\n--- Testing Connection (Using ' + (serviceKey ? 'Service Role' : 'Anon') + ' Key) ---');
    (async () => {
        try {
            const supabase = createClient(url, activeKey);
            log('Client initialized.');

            // --- TEST PROFILE IMAGES ---
            try {
                log('\n--- Testing "ProfileImages" Bucket ---');
                const { data, error } = await supabase.storage.from('ProfileImages').list();
                if (error) {
                    log('❌ Failed to list "ProfileImages": ' + error.message);
                } else {
                    log('✅ Successfully accessed "ProfileImages" bucket.');

                    const fileName = `verify_${Date.now()}.txt`;
                    const fileContent = 'Supabase Verification Test';
                    // Upsert true
                    const { error: uploadError } = await supabase.storage
                        .from('ProfileImages')
                        .upload(fileName, Buffer.from(fileContent), { contentType: 'text/plain', upsert: true });

                    if (uploadError) {
                        log('❌ ProfileImages Upload Failed: ' + uploadError.message);
                    } else {
                        log('✅ ProfileImages Upload Successful: ' + fileName);
                        // Clean up
                        await supabase.storage.from('ProfileImages').remove([fileName]);
                    }
                }
            } catch (e) {
                log('❌ ProfileImages Test Exception: ' + e.message);
            }

            // --- TEST DOCUMENTS ---
            try {
                log('\n--- Testing "Documents" Bucket ---');
                // List files
                const { error: docError } = await supabase.storage.from('Documents').list();
                if (docError) {
                    log('❌ Failed to list "Documents": ' + docError.message);
                } else {
                    log('✅ Successfully accessed "Documents" bucket.');

                    // Upload
                    const docName = `verify_doc_${Date.now()}.txt`;
                    const { error: docUploadError } = await supabase.storage
                        .from('Documents')
                        .upload(docName, Buffer.from('Doc Test'), { contentType: 'text/plain', upsert: true });

                    if (docUploadError) {
                        log('❌ Documents Upload Failed: ' + docUploadError.message);
                    } else {
                        log('✅ Documents Upload Successful');

                        // Check Public URL
                        const { data: { publicUrl: docPublicUrl } } = supabase.storage
                            .from('Documents')
                            .getPublicUrl(docName);

                        log('ℹ️ Doc Public URL: ' + docPublicUrl);

                        try {
                            const res = await axios.get(docPublicUrl);
                            if (res.status === 200 && res.data === 'Doc Test') {
                                log('✅ Documents Bucket is PUBLIC (Winner! We can use this).');
                            } else {
                                log('❌ Documents Public URL fetched but content mismatch or status: ' + res.status);
                            }
                        } catch (e) {
                            log('❌ Documents Bucket is PRIVATE (Request Failed: ' + e.message + ')');
                        }

                        // Clean up
                        await supabase.storage.from('Documents').remove([docName]);
                    }
                }
            } catch (e) {
                log('❌ Documents Test Exception: ' + e.message);
            }

        } catch (e) {
            log('❌ Script Critical Error: ' + e.message);
        }
    })();
}
