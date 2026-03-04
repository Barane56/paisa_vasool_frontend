import axiosInstance from '@/lib/axios';

const DISPUTES_BASE = '/dispute/api/v1/disputes';
const EMAILS_BASE   = '/dispute/api/v1/emails';
const INVOICES_BASE = '/dispute/api/v1/invoices';
const PAYMENTS_BASE = '/dispute/api/v1/payments';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DisputeType {
  dispute_type_id: number;
  reason_name: string;
  description: string | null;
  is_active?: boolean;
  severity_level?: string | null;
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

// ─── Invoice ──────────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  description: string;
  qty?: number;
  quantity?: number;
  unit_price?: number;
  total?: number;
}

export interface InvoiceDetails {
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  vendor_name?: string;
  customer_name?: string;
  customer_id?: string;
  line_items?: InvoiceLineItem[];
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  currency?: string;
  payment_terms?: string;
  [key: string]: unknown;
}

export interface InvoiceData {
  invoice_id: number;
  invoice_number: string;
  invoice_url: string;
  invoice_details: InvoiceDetails;
  updated_at: string;
}

// ─── Payment Detail ───────────────────────────────────────────────────────────

export interface PaymentDetails {
  payment_reference?: string;
  payment_date?: string;
  amount_paid?: number;
  payment_mode?: string;
  bank_reference?: string;
  invoice_number?: string;
  customer_id?: string;
  status?: string;
  note?: string;
  [key: string]: unknown;
}

export interface PaymentDetailData {
  payment_detail_id: number;
  customer_id: string;
  invoice_number: string;
  payment_url: string;
  payment_details: PaymentDetails | null;
}

// ─── Email types ──────────────────────────────────────────────────────────────

export interface EmailIngestResponse {
  email_id: number;
  processing_status: string;
  task_id: string;
}

export interface TaskStatusResponse {
  task_id: string;
  status: string;
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

// ─── Dispute service ──────────────────────────────────────────────────────────

export const disputeService = {
  list: async (params?: {
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<DisputeListResponse> => {
    const { data } = await axiosInstance.get<DisputeListResponse>(DISPUTES_BASE, { params });
    return data;
  },

  myDisputes: async (params?: {
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<DisputeListResponse> => {
    const { data } = await axiosInstance.get<DisputeListResponse>(`${DISPUTES_BASE}/my`, { params });
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

  updateStatus: async (disputeId: number, status: string, notes?: string): Promise<void> => {
    await axiosInstance.patch(`${DISPUTES_BASE}/${disputeId}/status`, { status, notes });
  },

  // Fetch invoice details — GET /dispute/api/v1/invoices/{invoice_id}
  getInvoice: async (invoiceId: number): Promise<InvoiceData> => {
    const { data } = await axiosInstance.get<InvoiceData>(`${INVOICES_BASE}/${invoiceId}`);
    return data;
  },

  // Fetch payment detail — GET /dispute/api/v1/payments/{payment_detail_id}
  getPaymentDetail: async (paymentDetailId: number): Promise<PaymentDetailData> => {
    const { data } = await axiosInstance.get<PaymentDetailData>(`${PAYMENTS_BASE}/${paymentDetailId}`);
    return data;
  },
};

// ─── Email service ─────────────────────────────────────────────────────────────

export const emailService = {
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
    const { data } = await axiosInstance.get<TaskStatusResponse>(`${EMAILS_BASE}/task/${taskId}/status`);
    return data;
  },

  getEmail: async (emailId: number): Promise<EmailResponse> => {
    const { data } = await axiosInstance.get<EmailResponse>(`${EMAILS_BASE}/${emailId}`);
    return data;
  },
};
