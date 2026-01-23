const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy init to get access to client if needed, or just use genAI
        // The SDK doesn't have a direct 'listModels' on genAI instance in all versions, 
        // but let's try to see if we can just infer or test a few.
        // Actually, looking at docs, typically we might not be able to list cleanly without a specific endpoint call if not exposed by helper.
        // Let's try to just run a simple generateContent on a few probable names to see which one marks valid.

        // Better yet, let's use the error message itself which suggests: "Call ListModels to see the list..."
        // We can try to make a raw request or use the model that *usually* works.

        // However, the best way with the SDK is usually assuming standard names.
        // Let's try 'gemini-1.5-flash-latest' or 'gemini-1.5-flash-001'.

        const candidates = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-001",
            "gemini-1.5-flash-002",
            "gemini-1.5-pro",
            "gemini-pro",
            "gemini-1.0-pro"
        ];

        for (const modelName of candidates) {
            console.log(`Testing model: ${modelName}...`);
            try {
                const m = genAI.getGenerativeModel({ model: modelName });
                const result = await m.generateContent("Hello");
                console.log(`✅ SUCCESS: ${modelName}`);
                console.log(result.response.text());
                break; // Found a working one
            } catch (e) {
                console.log(`❌ FAILED: ${modelName} - ${e.message.split('\n')[0]}`);
            }
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
