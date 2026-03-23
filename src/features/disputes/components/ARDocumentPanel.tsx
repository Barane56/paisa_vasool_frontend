import { useState, useCallback } from 'react';
import {
  Upload, FileText, Link2, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, Plus, Loader2, X, Calendar,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  arDocumentService,
  ARDocType, ARDocUploadResult, ARDocRelated, ARDocKey,
  DOC_TYPE_LABELS, KEY_TYPE_LABELS,
} from '../services/arDocumentService';
import type { Dispute } from '../services/disputeService';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DOC_TYPE_COLORS: Record<ARDocType, string> = {
  PO:          'bg-violet-100 text-violet-700 border-violet-200',
  INVOICE:     'bg-brand-100 text-brand-700 border-brand-200',
  GRN:         'bg-green-100 text-green-700 border-green-200',
  PAYMENT:     'bg-teal-100 text-teal-700 border-teal-200',
  CONTRACT:    'bg-slate-100 text-slate-700 border-slate-200',
  CREDIT_NOTE: 'bg-pink-100 text-pink-700 border-pink-200',
};

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.9 ? 'text-green-600' : c >= 0.7 ? 'text-brand-500' : 'text-red-500';

const KEY_TYPE_OPTIONS = [
  'po_number', 'inv_number', 'grn_number',
  'contract_number', 'payment_ref', 'credit_note_number',
];

// ── Key chip ─────────────────────────────────────────────────────────────────
const KeyChip = ({ k, dim }: { k: ARDocKey; dim?: boolean }) => (
  <div className={clsx(
    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs',
    dim ? 'bg-surface-50 border-surface-200 text-surface-500'
        : 'bg-white border-surface-200 text-surface-700',
  )}>
    <span className="font-semibold text-surface-500">
      {KEY_TYPE_LABELS[k.key_type] ?? k.key_type}:
    </span>
    <span className="font-mono font-bold">{k.key_value_raw}</span>
    <span className={clsx('text-[10px] font-semibold', CONFIDENCE_COLOR(k.confidence))}>
      {k.source === 'manual' ? '✓ manual' : k.source === 'regex' ? '⚡ regex' : '🤖 ai'}
    </span>
  </div>
);

