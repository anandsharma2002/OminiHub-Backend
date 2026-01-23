const aiService = require('../utils/ai-service');

/**
 * @desc    Chat with AI
 * @route   POST /api/v1/ai/chat
 * @access  Private
 */
exports.chat = async (req, res) => {
    try {
        const { prompt, history } = req.body;
        const user = req.user;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                message: "Prompt is required"
            });
        }

        const result = await aiService.chatWithAI(prompt, history, user);

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error("AI Controller Error:", error);
        res.status(500).json({
            success: false,
            message: "Something went wrong with AI service",
            error: error.message
        });
    }
};
