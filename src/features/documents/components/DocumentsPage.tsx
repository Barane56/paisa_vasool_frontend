import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload, File, X, CheckCircle2, AlertCircle, Loader2,
  FileText, Hash, Calendar, Eye,
  User, Package, CreditCard, Banknote, StickyNote,
  ArrowRight, RefreshCw, Inbox, Tag,
} from 'lucide-react';
import { PageHeader } from '@/components/common';
import { Button, Badge } from '@/components/ui';
import { UploadedDocument } from '@/types';
import { formatFileSize, formatDate } from '@/utils';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/config/constants';
import { emailService, EmailResponse } from '@/features/disputes/services/disputeService';
import clsx from 'clsx';

interface IngestJob {
  doc: UploadedDocument;
  file: File;
  senderEmail: string;
  subject: string;
  taskId?: string;
  emailId?: number;
  emailData?: EmailResponse;
  error?: string;
}

// ─── Upload zone ──────────────────────────────────────────────────────────────
const UploadZone = ({ onFiles }: { onFiles: (files: File[]) => void }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFiles(Array.from(e.dataTransfer.files));
  }, [onFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={clsx(
        'border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 py-12 px-6 cursor-pointer transition-all duration-200',
        dragging
          ? 'border-brand-400 bg-brand-50'
          : 'border-surface-200 hover:border-brand-300 hover:bg-surface-50'
      )}
    >
      <div className={clsx(
        'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
        dragging ? 'bg-brand-100' : 'bg-surface-100'
      )}>
        <Upload size={24} className={dragging ? 'text-brand-500' : 'text-surface-400'} />
      </div>
      <div className="text-center">
        <p className="font-medium text-surface-700 text-sm">
          {dragging ? 'Drop PDF here' : 'Drag & drop email PDF here'}
        </p>
        <p className="text-xs text-surface-400 mt-1">
          or <span className="text-brand-600 font-medium">click to browse</span>
        </p>
      </div>
      <p className="text-xs text-surface-300">PDF only — max {MAX_FILE_SIZE_MB} MB each</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </div>
  );
};

// ─── Metadata form ────────────────────────────────────────────────────────────
const MetaForm = ({
  onSubmit,
  isLoading,
}: {
  onSubmit: (senderEmail: string, subject: string) => void;
  isLoading: boolean;
}) => {
  const [senderEmail, setSenderEmail] = useState('');
  const [subject, setSubject]         = useState('');

  return (
    <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mt-3 space-y-3">
      <p className="text-xs font-semibold text-brand-700 uppercase tracking-wider">Email Metadata</p>
      <div className="space-y-2">
        <input
          className="input-base text-sm py-2 w-full"
          placeholder="Sender email (e.g. vendor@acme.com)"
          type="email"
          value={senderEmail}
          onChange={(e) => setSenderEmail(e.target.value)}
        />
        <input
          className="input-base text-sm py-2 w-full"
          placeholder="Subject (e.g. Invoice INV-2025-001 dispute)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        onClick={() => onSubmit(senderEmail, subject)}
        disabled={!senderEmail || !subject || isLoading}
        isLoading={isLoading}
        className="w-full"
      >
        {!isLoading && (
          <>
            Process Email <ArrowRight size={14} />
          </>
        )}
      </Button>
    </div>
  );
};

