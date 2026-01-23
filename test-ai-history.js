require('dotenv').config();
const path = require('path');

// Mock Project Model (simplified)
const projectModelPath = path.resolve(__dirname, 'src/models/Project.js');
require.cache[projectModelPath] = {
    id: projectModelPath,
    filename: projectModelPath,
    loaded: true,
    exports: {
        create: async (data) => {
            return { _id: "mock-id", ...data };
        }
    }
};

const aiService = require('./src/utils/ai-service');

const user = { _id: "test-user" };

async function testBadHistory() {
    try {
        console.log("Testing AI with malformed history (starting with model)...");
        const prompt = "Hello";
        // Imitating the frontend sending the welcome message as first history item
        const history = [
            { role: 'model', parts: [{ text: "Namaste! I am your Project Assistant." }] }
        ];

        console.log("Sending History:", JSON.stringify(history, null, 2));
        await aiService.chatWithAI(prompt, history, user);
        console.log("Success! (Fix worked)");
    } catch (error) {
        console.error("Failed as expected (or fix not applied yet):");
        console.error(error.message);
    }
}

testBadHistory();
