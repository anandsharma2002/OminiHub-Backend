const https = require('https');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            if (response.error) {
                console.error("API Error:", response.error);
            } else if (response.models) {
                console.log("Available MOdels:");
                response.models.forEach(m => {
                    console.log(`- ${m.name} [${m.supportedGenerationMethods.join(', ')}]`);
                });
            } else {
                console.log("Unexpected response structure:", response);
            }
        } catch (e) {
            console.error("Parse Error:", e);
            console.log("Raw Data:", data);
        }
    });

}).on('error', (err) => {
    console.error("Request Error:", err);
});
