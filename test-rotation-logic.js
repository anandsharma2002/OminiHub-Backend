// Copy of the logic from ai-service.js
const keys = ["KEY_1", "KEY_2", "KEY_3", "KEY_4", "KEY_5"];
let currentKeyIndex = 0;

const executeWithRetry = async (operation) => {
    let attempts = 0;
    const totalKeys = keys.length;

    while (attempts < totalKeys) {
        const apiKey = keys[currentKeyIndex];
        console.log(`[Test] Trying Key: ${apiKey} (Index: ${currentKeyIndex})`);

        try {
            return await operation(apiKey);
        } catch (error) {
            const isRateLimit = error.message && (
                error.message.includes('429') ||
                error.message.includes('Quota exceeded')
            );

            if (isRateLimit) {
                console.log(`[Test] Key ${currentKeyIndex} failed with 429. Rotating...`);
                attempts++;
                currentKeyIndex = (currentKeyIndex + 1) % totalKeys;

                if (attempts >= totalKeys) {
                    throw new Error("Daily Quota Exceeded for ALL available API keys.");
                }
            } else {
                throw error;
            }
        }
    }
};

// Test Case
async function runTest() {
    console.log("--- Starting Logic Verification ---");

    // Attempt 1: Fail Keys 1 and 2, Succeed on 3
    try {
        currentKeyIndex = 0; // Reset
        const result = await executeWithRetry(async (key) => {
            if (key === "KEY_1" || key === "KEY_2") {
                throw new Error("429 Quota exceeded");
            }
            return `Success with ${key}`;
        });
        console.log("Result 1:", result);
    } catch (e) {
        console.error("Test 1 Failed:", e.message);
    }

    // Attempt 2: All Fail
    try {
        console.log("\n--- Testing All Fail ---");
        currentKeyIndex = 0;
        await executeWithRetry(async (key) => {
            throw new Error("429 Quota exceeded");
        });
    } catch (e) {
        console.log("Test 2 Expected Error Caught:", e.message);
    }
}

runTest();
