import React, { useState, useEffect, useRef } from 'react';
import type { Task, TaskStatus, TaskPriority, WorkspaceMember, TaskComment, TaskAttachment } from '../types';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  X,
  MessageSquare,
  Send,
  Trash2,
  Clock,
  Paperclip,
  FileText,
  Download,
  UploadCloud,
} from 'lucide-react';

interface TaskDetailModalProps {
  taskId: string;
  members: WorkspaceMember[];
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
  onTaskDeleted: (taskId: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  taskId,
  members,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}) => {
  const { socket } = useSocket();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTaskDetails();
  }, [taskId]);

  // Real-time synchronization for comments, attachments, and updates
  useEffect(() => {
    if (!socket) return;

    const handleCommentCreated = (payload: { taskId: string; comment: TaskComment }) => {
      if (payload.taskId === taskId) {
        setTask((prev) => {
          if (!prev) return null;
          if (prev.comments?.some((c) => c.id === payload.comment.id)) return prev;
          return {
            ...prev,
            comments: [...(prev.comments || []), payload.comment],
          };
        });
      }
    };

    const handleTaskLiveUpdated = (updatedTask: Task) => {
      if (updatedTask.id === taskId) {
        setTask((prev) => (prev ? { ...prev, ...updatedTask } : null));
      }
    };

    const handleAttachmentAdded = (payload: { taskId: string; attachment: TaskAttachment }) => {
      if (payload.taskId === taskId) {
        setTask((prev) => {
          if (!prev) return null;
          if (prev.attachments?.some((a) => a.id === payload.attachment.id)) return prev;
          return {
            ...prev,
            attachments: [payload.attachment, ...(prev.attachments || [])],
          };
        });
      }
    };

    const handleAttachmentDeleted = (payload: { taskId: string; attachmentId: string }) => {
      if (payload.taskId === taskId) {
        setTask((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            attachments: prev.attachments?.filter((a) => a.id !== payload.attachmentId) || [],
          };
        });
      }
    };

    socket.on('comment:created', handleCommentCreated);
    socket.on('task:updated', handleTaskLiveUpdated);
    socket.on('attachment:added', handleAttachmentAdded);
    socket.on('attachment:deleted', handleAttachmentDeleted);

    return () => {
      socket.off('comment:created', handleCommentCreated);
      socket.off('task:updated', handleTaskLiveUpdated);
      socket.off('attachment:added', handleAttachmentAdded);
      socket.off('attachment:deleted', handleAttachmentDeleted);
    };
  }, [socket, taskId]);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      const res = await api.getTaskById(taskId);
      setTask(res.task);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch task');
    } finally {

      setLoading(false);
    }
  };

  const handleUpdate = async (updates: Partial<Task>) => {
    if (!task) return;
    try {
      setSaving(true);
      const res = await api.updateTask(task.id, updates as any);
      setTask((prev) => (prev ? { ...prev, ...res.task } : null));
      onTaskUpdated(res.task);
    } catch (err: any) {
      setError(err.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !commentText.trim()) return;

    try {
      setSubmittingComment(true);
      const res = await api.addComment(task.id, commentText.trim());
      setTask((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          comments: [...(prev.comments || []), res.comment],
        };
      });
      setCommentText('');
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    try {
      setUploadingAttachment(true);
      const res = await api.uploadAttachment(task.id, file);
      setTask((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          attachments: [res.attachment, ...(prev.attachments || [])],
        };
      });
    } catch (err: any) {
      setError(err.message || 'Failed to upload attachment');
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!task) return;
    try {
      await api.deleteAttachment(task.id, attachmentId);
      setTask((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          attachments: prev.attachments?.filter((a) => a.id !== attachmentId) || [],
        };
      });
    } catch (err: any) {
      setError(err.message || 'Failed to delete attachment');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDelete = async () => {
    if (!task) return;
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await api.deleteTask(task.id);
        onTaskDeleted(task.id);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to delete task');
      }
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-[#111827] p-8 rounded-2xl border border-slate-800 flex items-center gap-3 text-slate-300">
          <Clock className="w-5 h-5 animate-spin text-indigo-500" />
          <span>Loading task details...</span>
        </div>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131d36]/70">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              TASK-{task.id.slice(0, 6).toUpperCase()}
            </span>
            {saving && <span className="text-xs text-amber-400 animate-pulse">Saving changes...</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Content (2 cols) */}
          <div className="md:col-span-2 space-y-5">
            {/* Title Input */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">
                Title
              </label>
              <input
                type="text"
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                onBlur={() => handleUpdate({ title: task.title })}
                className="w-full bg-[#16213b] border border-slate-700/60 rounded-xl px-4 py-2.5 text-base font-medium text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Description Textarea */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">
                Description
              </label>
              <textarea
                rows={4}
                value={task.description || ''}
                placeholder="Add more details, acceptance criteria, or context..."
                onChange={(e) => setTask({ ...task, description: e.target.value })}
                onBlur={() => handleUpdate({ description: task.description })}
                className="w-full bg-[#16213b] border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors resize-none placeholder-slate-500"
              />
            </div>

            {/* Attachments Section */}
            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                  <Paperclip className="w-4 h-4 text-indigo-400" />
                  <span>Attachments ({task.attachments?.length || 0})</span>
                </div>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAttachment}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700/60"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{uploadingAttachment ? 'Uploading...' : 'Upload File'}</span>
                  </button>
                </div>
              </div>

              {/* Attachments List */}
              {task.attachments && task.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {task.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2.5 bg-[#141e34]/70 border border-slate-800/80 rounded-xl group hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate" title={att.fileName}>
                            {att.fileName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatFileSize(att.fileSize)} • {new Date(att.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <a
                          href={att.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={att.fileName}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-1">
                  No attachments yet. Upload PDFs, images, specifications, or diagrams.
                </p>
              )}
            </div>

            {/* Comments Section */}
            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2 mb-4 text-slate-200 font-semibold text-sm">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>Discussion & Activity ({task.comments?.length || 0})</span>
              </div>

              {/* Comment Thread */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1 mb-4">
                {task.comments && task.comments.length > 0 ? (
                  task.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-[#141e34]/70 border border-slate-800/80 rounded-xl p-3 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {comment.user.avatar ? (
                            <img
                              src={comment.user.avatar}
                              alt={comment.user.name}
                              className="w-5 h-5 rounded-full"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white">
                              {comment.user.name[0]}
                            </div>
                          )}
                          <span className="font-semibold text-slate-200">
                            {comment.user.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(comment.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed pl-7">
                        {comment.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic py-2">
                    No comments yet. Start the conversation!
                  </p>
                )}
              </div>

              {/* Add Comment Input */}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment or update..."
                  className="flex-1 bg-[#16213b] border border-slate-700/60 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Meta Column (1 col) */}
          <div className="bg-[#131d36]/60 rounded-xl p-4 border border-slate-800/80 space-y-4">
            {/* Status */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                Status
              </label>
              <select
                value={task.status}
                onChange={(e) => {
                  const newStatus = e.target.value as TaskStatus;
                  setTask({ ...task, status: newStatus });
                  handleUpdate({ status: newStatus });
                }}
                className="w-full bg-[#18233e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                Priority
              </label>
              <select
                value={task.priority}
                onChange={(e) => {
                  const newPriority = e.target.value as TaskPriority;
                  setTask({ ...task, priority: newPriority });
                  handleUpdate({ priority: newPriority });
                }}
                className="w-full bg-[#18233e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent ⚡</option>
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                Assignee
              </label>
              <select
                value={task.assigneeId || ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setTask({
                    ...task,
                    assigneeId: val,
                    assignee: members.find((m) => m.userId === val)?.user || null,
                  });
                  handleUpdate({ assigneeId: val });
                }}
                className="w-full bg-[#18233e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">
                Due Date
              </label>
              <input
                type="date"
                value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setTask({ ...task, dueDate: val });
                  handleUpdate({ dueDate: val });
                }}
                className="w-full bg-[#18233e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Info footer */}
            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
              <p>Created by: {task.createdBy?.name || 'User'}</p>
              <p>Created: {new Date(task.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
