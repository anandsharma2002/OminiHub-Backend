const { GoogleGenerativeAI } = require("@google/generative-ai");
const Project = require("../models/Project");
const { emitToUser } = require("../socket/socket");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define Tools (Function Definitions for AI)
const toolsDefinition = [
    {
        function_declarations: [
            {
                name: "createProject",
                description: "Create a new project for the user. Use this when the user asks to create, add, or make a new project.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: {
                            type: "STRING",
                            description: "The name of the project.",
                        },
                        description: {
                            type: "STRING",
                            description: "A short description of the project.",
                        },
                        githubRepo: {
                            type: "STRING",
                            description: "GitHub repository URL or name (optional).",
                        },
                    },
                    required: ["name"],
                },
            },
            {
                name: "updateProject",
                description: "Update a project's details by name. Use this when the user asks to rename, change description, or update a project.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        currentName: {
                            type: "STRING",
                            description: "The current name of the project to find.",
                        },
                        newName: {
                            type: "STRING",
                            description: "The new name for the project (optional).",
                        },
                        description: {
                            type: "STRING",
                            description: "The new description (optional).",
                        },
                        githubRepo: {
                            type: "STRING",
                            description: "The new GitHub repo URL (optional).",
                        },
                    },
                    required: ["currentName"],
                },
            },
            {
                name: "deleteProject",
                description: "Delete a project by name. Use this when the user asks to delete or remove a project.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: {
                            type: "STRING",
                            description: "The name of the project to delete.",
                        },
                    },
                    required: ["name"],
                },
            },
        ],
    },
];

// Map Function Names to Actual Implementation
const toolsImplementation = {
    createProject: async (args, user) => {
        try {
            const project = await Project.create({
                ...args,
                owner: user._id,
                contributors: [{ user: user._id, role: 'Admin', status: 'Accepted' }]
            });

            // Emit socket event for real-time update
            emitToUser(user._id.toString(), 'project_created', project);

            return {
                success: true,
                message: `Project '${project.name}' created successfully!`,
                project: {
                    id: project._id,
                    name: project.name,
                    description: project.description
                }
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to create project: ${error.message}`
            };
        }
    },

    updateProject: async (args, user) => {
        try {
            const { currentName, newName, description, githubRepo } = args;
            const updateData = {};
            if (newName) updateData.name = newName;
            if (description) updateData.description = description;
            if (githubRepo) updateData.githubRepo = githubRepo;

            const project = await Project.findOneAndUpdate(
                {
                    name: { $regex: new RegExp(`^${currentName}$`, 'i') },
                    owner: user._id
                },
                updateData,
                { new: true }
            );

            if (!project) {
                return {
                    success: false,
                    message: `Project '${currentName}' not found or you don't have permission to update it.`
                };
            }

            // Emit socket event for real-time update
            emitToUser(user._id.toString(), 'project_updated', project);

            return {
                success: true,
                message: `Project updated successfully! Current Name: ${project.name}`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to update project: ${error.message}`
            };
        }
    },
    deleteProject: async (args, user) => {
        try {
            const { name } = args;
            // Case-insensitive search for project owned by user
            const project = await Project.findOneAndDelete({
                name: { $regex: new RegExp(`^${name}$`, 'i') },
                owner: user._id
            });

            if (!project) {
                return {
                    success: false,
                    message: `Project '${name}' not found or you don't have permission to delete it.`
                };
            }

            // Emit socket event for real-time update
            emitToUser(user._id.toString(), 'project_deleted', { projectId: project._id });

            return {
                success: true,
                message: `Project '${project.name}' deleted successfully!`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to delete project: ${error.message}`
            };
        }
    }
};

/**
 * Handles chat with Gemini AI using Function Calling
 * @param {string} userPrompt - The user's message
 * @param {Array} history - Chat history
 * @param {Object} user - The authenticated user object
 * @returns {Promise<Object>} - AI response
 */
exports.chatWithAI = async (userPrompt, history = [], user) => {
    try {
        // Use 'gemini-flash-latest' - verified as the ONLY model with non-zero (though low 20/day) limit for this key
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            tools: toolsDefinition
        });

        // Sanitize history: Gemini requires the first message to be from 'user'
        // If the first message is from 'model' (e.g. welcome message), remove it.
        let validHistory = [...history];
        while (validHistory.length > 0 && validHistory[0].role !== 'user') {
            validHistory.shift();
        }

        const chat = model.startChat({
            history: validHistory,
            generationConfig: {
                maxOutputTokens: 1000,
            },
        });

        const result = await chat.sendMessage(userPrompt);
        const response = result.response;

        // Check for Function Calls
        const call = response.functionCalls();

        if (call && call.length > 0) {
            const firstCall = call[0];
            const functionName = firstCall.name;
            const args = firstCall.args;

            console.log(`[AI] Triggering Tool: ${functionName}`);

            // Execute the Tool safely
            if (toolsImplementation[functionName]) {
                const toolResult = await toolsImplementation[functionName](args, user);

                // Send tool result back to AI to generate natural language response
                const result2 = await chat.sendMessage([
                    {
                        functionResponse: {
                            name: functionName,
                            response: toolResult
                        }
                    }
                ]);

                return {
                    text: result2.response.text(),
                    toolExecuted: functionName
                };
            }
        }

        // Normal text response
        return {
            text: response.text()
        };

    } catch (error) {
        console.error("AI Service Error Details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        throw error; // Throw original error to see details in caller
    }
};
