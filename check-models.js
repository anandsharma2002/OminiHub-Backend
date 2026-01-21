const https = require('https');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.models) {
                console.log("AVAILABLE MODELS:");
                json.models.forEach(m => console.log(`- ${m.name}`));
            } else {
                console.log("ERROR RESPONSE:", data);
            }
        } catch (e) {
            console.log("PARSE ERROR:", e.message);
        }
    });
}).on('error', (e) => {
    console.error("REQUEST ERROR:", e.message);
});