// ─── File queue item ──────────────────────────────────────────────────────────
const FileQueueItem = ({
  job,
  onRemove,
  onPreview,
  onSubmitMeta,
}: {
  job: IngestJob;
  onRemove: (id: string) => void;
  onPreview: (job: IngestJob) => void;
  onSubmitMeta: (id: string, senderEmail: string, subject: string) => void;
}) => {
  const { doc } = job;
  const [showMeta, setShowMeta] = useState(!job.taskId && doc.status === 'processing');

  const statusIcon =
    doc.status === 'processing' && job.taskId ? <Loader2 size={15} className="text-brand-400 animate-spin" /> :
    doc.status === 'extracted'                ? <CheckCircle2 size={15} className="text-brand-500" /> :
    doc.status === 'failed'                   ? <AlertCircle size={15} className="text-brand-400" /> : null;

  const badgeVariant =
    doc.status === 'extracted' ? 'success' :
    doc.status === 'failed'    ? 'danger'  : 'info';

  const badgeLabel =
    doc.status === 'extracted' ? 'Processed' :
    doc.status === 'failed'    ? 'Failed'    :
    job.taskId                 ? 'Processing…' : 'Pending';

  return (
    <div className="rounded-xl border border-surface-100 bg-white overflow-hidden transition-all">
      <div className="flex items-center gap-3 p-3 hover:bg-surface-50 transition-colors group">
        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <File size={16} className="text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-800 truncate">{doc.filename}</p>
          <p className="text-xs text-surface-400">{formatFileSize(doc.size)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusIcon}
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          {doc.status === 'extracted' && (
            <button
              onClick={() => onPreview(job)}
              className="p-1 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-brand-500 transition-colors"
              title="Preview extracted data"
            >
              <Eye size={14} />
            </button>
          )}
          {doc.status === 'processing' && !job.taskId && (
            <button
              onClick={() => setShowMeta((v) => !v)}
              className="px-2 py-1 rounded-lg text-xs font-medium bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
            >
              {showMeta ? 'Hide' : 'Fill Info'}
            </button>
          )}
          <button
            onClick={() => onRemove(doc.id)}
            className="p-1 rounded-lg hover:bg-brand-50 text-surface-300 hover:text-brand-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {showMeta && doc.status === 'processing' && !job.taskId && (
        <div className="px-3 pb-3">
          <MetaForm
            isLoading={false}
            onSubmit={(email, subj) => {
              setShowMeta(false);
              onSubmitMeta(doc.id, email, subj);
            }}
          />
        </div>
      )}

      {job.error && (
        <div className="px-3 pb-3">
          <p className="text-xs text-brand-500 bg-brand-50 rounded-lg px-3 py-2">{job.error}</p>
        </div>
      )}
    </div>
  );
};

