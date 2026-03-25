/**
 * NotificationBell
 * ─────────────────
 * Header bell button with badge count + dropdown panel showing
 * new customer messages per dispute.
 *
 * Props:
 *   notifications — from useNewMessageNotifications()
 *   onOpen        — called with dispute_id when FA clicks a notification
 *   onMarkRead    — clear one notification
 *   onMarkAllRead — clear all
 */
import { useState, useRef, useEffect } from 'react';
import { Bell, X, MessageSquare, CheckCheck, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { NewMessageNotification } from '@/features/disputes/hooks/useNewMessageNotifications';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PRIORITY_DOT: Record<string, string> = {
  HIGH:   'bg-brand-600',
  MEDIUM: 'bg-brand-400',
  LOW:    'bg-brand-300',
};

interface NotificationBellProps {
  notifications: NewMessageNotification[];
  onOpen: (disputeId: number) => void;
  onMarkRead: (disputeId: number) => void;
  onMarkAllRead: () => void;
  isPolling?: boolean;
}

export const NotificationBell = ({
  notifications,
  onOpen,
  onMarkRead,
  onMarkAllRead,
  isPolling,
}: NotificationBellProps) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const count = notifications.length;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'relative p-2 rounded-xl transition-all duration-150',
          open
            ? 'bg-brand-100 text-brand-700'
            : 'hover:bg-surface-100 text-surface-500 hover:text-surface-800'
        )}
        aria-label={`${count} new message${count !== 1 ? 's' : ''}`}
      >
        {isPolling ? (
          <Loader2 size={17} className="animate-spin text-brand-400" />
        ) : (
          <Bell size={17} />
        )}

        {/* Unread badge */}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-brand-600 text-white text-[10px] font-bold rounded-full px-1 shadow-sm animate-in zoom-in-75 duration-200">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-modal border border-surface-200 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 bg-gradient-to-r from-brand-50 to-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center">
                <MessageSquare size={15} className="text-brand-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-surface-900">New Messages</p>
                <p className="text-xs text-gray-400">
                  {count === 0
                    ? 'All caught up!'
                    : `${count} unread case${count !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-all"
                  title="Mark all read"
                >
                  <CheckCheck size={12} /> All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-100 text-gray-400 hover:text-surface-700 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-surface-100">
            {count === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center mb-3">
                  <CheckCheck size={20} className="text-brand-600" />
                </div>
                <p className="text-sm font-semibold text-surface-800">You're all caught up!</p>
                <p className="text-xs text-gray-400 mt-1">
                  No new customer messages right now.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.dispute_id}
                  className="group flex items-start gap-3 px-5 py-4 hover:bg-brand-50/60 cursor-pointer transition-colors"
                  onClick={() => {
                    onOpen(n.dispute_id);
                    onMarkRead(n.dispute_id);
                    setOpen(false);
                  }}
                >
                  {/* Priority dot + icon */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                      <MessageSquare size={16} className="text-brand-600" />
                    </div>
                    <span
                      className={clsx(
                        'absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
                        PRIORITY_DOT[n.priority] ?? 'bg-gray-400'
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-bold text-surface-900 truncate">
                        #{n.dispute_id} · {n.dispute_type}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                        {timeAgo(n.received_at)}
                      </span>
                    </div>
                    <p className="text-xs text-brand-600 font-semibold mb-1 truncate">
                      {n.customer_id}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                      {n.latest_message_preview}
                    </p>
                  </div>

                  {/* Dismiss button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkRead(n.dispute_id);
                    }}
                    className="shrink-0 mt-0.5 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-surface-200 text-gray-400 hover:text-surface-700 transition-all"
                    title="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {count > 0 && (
            <div className="px-5 py-3 border-t border-surface-100 bg-surface-50 flex items-center justify-between">
              <p className="text-[10px] text-gray-400 font-medium">
                Polling every 30s · Click a case to open it
              </p>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-500">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                Live
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
