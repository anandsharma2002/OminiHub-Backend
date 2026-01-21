const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Just to initialize

        console.log("Fetching available models...");
        // There isn't a direct listModels method on the genAI instance in some versions, 
        // but usually it's accessible via the API.
        // Actually, looking at the library, typically we just try to generate content.
        // But let's verify specific model names by assuming 'gemini-pro' works or logging success.

        // Better approach: Use the create-response-safe method to just check if it runs.

        const modelsToCheck = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-001",
            "gemini-1.5-pro",
            "gemini-1.5-pro-001",
            "gemini-1.0-pro",
            "gemini-pro",
            "gemini-2.0-flash-exp"
        ];

        for (const modelName of modelsToCheck) {
            console.log(`Checking ${modelName}...`);
            try {
                const m = genAI.getGenerativeModel({ model: modelName });
                const result = await m.generateContent("Hello");
                console.log(`✅ ${modelName}: Success`);
            } catch (error) {
                console.log(`❌ ${modelName}: Failed - ${error.message.split('\n')[0]}`);
            }
        }

    } catch (error) {
        console.error("Script Error:", error);
    }
}

listModels();
