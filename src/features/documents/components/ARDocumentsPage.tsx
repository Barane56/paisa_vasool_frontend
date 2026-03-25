import { useState, useCallback, useRef } from 'react';
import {
  Upload, Link2, AlertCircle, CheckCircle2, Loader2,
  ChevronDown, ChevronUp, Plus, X, Calendar, FileText,
  GitBranch, Search, Pencil, Check,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/common';
import {
  arDocumentService,
  ARDocType, ARDocUploadResult, ARDocRelated, ARDocKey,
  DOC_TYPE_LABELS, KEY_TYPE_LABELS,
} from '@/features/disputes/services/arDocumentService';

// ── Palette ───────────────────────────────────────────────────────────────────
const DOC_TYPE_COLORS: Record<ARDocType, string> = {
  PO:          'bg-amber-100 text-amber-700 border-amber-200',
  INVOICE:     'bg-blue-100 text-blue-700 border-blue-200',
  GRN:         'bg-purple-100 text-purple-700 border-purple-200',
  PAYMENT:     'bg-green-100 text-green-700 border-green-200',
  CONTRACT:    'bg-slate-100 text-slate-700 border-slate-200',
  CREDIT_NOTE: 'bg-red-100 text-red-700 border-red-200',
};

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.9 ? 'text-brand-700' : c >= 0.7 ? 'text-brand-600' : 'text-surface-600';

const KEY_TYPE_OPTIONS = [
  'po_number', 'inv_number', 'grn_number',
  'contract_number', 'payment_ref', 'credit_note_number',
];

// ── Key chip ──────────────────────────────────────────────────────────────────
// Source badge
const SourceBadge = ({ source, confidence }: { source: string; confidence: number }) => {
  const icon   = source === 'manual' ? '✓' : source === 'regex' ? '⚡' : '🤖';
  const label  = source === 'manual' ? 'manual' : source === 'regex' ? 'regex' : 'ai';
  const color  = CONFIDENCE_COLOR(confidence);
  return (
    <span className={clsx('text-[10px] font-semibold shrink-0', color)} title={`source: ${label}, confidence: ${Math.round(confidence * 100)}%`}>
      {icon}
    </span>
  );
};

// Editable key chip — FA can click the value to edit inline
const KeyChip = ({ k, docId, onUpdated }: {
  k: ARDocKey;
  docId: number;
  onUpdated: (updated: ARDocKey) => void;
}) => {
  const [editing, setEditing]   = useState(false);
  const [value,   setValue]     = useState(k.key_value_raw);
  const [saving,  setSaving]    = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setValue(k.key_value_raw);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const cancel = () => {
    setEditing(false);
    setValue(k.key_value_raw);
  };

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === k.key_value_raw) { cancel(); return; }
    setSaving(true);
    try {
      const updated = await arDocumentService.addManualKey(docId, k.key_type, trimmed);
      onUpdated(updated);
      setEditing(false);
      toast.success('Key updated');
    } catch {
      toast.error('Failed to update key');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  save();
    if (e.key === 'Escape') cancel();
  };

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border-2 border-brand-400 bg-white text-xs shadow-sm">
        <span className="font-semibold text-brand-500 shrink-0 pl-1">
          {KEY_TYPE_LABELS[k.key_type] ?? k.key_type}:
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          className="font-mono font-bold text-surface-800 bg-transparent outline-none w-32 min-w-0"
          disabled={saving}
        />
        {saving
          ? <Loader2 size={11} className="animate-spin text-brand-400 shrink-0" />
          : <>
              <button onClick={save}   className="text-brand-500 hover:text-brand-700 shrink-0 p-0.5"><Check size={11} /></button>
              <button onClick={cancel} className="text-surface-400 hover:text-surface-600 shrink-0 p-0.5"><X size={11} /></button>
            </>
        }
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-surface-200 bg-white text-xs group hover:border-brand-300 hover:bg-brand-50 transition-all">
      <span className="font-semibold text-surface-400 shrink-0">
        {KEY_TYPE_LABELS[k.key_type] ?? k.key_type}:
      </span>
      <span className="font-mono font-bold text-surface-800">{k.key_value_raw}</span>
      <SourceBadge source={k.source} confidence={k.confidence} />
      <button
        onClick={startEdit}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-400 hover:text-brand-600 ml-0.5"
        title="Edit this key"
      >
        <Pencil size={10} />
      </button>
    </div>
  );
};

