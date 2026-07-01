import React from 'react';
import type { Activity } from '../types';
import { History, CheckCircle2, MessageSquare, Plus, ArrowRight, UserPlus } from 'lucide-react';

interface ActivityFeedProps {
  activities: Activity[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATED':
        return <Plus className="w-3.5 h-3.5 text-emerald-400" />;
      case 'STATUS_CHANGED':
        return <ArrowRight className="w-3.5 h-3.5 text-amber-400" />;
      case 'COMMENTED':
        return <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />;
      case 'JOINED':
        return <UserPlus className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const formatActivityText = (act: Activity) => {
    const meta = act.metadata || {};
    switch (act.action) {
      case 'CREATED':
        return (
          <span>
            created {act.entityType.toLowerCase()}{' '}
            <strong className="text-slate-200">"{meta.title || meta.name || 'item'}"</strong>
          </span>
        );
      case 'STATUS_CHANGED':
        return (
          <span>
            moved <strong className="text-slate-200">"{meta.title}"</strong> from{' '}
            <span className="text-slate-400">{meta.from}</span> →{' '}
            <span className="text-indigo-400 font-semibold">{meta.to}</span>
          </span>
        );
      case 'ASSIGNED':
        return (
          <span>
            assigned task <strong className="text-slate-200">"{meta.title}"</strong>
          </span>
        );
      case 'COMMENTED':
        return (
          <span>
            commented on <strong className="text-slate-200">"{meta.taskTitle}"</strong>
          </span>
        );
      case 'JOINED':
        return (
          <span>
            added <strong className="text-slate-200">{meta.memberName}</strong> as {meta.role}
          </span>
        );
      case 'DELETED':
        return (
          <span>
            deleted task <strong className="text-slate-200">"{meta.title}"</strong>
          </span>
        );
      default:
        return <span>updated {act.entityType.toLowerCase()}</span>;
    }
  };

  return (
    <div className="bg-[#0f172a]/60 rounded-2xl border border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
        <History className="w-4 h-4 text-indigo-400" />
        <h3 className="font-semibold text-sm text-slate-200">Activity History</h3>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {activities.length > 0 ? (
          activities.map((act) => (
            <div
              key={act.id}
              className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-800/40 transition-colors text-xs"
            >
              <div className="mt-0.5 p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                {getActionBadge(act.action)}
              </div>

              <div className="flex-1">
                <div className="text-slate-300 leading-snug">
                  <span className="font-semibold text-slate-100">{act.user.name}</span>{' '}
                  {formatActivityText(act)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {new Date(act.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-500 italic p-3 text-center">
            No recent activity recorded yet. Actions appear here in real time!
          </p>
        )}
      </div>
    </div>
  );
};
