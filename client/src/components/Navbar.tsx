import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import type { Workspace, Notification, Task } from '../types';
import {
  Layers,
  ChevronDown,
  Plus,
  LogOut,
  Search,
  Briefcase,
  CheckCircle,
  Bell,
  CheckCheck,
  Loader2,
} from 'lucide-react';

interface NavbarProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onOpenCreateWorkspace: () => void;
  onOpenCreateTask: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectTaskById?: (taskId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onOpenCreateWorkspace,
  onOpenCreateTask,
  searchQuery,
  onSearchChange,
  onSelectTaskById,
}) => {
  const { user, logout } = useAuth();
  const { socket, isConnected, onlineUsers } = useSocket();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Live Task Search State
  const [searchResults, setSearchResults] = useState<(Task & { project: { id: string; name: string } })[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial notifications
  const loadNotifications = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user?.id]);

  // Listen for real-time notifications via socket
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notif: Notification) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification:received', handleNotification);

    return () => {
      socket.off('notification:received', handleNotification);
    };
  }, [socket]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Debounced search query
  useEffect(() => {
    if (!activeWorkspace || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await api.searchTasks(activeWorkspace.id, searchQuery.trim());
        setSearchResults(res.tasks || []);
        setSearchDropdownOpen(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, activeWorkspace?.id]);

  // Press "/" to focus search and Escape to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setSearchDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-[#0a0f1d]/85 backdrop-blur-xl border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between gap-4">
      {/* Brand & Workspace Dropdown */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-base md:text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent hidden sm:inline">
            SyncSphere
          </span>
        </div>

        <div className="h-5 w-px bg-slate-800 hidden md:block" />

        {/* Workspace Switcher */}
        <div className="relative">
          <button
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 text-xs font-medium text-slate-200 transition-all"
          >
            <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
            <span className="max-w-[130px] truncate">
              {activeWorkspace?.name || 'Select Workspace'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {workspaceMenuOpen && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl bg-[#0f172a] border border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Workspaces ({workspaces.length})
              </div>

              <div className="max-h-48 overflow-y-auto py-1">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      onSelectWorkspace(ws);
                      setWorkspaceMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                      ws.id === activeWorkspace?.id
                        ? 'bg-indigo-600/15 text-indigo-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="truncate">{ws.name}</span>
                    {ws.id === activeWorkspace?.id && (
                      <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-800 pt-1 mt-1">
                <button
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    onOpenCreateWorkspace();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-indigo-400 hover:bg-slate-800/60 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Search Bar with Live Instant Results */}
      <div ref={searchContainerRef} className="flex-1 max-w-md hidden md:flex items-center relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search tasks... (Press / to focus)"
          value={searchQuery}
          onFocus={() => {
            if (searchResults.length > 0) setSearchDropdownOpen(true);
          }}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[#131b2e] border border-slate-800/90 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
        />

        {isSearching && (
          <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin absolute right-3 pointer-events-none" />
        )}

        {/* Live Search Results Dropdown */}
        {searchDropdownOpen && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl py-2 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800/70">
              <span>Matching Tasks ({searchResults.length})</span>
              <span className="text-[9px] text-slate-500">ESC to close</span>
            </div>

            <div className="max-h-64 overflow-y-auto py-1 divide-y divide-slate-800/40">
              {searchResults.map((task) => (
                <button
                  key={task.id}
                  onClick={() => {
                    setSearchDropdownOpen(false);
                    if (onSelectTaskById) {
                      onSelectTaskById(task.id);
                    }
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-indigo-400 truncate">
                      {task.title}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {task.project.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                        task.status === 'DONE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : task.status === 'IN_PROGRESS'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : task.status === 'IN_REVIEW'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Controls: Real-time Presence, Notifications, New Task & User Menu */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Real-time Connection Status & Presence Avatars */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/70 border border-slate-800">
          {isConnected ? (
            <div className="flex items-center gap-1.5" title="Socket.IO Live Connected">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium text-emerald-400">Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-500" title="Disconnected">
              <span className="w-2 h-2 rounded-full bg-slate-600" />
              <span className="text-[11px]">Offline</span>
            </div>
          )}

          {onlineUsers.length > 0 && (
            <div className="flex items-center -space-x-1.5 ml-1.5 pl-2 border-l border-slate-800">
              {onlineUsers.slice(0, 4).map((u) => (
                <div
                  key={u.id}
                  title={`${u.name} (Online)`}
                  className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center border-2 border-[#0a0f1d] shadow-sm relative group cursor-pointer"
                >
                  {u.avatar ? (
                    <img src={u.avatar} alt={u.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    u.name?.[0] || 'U'
                  )}
                  <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-[#0a0f1d]" />
                </div>
              ))}
              {onlineUsers.length > 4 && (
                <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-semibold text-[9px] flex items-center justify-center border-2 border-[#0a0f1d]">
                  +{onlineUsers.length - 4}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 text-slate-300 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0a0f1d] animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-2xl py-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 pb-2.5 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50 py-1">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No notifications yet. You're all caught up!
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.read) handleMarkAsRead(notif.id);
                        if (notif.link && notif.link.includes('task=')) {
                          const taskId = notif.link.split('task=')[1];
                          if (taskId && onSelectTaskById) {
                            onSelectTaskById(taskId);
                            setNotificationsOpen(false);
                          }
                        }
                      }}
                      className={`px-4 py-3 cursor-pointer transition-colors flex items-start gap-3 ${
                        notif.read ? 'hover:bg-slate-800/40 text-slate-400' : 'bg-indigo-950/20 hover:bg-indigo-950/30 text-slate-200'
                      }`}
                    >
                      <div className="mt-0.5">
                        {notif.read ? (
                          <div className="w-2 h-2 rounded-full bg-slate-600" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-tight truncate">{notif.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Create Task Button */}
        <button
          onClick={onOpenCreateTask}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Task</span>
        </button>

        {/* User profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-800 transition-colors"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-indigo-500/40 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                {user?.name?.[0] || 'U'}
              </div>
            )}
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0f172a] border border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-slate-800">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
