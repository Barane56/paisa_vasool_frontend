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
  has_new_customer_message?: boolean;
  dispute_token?: string | null;
  parent_dispute_id?: number | null;
}

export interface DisputeListResponse {
  total: number;
  items: Dispute[];
}

export interface TimelineAttachment {
  attachment_id: number;
  file_name: string;
  file_type: string;
  download_url: string;
  source: 'inbound' | 'outbound';
}

export interface TimelineEpisode {
  episode_id: number;
  actor: string;
  actor_name?: string | null;
  episode_type: string;
  content_text: string;
  created_at: string;
  attachments: TimelineAttachment[];
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
  payment_type?: string;
  payment_sequence?: number;
  failure_reason?: string;
  currency?: string;
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

export interface PaymentDetailListResponse {
  invoice_number: string;
  total: number;
  items: PaymentDetailData[];
}

export interface CustomerPaymentListResponse {
  customer_id: string;
  total: number;
  items: PaymentDetailData[];
}

// ─── Supporting Docs ──────────────────────────────────────────────────────────

export interface SupportingRef {
  ref_id: number;
  analysis_id: number;
  reference_table: string;
  ref_id_value: number;
  context_note: string;
}

export interface SupportingRefListResponse {
  dispute_id: number;
  total: number;
  items: SupportingRef[];
}

export interface SupportingRefCreate {
  analysis_id: number;
  reference_table: string;
  ref_id_value: number;
  context_note: string;
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
    search?: string;
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<DisputeListResponse> => {
    const { data } = await axiosInstance.get<DisputeListResponse>(DISPUTES_BASE, { params });
    return data;
  },

