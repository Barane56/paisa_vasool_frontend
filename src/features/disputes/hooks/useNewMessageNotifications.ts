/**
 * useNewMessageNotifications
 * ──────────────────────────
 * Polls GET /dispute/api/v1/disputes every 30 s and surfaces disputes
 * that have a new unread customer message.
 *
 * Detection strategy (two-layer, most reliable first):
 *
 * 1. `has_new_customer_message` flag from the dispute_new_message table
 *    (set by the agent when a CUSTOMER episode arrives, cleared when FA opens)
 *
 * 2. Fallback: compare dispute `updated_at` against the FA's last-seen
 *    timestamp stored in localStorage — catches cases where the DB table
 *    row doesn't exist yet (e.g. disputes created before migration ran)
 *
 * A notification is shown when EITHER condition is true and the dispute
 * is OPEN or UNDER_REVIEW and hasn't been dismissed by the FA.
 *
 * Dismissal is stored in localStorage keyed by dispute_id + updated_at
 * so dismissing clears the notification until a genuinely new update arrives.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from '@/lib/axios';
import { newMessageService } from '@/features/disputes/services/disputeService';

const DISPUTES_BASE    = '/dispute/api/v1/disputes';
const POLL_INTERVAL_MS = 30_000;
const LS_KEY           = 'pv_last_seen_v2'; // { [dispute_id]: last_updated_at ISO string }

export interface NewMessageNotification {
  dispute_id:             number;
  customer_id:            string;
  dispute_type:           string;
  latest_message_preview: string;
  received_at:            string;
  priority:               string;
}

interface LastSeenMap {
  [disputeId: string]: string; // ISO timestamp FA last dismissed/viewed
}

function loadLastSeen(): LastSeenMap {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLastSeen(map: LastSeenMap) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch { /* quota exceeded — ignore */ }
}

export function useNewMessageNotifications() {
  const [notifications, setNotifications] = useState<NewMessageNotification[]>([]);
  const [isPolling,     setIsPolling]     = useState(false);
  const lastSeenRef = useRef<LastSeenMap>(loadLastSeen());
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      setIsPolling(true);

      const { data } = await axiosInstance.get(DISPUTES_BASE, {
        params: { limit: 100, offset: 0 },
      });

      const items: Array<{
        dispute_id:               number;
        customer_id:              string;
        dispute_type?:            { reason_name?: string } | null;
        status:                   string;
        priority:                 string;
        updated_at:               string;
        description:              string;
        has_new_customer_message?: boolean;
        latest_analysis?:         { ai_summary?: string } | null;
      }> = data.items ?? [];

      const lastSeen = lastSeenRef.current;
      const notifs: NewMessageNotification[] = [];

      for (const d of items) {
        // Only surface active disputes
        if (d.status === 'RESOLVED' || d.status === 'CLOSED') continue;

        const key = String(d.dispute_id);
        const lastSeenAt = lastSeen[key];
        const updatedTs  = new Date(d.updated_at).getTime();
        const lastSeenTs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;

        // Layer 1: explicit flag from dispute_new_message table
        const flaggedByBackend = d.has_new_customer_message === true;

        // Layer 2: fallback — dispute updated after FA last dismissed it
        // Only trigger if there's a previous last-seen (i.e. FA has viewed it before)
        // and the dispute has been updated since then
        const updatedSinceLastSeen = lastSeenAt != null && updatedTs > lastSeenTs;

        const shouldNotify = flaggedByBackend || updatedSinceLastSeen;
        if (!shouldNotify) continue;

        // If FA dismissed at the same or later time than current updated_at → skip
        if (lastSeenAt && lastSeenTs >= updatedTs) continue;

        notifs.push({
          dispute_id:             d.dispute_id,
          customer_id:            d.customer_id,
          dispute_type:           d.dispute_type?.reason_name ?? 'Dispute',
          latest_message_preview: (
            d.latest_analysis?.ai_summary || d.description || 'New activity on this dispute'
          ).slice(0, 120),
          received_at: d.updated_at,
          priority:    d.priority,
        });
      }

      setNotifications(notifs);
    } catch {
      /* silent network blip */
    } finally {
      setIsPolling(false);
    }
  }, []);

  // Start polling on mount
  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll]);

  /**
   * FA opened the dispute — clear notification, persist dismissal timestamp,
   * and clear the backend flag in dispute_new_message table.
   */
  const markRead = useCallback((disputeId: number) => {
    const now = new Date().toISOString();
    const key = String(disputeId);
    lastSeenRef.current = { ...lastSeenRef.current, [key]: now };
    saveLastSeen(lastSeenRef.current);
    setNotifications(prev => prev.filter(n => n.dispute_id !== disputeId));
    // Clear backend flag — fire and forget
    newMessageService.markDisputeRead(disputeId).catch(() => { /* silent */ });
  }, []);

  /** Dismiss all currently visible notifications */
  const markAllRead = useCallback(() => {
    const now     = new Date().toISOString();
    const updated = { ...lastSeenRef.current };
    setNotifications(prev => {
      prev.forEach(n => { updated[String(n.dispute_id)] = now; });
      prev.forEach(n => {
        newMessageService.markDisputeRead(n.dispute_id).catch(() => { /* silent */ });
      });
      return [];
    });
    lastSeenRef.current = updated;
    saveLastSeen(updated);
  }, []);

  /** Force an immediate re-poll */
  const refetch = useCallback(() => poll(), [poll]);

  return {
    notifications,
    unreadCount: notifications.length,
    isPolling,
    markRead,
    markAllRead,
    refetch,
  };
}
