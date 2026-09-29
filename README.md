# SyncSphere — Collaborative Project & Task Workspace

> A fusion of Trello's agile simplicity, Jira's workflow depth, and Slack-style real-time collaboration.

---

## ⚡ Architecture Overview (Phase 1)

```
                     FRONTEND (client/)
              React 19 + TypeScript + Vite
              Tailwind CSS + Lucide Icons
                         │
                         │ HTTP / REST (/api)
                         ▼
                     BACKEND (server/)
               Node.js + Express + TypeScript
               JWT Auth + RBAC Middleware
                         │
                         │ Prisma ORM (v6)
                         ▼
                   DATABASE (PostgreSQL 18)
          Users • Workspaces • Members • Projects
          Tasks • Comments • Activity Audit Log
```

---

## 📁 Repository Structure

```
├── client/                      # React + TypeScript Vite frontend
│   ├── src/
│   │   ├── components/          # KanbanBoard, TaskCard, TaskDetailModal, Modals, Navbar, Sidebar
│   │   ├── context/             # AuthContext (JWT session management)
│   │   ├── pages/               # Login, Register, Dashboard
│   │   ├── services/            # Typed ApiClient (fetch wrapper with Bearer token)
│   │   ├── types/               # TypeScript domain interfaces
│   │   └── App.tsx              # React Router configuration
│   └── vite.config.ts           # Tailwind CSS v4 & /api proxy to :5000
│
├── server/                      # Node.js + Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma        # PostgreSQL relational schema
│   │   └── seed.ts              # Demo workspace, projects, tasks, and users
│   ├── src/
│   │   ├── config/              # Prisma client singleton
│   │   ├── controllers/         # Auth, Workspaces, Projects, Tasks, Comments
│   │   ├── middleware/          # JWT verification & Error handlers
│   │   ├── routes/              # Express API endpoints
│   │   ├── services/            # Activity audit logging service
│   │   └── server.ts            # Express app entry point
│   └── .env                     # Database connection & JWT secrets
│
└── package.json                 # Monorepo orchestration scripts
```

---

## 🚀 Quick Start Guide

### 1. Database Configuration
Ensure your local PostgreSQL 18 service is running. Update your password in `server/.env`:

```env
DATABASE_URL="postgresql://postgres:<YOUR_PASSWORD>@localhost:5432/taskflow_db?schema=public"
JWT_SECRET="syncsphere_jwt_secret_dev_key_super_secure_2026"
PORT=5000
```

### 2. Push Schema & Seed Initial Data
```bash
npm run prisma:push
npm run seed
```

### 3. Launch Development Servers
In two separate terminals (or concurrently):

```bash
# Terminal 1: Backend API (port 5000)
npm run dev:server

# Terminal 2: Frontend Client (port 3000)
npm run dev:client
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 👥 Seeded Demo Accounts (Password: `password123`)

| Name | Email | Role |
| :--- | :--- | :--- |
| **Tanmay Sharma** | `tanmay@example.com` | Workspace Owner |
| **Rahul Verma** | `rahul@example.com` | Member (Assigned tasks) |
| **Priya Patel** | `priya@example.com` | Admin |
