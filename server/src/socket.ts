import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

interface SocketUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

interface AuthenticatedSocket extends Socket {
  data: {
    user?: SocketUser;
  };
}

let io: SocketIOServer | null = null;

// Track online users per workspace: workspaceId -> Map<userId, SocketUser & { count: number }>
const onlinePresence = new Map<string, Map<string, SocketUser & { count: number }>>();

export const initSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
  });

  // JWT Authentication Middleware for Socket.IO
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.headers?.authorization?.replace('Bearer ', '') as string);

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const secret = process.env.JWT_SECRET || 'syncsphere_jwt_secret_dev_key_super_secure_2026';
      const decoded = jwt.verify(token, secret) as SocketUser;
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication failed: Invalid or expired token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user;
    if (!user) return;

    // Automatically join personal user room for direct notifications
    socket.join(`user:${user.id}`);
    console.log(`🔌 [Socket.IO] User connected: ${user.name} (${user.id})`);

    // Handle joining workspace room
    socket.on('join:workspace', (workspaceId: string) => {
      if (!workspaceId) return;
      const room = `workspace:${workspaceId}`;
      socket.join(room);

      // Track presence
      if (!onlinePresence.has(workspaceId)) {
        onlinePresence.set(workspaceId, new Map());
      }
      const workspaceUsers = onlinePresence.get(workspaceId)!;
      const existing = workspaceUsers.get(user.id);
      if (existing) {
        existing.count += 1;
      } else {
        workspaceUsers.set(user.id, { ...user, count: 1 });
      }

      // Broadcast updated active presence list
      const activeList = Array.from(workspaceUsers.values()).map(({ count, ...u }) => u);
      io?.to(room).emit('presence:update', { workspaceId, users: activeList });
      console.log(`👥 [Presence] ${user.name} joined ${room}`);
    });

    // Handle leaving workspace room
    socket.on('leave:workspace', (workspaceId: string) => {
      if (!workspaceId) return;
      const room = `workspace:${workspaceId}`;
      socket.leave(room);

      const workspaceUsers = onlinePresence.get(workspaceId);
      if (workspaceUsers && workspaceUsers.has(user.id)) {
        const existing = workspaceUsers.get(user.id)!;
        existing.count -= 1;
        if (existing.count <= 0) {
          workspaceUsers.delete(user.id);
        }
        const activeList = Array.from(workspaceUsers.values()).map(({ count, ...u }) => u);
        io?.to(room).emit('presence:update', { workspaceId, users: activeList });
      }
    });

    // Handle joining project room
    socket.on('join:project', (projectId: string) => {
      if (!projectId) return;
      socket.join(`project:${projectId}`);
    });

    socket.on('leave:project', (projectId: string) => {
      if (!projectId) return;
      socket.leave(`project:${projectId}`);
    });

    // Disconnect cleanup
    socket.on('disconnecting', () => {
      // Find all workspace rooms the socket was in
      socket.rooms.forEach((room) => {
        if (room.startsWith('workspace:')) {
          const workspaceId = room.replace('workspace:', '');
          const workspaceUsers = onlinePresence.get(workspaceId);
          if (workspaceUsers && workspaceUsers.has(user.id)) {
            const existing = workspaceUsers.get(user.id)!;
            existing.count -= 1;
            if (existing.count <= 0) {
              workspaceUsers.delete(user.id);
            }
            const activeList = Array.from(workspaceUsers.values()).map(({ count, ...u }) => u);
            io?.to(room).emit('presence:update', { workspaceId, users: activeList });
          }
        }
      });
      console.log(`🔌 [Socket.IO] User disconnected: ${user.name} (${user.id})`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocket first.');
  }
  return io;
};

// Safe helper functions for controllers/services
export const emitToWorkspace = (workspaceId: string, event: string, data: any) => {
  try {
    if (io) {
      io.to(`workspace:${workspaceId}`).emit(event, data);
    }
  } catch (err) {
    console.warn(`[Socket Emit Warning] Failed to emit ${event} to workspace:${workspaceId}`, err);
  }
};

export const emitToProject = (projectId: string, event: string, data: any) => {
  try {
    if (io) {
      io.to(`project:${projectId}`).emit(event, data);
    }
  } catch (err) {
    console.warn(`[Socket Emit Warning] Failed to emit ${event} to project:${projectId}`, err);
  }
};

export const emitToUser = (userId: string, event: string, data: any) => {
  try {
    if (io) {
      io.to(`user:${userId}`).emit(event, data);
    }
  } catch (err) {
    console.warn(`[Socket Emit Warning] Failed to emit ${event} to user:${userId}`, err);
  }
};
