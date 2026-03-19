/**
 * useNewMessageNotifications
 * ──────────────────────────
 * Polls GET /dispute/api/v1/disputes every 30 s.
 *
 * The backend already returns `has_new_customer_message: boolean` on every
 * DisputeDetailResponse — it's true when the latest memory episode actor
 * is "CUSTOMER". We use that flag directly, zero extra API calls.
 *
 * Persistence: we track which dispute_ids the FA has explicitly dismissed
 * in localStorage so notifications don't re-appear on refresh until a new
 * customer message actually arrives after the dismissal.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from '@/lib/axios';

const DISPUTES_BASE    = '/dispute/api/v1/disputes';
const POLL_INTERVAL_MS = 30_000;
const LS_KEY           = 'pv_dismissed_new_msg'; // { [dispute_id]: last_updated_at ISO }

export interface NewMessageNotification {
  dispute_id:             number;
  customer_id:            string;
  dispute_type:           string;
  latest_message_preview: string;   // from ai_summary or description
  received_at:            string;   // dispute updated_at
  priority:               string;
}

interface DismissedMap {
  [disputeId: number]: string; // ISO — updated_at at time of dismiss
}

function loadDismissed(): DismissedMap {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDismissed(map: DismissedMap) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch { /* quota exceeded */ }
}

export function useNewMessageNotifications() {
  const [notifications, setNotifications] = useState<NewMessageNotification[]>([]);
  const [isPolling,     setIsPolling]     = useState(false);
  const dismissedRef = useRef<DismissedMap>(loadDismissed());
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      setIsPolling(true);

      // Single call — backend returns has_new_customer_message on each item
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
        has_new_customer_message: boolean;
        latest_analysis?:         { ai_summary?: string } | null;
      }> = data.items ?? [];

      const dismissed = dismissedRef.current;
      const notifs: NewMessageNotification[] = [];

      for (const d of items) {
        // Skip if the backend says no new customer message
        if (!d.has_new_customer_message) continue;

        // Skip resolved / closed disputes — FA doesn't need to see those
        if (d.status === 'RESOLVED' || d.status === 'CLOSED') continue;

        // Skip if FA already dismissed this and the dispute hasn't been updated since
        const prevDismissedAt = dismissed[d.dispute_id];
        if (prevDismissedAt) {
          const dismissedTs = new Date(prevDismissedAt).getTime();
          const updatedTs   = new Date(d.updated_at).getTime();
          if (updatedTs <= dismissedTs) continue;
        }

        notifs.push({
          dispute_id:             d.dispute_id,
          customer_id:            d.customer_id,
          dispute_type:           d.dispute_type?.reason_name ?? 'Dispute',
          latest_message_preview: (
            d.latest_analysis?.ai_summary || d.description || 'New customer message'
          ).slice(0, 120),
          received_at:            d.updated_at,
          priority:               d.priority,
        });
      }

      setNotifications(notifs);
    } catch {
      /* silent — network blip */
    } finally {
      setIsPolling(false);
    }
  }, []);

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [poll]);

  /** FA opened the dispute — dismiss its notification */
  const markRead = useCallback((disputeId: number) => {
    const now = new Date().toISOString();
    dismissedRef.current = { ...dismissedRef.current, [disputeId]: now };
    saveDismissed(dismissedRef.current);
    setNotifications(prev => prev.filter(n => n.dispute_id !== disputeId));
  }, []);

  /** Dismiss everything currently visible */
  const markAllRead = useCallback(() => {
    const now     = new Date().toISOString();
    const updated = { ...dismissedRef.current };
    setNotifications(prev => {
      prev.forEach(n => { updated[n.dispute_id] = now; });
      return [];
    });
    dismissedRef.current = updated;
    saveDismissed(updated);
  }, []);

  return { notifications, unreadCount: notifications.length, isPolling, markRead, markAllRead, refetch: poll };
}
