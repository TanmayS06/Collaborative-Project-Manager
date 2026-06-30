import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import type { OnlineUser } from '../types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  joinWorkspace: (workspaceId: string) => void;
  leaveWorkspace: (workspaceId: string) => void;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const activeWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setOnlineUsers([]);
      }
      return;
    }

    // Connect to backend Socket.IO server
    const socketInstance: Socket = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('⚡ [Socket.IO] Connected to real-time server');
      // Re-join workspace if there was one
      if (activeWorkspaceRef.current) {
        socketInstance.emit('join:workspace', activeWorkspaceRef.current);
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('🔌 [Socket.IO] Disconnected from server');
    });

    socketInstance.on('presence:update', (data: { workspaceId: string; users: OnlineUser[] }) => {
      setOnlineUsers(data.users || []);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
    };
  }, [token, user?.id]);

  const joinWorkspace = useCallback(
    (workspaceId: string) => {
      if (!workspaceId) return;
      if (activeWorkspaceRef.current && activeWorkspaceRef.current !== workspaceId && socket) {
        socket.emit('leave:workspace', activeWorkspaceRef.current);
      }
      activeWorkspaceRef.current = workspaceId;
      if (socket && socket.connected) {
        socket.emit('join:workspace', workspaceId);
      }
    },
    [socket]
  );

  const leaveWorkspace = useCallback(
    (workspaceId: string) => {
      if (socket && socket.connected) {
        socket.emit('leave:workspace', workspaceId);
      }
      if (activeWorkspaceRef.current === workspaceId) {
        activeWorkspaceRef.current = null;
        setOnlineUsers([]);
      }
    },
    [socket]
  );

  const joinProject = useCallback(
    (projectId: string) => {
      if (socket && socket.connected && projectId) {
        socket.emit('join:project', projectId);
      }
    },
    [socket]
  );

  const leaveProject = useCallback(
    (projectId: string) => {
      if (socket && socket.connected && projectId) {
        socket.emit('leave:project', projectId);
      }
    },
    [socket]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        joinWorkspace,
        leaveWorkspace,
        joinProject,
        leaveProject,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
