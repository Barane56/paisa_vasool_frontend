import axiosInstance from '@/lib/axios';

const BASE = '/dispute/api/v1';

export interface Mailbox {
  mailbox_id: number;
  label: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  use_ssl: boolean;
  smtp_host: string | null;
  smtp_port: number;
  smtp_use_tls: boolean;
  is_active: boolean;
  is_paused: boolean;
  last_polled_at: string | null;
  last_uid_seen: number | null;
  created_at: string;
}

export interface MailboxCreatePayload {
  label: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  use_ssl: boolean;
  password: string;
  smtp_host: string | null;
  smtp_port: number;
  smtp_use_tls: boolean;
}

export interface MailboxTestResult {
  mailbox_id: number;
  imap_ok: boolean;
  smtp_ok: boolean;
  message: string;
}

export interface OutboundEmail {
  outbound_id: number;
  dispute_id: number;
  sent_by_user_id: number | null;
  sent_by_name: string | null;
  from_email: string;
  to_email: string;
  subject: string;
  body_html: string;
  body_text: string;
  message_id_header: string | null;
  in_reply_to_header: string | null;
  references_header: string | null;
  thread_root_message_id: string | null;
  email_kind: 'AI_RESPONSE' | 'AI_ACK' | 'FA_REPLY' | 'OOS_REJECTION' | 'FORK_NOTIFICATION';
  trigger_email_id: number | null;
  sent_at: string | null;
  status: 'PENDING' | 'SENT' | 'FAILED';
  failure_reason: string | null;
  attachments: OutboundAttachment[];
  created_at: string;
}

export interface OutboundAttachment {
  attachment_id: number;
  file_name: string;
  file_type: string;
  file_size: number | null;
  created_at: string;
}

export interface InboxMessage {
  message_id: number;
  mailbox_id: number | null;
  source: string;
  direction: string;
  sender_email: string;
  recipient_email: string | null;
  subject: string;
  body_text: string;
  body_html: string | null;
  received_at: string;
  has_attachment: boolean;
  dispute_id: number | null;
  processing_status: string;
  in_reply_to_header: string | null;
  references_header: string | null;
  attachments: InboxAttachment[];
  created_at: string;
}

export interface InboxAttachment {
  attachment_id: number;
  file_name: string;
  file_type: string;
  file_size: number | null;
  file_path: string;
  created_at: string;
}

export const mailboxService = {
  // ── Mailbox CRUD ─────────────────────────────────────────────────────────

  list: async (): Promise<Mailbox[]> => {
    const { data } = await axiosInstance.get<Mailbox[]>(`${BASE}/mailboxes`);
    return data;
  },

  get: async (id: number): Promise<Mailbox> => {
    const { data } = await axiosInstance.get<Mailbox>(`${BASE}/mailboxes/${id}`);
    return data;
  },

  create: async (payload: MailboxCreatePayload): Promise<Mailbox> => {
    const { data } = await axiosInstance.post<Mailbox>(`${BASE}/mailboxes`, payload);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`${BASE}/mailboxes/${id}`);
  },

  pause: async (id: number): Promise<Mailbox> => {
    const { data } = await axiosInstance.post<Mailbox>(`${BASE}/mailboxes/${id}/pause`);
    return data;
  },

  unpause: async (id: number): Promise<Mailbox> => {
    const { data } = await axiosInstance.post<Mailbox>(`${BASE}/mailboxes/${id}/unpause`);
    return data;
  },

  test: async (id: number): Promise<MailboxTestResult> => {
    const { data } = await axiosInstance.get<MailboxTestResult>(`${BASE}/mailboxes/${id}/test`);
    return data;
  },

  // ── Outbound emails ───────────────────────────────────────────────────────

  getOutboundForDispute: async (disputeId: number): Promise<OutboundEmail[]> => {
    const { data } = await axiosInstance.get<OutboundEmail[]>(
      `${BASE}/disputes/${disputeId}/outbound`
    );
    return data;
  },

  sendEmail: async (
    disputeId: number,
    payload: {
      to_email: string;
      subject: string;
      body_html: string;
      body_text: string;
      new_thread?: boolean;
    },
    attachments: File[]
  ): Promise<OutboundEmail> => {
    const form = new FormData();
    form.append('to_email', payload.to_email);
    form.append('subject', payload.subject);
    form.append('body_html', payload.body_html);
    form.append('body_text', payload.body_text);
    form.append('new_thread', payload.new_thread ? 'true' : 'false');
    attachments.forEach(f => form.append('attachments', f));
    const { data } = await axiosInstance.post<OutboundEmail>(
      `${BASE}/disputes/${disputeId}/send-email`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  },

  // ── Inbox messages ────────────────────────────────────────────────────────

  getInboxForDispute: async (disputeId: number): Promise<InboxMessage[]> => {
    const { data } = await axiosInstance.get<InboxMessage[]>(
      `${BASE}/inbox/disputes/${disputeId}/messages`
    );
    return data;
  },
};
