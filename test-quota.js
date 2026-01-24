const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const candidates = [
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite-preview",
    "gemini-2.0-flash-exp"
];

async function testModels() {
    for (const modelName of candidates) {
        console.log(`\nTesting: ${modelName}...`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hi");
            console.log(`✅ SUCCESS: ${modelName}`);
            console.log("Response:", result.response.text());
            return; // Stop after finding a working one
        } catch (e) {
            console.log(`❌ FAILED: ${modelName}`);
            // Extract the specific error message to see limits
            if (e.message.includes("429")) {
                console.log("Error: 429 Quota Exceeded");
                if (e.message.includes("limit: 0")) console.log(">> LIMIT IS 0 (BLOCKED)");
                else if (e.message.includes("limit: 20")) console.log(">> LIMIT IS 20/DAY");
                else console.log(">> " + e.message.split('\n')[0]);
            } else {
                console.log("Error: " + e.message.split('\n')[0]);
            }
        }
    }
    console.log("\nNo working high-quota models found.");
}

testModels();
