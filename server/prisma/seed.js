"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting seed...');
    // Clear existing
    await prisma.activity.deleteMany({});
    await prisma.taskComment.deleteMany({});
    await prisma.taskLabelAssignment.deleteMany({});
    await prisma.taskLabel.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.workspaceMember.deleteMany({});
    await prisma.workspace.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.user.deleteMany({});
    const passwordHash = await bcryptjs_1.default.hash('password123', 10);
    // 1. Create Users
    const tanmay = await prisma.user.create({
        data: {
            name: 'Tanmay Sharma',
            email: 'tanmay@example.com',
            passwordHash,
            avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Tanmay',
        },
    });
    const rahul = await prisma.user.create({
        data: {
            name: 'Rahul Verma',
            email: 'rahul@example.com',
            passwordHash,
            avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Rahul',
        },
    });
    const priya = await prisma.user.create({
        data: {
            name: 'Priya Patel',
            email: 'priya@example.com',
            passwordHash,
            avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Priya',
        },
    });
    console.log('✅ Users created: Tanmay, Rahul, Priya (password: password123)');
    // 2. Create Workspace
    const workspace = await prisma.workspace.create({
        data: {
            name: 'College Projects',
            description: 'Collaborative development hub for semester capstone projects',
            ownerId: tanmay.id,
            members: {
                create: [
                    { userId: tanmay.id, role: 'OWNER' },
                    { userId: rahul.id, role: 'MEMBER' },
                    { userId: priya.id, role: 'ADMIN' },
                ],
            },
        },
    });
    console.log(`✅ Workspace "${workspace.name}" created`);
    // 3. Create Projects
    const websiteProject = await prisma.project.create({
        data: {
            workspaceId: workspace.id,
            name: 'Website App',
            description: 'Next.js & Express collaborative portal',
        },
    });
    const mobileProject = await prisma.project.create({
        data: {
            workspaceId: workspace.id,
            name: 'Mobile Client',
            description: 'React Native companion app',
        },
    });
    console.log('✅ Projects created: Website App, Mobile Client');
    // 4. Create Tasks
    const task1 = await prisma.task.create({
        data: {
            projectId: websiteProject.id,
            title: 'Implement JWT Authentication & RBAC',
            description: 'Secure API routes with bcrypt and role-based access control (OWNER/ADMIN/MEMBER)',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            createdById: tanmay.id,
            assigneeId: rahul.id,
            dueDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
            orderIndex: 1000,
        },
    });
    const task2 = await prisma.task.create({
        data: {
            projectId: websiteProject.id,
            title: 'Create Interactive Kanban Board UI',
            description: 'Support drag-and-drop task movements and instant optimistic UI updates',
            status: 'DONE',
            priority: 'URGENT',
            createdById: tanmay.id,
            assigneeId: tanmay.id,
            dueDate: new Date(Date.now() - 86400000), // yesterday
            orderIndex: 1000,
        },
    });
    const task3 = await prisma.task.create({
        data: {
            projectId: websiteProject.id,
            title: 'Design PostgreSQL Schema with Prisma',
            description: 'Define relational entities: Users, Workspaces, Projects, Tasks, Activities',
            status: 'DONE',
            priority: 'HIGH',
            createdById: priya.id,
            assigneeId: priya.id,
            orderIndex: 2000,
        },
    });
    const task4 = await prisma.task.create({
        data: {
            projectId: websiteProject.id,
            title: 'Integrate Socket.IO Live Updates',
            description: 'Broadcast taskMoved, commentAdded, and notification events across room peers',
            status: 'TODO',
            priority: 'HIGH',
            createdById: tanmay.id,
            assigneeId: rahul.id,
            dueDate: new Date(Date.now() + 86400000 * 7),
            orderIndex: 1000,
        },
    });
    const task5 = await prisma.task.create({
        data: {
            projectId: websiteProject.id,
            title: 'Set up BullMQ background queues with Redis',
            description: 'Offload email dispatch and due-date reminder jobs to worker threads',
            status: 'TODO',
            priority: 'MEDIUM',
            createdById: priya.id,
            orderIndex: 2000,
        },
    });
    console.log('✅ Tasks created across Kanban columns');
    // 5. Create Comments
    await prisma.taskComment.create({
        data: {
            taskId: task1.id,
            userId: tanmay.id,
            content: 'API endpoints for login & register are ready in Express. Check /api/auth.',
        },
    });
    await prisma.taskComment.create({
        data: {
            taskId: task1.id,
            userId: rahul.id,
            content: "I'll connect the React AuthContext and token headers this afternoon!",
        },
    });
    console.log('✅ Initial comments seeded');
    // 6. Create Activities
    await prisma.activity.createMany({
        data: [
            {
                workspaceId: workspace.id,
                userId: tanmay.id,
                entityType: 'WORKSPACE',
                entityId: workspace.id,
                action: 'CREATED',
                metadata: { name: workspace.name },
            },
            {
                workspaceId: workspace.id,
                userId: tanmay.id,
                entityType: 'TASK',
                entityId: task1.id,
                action: 'CREATED',
                metadata: { title: task1.title, status: 'TODO' },
            },
            {
                workspaceId: workspace.id,
                userId: tanmay.id,
                entityType: 'TASK',
                entityId: task1.id,
                action: 'ASSIGNED',
                metadata: { title: task1.title, assigneeName: 'Rahul Verma' },
            },
            {
                workspaceId: workspace.id,
                userId: rahul.id,
                entityType: 'TASK',
                entityId: task1.id,
                action: 'STATUS_CHANGED',
                metadata: { title: task1.title, from: 'TODO', to: 'IN_PROGRESS' },
            },
            {
                workspaceId: workspace.id,
                userId: rahul.id,
                entityType: 'COMMENT',
                entityId: task1.id,
                action: 'COMMENTED',
                metadata: { taskTitle: task1.title },
            },
        ],
    });
    console.log('✅ Activity audit log seeded');
    console.log('🚀 Seed completed successfully!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
