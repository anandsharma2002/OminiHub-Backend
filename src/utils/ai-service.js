const { GoogleGenerativeAI } = require("@google/generative-ai");
const Project = require("../models/Project");
const Task = require("../models/Task");
const { emitToUser } = require("../socket/socket");

// Initialize Gemini
// Initialize Gemini moved to function scope for key rotation

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
            {
                name: "addProjectItem",
                description: "Add a Heading, Sub-Heading, or Task to a project. Handles hierarchy (e.g. 'Add task X under heading Y').",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        projectName: { type: "STRING", description: "Name of the project." },
                        itemType: { type: "STRING", description: "Type of item: 'Heading', 'Sub-Heading', or 'Task'." },
                        content: { type: "STRING", description: "Title/Content of the item." },
                        parentName: { type: "STRING", description: "Name of the parent Heading/Sub-Heading (if any)." },
                        parentType: { type: "STRING", description: "Type of the parent (optional hint)." }
                    },
                    required: ["projectName", "itemType", "content"]
                }
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
    },
    addProjectItem: async (args, user) => {
        try {
            const { projectName, itemType, content, parentName, parentType } = args;
            console.log(`[AI] addProjectItem: Adding ${itemType} '${content}' to '${projectName}' (Parent: ${parentName})`);

            // 1. Find Project
            const project = await Project.findOne({
                name: { $regex: new RegExp(`^${projectName}$`, 'i') },
                owner: user._id
            });

            if (!project) {
                return { success: false, message: `Project '${projectName}' not found.` };
            }

            // 2. Resolve Parent (if applicable)
            let parentTaskId = null;
            if (parentName) {
                const query = {
                    project: project._id,
                    title: { $regex: new RegExp(`^${parentName}$`, 'i') }
                };

                // If adding a Task, parent is likely Sub-Heading (or Heading)
                // If adding a Sub-Heading, parent MUST be Heading
                if (itemType === 'Sub-Heading') {
                    query.type = 'Heading';
                }
                // If adding a Task, parent could be Heading or Sub-Heading. 
                // If parentType hint provided by AI, use it.
                if (parentType) {
                    query.type = parentType;
                }

                const parents = await Task.find(query);

                if (parents.length === 0) {
                    return {
                        success: false,
                        message: `Parent item '${parentName}' not found in project. Please ensure the Heading/Sub-Heading exists.`
                    };
                } else if (parents.length > 1) {
                    // Ambiguity!
                    const context = parents.map(p => `(Type: ${p.type})`).join(", ");
                    return {
                        success: false,
                        message: `Found multiple items named '${parentName}' ${context}. Please specify which one (e.g. by mentioning its unique parent).`
                    };
                }

                parentTaskId = parents[0]._id;
            }

            // 3. Normalize Item Type
            // Model expects: 'Heading', 'Sub-Heading', 'Task'
            let normalizedType = 'Task';
            if (itemType && itemType.toLowerCase().includes('sub')) normalizedType = 'Sub-Heading';
            else if (itemType && itemType.toLowerCase().includes('head')) normalizedType = 'Heading';

            // 4. Create Task
            const newTask = await Task.create({
                title: content,
                type: normalizedType,
                project: project._id,
                parentTask: parentTaskId,
                assignedTo: user._id, // Default to owner
                status: 'To Do'
            });

            // 5. Link to Project
            project.tasks.push(newTask._id);
            await project.save();

            // 6. Emit Update
            emitToUser(user._id.toString(), 'project_updated', project);
            emitToUser(user._id.toString(), 'task_created', newTask);

            return {
                success: true,
                message: `Added ${normalizedType} '${content}' to project '${project.name}'.`,
                item: { id: newTask._id, title: newTask.title, type: newTask.type }
            };

        } catch (error) {
            console.error("addProjectItem Error:", error);
            return { success: false, message: `Failed to add item: ${error.message}` };
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
// Initialize Keys
const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5
].filter(Boolean);

let currentKeyIndex = 0;

/**
 * Execute an AI operation with automatic failover/rotation on Quota Limit (429) errors.
 * @param {Function} operation - Function that takes (apiKey, modelName) and returns a promise
 */
const executeWithRetry = async (operation) => {
    // Try each key exactly once in a full cycle if needed
    // We start from currentKeyIndex and can loop through all keys
    let attempts = 0;
    const totalKeys = keys.length;

    while (attempts < totalKeys) {
        const apiKey = keys[currentKeyIndex];

        try {
            return await operation(apiKey);
        } catch (error) {
            // Check for Rate Limit / Quota Exceeded errors
            const isRateLimit = error.message && (
                error.message.includes('429') ||
                error.message.includes('Quota exceeded') ||
                error.message.includes('User Rate Limit Exceeded') ||
                error.message.includes('REVENUE_QUOTA_EXCEEDED')
            );

            if (isRateLimit) {
                console.warn(`[AI-Service] Key index ${currentKeyIndex} rate limited. Switching to next key...`);
                attempts++;

                // Move to next key, wrapping around
                currentKeyIndex = (currentKeyIndex + 1) % totalKeys;

                // If we have tried all keys, we must fail
                if (attempts >= totalKeys) {
                    throw new Error("Daily Quota Exceeded for ALL available API keys. Please try again tomorrow.");
                }
            } else {
                // If it's not a rate limit error (e.g. 400 Bad Request, 500), throw immediately
                throw error;
            }
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
    return executeWithRetry(async (apiKey) => {
        const genAI = new GoogleGenerativeAI(apiKey);

        // Use 'gemini-flash-latest' which is verified to be in the User's model list
        // (gemini-1.5-flash was returning 404)
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            tools: toolsDefinition
        });

        // Sanitize history
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

            if (toolsImplementation[functionName]) {
                const toolResult = await toolsImplementation[functionName](args, user);

                // Send tool result back to AI
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

        return {
            text: response.text()
        };
    }).catch(error => {
        // Final error handler to format messages as before
        console.error("AI Service Final Error:", error.message);

        // Enhance error message for user
        if (error.message.includes('Daily Quota Exceeded')) {
            const rateLimitError = new Error("System is currently at maximum capacity (All Keys Exhausted). Please try again later.");
            rateLimitError.isRateLimit = true;
            throw rateLimitError;
        }

        throw error;
    });
};
