const { GoogleGenerativeAI } = require("@google/generative-ai");
const AIChat = require("../models/AIChat");
const { toolsDefinition, handleToolCall } = require("../services/geminiTools");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp", // Experimental version often has free tier availability
    tools: toolsDefinition,
    systemInstruction: {
        parts: [{ text: "You are a helpful AI assistant for the OmniHub project management app. You can manage projects, tasks, and users. Keep your responses concise (1-2 lines) unless asked for details. When a user asks to create something, use the appropriate tool. If you lack info (like project ID), ask the user." }]
    }
});


// Helper for exponential backoff
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendMessageWithRetry(chatSession, message, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await chatSession.sendMessage(message);
        } catch (error) {
            if ((error.message.includes("429") || error.message.includes("503")) && i < retries - 1) {
                const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
                console.log(`Gemini 429/503 hit. Retrying in ${delay / 1000}s...`);
                await wait(delay);
            } else {
                throw error;
            }
        }
    }
}

exports.chat = async (req, res) => {
    try {
        const { message, chatId } = req.body;
        const userId = req.user._id;

        // 1. Retrieve or Create Chat Session
        let chat;
        if (chatId) {
            chat = await AIChat.findOne({ _id: chatId, user: userId });
        }

        if (!chat) {
            chat = await AIChat.create({
                user: userId,
                history: [] // Fresh history
            });
        }

        // 2. Prepare History for Gemini 
        const historyForGemini = chat.history.map(h => ({
            role: h.role,
            parts: h.parts.map(p => ({ text: p.text }))
        }));

        const chatSession = model.startChat({
            history: historyForGemini
        });

        // 3. Send User Message with Retry
        let result = await sendMessageWithRetry(chatSession, message);
        let response = await result.response;

        let finalTextResponse = "";

        // 4. Handle Function Calls
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];

            // Execute Tool
            const io = req.app.get('io');
            const toolResult = await handleToolCall(call, userId, io);

            // Send Result back to Gemini
            const toolResponsePart = [
                {
                    functionResponse: {
                        name: call.name,
                        response: toolResult
                    }
                }
            ];

            const result2 = await sendMessageWithRetry(chatSession, toolResponsePart);
            finalTextResponse = result2.response.text();

        } else {
            finalTextResponse = response.text();
        }

        // 5. Save Convo to DB
        chat.history.push({
            role: 'user',
            parts: [{ text: message }]
        });

        chat.history.push({
            role: 'model',
            parts: [{ text: finalTextResponse }]
        });

        // Update title if it's the first message
        if (chat.history.length <= 2) {
            chat.title = message.substring(0, 30);
        }

        await chat.save();

        res.status(200).json({
            response: finalTextResponse,
            chatId: chat._id,
            history: chat.history
        });

    } catch (error) {
        console.error("Gemini Chat Error:", error);

        let statusCode = 500;
        let errorMessage = "AI Service Error";

        if (error.message.includes("429") || error.message.includes("Quota exceeded")) {
            statusCode = 429;
            errorMessage = "Daily/Minute Quota Exceeded. Please try again later.";
        }

        res.status(statusCode).json({ message: errorMessage, error: error.message });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const chats = await AIChat.find({ user: req.user._id }).sort({ updatedAt: -1 });
        res.status(200).json(chats);
    } catch (error) {
        res.status(500).json({ message: "Error fetching history" });
    }
};

exports.deleteChat = async (req, res) => {
    try {
        await AIChat.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        res.status(200).json({ message: "Chat deleted" });
    } catch (error) {
        res.status(500).json({ message: "Delete error" });
    }
}