// ─── Extracted data panel ─────────────────────────────────────────────────────
const ExtractedPanel = ({ job }: { job: IngestJob | null }) => {
  if (!job) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
          <FileText size={28} className="text-surface-300" />
        </div>
        <h3 className="font-display font-semibold text-surface-500 mb-1">No document selected</h3>
        <p className="text-sm text-surface-400 max-w-xs">
          Upload an email PDF and click <Eye size={12} className="inline" /> to preview AI-extracted data here.
        </p>
      </div>
    );
  }

  if (job.doc.status === 'processing') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center">
          <Loader2 size={24} className="text-brand-400 animate-spin" />
        </div>
        <p className="text-sm text-surface-500 font-medium">AI is processing your email…</p>
        {job.taskId && (
          <p className="text-xs text-surface-300 font-mono bg-surface-50 px-3 py-1.5 rounded-lg">
            Task {job.taskId.slice(0, 20)}…
          </p>
        )}
        <p className="text-xs text-surface-400 max-w-xs">
          The pipeline is extracting invoice data, classifying the dispute, and preparing an AI response.
        </p>
      </div>
    );
  }

  if (job.doc.status === 'failed') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center">
          <AlertCircle size={24} className="text-brand-400" />
        </div>
        <p className="text-sm text-brand-700 font-medium">Processing failed</p>
        <p className="text-xs text-surface-400 max-w-xs">{job.error ?? 'An unexpected error occurred.'}</p>
      </div>
    );
  }

  const email = job.emailData;
  if (!email) return null;

  const fields = [
    { icon: User,      label: 'Sender',      value: email.sender_email },
    { icon: Hash,      label: 'Email ID',    value: `#${email.email_id}` },
    { icon: Tag,       label: 'AI Status',   value: email.processing_status },
    { icon: CreditCard,label: 'Dispute',     value: email.dispute_id ? `#${email.dispute_id}` : null },
    { icon: Banknote,  label: 'Confidence',  value: email.routing_confidence != null ? `${(email.routing_confidence * 100).toFixed(0)}%` : null },
    { icon: Calendar,  label: 'Received',    value: formatDate(email.received_at) },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Subject banner */}
      <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
        <p className="text-[11px] text-brand-500 font-semibold uppercase tracking-wider mb-1">Subject</p>
        <p className="text-sm font-semibold text-surface-900">{email.subject}</p>
      </div>

      {/* Key fields grid */}
      <div>
        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Email Details</p>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-surface-50 rounded-xl p-3 border border-surface-100">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} className="text-surface-400" />
                <span className="text-[11px] text-surface-400 uppercase tracking-wider font-medium">{label}</span>
              </div>
              <p className="text-sm font-semibold text-surface-800 truncate">
                {value ?? <span className="text-surface-300 font-normal italic">—</span>}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Attachments */}
      {email.attachments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Package size={12} /> Attachments ({email.attachments.length})
          </p>
          <div className="space-y-1.5">
            {email.attachments.map((a) => (
              <div key={a.attachment_id} className="flex items-center gap-3 p-2.5 bg-surface-50 rounded-xl border border-surface-100">
                <File size={14} className="text-brand-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-surface-800 truncate">{a.file_name}</p>
                  <p className="text-[11px] text-surface-400">{formatDate(a.uploaded_at)}</p>
                </div>
                <Badge variant="info">{a.file_type.split('/').pop()?.toUpperCase() ?? 'FILE'}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body preview */}
      {email.body_text && (
        <div>
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <StickyNote size={12} /> Email Body Preview
          </p>
          <pre className="text-xs text-surface-600 bg-surface-50 border border-surface-100 rounded-xl p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
            {email.body_text}
          </pre>
        </div>
      )}

      {/* Dispute created */}
      {email.dispute_id && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-brand-500 shrink-0" />
          <p className="text-xs text-brand-700">
            <span className="font-semibold">Dispute #{email.dispute_id} created.</span>{' '}
            Head to the Dashboard to review and manage it.
          </p>
        </div>
      )}

      {/* Failure reason */}
      {email.failure_reason && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 flex items-start gap-2">
          <AlertCircle size={14} className="text-brand-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-brand-800 mb-0.5">Processing note</p>
            <p className="text-xs text-brand-700">{email.failure_reason}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Documents Page ───────────────────────────────────────────────────────────
let idCounter = 1;
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40;

const DocumentsPage = () => {
  const [jobs, setJobs]         = useState<IngestJob[]>([]);
  const [activeJob, setActiveJob] = useState<IngestJob | null>(null);
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    return () => { Object.values(pollRefs.current).forEach(clearInterval); };
  }, []);

  const updateJob = useCallback((id: string, patch: Partial<IngestJob>) => {
    setJobs((prev) => prev.map((j) => j.doc.id === id ? { ...j, ...patch } : j));
    setActiveJob((prev) => prev?.doc.id === id ? { ...prev, ...patch } : prev);
  }, []);

  const stopPolling = (docId: string) => {
    if (pollRefs.current[docId]) {
      clearInterval(pollRefs.current[docId]);
      delete pollRefs.current[docId];
    }
  };

  const startPolling = useCallback((docId: string, taskId: string, emailId: number) => {
    let polls = 0;
    pollRefs.current[docId] = setInterval(async () => {
      polls++;
      if (polls > MAX_POLLS) {
        stopPolling(docId);
        updateJob(docId, {
          error: 'Processing timed out. Please try again.',
          doc: { id: docId, filename: '', size: 0, mime_type: '', uploaded_at: '', status: 'failed' },
        });
        return;
      }
      try {
        const taskStatus = await emailService.getTaskStatus(taskId);
        if (taskStatus.status === 'SUCCESS') {
          stopPolling(docId);
          const emailData = await emailService.getEmail(emailId);
          updateJob(docId, {
            emailData,
            doc: { id: docId, filename: '', size: 0, mime_type: '', uploaded_at: '', status: 'extracted' },
          });
        } else if (taskStatus.status === 'FAILURE') {
          stopPolling(docId);
          updateJob(docId, {
            error: 'Processing failed. The AI pipeline encountered an error.',
            doc: { id: docId, filename: '', size: 0, mime_type: '', uploaded_at: '', status: 'failed' },
          });
        }
      } catch {
        // network hiccup — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [updateJob]);

  const handleFiles = (files: File[]) => {
    const valid = files.filter((f) => f.type === 'application/pdf' && f.size <= MAX_FILE_SIZE_BYTES);
    if (!valid.length) return;
    const newJobs: IngestJob[] = valid.map((f) => ({
      doc: {
        id: String(idCounter++),
        filename: f.name,
        size: f.size,
        mime_type: f.type,
        uploaded_at: new Date().toISOString(),
        status: 'processing' as const,
      },
      file: f,
      senderEmail: '',
      subject: '',
    }));
    setJobs((prev) => [...prev, ...newJobs]);
  };

  const handleSubmitMeta = async (docId: string, senderEmail: string, subject: string) => {
    const job = jobs.find((j) => j.doc.id === docId);
    if (!job) return;
    updateJob(docId, { senderEmail, subject });
    try {
      const resp = await emailService.ingest(job.file, senderEmail, subject);
      updateJob(docId, { taskId: resp.task_id, emailId: resp.email_id });
      startPolling(docId, resp.task_id, resp.email_id);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      updateJob(docId, {
        error: apiErr?.message ?? 'Upload failed. Please try again.',
        doc: { ...job.doc, status: 'failed' },
      });
    }
  };

  const handleRemove = (id: string) => {
    stopPolling(id);
    setJobs((prev) => prev.filter((j) => j.doc.id !== id));
    if (activeJob?.doc.id === id) setActiveJob(null);
  };

  const handleClearAll = () => {
    jobs.forEach((j) => stopPolling(j.doc.id));
    setJobs([]);
    setActiveJob(null);
  };

  return (
    <div className="p-6 h-full max-w-screen-xl mx-auto flex flex-col">
      <PageHeader
        title="Document Upload"
        subtitle="Upload email PDFs for AI-powered extraction and automated dispute creation."
        action={
          jobs.length > 0
            ? <Button variant="ghost" size="sm" onClick={handleClearAll}>Clear All</Button>
            : undefined
        }
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">

        {/* ── Left: Upload panel ── */}
        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <h3 className="font-display font-semibold text-surface-800 mb-1 text-sm">Upload Email PDF</h3>
            <p className="text-xs text-surface-400 mb-4">
              Each file goes through the LangGraph AI pipeline: invoice extraction → classification → dispute creation.
            </p>
            <UploadZone onFiles={handleFiles} />
          </div>

          {jobs.length > 0 && (
            <div className="card p-5 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-surface-800 text-sm">Uploaded Files</h3>
                <Badge variant={jobs.some(j => j.doc.status === 'processing') ? 'info' : 'success'}>
                  {jobs.filter(j => j.doc.status === 'extracted').length}/{jobs.length} done
                </Badge>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1">
                {jobs.map((job) => (
                  <FileQueueItem
                    key={job.doc.id}
                    job={job}
                    onRemove={handleRemove}
                    onPreview={(j) => setActiveJob(j)}
                    onSubmitMeta={handleSubmitMeta}
                  />
                ))}
              </div>
            </div>
          )}

          {jobs.length === 0 && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-surface-800 text-sm mb-3 flex items-center gap-2">
                <Inbox size={14} className="text-brand-500" /> How it works
              </h3>
              <ol className="space-y-2.5">
                {[
                  ['Upload', 'an email saved as PDF'],
                  ['Fill', 'in sender email & subject'],
                  ['AI pipeline', 'extracts invoice data & classifies the dispute type'],
                  ['Preview', 'all extracted fields in the right panel'],
                  ['Dispute created', 'auto-visible on your Dashboard'],
                ].map(([bold, rest], i) => (
                  <li key={i} className="flex items-start gap-3 text-xs text-surface-600">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span><span className="font-semibold text-surface-800">{bold}</span> {rest}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* ── Right: Extracted data panel ── */}
        <div className="card p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-surface-800 text-sm">Extracted Data</h3>
            {activeJob && (
              <div className="flex items-center gap-2">
                <File size={12} className="text-surface-400" />
                <span className="text-xs text-surface-400 truncate max-w-[180px]">{activeJob.doc.filename}</span>
                {activeJob.doc.status === 'extracted' && <Badge variant="success">AI Processed</Badge>}
                {activeJob.doc.status === 'processing' && activeJob.taskId && (
                  <button
                    title="Refresh status"
                    onClick={async () => {
                      if (!activeJob.emailId) return;
                      try {
                        const emailData = await emailService.getEmail(activeJob.emailId);
                        updateJob(activeJob.doc.id, { emailData, doc: { ...activeJob.doc, status: 'extracted' } });
                      } catch { /* silent */ }
                    }}
                    className="p-1 rounded hover:bg-surface-100"
                  >
                    <RefreshCw size={12} className="text-surface-400" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            <ExtractedPanel job={activeJob} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentsPage;