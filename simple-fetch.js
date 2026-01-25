const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

(async () => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        // Direct REST call to avoid SDK confusion
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            const fs = require('fs');
            const models = data.models
                .filter(m => m.supportedGenerationMethods.includes("generateContent"))
                .map(m => m.name)
                .join('\n');
            fs.writeFileSync('models.txt', models);
            console.log("Written to models.txt");
        } else {
            console.log("No models found or error:", data);
        }
    } catch (e) {
        console.error(e);
    }
})();
