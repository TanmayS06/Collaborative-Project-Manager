import React from 'react';
import type { Task, TaskPriority } from '../types';
import { Calendar, MessageSquare, AlertCircle, Trash2 } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onOpenDetails: (task: Task) => void;
  onDeleteTask: (taskId: string, e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
}

const priorityConfig: Record<TaskPriority, { label: string; badgeClass: string }> = {
  LOW: { label: 'Low', badgeClass: 'bg-slate-800/80 text-slate-300 border-slate-700/60' },
  MEDIUM: { label: 'Medium', badgeClass: 'bg-blue-950/60 text-blue-400 border-blue-800/50' },
  HIGH: { label: 'High', badgeClass: 'bg-amber-950/60 text-amber-400 border-amber-800/50' },
  URGENT: { label: 'Urgent', badgeClass: 'bg-rose-950/70 text-rose-300 border-rose-800/70 animate-pulse' },
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onOpenDetails,
  onDeleteTask,
  onDragStart,
}) => {
  const priority = priorityConfig[task.priority] || priorityConfig.MEDIUM;

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const isPast = date < new Date() && task.status !== 'DONE';
    return {
      text: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      isPast,
    };
  };

  const due = formatDueDate(task.dueDate);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, task.id)}
      onClick={() => onOpenDetails(task)}
      className="group relative bg-[#131b2e]/70 hover:bg-[#18233c]/90 border border-slate-800/80 hover:border-indigo-500/40 rounded-xl p-3.5 shadow-lg shadow-black/20 hover:shadow-indigo-500/10 cursor-grab active:cursor-grabbing transition-all duration-200"
    >
      {/* Top row: Priority badge + Quick actions */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${priority.badgeClass}`}
        >
          {priority.label}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteTask(task.id, e);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-all"
          title="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-200 transition-colors line-clamp-2 mb-1.5">
        {task.title}
      </h4>

      {/* Description Snippet */}
      {task.description && (
        <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Card Footer: Due date, comment count, and assignee avatar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-2 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          {due && (
            <div
              className={`flex items-center gap-1 font-medium ${
                due.isPast ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              {due.isPast ? <AlertCircle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
              <span>{due.text}</span>
            </div>
          )}

          {(task._count?.comments || (task.comments && task.comments.length > 0)) ? (
            <div className="flex items-center gap-1 text-slate-400">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{task._count?.comments || task.comments?.length}</span>
            </div>
          ) : null}
        </div>

        {/* Assignee Avatar */}
        {task.assignee ? (
          <div
            className="flex items-center gap-1.5"
            title={`Assigned to ${task.assignee.name}`}
          >
            {task.assignee.avatar ? (
              <img
                src={task.assignee.avatar}
                alt={task.assignee.name}
                className="w-5 h-5 rounded-full border border-indigo-500/30"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-indigo-600 text-[10px] font-bold text-white flex items-center justify-center">
                {task.assignee.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-slate-600 italic">Unassigned</span>
        )}
      </div>
    </div>
  );
};