// ── Related doc card ──────────────────────────────────────────────────────────
const RelatedCard = ({ doc }: { doc: ARDocRelated }) => {
  const [open, setOpen] = useState(false);
  const color = DOC_TYPE_COLORS[doc.doc_type] ?? 'bg-surface-100 text-surface-600';
  return (
    <div className="border border-surface-200 rounded-xl overflow-hidden bg-white">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0', color)}>
          {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
        </span>
        <div className="flex-1 flex flex-wrap gap-1 min-w-0">
          {doc.shared_keys.map(sk => (
            <span key={sk.key_type + sk.key_value_norm}
              className="text-[10px] font-mono bg-surface-100 text-surface-700 px-1.5 py-0.5 rounded border border-surface-200">
              {sk.key_value_raw}
            </span>
          ))}
        </div>
        {doc.doc_date && (
          <span className="text-[10px] text-surface-400 shrink-0 flex items-center gap-1">
            <Calendar size={10} />{doc.doc_date}
          </span>
        )}
        {open ? <ChevronUp size={14} className="text-surface-400 shrink-0" />
               : <ChevronDown size={14} className="text-surface-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-surface-100 pt-2.5">
          <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-widest mb-2">All keys</p>
          <div className="flex flex-wrap gap-1.5">
            {doc.all_keys.map(k => (
              <span key={k.key_id}
                className="text-[10px] font-mono bg-surface-100 text-surface-600 px-1.5 py-0.5 rounded border border-surface-200">
                <span className="opacity-60">{k.key_type.replace(/_/g,' ')}: </span>{k.key_value_raw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Add key form ──────────────────────────────────────────────────────────────
const AddKeyForm = ({ docId, onAdded, onCancel }: {
  docId: number;
  onAdded: (k: ARDocKey) => void;
  onCancel: () => void;
}) => {
  const [keyType, setKeyType]   = useState(KEY_TYPE_OPTIONS[0]);
  const [keyValue, setKeyValue] = useState('');
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    if (!keyValue.trim()) return;
    setSaving(true);
    try {
      const k = await arDocumentService.addManualKey(docId, keyType, keyValue.trim());
      onAdded(k);
      toast.success('Key added');
    } catch { toast.error('Failed to add key'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-2 mt-2">
      <p className="text-xs font-semibold text-brand-700">Add reference key manually</p>
      <div className="flex gap-2">
        <select value={keyType} onChange={e => setKeyType(e.target.value)}
          className="input-base py-1.5 text-xs flex-1">
          {KEY_TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{KEY_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input value={keyValue} onChange={e => setKeyValue(e.target.value)}
          placeholder="e.g. PO-2025-0047"
          className="input-base py-1.5 text-xs flex-1 font-mono" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-surface-500 hover:text-surface-700 px-3 py-1.5">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving || !keyValue.trim()}
          className="btn-primary btn-sm text-xs">
          {saving ? <Loader2 size={12} className="animate-spin" /> : 'Add Key'}
        </button>
      </div>
    </div>
  );
};

// ── Result panel ──────────────────────────────────────────────────────────────
const ResultPanel = ({ result, onReset }: { result: ARDocUploadResult; onReset: () => void }) => {
  const [showAddKey, setShowAddKey] = useState(false);
  const [extraKeys, setExtraKeys]   = useState<ARDocKey[]>([]);
  // extraKeys override extracted_keys for same key_type
  const overriddenTypes = new Set(extraKeys.map(k => k.key_type));
  const allKeys = [
    ...result.extracted_keys.filter(k => !overriddenTypes.has(k.key_type)),
    ...extraKeys,
  ];
  const { document: doc, related_documents, graph_summary } = result;
  const color = DOC_TYPE_COLORS[doc.doc_type as ARDocType] ?? 'bg-surface-100 text-surface-600';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Doc summary */}
      <div className="flex items-center gap-3 p-4 bg-white border border-surface-200 rounded-2xl">
        <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
          <FileText size={18} className="text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border', color)}>
              {DOC_TYPE_LABELS[doc.doc_type as ARDocType] ?? doc.doc_type}
            </span>
            <CheckCircle2 size={13} className="text-brand-500" />
            <span className="text-xs text-brand-700 font-semibold">Uploaded</span>
          </div>
          <p className="text-xs text-surface-400 mt-0.5">
            {doc.doc_date && <span className="flex items-center gap-1 inline-flex"><Calendar size={10} /> {doc.doc_date} · </span>}
            Doc ID: {doc.doc_id}
          </p>
        </div>
        <button onClick={onReset} className="text-surface-300 hover:text-surface-500 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Extracted keys */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-surface-600 uppercase tracking-widest">
            Extracted Keys ({allKeys.length})
          </p>
          {!showAddKey && (
            <button onClick={() => setShowAddKey(true)}
              className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-semibold">
              <Plus size={11} /> Add manually
            </button>
          )}
        </div>
        {allKeys.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {allKeys.map((k, i) => (
              <KeyChip
                key={k.key_id ?? `key-${i}`}
                k={k}
                docId={doc.doc_id}
                onUpdated={updated => {
                  // Replace the key in allKeys by merging into extraKeys
                  setExtraKeys(prev => {
                    const inExtra = prev.findIndex(ek => ek.key_id === k.key_id);
                    if (inExtra >= 0) {
                      const next = [...prev];
                      next[inExtra] = updated;
                      return next;
                    }
                    // Was in result.extracted_keys — add override to extraKeys
                    return [...prev.filter(ek => ek.key_type !== k.key_type), updated];
                  });
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-surface-400 bg-surface-50 rounded-xl px-3 py-2.5 border border-surface-200">
            <AlertCircle size={13} className="shrink-0" />
            No reference keys found. Add them manually to enable graph linking.
          </div>
        )}
        {showAddKey && (
          <AddKeyForm
            docId={doc.doc_id}
            onAdded={k => { setExtraKeys(prev => [...prev, k]); setShowAddKey(false); }}
            onCancel={() => setShowAddKey(false)}
          />
        )}
      </div>

      {/* Graph summary */}
      <div className={clsx(
        'rounded-xl border px-4 py-3 flex items-start gap-3',
        graph_summary.related_docs_found > 0
          ? 'bg-emerald-50 border-emerald-100'
          : 'bg-surface-50 border-surface-200'
      )}>
        <GitBranch size={15} className={graph_summary.related_docs_found > 0 ? 'text-emerald-500 shrink-0 mt-0.5' : 'text-surface-300 shrink-0 mt-0.5'} />
        <div>
          <p className={clsx('text-xs font-bold', graph_summary.related_docs_found > 0 ? 'text-emerald-700' : 'text-surface-500')}>
            {graph_summary.related_docs_found > 0
              ? `Linked to ${graph_summary.related_docs_found} document${graph_summary.related_docs_found !== 1 ? 's' : ''}`
              : 'No related documents yet'}
          </p>
          <p className="text-[11px] text-surface-400 mt-0.5">
            {graph_summary.related_docs_found > 0
              ? `Types: ${graph_summary.linked_types.join(', ')} · ${graph_summary.total_keys_extracted} key${graph_summary.total_keys_extracted !== 1 ? 's' : ''} extracted`
              : 'Upload more documents for this customer to build the chain'}
          </p>
        </div>
      </div>

      {/* Related documents */}
      {related_documents.length > 0 && (
        <div>
          <p className="text-xs font-bold text-surface-600 uppercase tracking-widest mb-2">
            Related Documents
          </p>
          <div className="space-y-2">
            {related_documents.map(r => <RelatedCard key={r.doc_id} doc={r} />)}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const ARDocumentsPage = () => {
  const [dragOver,    setDragOver]    = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [docType,     setDocType]     = useState<ARDocType>('PO');
  const [customerEmail, setCustomerEmail] = useState('');
  const [docDate,     setDocDate]     = useState('');
  const [result,      setResult]      = useState<ARDocUploadResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      toast.error('Enter a valid customer email before uploading');
      return;
    }
    try {
      setUploading(true);
      setResult(null);
      const res = await arDocumentService.upload(
        file, docType, customerEmail.trim(), docDate || undefined,
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

  return (
    <div className="p-6 h-full max-w-screen-xl mx-auto flex flex-col">
      <PageHeader
        title="AR Document Graph"
        subtitle="Upload PO, GRN, Invoice, Payment and Contract documents. Reference keys are extracted automatically and linked across documents."
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">

        {/* ── Left: Upload config + drop zone ── */}
        <div className="flex flex-col gap-4">

          {/* Config card */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-display font-semibold text-surface-800">Document Details</h3>

            {/* Customer email — the customer_scope for graph linking */}
            <div>
              <label className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5 block">
                Customer Email <span className="text-brand-400">*</span>
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                className="input-base text-sm py-2"
              />
              <p className="text-[10px] text-surface-400 mt-1">
                Must match the customer's email in the dispute pipeline
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5 block">
                  Document Type
                </label>
                <select value={docType} onChange={e => setDocType(e.target.value as ARDocType)}
                  className="input-base py-2 text-sm">
                  {(Object.entries(DOC_TYPE_LABELS) as [ARDocType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5 block">
                  Document Date <span className="text-surface-300">(optional)</span>
                </label>
                <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)}
                  className="input-base py-2 text-sm" />
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <label
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={clsx(
              'card p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all border-2',
              dragOver ? 'border-brand-400 bg-brand-50' : 'border-dashed border-surface-200 hover:border-brand-300 hover:bg-surface-50',
              uploading && 'pointer-events-none opacity-60',
            )}
          >
            <input type="file" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              accept=".pdf,.txt,.csv,.xml,.json" disabled={uploading} />
            {uploading ? (
              <>
                <Loader2 size={28} className="animate-spin text-brand-500" />
                <p className="text-sm font-semibold text-brand-600">Extracting reference keys…</p>
                <p className="text-xs text-surface-400">Running anchor regex + LLM pipeline</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center">
                  <Upload size={22} className="text-brand-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-surface-700">
                    Drop a file or <span className="text-brand-600">click to browse</span>
                  </p>
                  <p className="text-xs text-surface-400 mt-1">PDF, TXT, CSV, XML — max 10 MB</p>
                </div>
              </>
            )}
          </label>

          {/* How it works */}
          {!result && (
            <div className="card p-5">
              <h3 className="text-sm font-display font-semibold text-surface-800 mb-3 flex items-center gap-2">
                <GitBranch size={14} className="text-brand-500" /> How the graph works
              </h3>
              <ol className="space-y-2.5">
                {[
                  ['Upload a PO',      'Reference keys (PO No, etc.) are extracted via regex'],
                  ['Upload an Invoice','Invoice No + PO No link it to the PO automatically'],
                  ['Upload a GRN',     'GRN links to both PO and Invoice via shared keys'],
                  ['Upload Payment',   'Payment Ref links to the Invoice — chain is complete'],
                  ['Open any case',    'The full document chain appears in the Documents tab'],
                ].map(([bold, rest], i) => (
                  <li key={i} className="flex items-start gap-3 text-xs text-surface-600">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span><span className="font-semibold text-surface-800">{bold}</span> — {rest}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 pt-4 border-t border-surface-100">
                <p className="text-[11px] text-surface-400 font-semibold uppercase tracking-widest mb-2">Seed customers</p>
                <div className="space-y-1">
                  {[
                    'baranekumar56@gmail.com',
                    '717822p107@kce.ac.in',
                    'jeevadharani9384@gmail.com',
                    'prakeshprakesh9345@gmail.com',
                  ].map(email => (
                    <button
                      key={email}
                      onClick={() => setCustomerEmail(email)}
                      className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-brand-50 transition-colors group"
                    >
                      <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-brand-600">{email[0].toUpperCase()}</span>
                      </div>
                      <span className="text-xs text-surface-600 group-hover:text-brand-700 font-mono">{email}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Result panel ── */}
        <div className="card p-5 flex flex-col min-h-0 overflow-y-auto">
          {result ? (
            <ResultPanel result={result} onReset={() => setResult(null)} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
                <Link2 size={28} className="text-surface-300" />
              </div>
              <h3 className="font-display font-semibold text-surface-500 mb-1">Graph result will appear here</h3>
              <p className="text-sm text-surface-400 max-w-xs">
                After upload, you'll see the extracted reference keys and all documents automatically linked via the graph.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ARDocumentsPage;
