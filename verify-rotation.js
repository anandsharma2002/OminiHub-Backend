const aiService = require('./src/utils/ai-service');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Mocking the GoogleGenerativeAI class
// We need to intercept the constructor or the method calls.
// Since `ai-service` requires `@google/generative-ai`, we can't easily mock it if it's already required inside `ai-service.js`.
// However, in `ai-service.js`, `GoogleGenerativeAI` is destructured from require.
// We can use a library or just a simple trick if we could inject dependency.
// But `ai-service.js` instantiates `new GoogleGenerativeAI(apiKey)` directly.

// ALTERNATIVE: Use `jest` or similar if available? No.
// I will create a temporary version of `ai-service.js` that allows injection OR just run a real test if I can trust it won't consume quota?
// No, I need to test the *rotation*.

// Plan B: Modify `ai-service.js` temporarily to accept an injected Mock Class? No, too invasive.

// Plan C: Create a test script that uses `proxyquire` or simply mocks the require cache.
// Let's try mocking require cache.

const mockGenAI = class {
    constructor(apiKey) {
        this.apiKey = apiKey;
        console.log(`[Mock] Initialized with Key ending in ...${apiKey.slice(-4)}`);
    }

    getGenerativeModel({ model }) {
        return {
            startChat: () => {
                return {
                    sendMessage: async (prompt) => {
                        // Logic to simulate failure based on key
                        // Let's say keys 1 and 2 fail, 3 succeeds.
                        if (this.apiKey.includes("AIzaSyBeqVhxzR_fYsYGz4hiPyegQxEY3a3MhtQ")) { // Key 1
                            const e = new Error("429 Resource exhausted");
                            throw e;
                        }
                        if (this.apiKey.includes("AIzaSyBKs9Id4_fmw7aRKBZzTEbiNbpxJZSSpLw")) { // Key 2
                            const e = new Error("429 Quota exceeded");
                            throw e;
                        }

                        return {
                            response: {
                                text: () => "Success from Key 3!",
                                functionCalls: () => []
                            }
                        };
                    }
                }
            }
        }
    }
};

// Mock the module in require cache
require.cache[require.resolve("@google/generative-ai")] = {
    exports: {
        GoogleGenerativeAI: mockGenAI
    }
};

// Now import the service (it will use the mocked module)
// We need to make sure dotenv is loaded so keys are present
require("dotenv").config();

// We need to reload ai-service if it was already loaded, but here it's fresh.
// But wait, `ai-service.js` does `const { GoogleGenerativeAI } = require(...)`.
// If I mock it BEFORE import, it should work.

async function runTest() {
    console.log("Starting Rotation Test...");
    try {
        const response = await aiService.chatWithAI("Hello");
        console.log("Test Result:", response);
    } catch (error) {
        console.error("Test Failed:", error);
    }
}

runTest();