// ── Related document card ─────────────────────────────────────────────────────
const RelatedDocCard = ({ doc }: { doc: ARDocRelated }) => {
  const [expanded, setExpanded] = useState(false);
  const color = DOC_TYPE_COLORS[doc.doc_type] ?? 'bg-surface-100 text-surface-700';

  return (
    <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border', color)}>
          {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
        </span>
        <div className="flex-1 min-w-0">
          {/* Show the doc's own natural key as the primary identifier */}
          {doc.all_keys && doc.all_keys.length > 0 ? (
            <p className="text-xs font-semibold text-surface-700 truncate">
              <span className="text-surface-400 font-normal text-[10px]">
                {KEY_TYPE_LABELS[doc.all_keys[0].key_type] ?? doc.all_keys[0].key_type}:{' '}
              </span>
              {doc.all_keys[0].key_value_raw}
            </p>
          ) : (
            <p className="text-[10px] text-gray-400 italic">No keys extracted</p>
          )}
        </div>
        {doc.doc_date && (
          <span className="text-[10px] text-surface-400 shrink-0 flex items-center gap-1">
            <Calendar size={10} />{doc.doc_date}
          </span>
        )}
        {expanded ? <ChevronUp size={14} className="text-surface-400 shrink-0" />
                  : <ChevronDown size={14} className="text-surface-400 shrink-0" />}
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-surface-100">
          <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-widest mt-2 mb-1.5">
            All keys on this document
          </p>
          <div className="flex flex-wrap gap-1.5">
            {doc.all_keys.map(k => <KeyChip key={k.key_id} k={k} dim />)}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Manual key form ───────────────────────────────────────────────────────────
const AddKeyForm = ({
  docId,
  onAdded,
  onCancel,
}: {
  docId: number;
  onAdded: (k: ARDocKey) => void;
  onCancel: () => void;
}) => {
  const [keyType, setKeyType] = useState(KEY_TYPE_OPTIONS[0]);
  const [keyValue, setKeyValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!keyValue.trim()) return;
    try {
      setSaving(true);
      const k = await arDocumentService.addManualKey(docId, keyType, keyValue.trim());
      onAdded(k);
      toast.success('Key added');
    } catch {
      toast.error('Failed to add key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-brand-700">Add reference key manually</p>
      <div className="flex gap-2">
        <select
          value={keyType}
          onChange={e => setKeyType(e.target.value)}
          className="input-base py-1.5 text-xs flex-1"
        >
          {KEY_TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{KEY_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input
          value={keyValue}
          onChange={e => setKeyValue(e.target.value)}
          placeholder="e.g. PO-2025-0047"
          className="input-base py-1.5 text-xs flex-1 font-mono"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-surface-500 hover:text-surface-700 px-3 py-1.5">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !keyValue.trim()}
          className="btn-primary btn-sm text-xs"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : 'Add Key'}
        </button>
      </div>
    </div>
  );
};

// ── Uploaded document view ───────────────────────────────────────────────────
const UploadedDocView = ({
  result,
  onKeyAdded,
}: {
  result: ARDocUploadResult;
  onKeyAdded: (k: ARDocKey) => void;
}) => {
  const [showAddKey, setShowAddKey] = useState(false);
  const [extraKeys, setExtraKeys] = useState<ARDocKey[]>([]);

  const allKeys = [...result.extracted_keys, ...extraKeys];

  const handleKeyAdded = (k: ARDocKey) => {
    setExtraKeys(prev => [...prev, k]);
    setShowAddKey(false);
    onKeyAdded(k);
  };

  return (
    <div className="space-y-4">
      {/* Extracted keys */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-surface-700 uppercase tracking-wider">
            Extracted Keys
          </p>
          {!showAddKey && (
            <button
              onClick={() => setShowAddKey(true)}
              className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-semibold"
            >
              <Plus size={11} /> Add manually
            </button>
          )}
        </div>
        {allKeys.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {allKeys.map(k => <KeyChip key={k.key_id} k={k} />)}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-surface-400 bg-surface-50 rounded-xl px-3 py-2.5 border border-surface-200">
            <AlertCircle size={13} className="shrink-0" />
            No reference keys found. Add them manually so this document can be linked.
          </div>
        )}
        {showAddKey && (
          <div className="mt-2">
            <AddKeyForm
              docId={result.document.doc_id}
              onAdded={handleKeyAdded}
              onCancel={() => setShowAddKey(false)}
            />
          </div>
        )}
      </div>

      {/* Graph summary */}
      <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Link2 size={13} className="text-brand-500" />
          <p className="text-xs font-bold text-surface-700">Document Graph</p>
        </div>
        <p className="text-xs text-surface-500">
          {result.graph_summary.related_docs_found === 0
            ? 'No related documents found yet. Upload more documents to build the chain.'
            : `Linked to ${result.graph_summary.related_docs_found} document${result.graph_summary.related_docs_found !== 1 ? 's' : ''}: ${result.graph_summary.linked_types.join(', ')}`
          }
        </p>
      </div>

      {/* Related documents */}
      {result.related_documents.length > 0 && (
        <div>
          <p className="text-xs font-bold text-surface-700 uppercase tracking-wider mb-2">
            Related Documents
          </p>
          <div className="space-y-2">
            {result.related_documents.map(r => (
              <RelatedDocCard key={r.doc_id} doc={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main panel ────────────────────────────────────────────────────────────────
export const ARDocumentPanel = ({ dispute }: { dispute: Dispute }) => {
  const [dragOver,  setDragOver]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType,   setDocType]   = useState<ARDocType>('PO');
  const [docDate,   setDocDate]   = useState('');
  const [result,    setResult]    = useState<ARDocUploadResult | null>(null);
  const [lastKeyAdded, setLastKeyAdded] = useState(0);

  const customerEmail = dispute.customer_id ?? '';

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    try {
      setUploading(true);
      setResult(null);
      const res = await arDocumentService.upload(
        file, docType, customerEmail, docDate || undefined,
      );
      setResult(res);
      toast.success(
        `${DOC_TYPE_LABELS[docType]} uploaded — ${res.graph_summary.total_keys_extracted} key${res.graph_summary.total_keys_extracted !== 1 ? 's' : ''} extracted`
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [docType, customerEmail, docDate]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Upload config */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1 block">
            Document Type
          </label>
          <select
            value={docType}
            onChange={e => setDocType(e.target.value as ARDocType)}
            className="input-base py-2 text-sm"
          >
            {(Object.entries(DOC_TYPE_LABELS) as [ARDocType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1 block">
            Document Date <span className="font-normal text-surface-400">(optional)</span>
          </label>
          <input
            type="date"
            value={docDate}
            onChange={e => setDocDate(e.target.value)}
            className="input-base py-2 text-sm"
          />
        </div>
      </div>

      {/* Drop zone */}
      <label
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={clsx(
          'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 cursor-pointer transition-all',
          dragOver
            ? 'border-brand-400 bg-brand-50'
            : 'border-surface-200 hover:border-brand-300 hover:bg-surface-50',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <input type="file" className="sr-only" onChange={onInputChange}
          accept=".pdf,.txt,.csv,.xml,.json" disabled={uploading} />
        {uploading ? (
          <>
            <Loader2 size={24} className="animate-spin text-brand-500" />
            <p className="text-sm font-semibold text-brand-600">Extracting keys…</p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
              <Upload size={18} className="text-brand-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-surface-700">
                Drop a file or <span className="text-brand-600">click to browse</span>
              </p>
              <p className="text-xs text-surface-400 mt-0.5">PDF, TXT, CSV, XML — max 10 MB</p>
            </div>
          </>
        )}
      </label>

      {/* Result */}
      {result && (
        <div className="border-t border-surface-200 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={14} className="text-green-600" />
            <span className="text-xs font-bold text-surface-700">
              {DOC_TYPE_LABELS[result.document.doc_type]} uploaded successfully
            </span>
            <button onClick={() => setResult(null)} className="ml-auto text-surface-400 hover:text-surface-600">
              <X size={14} />
            </button>
          </div>
          <UploadedDocView
            result={result}
            onKeyAdded={() => setLastKeyAdded(n => n + 1)}
          />
        </div>
      )}
    </div>
  );
};
