import React, { useState, useEffect } from 'react';
import type { Workspace, Project, Task, TaskStatus, Activity } from '../types';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { KanbanBoard } from '../components/KanbanBoard';
import { ActivityFeed } from '../components/ActivityFeed';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { CreateWorkspaceModal } from '../components/CreateWorkspaceModal';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import {
  Layers,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  CircleDot,
  UserPlus,
} from 'lucide-react';


export const Dashboard: React.FC = () => {
  const { socket, joinWorkspace, joinProject } = useSocket();

  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'board' | 'activity' | 'members'>('board');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Modals
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [createTaskDefaultStatus, setCreateTaskDefaultStatus] = useState<TaskStatus>('TODO');
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isInviteMemberOpen, setIsInviteMemberOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Sync active workspace room
  useEffect(() => {
    if (activeWorkspace?.id) {
      joinWorkspace(activeWorkspace.id);
    }
  }, [activeWorkspace?.id, joinWorkspace]);

  // Sync active project room
  useEffect(() => {
    if (activeProjectId) {
      joinProject(activeProjectId);
    }
  }, [activeProjectId, joinProject]);

  // Real-time collaborative event listeners
  useEffect(() => {
    if (!socket) return;

    // Live Task Created
    const handleTaskCreated = (newTask: Task) => {
      if (newTask.projectId === activeProjectId) {
        setTasks((prev) => {
          if (prev.some((t) => t.id === newTask.id)) return prev;
          return [newTask, ...prev];
        });
      }
    };

    // Live Task Updated (e.g. teammate moves card from TODO -> IN_PROGRESS or updates details)
    const handleTaskUpdated = (updatedTask: Task) => {
      if (updatedTask.projectId === activeProjectId) {
        setTasks((prev) =>
          prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
        );
      }
    };

    // Live Task Deleted
    const handleTaskDeleted = (payload: { taskId: string; projectId: string }) => {
      if (payload.projectId === activeProjectId) {
        setTasks((prev) => prev.filter((t) => t.id !== payload.taskId));
      }
    };

    // Live Activity Logged
    const handleActivityLogged = (newActivity: Activity) => {
      if (newActivity.workspaceId === activeWorkspace?.id) {
        setActiveWorkspace((prev) => {
          if (!prev) return prev;
          const currentActs = prev.activities || [];
          if (currentActs.some((a) => a.id === newActivity.id)) return prev;
          return {
            ...prev,
            activities: [newActivity, ...currentActs],
          };
        });
      }
    };

    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);
    socket.on('activity:logged', handleActivityLogged);

    return () => {
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
      socket.off('activity:logged', handleActivityLogged);
    };
  }, [socket, activeProjectId, activeWorkspace?.id]);

  // Initial Load
  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await api.getWorkspaces();
      setWorkspaces(res.workspaces);
      if (res.workspaces.length > 0) {
        await selectWorkspace(res.workspaces[0]);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectWorkspace = async (workspace: Workspace) => {
    try {
      const res = await api.getWorkspaceById(workspace.id);
      setActiveWorkspace(res.workspace);
      const workspaceProjects = res.workspace.projects || [];
      setProjects(workspaceProjects);

      if (workspaceProjects.length > 0) {
        await selectProject(workspaceProjects[0].id);
      } else {
        setActiveProjectId(null);
        setTasks([]);
      }
    } catch (err) {
      console.error('Failed to load workspace details:', err);
    }
  };

  const selectProject = async (projectId: string) => {
    try {
      setActiveProjectId(projectId);
      const res = await api.getProjectById(projectId);
      setTasks(res.project.tasks || []);
    } catch (err) {
      console.error('Failed to load project details:', err);
    }
  };


  // Handlers for Tasks
  const handleTaskMove = async (taskId: string, newStatus: TaskStatus) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await api.updateTask(taskId, { status: newStatus });
      // Refresh workspace activities in background
      if (activeWorkspace) {
        api.getWorkspaceById(activeWorkspace.id).then((res) => {
          setActiveWorkspace(res.workspace);
        });
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
      // Revert if failed
      if (activeProjectId) {
        selectProject(activeProjectId);
      }
    }
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this task?')) {
      try {
        await api.deleteTask(taskId);
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    }
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
    );
  };

  const handleTaskCreated = (newTask: Task) => {
    setTasks((prev) => [newTask, ...prev]);
  };

  // Filtered tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority =
      priorityFilter === 'ALL' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Task Stats
  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const inReviewTasks = tasks.filter((t) => t.status === 'IN_REVIEW').length;
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;

  if (loading && workspaces.length === 0) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 gap-3">
        <Clock className="w-5 h-5 animate-spin text-indigo-500" />
        <span className="text-sm">Loading workspace dashboard...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <Navbar
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={selectWorkspace}
        onOpenCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
        onOpenCreateTask={() => {
          if (!activeProjectId) {
            alert('Please create or select a project first.');
            return;
          }
          setCreateTaskDefaultStatus('TODO');
          setIsCreateTaskOpen(true);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectTaskById={(taskId) => setSelectedTaskId(taskId)}
      />


      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeWorkspace={activeWorkspace}
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={selectProject}
          onOpenCreateProject={() => setIsCreateProjectOpen(true)}
          onOpenInviteMember={() => setIsInviteMemberOpen(true)}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 bg-[#0a0f1d]/50">
          {/* Project & Stats Bar */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                  {activeTab === 'board'
                    ? activeProject?.name || 'Select a Project'
                    : activeTab === 'activity'
                    ? 'Activity History & Audit Trail'
                    : 'Workspace Team Members'}
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {activeTab === 'board'
                  ? activeProject?.description || 'Manage tasks and drag across sprint columns'
                  : activeTab === 'activity'
                  ? 'Audit log of actions across projects and tasks'
                  : 'Manage member access, roles, and collaboration'}
              </p>
            </div>

            {/* Quick Metrics Pills */}
            {activeTab === 'board' && activeProject && (
              <div className="flex items-center gap-2 bg-[#0f172a]/70 p-1.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/60 text-xs">
                  <CircleDot className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400 font-medium">Total:</span>
                  <span className="font-bold text-slate-200">{totalTasks}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-950/40 text-xs">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300 font-medium">In Progress:</span>
                  <span className="font-bold text-amber-300">{inProgressTasks}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-950/40 text-xs">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="text-indigo-300 font-medium">In Review:</span>
                  <span className="font-bold text-indigo-300">{inReviewTasks}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/40 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-medium">Done:</span>
                  <span className="font-bold text-emerald-300">{doneTasks}</span>
                </div>
              </div>
            )}
          </div>

          {/* Tab 1: Board View */}
          {activeTab === 'board' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Filter controls */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium">Priority:</span>
                  <div className="flex gap-1.5">
                    {['ALL', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((pri) => (
                      <button
                        key={pri}
                        onClick={() => setPriorityFilter(pri)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          priorityFilter === pri
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                            : 'bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {pri.charAt(0) + pri.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {activeProjectId && (
                  <button
                    onClick={() => {
                      setCreateTaskDefaultStatus('TODO');
                      setIsCreateTaskOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Task</span>
                  </button>
                )}
              </div>

              {/* Kanban Container */}
              {activeProjectId ? (
                <div className="flex-1 min-h-0">
                  <KanbanBoard
                    tasks={filteredTasks}
                    onTaskMove={handleTaskMove}
                    onOpenDetails={(task) => setSelectedTaskId(task.id)}
                    onDeleteTask={handleDeleteTask}
                    onQuickAddTask={(status) => {
                      setCreateTaskDefaultStatus(status);
                      setIsCreateTaskOpen(true);
                    }}
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#0f172a]/30 border border-slate-800/80 rounded-2xl text-center">
                  <Layers className="w-12 h-12 text-indigo-400/60 mb-3" />
                  <h3 className="text-base font-semibold text-slate-200">No project selected</h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                    Create your first project or select an existing one to launch your Kanban board.
                  </p>
                  <button
                    onClick={() => setIsCreateProjectOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
                  >
                    + Create First Project
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Activity Audit Log */}
          {activeTab === 'activity' && (
            <div className="max-w-3xl">
              <ActivityFeed activities={activeWorkspace?.activities || []} />
            </div>
          )}

          {/* Tab 3: Workspace Members */}
          {activeTab === 'members' && activeWorkspace && (
            <div className="bg-[#0f172a]/70 border border-slate-800 rounded-2xl p-6 max-w-4xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">Team Members</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Colleagues with access to {activeWorkspace.name}
                  </p>
                </div>
                <button
                  onClick={() => setIsInviteMemberOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invite Teammate</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">User</th>
                      <th className="pb-3 font-semibold">Email</th>
                      <th className="pb-3 font-semibold">Role</th>
                      <th className="pb-3 font-semibold">Joined Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeWorkspace.members.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-800/30">
                        <td className="py-3.5 flex items-center gap-3">
                          {member.user.avatar ? (
                            <img
                              src={member.user.avatar}
                              alt={member.user.name}
                              className="w-7 h-7 rounded-full border border-indigo-500/30"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white">
                              {member.user.name[0]}
                            </div>
                          )}
                          <span className="font-semibold text-slate-200">
                            {member.user.name}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-400">{member.user.email}</td>
                        <td className="py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                              member.role === 'OWNER'
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                                : member.role === 'ADMIN'
                                ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/50'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-500">
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {isCreateTaskOpen && activeProjectId && activeWorkspace && (
        <CreateTaskModal
          projectId={activeProjectId}
          defaultStatus={createTaskDefaultStatus}
          members={activeWorkspace.members}
          onClose={() => setIsCreateTaskOpen(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}

      {isCreateProjectOpen && activeWorkspace && (
        <CreateProjectModal
          workspaceId={activeWorkspace.id}
          onClose={() => setIsCreateProjectOpen(false)}
          onProjectCreated={(newProject) => {
            setProjects((prev) => [...prev, newProject]);
            selectProject(newProject.id);
          }}
        />
      )}

      {isCreateWorkspaceOpen && (
        <CreateWorkspaceModal
          onClose={() => setIsCreateWorkspaceOpen(false)}
          onWorkspaceCreated={(newWorkspace) => {
            setWorkspaces((prev) => [newWorkspace, ...prev]);
            selectWorkspace(newWorkspace);
          }}
        />
      )}

      {isInviteMemberOpen && activeWorkspace && (
        <InviteMemberModal
          workspaceId={activeWorkspace.id}
          onClose={() => setIsInviteMemberOpen(false)}
          onMemberAdded={() => selectWorkspace(activeWorkspace)}
        />
      )}

      {selectedTaskId && activeWorkspace && (
        <TaskDetailModal
          taskId={selectedTaskId}
          members={activeWorkspace.members}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={(deletedId) => {
            setTasks((prev) => prev.filter((t) => t.id !== deletedId));
          }}
        />
      )}
    </div>
  );
};
