import axiosInstance from '@/lib/axios';

const DISPUTES_BASE = '/dispute/api/v1/disputes';
const EMAILS_BASE   = '/dispute/api/v1/emails';

// ── Email ingest ─────────────────────────────────────────────────────────────
export interface EmailIngestResponse {
  email_id: number;
  processing_status: string;
  task_id: string;
}

export interface TaskStatusResponse {
  task_id: string;
  status: string;   // PENDING | STARTED | SUCCESS | FAILURE
  result: unknown | null;
}

export interface EmailResponse {
  email_id: number;
  sender_email: string;
  subject: string;
  body_text: string;
  received_at: string;
  has_attachment: boolean;
  processing_status: string;
  failure_reason: string | null;
  dispute_id: number | null;
  routing_confidence: number | null;
  attachments: Array<{
    attachment_id: number;
    file_name: string;
    file_type: string;
    uploaded_at: string;
  }>;
}

// ── Dispute types ─────────────────────────────────────────────────────────────
export interface DisputeType {
  dispute_type_id: number;
  reason_name: string;
  description: string;
  is_active: boolean;
}

export interface AIAnalysis {
  analysis_id: number;
  predicted_category: string;
  confidence_score: number;
  ai_summary: string;
  ai_response: string | null;
  auto_response_generated: boolean;
  memory_context_used: boolean;
  episodes_referenced: number[] | null;
  created_at: string;
}

export interface Dispute {
  dispute_id: number;
  email_id: number;
  invoice_id: number | null;
  payment_detail_id: number | null;
  customer_id: string;
  dispute_type: DisputeType | null;
  status: string;
  priority: string;
  description: string;
  created_at: string;
  updated_at: string;
  // Detail-only fields
  latest_analysis?: AIAnalysis | null;
  open_questions_count?: number;
  assigned_to?: string | null;
}

export interface DisputeListResponse {
  total: number;
  items: Dispute[];
}

export interface TimelineEpisode {
  episode_id: number;
  actor: string;
  episode_type: string;
  content_text: string;
  created_at: string;
}

export interface SupportingDoc {
  attachment_id: number;
  file_name: string;
  file_type: string;
  file_url: string;
  uploaded_at: string;
}

// ── Email service ─────────────────────────────────────────────────────────────
const emailService = {
  ingest: async (file: File, senderEmail: string, subject: string): Promise<EmailIngestResponse> => {
    const form = new FormData();
    form.append('file', file);
    form.append('sender_email', senderEmail);
    form.append('subject', subject);
    const { data } = await axiosInstance.post<EmailIngestResponse>(
      `${EMAILS_BASE}/ingest`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  },

  getTaskStatus: async (taskId: string): Promise<TaskStatusResponse> => {
    const { data } = await axiosInstance.get<TaskStatusResponse>(
      `${EMAILS_BASE}/task/${taskId}/status`
    );
    return data;
  },

  getEmail: async (emailId: number): Promise<EmailResponse> => {
    const { data } = await axiosInstance.get<EmailResponse>(`${EMAILS_BASE}/${emailId}`);
    return data;
  },
};

// ── Dispute service ───────────────────────────────────────────────────────────
const disputeService = {
  list: async (params?: {
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<DisputeListResponse> => {
    const { data } = await axiosInstance.get<DisputeListResponse>(DISPUTES_BASE, { params });
    return data;
  },

  myDisputes: async (limit = 20, offset = 0): Promise<DisputeListResponse> => {
    const { data } = await axiosInstance.get<DisputeListResponse>(`${DISPUTES_BASE}/my`, {
      params: { limit, offset },
    });
    return data;
  },

  getDetail: async (disputeId: number): Promise<Dispute> => {
    const { data } = await axiosInstance.get<Dispute>(`${DISPUTES_BASE}/${disputeId}`);
    return data;
  },

  getTimeline: async (disputeId: number): Promise<{
    dispute_id: number;
    customer_id: string;
    status: string;
    timeline: TimelineEpisode[];
    pending_questions: number;
    assigned_to: string | null;
  }> => {
    const { data } = await axiosInstance.get(`${DISPUTES_BASE}/${disputeId}/timeline`);
    return data;
  },

  getAnalysis: async (disputeId: number): Promise<AIAnalysis> => {
    const { data } = await axiosInstance.get<AIAnalysis>(`${DISPUTES_BASE}/${disputeId}/analysis`);
    return data;
  },

  // Supporting documents come from the email attachments for this dispute
  getSupportingDocs: async (emailId: number): Promise<SupportingDoc[]> => {
    const { data } = await axiosInstance.get<EmailResponse>(`${EMAILS_BASE}/${emailId}`);
    return data.attachments.map((a) => ({
      attachment_id: a.attachment_id,
      file_name: a.file_name,
      file_type: a.file_type,
      file_url: `/api/v1/emails/attachments/${a.attachment_id}`,
      uploaded_at: a.uploaded_at,
    }));
  },
};

export { emailService, disputeService };