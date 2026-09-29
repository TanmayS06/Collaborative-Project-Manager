import React, { useState } from 'react';
import type { Task, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { Plus, CircleDot, Clock, CheckCircle2, Eye } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onOpenDetails: (task: Task) => void;
  onDeleteTask: (taskId: string, e: React.MouseEvent) => void;
  onQuickAddTask: (status: TaskStatus) => void;
}

interface ColumnConfig {
  id: TaskStatus;
  title: string;
  icon: React.ReactNode;
  borderAccent: string;
  badgeBg: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'TODO',
    title: 'To Do',
    icon: <CircleDot className="w-4 h-4 text-slate-400" />,
    borderAccent: 'border-t-slate-500',
    badgeBg: 'bg-slate-800 text-slate-300',
  },
  {
    id: 'IN_PROGRESS',
    title: 'In Progress',
    icon: <Clock className="w-4 h-4 text-amber-400" />,
    borderAccent: 'border-t-amber-500',
    badgeBg: 'bg-amber-950/70 text-amber-300',
  },
  {
    id: 'IN_REVIEW',
    title: 'In Review',
    icon: <Eye className="w-4 h-4 text-indigo-400" />,
    borderAccent: 'border-t-indigo-500',
    badgeBg: 'bg-indigo-950/70 text-indigo-300',
  },
  {
    id: 'DONE',
    title: 'Done',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    borderAccent: 'border-t-emerald-500',
    badgeBg: 'bg-emerald-950/70 text-emerald-300',
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onTaskMove,
  onOpenDetails,
  onDeleteTask,
  onQuickAddTask,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<TaskStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault();
    if (hoveredColumn !== columnId) {
      setHoveredColumn(columnId);
    }
  };

  const handleDragLeave = () => {
    setHoveredColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault();
    setHoveredColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== columnId) {
        await onTaskMove(taskId, columnId);
      }
    }
    setDraggedTaskId(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 h-full items-start overflow-x-auto pb-6">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.id);
        const isHovered = hoveredColumn === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`flex flex-col bg-[#0f172a]/60 backdrop-blur-md rounded-2xl border ${
              isHovered
                ? 'border-indigo-500/80 bg-indigo-950/20 ring-2 ring-indigo-500/30'
                : 'border-slate-800/80'
            } ${col.borderAccent} border-t-2 min-h-[500px] max-h-[calc(100vh-220px)] transition-all duration-150`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                {col.icon}
                <h3 className="font-semibold text-sm text-slate-200">{col.title}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.badgeBg}`}
                >
                  {columnTasks.length}
                </span>
              </div>

              <button
                onClick={() => onQuickAddTask(col.id)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors"
                title={`Add task to ${col.title}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Tasks Container */}
            <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpenDetails={onOpenDetails}
                  onDeleteTask={onDeleteTask}
                  onDragStart={handleDragStart}
                />
              ))}

              {columnTasks.length === 0 && (
                <div
                  onClick={() => onQuickAddTask(col.id)}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-800/60 rounded-xl hover:border-slate-700/80 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer group"
                >
                  <Plus className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-medium">No tasks yet</p>
                  <p className="text-[11px] text-slate-600">Click to add</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
