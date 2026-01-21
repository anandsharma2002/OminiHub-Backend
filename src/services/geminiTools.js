const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const BoardColumn = require('../models/BoardColumn');
const Documentation = require('../models/Documentation');

/**
 * Tool Definitions passed to Gemini
 */
const toolsDefinition = [
    {
        function_declarations: [
            // --- PROJECT TOOLS ---
            {
                name: "create_project",
                description: "Creates a new project. Required when user says 'create project'.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING", description: "Name of the project" },
                        description: { type: "STRING", description: "Description of the project" },
                        githubRepo: { type: "STRING", description: "GitHub repository (optional)" }
                    },
                    required: ["name"]
                }
            },
            {
                name: "get_projects",
                description: "Retrieves a list of projects accessible to the user.",
                parameters: { type: "OBJECT", properties: {} }
            },
            {
                name: "delete_project",
                description: "Deletes a project by ID. Use get_projects first to find ID if needed.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        projectId: { type: "STRING", description: "The ID of the project to delete" }
                    },
                    required: ["projectId"]
                }
            },

            // --- TASK TOOLS ---
            {
                name: "create_task",
                description: "Creates a new task in a project.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        projectId: { type: "STRING", description: "ID of the project" },
                        title: { type: "STRING", description: "Title of the task" },
                        description: { type: "STRING", description: "Description of the task" },
                        priority: { type: "STRING", enum: ["Low", "Medium", "High", "Critical"] },
                        deadline: { type: "STRING", description: "ISO Date string for deadline" },
                        assignedTo: { type: "STRING", description: "User ID to assign the task to" }
                    },
                    required: ["projectId", "title"]
                }
            },
            {
                name: "get_tasks",
                description: "Get tasks for a specific project.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        projectId: { type: "STRING", description: "ID of the project" }
                    },
                    required: ["projectId"]
                }
            },
            {
                name: "update_task",
                description: "Updates a task's status, priority, or assignment.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        taskId: { type: "STRING", description: "ID of the task" },
                        status: { type: "STRING", enum: ["To Do", "In Progress", "Done"] },
                        priority: { type: "STRING", enum: ["Low", "Medium", "High", "Critical"] },
                        assignedTo: { type: "STRING", description: "User ID to assign to" }
                    },
                    required: ["taskId"]
                }
            },
            {
                name: "delete_task",
                description: "Deletes a task by ID.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        taskId: { type: "STRING", description: "ID of the task to delete" }
                    },
                    required: ["taskId"]
                }
            },

            // --- USER TOOLS ---
            {
                name: "search_users",
                description: "Search for users by name or email. Useful for finding IDs for assignment.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Name or email to search for" }
                    },
                    required: ["query"]
                }
            },

            // --- DOCS TOOLS ---
            {
                name: "list_documents",
                description: "List all documents uploaded by the user.",
                parameters: { type: "OBJECT", properties: {} }
            }
        ]
    }
];

/**
 * Execution Logic for Tools
 */
const handleToolCall = async (functionCall, userId, io) => {
    const { name, args } = functionCall;
    console.log(`Executing Tool: ${name} for User: ${userId}`, args);

    try {
        switch (name) {
            // --- PROJECTS ---
            case "create_project":
                const newProject = await Project.create({
                    name: args.name,
                    description: args.description,
                    githubRepo: args.githubRepo,
                    owner: userId
                });
                return {
                    status: "success",
                    message: `Project '${newProject.name}' created. ID: ${newProject._id}`,
                    project: newProject
                };

            case "get_projects":
                const projects = await Project.find({
                    $or: [
                        { owner: userId },
                        { 'contributors.user': userId, 'contributors.status': 'Accepted' }
                    ]
                }).select('name description owner createdAt');
                return { projects };

            case "delete_project":
                // Additional check: Ensure owner
                const projectToDelete = await Project.findOne({ _id: args.projectId, owner: userId });
                if (!projectToDelete) return { status: "error", message: "Project not found or unauthorized" };
                await Project.findByIdAndDelete(args.projectId);
                return { status: "success", message: "Project deleted successfully." };

            // --- TASKS ---
            case "create_task":
                // Verify project access
                const proj = await Project.findById(args.projectId);
                if (!proj) return { status: "error", message: "Project not found" };

                const newTask = await Task.create({
                    title: args.title,
                    description: args.description,
                    project: args.projectId,
                    priority: args.priority || 'Medium',
                    deadline: args.deadline,
                    assignedTo: args.assignedTo,
                    type: 'Task'
                });

                // Real-time emit
                if (io) io.emit('task_created', newTask);

                return { status: "success", message: `Task '${newTask.title}' created. ID: ${newTask._id}`, task: newTask };

            case "get_tasks":
                const tasks = await Task.find({ project: args.projectId }).select('title status priority assignedTo');
                return { tasks };

            case "update_task":
                const updateData = {};
                if (args.status) updateData.status = args.status;
                if (args.priority) updateData.priority = args.priority;
                if (args.assignedTo) updateData.assignedTo = args.assignedTo;

                const updatedTask = await Task.findByIdAndUpdate(args.taskId, updateData, { new: true });
                if (!updatedTask) return { status: "error", message: "Task not found" };

                if (io) io.emit('task_updated', updatedTask);
                return { status: "success", message: "Task updated.", task: updatedTask };

            case "delete_task":
                const dt = await Task.findByIdAndDelete(args.taskId);
                if (!dt) return { status: "error", message: "Task not found" };

                if (io) io.emit('task_deleted', { taskId: args.taskId, projectId: dt.project });
                return { status: "success", message: "Task deleted." };

            // --- USERS ---
            case "search_users":
                const users = await User.find({
                    $or: [
                        { username: { $regex: args.query, $options: 'i' } },
                        { email: { $regex: args.query, $options: 'i' } },
                        { firstName: { $regex: args.query, $options: 'i' } }
                    ]
                }).select('username email _id firstName lastName');
                return { users };

            // --- DOCS ---
            case "list_documents":
                const docs = await Documentation.find({ user: userId }).select('name description filePath');
                return { documents: docs };

            default:
                return { status: "error", message: "Unknown tool function" };
        }
    } catch (error) {
        console.error("Tool Execution Error:", error);
        return { status: "error", message: error.message };
    }
};

module.exports = { toolsDefinition, handleToolCall };