  myDisputes: async (params?: {
    search?: string;
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

  bulkDetail: async (ids: number[]): Promise<Dispute[]> => {
    if (!ids.length) return [];
    const { data } = await axiosInstance.get<Dispute[]>(`${DISPUTES_BASE}/bulk-detail`, {
      params: { ids: ids.join(',') },
    });
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

  // Fetch a single payment detail by ID
  getPaymentDetail: async (paymentDetailId: number): Promise<PaymentDetailData> => {
    const { data } = await axiosInstance.get<PaymentDetailData>(`${PAYMENTS_BASE}/${paymentDetailId}`);
    return data;
  },

  // Fetch ALL payment details for a given invoice number (multiple payments)
  getPaymentsByInvoice: async (invoiceNumber: string): Promise<PaymentDetailListResponse> => {
    const { data } = await axiosInstance.get<PaymentDetailListResponse>(
      `${PAYMENTS_BASE}/by-invoice/${encodeURIComponent(invoiceNumber)}`
    );
    return data;
  },

  // Fetch all payment details for a customer
  getPaymentsByCustomer: async (
    customerId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<CustomerPaymentListResponse> => {
    const { data } = await axiosInstance.get<CustomerPaymentListResponse>(
      `${PAYMENTS_BASE}/by-customer/${encodeURIComponent(customerId)}`,
      { params }
    );
    return data;
  },

  // ── Supporting Docs ──────────────────────────────────────────────────────

  getSupportingDocs: async (disputeId: number): Promise<SupportingRefListResponse> => {
    const { data } = await axiosInstance.get<SupportingRefListResponse>(
      `${DISPUTES_BASE}/${disputeId}/supporting-docs`
    );
    return data;
  },

  addSupportingDoc: async (
    disputeId: number,
    payload: SupportingRefCreate
  ): Promise<SupportingRef> => {
    const { data } = await axiosInstance.post<SupportingRef>(
      `${DISPUTES_BASE}/${disputeId}/supporting-docs`,
      payload
    );
    return data;
  },

  removeSupportingDoc: async (disputeId: number, refId: number): Promise<void> => {
    await axiosInstance.delete(`${DISPUTES_BASE}/${disputeId}/supporting-docs/${refId}`);
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
// ─── AI Draft Email ───────────────────────────────────────────────────────────

export interface DraftEmailResponse {
  dispute_id: number;
  draft_body: string;
  customer_id: string;
  suggested_subject: string;
}

export const newMessageService = {
  /**
   * Calls PATCH /dispute/api/v1/disputes/{id}/mark-read
   * Clears the has_new_message flag in the dispute_new_message table.
   * Called whenever an FA opens a dispute modal.
   */
  markDisputeRead: async (disputeId: number): Promise<void> => {
    await axiosInstance.patch(`${DISPUTES_BASE}/${disputeId}/mark-read`);
  },
};

export const draftEmailService = {
  /**
   * Calls POST /dispute/api/v1/disputes/{id}/draft-email
   * Backend uses Groq (llama-3.3-70b-versatile) to generate the draft.
   */
  generateDraft: async (disputeId: number): Promise<DraftEmailResponse> => {
    const { data } = await axiosInstance.post<DraftEmailResponse>(
      `${DISPUTES_BASE}/${disputeId}/draft-email`
    );
    return data;
  },
};


// ─── FA Manual Dispute Creation ───────────────────────────────────────────────

export interface FADisputeCreate {
  customer_id:       string;
  customer_email?:   string | null;
  dispute_type_id?:  number | null;
  custom_type_name?: string | null;
  custom_type_desc?: string | null;
  priority:          'LOW' | 'MEDIUM' | 'HIGH';
  description:       string;
  invoice_id?:       number | null;
  ar_document_id?:   number | null;
  notes?:            string | null;
}

// ─── Dispute Documents ────────────────────────────────────────────────────────

export interface DisputeDocument {
  document_id:   number;
  dispute_id:    number;
  uploaded_by:   number;
  uploader_name: string | null;
  file_name:     string;
  file_type:     string;
  file_size:     number | null;
  display_name:  string | null;
  notes:         string | null;
  download_url:  string;
  created_at:    string;
}

export interface DisputeDocumentListResponse {
  dispute_id: number;
  total:      number;
  items:      DisputeDocument[];
}

export const faDisputeService = {
  /** Create a dispute manually — no email required */
  create: async (data: FADisputeCreate): Promise<Dispute> => {
    const { data: res } = await axiosInstance.post<Dispute>(`${DISPUTES_BASE}/create`, data);
    return res;
  },
};

// ─── Fork Recommendations ─────────────────────────────────────────────────────

export interface ForkRecommendation {
  recommendation_id:        number;
  dispute_id:               number;
  confidence:               number;
  reasoning:                string | null;
  suggested_invoice_number: string | null;
  suggested_type_hint:      string | null;
  suggested_description:    string | null;
  suggested_priority:       string;
  status:                   'PENDING' | 'ACCEPTED' | 'DISMISSED';
  created_at:               string;
}

export interface ForkRecommendationActionPayload {
  action:           'ACCEPT' | 'DISMISS';
  dispute_type_id?: number | null;
  custom_type_name?: string | null;
  custom_type_desc?: string | null;
  description?:     string | null;
  priority?:        string;
  customer_email?:  string | null;
  ar_document_id?:  number | null;
}

export const forkRecommendationService = {
  list: async (disputeId: number): Promise<ForkRecommendation[]> => {
    const { data } = await axiosInstance.get<ForkRecommendation[]>(
      `${DISPUTES_BASE}/${disputeId}/fork-recommendations`
    );
    return data;
  },
  action: async (
    disputeId: number,
    recommendationId: number,
    payload: ForkRecommendationActionPayload,
  ): Promise<{ status: string; new_dispute_id?: number; dispute_token?: string }> => {
    const { data } = await axiosInstance.post(
      `${DISPUTES_BASE}/${disputeId}/fork-recommendations/${recommendationId}/action`,
      payload,
    );
    return data;
  },
};

export const disputeDocumentService = {
  /** Upload a supporting document to a dispute */
  upload: async (
    disputeId:   number,
    file:        File,
    displayName?: string,
    notes?:       string,
  ): Promise<DisputeDocument> => {
    const form = new FormData();
    form.append('file', file);
    if (displayName) form.append('display_name', displayName);
    if (notes)       form.append('notes', notes);
    const { data } = await axiosInstance.post<DisputeDocument>(
      `${DISPUTES_BASE}/${disputeId}/documents`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  /** List all uploaded documents for a dispute */
  list: async (disputeId: number): Promise<DisputeDocumentListResponse> => {
    const { data } = await axiosInstance.get<DisputeDocumentListResponse>(
      `${DISPUTES_BASE}/${disputeId}/documents`
    );
    return data;
  },

  /** Delete a document */
  delete: async (disputeId: number, documentId: number): Promise<void> => {
    await axiosInstance.delete(`${DISPUTES_BASE}/${disputeId}/documents/${documentId}`);
  },
};

export const disputeTypeService = {
  /** List all active dispute types for the create form dropdown */
  list: async (): Promise<DisputeType[]> => {
    const { data } = await axiosInstance.get<DisputeType[]>(`/dispute/api/v1/dispute-types`);
    return data;
  },
};
