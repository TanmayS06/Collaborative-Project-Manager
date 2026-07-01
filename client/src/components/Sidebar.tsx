import React from 'react';
import type { Workspace, Project } from '../types';
import {
  FolderKanban,
  FolderPlus,
  Users,
  UserPlus,
  Activity as ActivityIcon,
} from 'lucide-react';

interface SidebarProps {
  activeWorkspace: Workspace | null;
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onOpenCreateProject: () => void;
  onOpenInviteMember: () => void;
  activeTab: 'board' | 'activity' | 'members';
  onSelectTab: (tab: 'board' | 'activity' | 'members') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeWorkspace,
  projects,
  activeProjectId,
  onSelectProject,
  onOpenCreateProject,
  onOpenInviteMember,
  activeTab,
  onSelectTab,
}) => {
  return (
    <aside className="w-64 h-[calc(100vh-4rem)] bg-[#0c1222]/90 border-r border-slate-800/80 flex flex-col p-4 shrink-0 overflow-y-auto">
      {/* Workspace Header Snippet */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-slate-100 truncate">
          {activeWorkspace?.name || 'Workspace'}
        </h2>
        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
          {activeWorkspace?.description || 'Collaborative workspace'}
        </p>
      </div>

      {/* Primary Navigation Views */}
      <div className="space-y-1 mb-6">
        <button
          onClick={() => onSelectTab('board')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'board'
              ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>Kanban Board</span>
        </button>

        <button
          onClick={() => onSelectTab('activity')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'activity'
              ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ActivityIcon className="w-4 h-4" />
          <span>Activity Feed</span>
        </button>

        <button
          onClick={() => onSelectTab('members')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'members'
              ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Members</span>
          <span className="ml-auto text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
            {activeWorkspace?.members?.length || 1}
          </span>
        </button>
      </div>

      {/* Projects List */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Projects ({projects.length})
          </span>
          <button
            onClick={onOpenCreateProject}
            className="p-1 text-slate-400 hover:text-indigo-400 rounded-md hover:bg-slate-800 transition-colors"
            title="Create Project"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          {projects.map((proj) => {
            const isSelected = proj.id === activeProjectId && activeTab === 'board';
            return (
              <button
                key={proj.id}
                onClick={() => {
                  onSelectProject(proj.id);
                  onSelectTab('board');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                  isSelected
                    ? 'bg-slate-800 text-indigo-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  <span className="truncate">{proj.name}</span>
                </div>
                {proj._count?.tasks !== undefined && (
                  <span className="text-[10px] text-slate-500 ml-2">
                    {proj._count.tasks}
                  </span>
                )}
              </button>
            );
          })}

          {projects.length === 0 && (
            <div
              onClick={onOpenCreateProject}
              className="text-center py-4 border border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-slate-300 hover:border-slate-700 cursor-pointer text-xs"
            >
              + Add first project
            </div>
          )}
        </div>
      </div>

      {/* Bottom Invite Member Callout */}
      <div className="pt-4 border-t border-slate-800/80">
        <button
          onClick={onOpenInviteMember}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-semibold transition-all"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Invite Member</span>
        </button>
      </div>
    </aside>
  );
};
