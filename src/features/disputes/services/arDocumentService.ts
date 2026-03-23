import axiosInstance from '@/lib/axios';

const BASE = '/dispute/api/v1/ar-documents';

export type ARDocType = 'PO' | 'INVOICE' | 'GRN' | 'PAYMENT' | 'CONTRACT' | 'CREDIT_NOTE';

export const DOC_TYPE_LABELS: Record<ARDocType, string> = {
  PO:           'Purchase Order',
  INVOICE:      'Invoice',
  GRN:          'Goods Receipt Note',
  PAYMENT:      'Payment Advice',
  CONTRACT:     'Contract / Rate Contract',
  CREDIT_NOTE:  'Credit Note',
};

export const KEY_TYPE_LABELS: Record<string, string> = {
  po_number:          'PO Number',
  inv_number:         'Invoice Number',
  grn_number:         'GRN Number',
  contract_number:    'Contract Number',
  payment_ref:        'Payment Reference',
  credit_note_number: 'Credit Note Number',
};

export interface ARDocKey {
  key_id:         number;
  key_type:       string;
  key_value_raw:  string;
  key_value_norm: string;
  confidence:     number;
  source:         string;
  verified:       boolean;
}

export interface ARDocSummary {
  doc_id:         number;
  doc_type:       ARDocType;
  customer_scope: string;
  doc_date:       string | null;
  status:         string;
  created_at:     string;
  all_keys:       ARDocKey[];
  has_file:       boolean;
  download_url:   string;
}

export interface ARDocRelated extends ARDocSummary {
  shared_keys: { key_type: string; key_value_norm: string; key_value_raw: string }[];
}

export interface ARDocUploadResult {
  document:          ARDocSummary;
  extracted_keys:    ARDocKey[];
  related_documents: ARDocRelated[];
  graph_summary: {
    total_keys_extracted: number;
    related_docs_found:   number;
    linked_types:         string[];
  };
}

export const arDocumentService = {
  upload: async (
    file:          File,
    docType:       ARDocType,
    customerEmail: string,
    docDate?:      string,
  ): Promise<ARDocUploadResult> => {
    const form = new FormData();
    form.append('file',           file);
    form.append('doc_type',       docType);
    form.append('customer_email', customerEmail);
    if (docDate) form.append('doc_date', docDate);
    const { data } = await axiosInstance.post<ARDocUploadResult>(BASE, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getDocument: async (docId: number): Promise<ARDocUploadResult> => {
    const { data } = await axiosInstance.get<ARDocUploadResult>(`${BASE}/${docId}`);
    return data;
  },

  getRelated: async (docId: number): Promise<ARDocRelated[]> => {
    const { data } = await axiosInstance.get<ARDocRelated[]>(`${BASE}/${docId}/related`);
    return data;
  },

  /** List all AR documents on file for a given customer scope (email or domain), including their keys. */
  listForCustomer: async (customerEmail: string): Promise<ARDocRelated[]> => {
    const { data } = await axiosInstance.get<ARDocRelated[]>(BASE, {
      params: { customer_email: customerEmail },
    });
    return data;
  },

  /**
   * Return only the AR documents linked to a specific dispute.
   * Used by the dispute Docs tab — scoped to this case, not all customer docs.
   */
  getForDispute: async (disputeId: number): Promise<ARDocRelated[]> => {
    const { data } = await axiosInstance.get<ARDocRelated[]>(
      `/dispute/api/v1/disputes/${disputeId}/ar-documents`
    );
    return data;
  },

  /**
   * Replace the anchor AR document for a dispute.
   * Clears all currently linked docs and re-walks the graph from the new anchor.
   */
  updateAnchor: async (disputeId: number, docId: number, customerEmail?: string): Promise<ARDocRelated[]> => {
    const { data } = await axiosInstance.put<ARDocRelated[]>(
      `/dispute/api/v1/disputes/${disputeId}/ar-documents/anchor`,
      { doc_id: docId, customer_email: customerEmail ?? null },
    );
    return data;
  },

  addManualKey: async (
    docId:       number,
    keyType:     string,
    keyValueRaw: string,
  ): Promise<ARDocKey> => {
    const { data } = await axiosInstance.post<ARDocKey>(`${BASE}/${docId}/keys`, {
      key_type:      keyType,
      key_value_raw: keyValueRaw,
    });
    return data;
  },
};
