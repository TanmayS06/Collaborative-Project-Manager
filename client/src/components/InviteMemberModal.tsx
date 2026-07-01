import React, { useState } from 'react';
import type { WorkspaceRole } from '../types';
import { api } from '../services/api';
import { X, UserPlus } from 'lucide-react';

interface InviteMemberModalProps {
  workspaceId: string;
  onClose: () => void;
  onMemberAdded: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  workspaceId,
  onClose,
  onMemberAdded,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('MEMBER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const res = await api.addWorkspaceMember(workspaceId, {
        email: email.trim().toLowerCase(),
        role,
      });

      setSuccess(res.message || 'Member added successfully');
      setTimeout(() => {
        onMemberAdded();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to add member to workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131d36]/70">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-sm text-slate-100">Invite Workspace Member</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="mx-6 mt-4 p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-lg text-emerald-300 text-xs">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              User Email <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              required
              autoFocus
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#16213b] border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Note: The user must have already registered an account with this email.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Role & Permissions
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                onClick={() => setRole('MEMBER')}
                className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${
                  role === 'MEMBER'
                    ? 'border-indigo-500 bg-indigo-950/30 text-indigo-300'
                    : 'border-slate-800 bg-[#16213b]/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Member</span>
                  <span className="text-[10px] text-slate-400">Can view & edit tasks</span>
                </div>
              </label>

              <label
                onClick={() => setRole('ADMIN')}
                className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${
                  role === 'ADMIN'
                    ? 'border-indigo-500 bg-indigo-950/30 text-indigo-300'
                    : 'border-slate-800 bg-[#16213b]/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Admin</span>
                  <span className="text-[10px] text-slate-400">Can invite & manage</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
            >
              {loading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
