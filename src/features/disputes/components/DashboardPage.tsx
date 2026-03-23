import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Search, Filter, Link2, Clock, CheckCircle2, AlertCircle, FileText,
  X, ChevronRight, ChevronDown, ChevronUp, Brain, MessageSquare,
  User2, RefreshCw, Loader2, AlertTriangle, Receipt,
  Calendar, DollarSign, Building2, Hash, Zap,
  ArrowUpRight, Package, CheckCheck, TrendingUp, CreditCard,
  Send, Paperclip, Mail, Download, Sparkles, Wand2, Plus, Upload, Trash2, FileIcon, Eye,
} from 'lucide-react';
import { useUser } from '@/hooks';
import { Badge } from '@/components/ui';
import { PageHeader, EmptyState, LoadingSpinner } from '@/components/common';
import { formatDate, formatCurrency } from '@/utils';
import {
  disputeService,
  draftEmailService,
  newMessageService,
  faDisputeService,
  forkRecommendationService,
  disputeDocumentService,
  disputeTypeService,
  Dispute, DisputeDocument, DisputeType as DisputeTypeOption,
  ForkRecommendation,
  InvoiceData, PaymentDetailData, TimelineEpisode, TimelineAttachment,
} from '../services/disputeService';
import { arDocumentService, ARDocRelated, DOC_TYPE_LABELS, KEY_TYPE_LABELS } from '../services/arDocumentService';
import { mailboxService, OutboundEmail } from '@/services/mailboxService';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// ─── Status / Priority helpers ────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; badge: 'danger'|'warning'|'success'|'default'; dot: string }> = {
  OPEN:         { label: 'Open',         badge: 'danger',  dot: 'bg-red-500'      },
  UNVERIFIED:   { label: 'Unverified',   badge: 'warning', dot: 'bg-brand-300'   },
  UNDER_REVIEW: { label: 'Under Review', badge: 'warning', dot: 'bg-brand-400'    },
  RESOLVED:     { label: 'Resolved',     badge: 'success', dot: 'bg-green-500'    },
  CLOSED:       { label: 'Closed',       badge: 'default', dot: 'bg-surface-300'  },
};
const PRIORITY_CONFIG: Record<string, { label: string; badge: 'danger'|'warning'|'default' }> = {
  HIGH:   { label: 'High',   badge: 'danger'  },
  MEDIUM: { label: 'Medium', badge: 'warning' },
  LOW:    { label: 'Low',    badge: 'default' },
};
const sc = (s: string) => STATUS_CONFIG[s]   ?? { label: s, badge: 'default' as const, dot: 'bg-surface-200' };
const pc = (p: string) => PRIORITY_CONFIG[p] ?? { label: p, badge: 'default' as const };

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, accent, sub }: {
  icon: React.ElementType; label: string; value: number; accent: string; sub?: string;
}) => (
  <div className="card p-5 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
      <Icon size={20} className="text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest truncate">{label}</p>
      <p className="font-display text-3xl font-bold text-surface-800 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);



// ─── Invoice detail card ──────────────────────────────────────────────────────
const InvoiceCard = ({ invoice }: { invoice: InvoiceData }) => {
  const d = invoice.invoice_details ?? {};
  const cur = d.currency ?? 'INR';
  const items = d.line_items ?? [];
  return (
    <div className="rounded-2xl border border-surface-200 overflow-hidden">
      <div className="bg-brand-50 px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0"><Receipt size={16} className="text-brand-600" /></div>
          <div className="min-w-0">
            <p className="text-xs text-brand-500 font-semibold uppercase tracking-wider">Invoice</p>
            <p className="font-display font-bold text-surface-800 text-sm truncate">{d.invoice_number ?? invoice.invoice_number}</p>
          </div>
        </div>
        {invoice.invoice_url && (<a href={invoice.invoice_url} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-white border border-brand-200 hover:border-brand-400 px-3 py-1.5 rounded-lg transition-all">View PDF <ArrowUpRight size={12} /></a>)}
      </div>
      <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 border-b border-surface-100">
        {d.vendor_name && (<div className="col-span-2 flex items-center gap-2"><Building2 size={13} className="text-gray-500 shrink-0" /><span className="text-sm text-surface-800 font-medium">{d.vendor_name}</span>{d.customer_name && (<><ChevronRight size={13} className="text-gray-400" /><span className="text-sm text-surface-800 font-medium">{d.customer_name}</span></>)}</div>)}
        {[
          { icon: Calendar,   label: 'Invoice Date', val: d.invoice_date  ? formatDate(d.invoice_date as string)  : null },
          { icon: Calendar,   label: 'Due Date',     val: d.due_date      ? formatDate(d.due_date as string)      : null },
          { icon: Hash,       label: 'Terms',        val: d.payment_terms as string ?? null },
          { icon: DollarSign, label: 'Currency',     val: cur },
        ].filter(r => r.val).map(({ icon: Ic, label, val }) => (
          <div key={label} className="flex items-start gap-2"><Ic size={13} className="text-gray-500 mt-0.5 shrink-0" /><div><p className="text-xs text-gray-500 font-medium">{label}</p><p className="text-sm font-semibold text-surface-800">{val}</p></div></div>
        ))}
      </div>
      {items.length > 0 && (
        <div className="px-5 py-4 border-b border-surface-100">
          <div className="flex items-center gap-1.5 mb-3"><Package size={13} className="text-gray-500" /><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Line Items</p></div>
          <div className="space-y-1.5">
            {items.map((item, i) => (<div key={i} className="flex items-baseline justify-between gap-4 text-sm"><span className="text-surface-800 flex-1 min-w-0 truncate">{item.description}</span><span className="text-gray-500 shrink-0 text-xs">{(item.qty ?? item.quantity) != null ? `× ${item.qty ?? item.quantity}` : ''}{item.unit_price != null ? ` @ ${formatCurrency(item.unit_price, cur)}` : ''}</span>{item.total != null && <span className="font-semibold text-surface-800 shrink-0">{formatCurrency(item.total, cur)}</span>}</div>))}
          </div>
        </div>
      )}
      <div className="px-5 py-4 space-y-2">
        {d.subtotal != null && <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium text-surface-800">{formatCurrency(d.subtotal, cur)}</span></div>}
        {d.tax_amount != null && <div className="flex justify-between text-sm"><span className="text-gray-500">Tax (GST/VAT)</span><span className="font-medium text-surface-800">{formatCurrency(d.tax_amount, cur)}</span></div>}
        {d.total_amount != null && <div className="flex justify-between items-center pt-2 mt-2 border-t border-surface-100"><span className="font-bold text-surface-800">Total</span><span className="font-display font-bold text-xl text-brand-600">{formatCurrency(d.total_amount, cur)}</span></div>}
      </div>
    </div>
  );
};

// ─── Payment row ──────────────────────────────────────────────────────────────
const PaymentRow = ({ payment, index }: { payment: PaymentDetailData; index: number }) => {
  const d = payment.payment_details ?? {};
  const statusColor = d.status === 'CLEARED' ? 'bg-green-100 text-green-700' : d.status === 'PENDING' ? 'bg-brand-100 text-brand-700' : d.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-surface-100 text-surface-800';
  return (
    <div className={clsx('border-b border-surface-100 last:border-b-0', index % 2 === 1 ? 'bg-surface-50' : 'bg-white')}>
      <div className="px-5 py-3.5 flex items-start gap-4">
        <div className="w-7 h-7 rounded-full bg-surface-100 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-surface-600">{d.payment_sequence ?? index + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-semibold text-surface-800 text-sm">{d.payment_reference ?? `Payment #${payment.payment_detail_id}`}</span>
            <div className="flex items-center gap-2 shrink-0">
              {d.status && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor}`}>{d.status as string}</span>}
              {payment.payment_url && <a href={payment.payment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">PDF <ArrowUpRight size={10} /></a>}
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-4 flex-wrap text-xs text-gray-500">
            {d.payment_date && <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(d.payment_date as string)}</span>}
            {d.payment_mode && <span className="flex items-center gap-1"><Zap size={11} />{d.payment_mode as string}</span>}
            {d.amount_paid != null && <span className="flex items-center gap-1 font-bold text-green-700 text-sm"><DollarSign size={11} />{formatCurrency(d.amount_paid as number)}</span>}
          </div>
          {(d.note || d.failure_reason) && (<div className="mt-1.5 flex items-start gap-1.5 text-xs text-brand-800 bg-brand-50 rounded-lg px-2.5 py-1.5"><AlertTriangle size={11} className="shrink-0 mt-0.5 text-brand-500" />{(d.failure_reason ?? d.note) as string}</div>)}
        </div>
      </div>
    </div>
  );
};

const PaymentListCard = ({ payments }: { payments: PaymentDetailData[] }) => {
  const totalPaid = payments.reduce((sum, p) => { const amt = p.payment_details?.amount_paid; if (typeof amt === 'number' && p.payment_details?.status === 'CLEARED') return sum + amt; return sum; }, 0);
  return (
    <div className="rounded-2xl border border-surface-200 overflow-hidden">
      <div className="bg-green-50 px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-green-200 flex items-center justify-center shrink-0"><CreditCard size={16} className="text-green-700" /></div>
          <div className="min-w-0"><p className="text-xs text-green-600 font-semibold uppercase tracking-wider">Payments</p><p className="font-display font-bold text-surface-800 text-sm">{payments.length} record{payments.length !== 1 ? 's' : ''}</p></div>
        </div>
        {totalPaid > 0 && <div className="shrink-0 text-right"><p className="text-xs text-gray-500">Cleared</p><p className="font-display font-bold text-green-700 text-lg">{formatCurrency(totalPaid)}</p></div>}
      </div>
      <div className="divide-y divide-surface-100">{payments.map((p, i) => <PaymentRow key={p.payment_detail_id} payment={p} index={i} />)}</div>
    </div>
  );
};

// ─── Timeline message ─────────────────────────────────────────────────────────
const actorConfig = {
  CUSTOMER:  { color: 'bg-blue-500',   ring: 'ring-blue-200',   bubble: 'bg-slate-50 border border-slate-200',    text: 'text-blue-600'   },
  AI:        { color: 'bg-brand-600', ring: 'ring-brand-200', bubble: 'bg-brand-50 border border-brand-100',  text: 'text-brand-600' },
  ASSOCIATE: { color: 'bg-brand-600', ring: 'ring-brand-200', bubble: 'bg-brand-50 border border-brand-100',  text: 'text-brand-600' },
  SYSTEM:    { color: 'bg-slate-400',  ring: 'ring-slate-200',  bubble: 'bg-slate-100 border border-slate-200',   text: 'text-slate-600'  },
};
const getActorCfg = (actor: string) => actorConfig[actor as keyof typeof actorConfig] ?? actorConfig.ASSOCIATE;

const getActorLabel = (ep: TimelineEpisode, dispute: Dispute): string => {
  if (ep.actor === 'AI') return 'AI · Accounts Receivable';
  if (ep.actor === 'SYSTEM') return 'System';
  if (ep.actor === 'CUSTOMER') return dispute.customer_id ?? 'Customer';
  if (ep.actor === 'ASSOCIATE') {
    const name = ep.actor_name?.trim() || dispute.assigned_to?.trim();
    return name ? `${name} (Finance Associate)` : 'Finance Associate';
  }
  return ep.actor;
};

const ActorIcon = ({ actor }: { actor: string }) => {
  if (actor === 'CUSTOMER')  return <MessageSquare size={12} className="text-white" />;
  if (actor === 'AI')        return <Brain size={12} className="text-white" />;
  if (actor === 'ASSOCIATE') return <User2 size={12} className="text-white" />;
  return <Zap size={12} className="text-white" />;
};

// ─── Attachment chip shown inside a timeline bubble ──────────────────────────
const AttachmentChip = ({ att }: { att: TimelineAttachment }) => {
  const [loading, setLoading] = useState(false);
  const isImage = att.file_type?.startsWith('image/');
  const isPdf   = att.file_type === 'application/pdf' || att.file_name.endsWith('.pdf');
  const icon    = isImage ? '🖼' : isPdf ? '📄' : '📎';

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    try {
      setLoading(true);
      // Import axios instance so the JWT header is included automatically
      const { default: axiosInstance } = await import('@/lib/axios');
      const response = await axiosInstance.get(att.download_url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = att.file_name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      toast.error(`Failed to download ${att.file_name}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-current/20 bg-white/60 hover:bg-white transition-all text-xs font-medium group/chip disabled:opacity-60"
    >
      <span className="text-sm leading-none">{icon}</span>
      <span className="max-w-[140px] truncate">{att.file_name}</span>
      {loading
        ? <Loader2 size={11} className="shrink-0 animate-spin" />
        : <Download size={11} className="shrink-0 opacity-50 group-hover/chip:opacity-100 transition-opacity" />
      }
    </button>
  );
};

const TimelineMessage = ({ ep, dispute, isLast }: { ep: TimelineEpisode; dispute: Dispute; isLast: boolean }) => {
  const cfg = getActorCfg(ep.actor);
  const label = getActorLabel(ep, dispute);
  const hasAttachments = ep.attachments && ep.attachments.length > 0;
  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-full ${cfg.color} ring-2 ${cfg.ring} flex items-center justify-center shrink-0 shadow-sm`}><ActorIcon actor={ep.actor} /></div>
        {!isLast && <div className="w-px flex-1 bg-surface-200 mt-2 min-h-4" />}
      </div>
      <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-5'}`}>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={`text-xs font-bold ${cfg.text}`}>{label}</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500">{formatDate(ep.created_at)}</span>
          {hasAttachments && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Paperclip size={10} />{ep.attachments.length} file{ep.attachments.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className={`${cfg.bubble} rounded-2xl rounded-tl-sm px-4 py-3`}>
          <p className="text-sm text-surface-800 leading-relaxed whitespace-pre-wrap break-words">{ep.content_text}</p>
          {hasAttachments && (
            <div className={`mt-3 pt-3 border-t border-current/10 flex flex-wrap gap-2 ${cfg.text}`}>
              {ep.attachments.map(att => (
                <AttachmentChip key={att.attachment_id} att={att} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Doc row ──────────────────────────────────────────────────────────────────
const DocRow = ({ icon: Icon, iconBg, label, sublabel, meta, url, urlLabel, loading, missing, missingText }: {
  icon: React.ElementType; iconBg: string; label: string; sublabel?: string;
  meta?: Array<{ icon: React.ElementType; text: string }>; url?: string; urlLabel: string;
  loading?: boolean; missing?: boolean; missingText?: string;
}) => (
  <div className="rounded-2xl border border-surface-200 overflow-hidden">
    <div className="flex items-start gap-4 p-5">
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}><Icon size={18} className="text-white" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
        {loading ? (<div className="flex items-center gap-2 mt-1"><Loader2 size={14} className="animate-spin text-gray-500" /><span className="text-sm text-gray-500">Fetching details…</span></div>)
          : missing ? (<p className="text-sm text-gray-400 italic">{missingText}</p>)
          : (<><p className="font-display font-bold text-surface-800">{sublabel}</p>{meta && meta.length > 0 && (<div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">{meta.map(({ icon: Ic, text }, i) => (<div key={i} className="flex items-center gap-1.5"><Ic size={12} className="text-gray-500 shrink-0" /><span className="text-xs text-surface-800">{text}</span></div>))}</div>)}</>)}
      </div>
      {!loading && !missing && url && (<a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-2 rounded-xl transition-all shrink-0">{urlLabel} <ArrowUpRight size={12} /></a>)}
    </div>
  </div>
);

// ─── AI Draft generation ──────────────────────────────────────────────────────
// Draft is generated by the backend using Groq (llama-3.3-70b-versatile).
// The backend reads the full dispute timeline and metadata, so no extra
// API calls are needed from the frontend.

// ─── Send Email Panel ─────────────────────────────────────────────────────────
const SendEmailPanel = ({ dispute, onEmailSent }: { dispute: Dispute; onEmailSent: () => void }) => {
  const defaultSubject = `Re: Case #${dispute.dispute_id} – ${dispute.dispute_type?.reason_name ?? 'Case'}`;
  const [to, setTo]           = useState(dispute.customer_id ?? '');
  const [subject, setSubj]    = useState(defaultSubject);
  const [body, setBody]       = useState('');
  const [files, setFiles]     = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [newThread, setNewThread] = useState(false);
  const [draftLoading, setDraftLoading]   = useState(false);
  const [draftError, setDraftError]       = useState<string | null>(null);
  const [isDraftFromAI, setIsDraftFromAI] = useState(false);   // true only when AI generated, reset on manual edit
  const fileRef = useRef<HTMLInputElement>(null);

  // When toggling thread mode, update subject to match expected behaviour
  const handleToggleThread = (val: boolean) => {
    setNewThread(val);
    if (val) {
      setSubj(`[PV-${String(dispute.dispute_id).padStart(5, '0')}] ${dispute.dispute_type?.reason_name ?? 'Your Case'}`);
    } else {
      setSubj(defaultSubject);
    }
  };

  // ── AI Draft ────────────────────────────────────────────────────────────────
  const handleAIDraft = async () => {
    setDraftLoading(true);
    setDraftError(null);
    try {
      // Single backend call — Groq generates the draft server-side
      const result = await draftEmailService.generateDraft(dispute.dispute_id);
      setBody(result.draft_body);
      setIsDraftFromAI(true);
      // Also update subject if it's still the default
      if (subject === defaultSubject) {
        setSubj(result.suggested_subject);
      }
      toast.success('AI draft ready — review before sending!');
    } catch {
      setDraftError('Failed to generate draft. Check your connection and try again.');
      toast.error('AI draft generation failed');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) { toast.error('Fill in all fields'); return; }
    try {
      setSending(true);
      const bodyHtml = `<p>${body.replace(/\n/g, '<br/>')}</p>`;
      await mailboxService.sendEmail(
        dispute.dispute_id,
        { to_email: to, subject, body_html: bodyHtml, body_text: body, new_thread: newThread },
        files,
      );
      setBody(''); setFiles([]);
      toast.success(newThread ? 'New email thread sent' : 'Reply sent in existing thread');
      onEmailSent();
    } catch { toast.error('Failed to send email'); } finally { setSending(false); }
  };

  const removeFile = (i: number) => setFiles(f => f.filter((_, idx) => idx !== i));
  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    setFiles(f => [...f, ...newFiles]);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <h3 className="text-sm font-bold text-surface-800 flex items-center gap-2 mb-5">
          <Mail size={15} className="text-brand-500" /> Compose Email
        </h3>

        {/* Thread mode toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-100 rounded-xl mb-5 w-fit">
          <button
            onClick={() => handleToggleThread(false)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              !newThread
                ? 'bg-white text-brand-700 shadow-sm border border-brand-200'
                : 'text-gray-500 hover:text-surface-700'
            )}
          >
            <MessageSquare size={12} /> Reply to thread
          </button>
          <button
            onClick={() => handleToggleThread(true)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              newThread
                ? 'bg-white text-brand-600 shadow-sm border border-brand-200'
                : 'text-gray-500 hover:text-surface-700'
            )}
          >
            <Send size={12} /> New thread
          </button>
        </div>

        {/* Context hint */}
        <div className={clsx(
          'flex items-start gap-2 rounded-xl px-3.5 py-2.5 mb-4 text-xs',
          newThread
            ? 'bg-brand-50 border border-brand-100 text-brand-700'
            : 'bg-brand-50 border border-brand-100 text-brand-700'
        )}>
          {newThread
            ? <><AlertTriangle size={13} className="shrink-0 mt-0.5" /> <span>This will appear as a <strong>new conversation</strong> in the customer's inbox — not linked to any previous email thread.</span></>
            : <><CheckCircle2 size={13} className="shrink-0 mt-0.5" /> <span>This reply will be <strong>grouped with previous emails</strong> in the customer's inbox as part of the same conversation.</span></>
          }
        </div>

        {/* ── AI Draft Banner ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-50 px-5 py-4 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-brand-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-brand-900">AI Email Draft</p>
                <p className="text-xs text-brand-600 mt-0.5 leading-relaxed">
                  Reads the entire conversation history and generates a professional reply for you to review and edit.
                </p>
              </div>
            </div>
            <button
              onClick={handleAIDraft}
              disabled={draftLoading}
              className={clsx(
                'shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                draftLoading
                  ? 'bg-brand-100 text-brand-400 cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow-md'
              )}
            >
              {draftLoading ? (
                <><Loader2 size={14} className="animate-spin" /> Drafting…</>
              ) : (
                <><Wand2 size={14} /> Generate Draft</>
              )}
            </button>
          </div>
          {draftError && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              {draftError}
            </div>
          )}
          {isDraftFromAI && !draftLoading && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
              <CheckCheck size={12} className="shrink-0" />
              Draft generated — review and edit below before sending.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">To</label>
            <input className="input-base text-sm py-2" placeholder="customer@example.com" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Subject</label>
            <input className="input-base text-sm py-2" value={subject} onChange={e => setSubj(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
              Message
              {draftLoading && (
                <span className="flex items-center gap-1 text-brand-500 font-medium">
                  <Loader2 size={10} className="animate-spin" /> AI is writing…
                </span>
              )}
            </label>
            <textarea
              className={clsx(
                'input-base text-sm py-2 resize-none transition-all',
                draftLoading && 'opacity-50 pointer-events-none',
                isDraftFromAI && !draftLoading && 'border-brand-300 ring-1 ring-brand-200'
              )}
              rows={9}
              placeholder={draftLoading ? 'Generating AI draft…' : 'Type your message here, or click Generate Draft above…'}
              value={body}
              onChange={e => { setBody(e.target.value); setIsDraftFromAI(false); }}
            />
          </div>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-surface-100 rounded-lg px-2.5 py-1.5 text-xs text-surface-700">
                  <Paperclip size={11} className="text-gray-500" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition-colors ml-1"><X size={11} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input ref={fileRef} type="file" multiple className="hidden" onChange={addFiles} />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-surface-800 border border-surface-200 hover:border-surface-300 px-3 py-1.5 rounded-lg transition-all"
            >
              <Paperclip size={13} /> Attach Files
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !to || !body}
              className={clsx(
                'ml-auto flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                newThread ? 'bg-brand-500 hover:bg-brand-600' : 'bg-brand-600 hover:bg-brand-700'
              )}
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {newThread ? 'Send New Thread' : 'Send Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Full-screen Dispute Modal ────────────────────────────────────────────────
const DisputeModal = ({ dispute: initDispute, onClose, onStatusUpdate }: {
  dispute: Dispute; onClose: () => void;
  onStatusUpdate: (disputeId: number, patch: Partial<Dispute>) => void;
}) => {
  const [dispute, setDispute]  = useState<Dispute>(initDispute);
  const [invoice, setInvoice]  = useState<InvoiceData | null>(null);
  const [payments, setPayments] = useState<PaymentDetailData[]>([]);
  const [episodes, setEpisodes] = useState<TimelineEpisode[]>([]);
  const [invoiceLoading, setIL]   = useState(false);
  const [paymentLoading, setPL]   = useState(false);
  const [timelineLoading, setTL]  = useState(false);
  const [invoiceTried,  setIT]    = useState(false);
  const [paymentTried,  setPT]    = useState(false);
  const [timelineTried, setTT]    = useState(false);
  const [updating, setUpdating]   = useState<string | null>(null);
  const [tab, setTab] = useState<'overview'|'timeline'|'documents'|'email'>('overview');

  // Fork recommendations — loaded once on mount
  const [forkRecs, setForkRecs]           = useState<ForkRecommendation[]>([]);
  const [forkRecsLoaded, setForkRecsLoaded] = useState(false);

  useEffect(() => {
    if (forkRecsLoaded) return;
    setForkRecsLoaded(true);
    forkRecommendationService.list(dispute.dispute_id)
      .then(setForkRecs)
      .catch(() => setForkRecs([]));
  }, [dispute.dispute_id, forkRecsLoaded]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (invoiceTried || !dispute.invoice_id) return;
    if (tab !== 'overview' && tab !== 'documents') return;
    setIT(true); setIL(true);
    disputeService.getInvoice(dispute.invoice_id).then(setInvoice).catch(() => {}).finally(() => setIL(false));
  }, [tab, dispute.invoice_id, invoiceTried]);

  useEffect(() => {
    if (paymentTried) return;
    if (tab !== 'overview' && tab !== 'documents') return;
    if (!dispute.invoice_id && !dispute.payment_detail_id) return;
    setPT(true); setPL(true);
    const run = async () => {
      try {
        if (dispute.invoice_id) {
          const invNum = invoice?.invoice_number ?? (await disputeService.getInvoice(dispute.invoice_id)).invoice_number;
          const res = await disputeService.getPaymentsByInvoice(invNum);
          setPayments(res.items);
        } else {
          const p = await disputeService.getPaymentDetail(dispute.payment_detail_id!);
          setPayments([p]);
        }
      } catch {} finally { setPL(false); }
    };
    run();
  }, [tab, dispute.invoice_id, dispute.payment_detail_id, paymentTried, invoice]);

  const refreshTimeline = () => {
    setTL(true);
    disputeService.getTimeline(dispute.dispute_id).then(r => setEpisodes(r.timeline)).catch(() => setEpisodes([])).finally(() => setTL(false));
  };

  useEffect(() => {
    if (timelineTried || tab !== 'timeline') return;
    setTT(true);
    refreshTimeline();
  }, [tab, dispute.dispute_id, timelineTried]);

  const handleStatus = async (newStatus: string) => {
    try {
      setUpdating(newStatus);
      await disputeService.updateStatus(dispute.dispute_id, newStatus);
      // Update local modal state immediately — no flicker, no reload
      setDispute(prev => ({ ...prev, status: newStatus }));
      // Patch parent list in-place — only this row updates
      onStatusUpdate(dispute.dispute_id, { status: newStatus });
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); } finally { setUpdating(null); }
  };

  const s = sc(dispute.status);
  const p = pc(dispute.priority);

  const TABS = [
    { id: 'overview'   as const, label: 'Overview'  },
    { id: 'timeline'   as const, label: 'Timeline',  pill: timelineTried ? episodes.length : undefined },
    { id: 'documents'  as const, label: 'Documents' },
    { id: 'email'      as const, label: '✉ Send Email' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — large centered */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
        <div className="bg-white rounded-2xl shadow-modal w-full max-w-6xl h-full max-h-[92vh] flex flex-col animate-scale-in overflow-hidden">

          {/* ── Header ── */}
          <div className="flex-shrink-0 px-8 pt-6 pb-5 border-b border-surface-100 bg-gradient-to-r from-surface-50 to-white">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                  <code className="text-xs font-mono bg-surface-100 text-surface-700 px-2.5 py-1 rounded-lg">#{dispute.dispute_id}</code>
                  <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold', s.badge === 'danger' ? 'bg-red-50 text-red-700' : s.badge === 'warning' ? 'bg-brand-50 text-brand-700' : s.badge === 'success' ? 'bg-green-50 text-green-700' : 'bg-surface-100 text-surface-700')}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                  </span>
                  <Badge variant={p.badge}>{p.label} Priority</Badge>
                </div>
                <h2 className="font-display font-bold text-surface-800 text-xl leading-snug">{dispute.dispute_type?.reason_name ?? 'Unknown Dispute'}</h2>
                <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-2">
                  <Building2 size={13} className="shrink-0" />{dispute.customer_id}
                  <span className="text-gray-300 mx-0.5">·</span>
                  <Calendar size={13} className="shrink-0" />Opened {formatDate(dispute.created_at)}
                </p>
              </div>
              <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-surface-100 text-gray-400 hover:text-surface-700 transition-colors shrink-0">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex-shrink-0 flex gap-0 border-b border-surface-100 px-8 bg-white">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={clsx('relative flex items-center gap-2 py-4 mr-7 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-surface-800')}>
                {t.label}
                {t.pill != null && t.pill > 0 && <span className="text-xs bg-surface-100 text-surface-700 rounded-full px-1.5 py-px font-bold">{t.pill}</span>}
              </button>
            ))}
          </div>

          {/* ── Body — split layout ── */}
          <div className="flex-1 overflow-hidden flex min-h-0">

            {/* Main content */}
            <div className="flex-1 overflow-y-auto">

              {/* OVERVIEW */}
              {tab === 'overview' && (
                <div className="px-8 py-6 space-y-6">

                  {/* Description + AI summary */}
                  <section>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Case Description</h3>
                    {dispute.description && dispute.description.trim() ? (
                      <p className="text-sm text-surface-800 leading-relaxed bg-surface-50 border border-surface-100 rounded-xl px-4 py-3.5 whitespace-pre-wrap">{dispute.description.trim()}</p>
                    ) : dispute.latest_analysis?.ai_summary ? (
                      <p className="text-sm text-surface-800 leading-relaxed bg-surface-50 border border-surface-100 rounded-xl px-4 py-3.5">{dispute.latest_analysis.ai_summary}</p>
                    ) : (
                      <p className="text-sm bg-surface-50 border border-surface-100 rounded-xl px-4 py-3.5"><em className="text-gray-400">No description available</em></p>
                    )}
                    {dispute.description && dispute.description.trim() && dispute.latest_analysis?.ai_summary && (
                      <div className="mt-2 px-4 py-2.5 bg-brand-50 border border-brand-100 rounded-xl">
                        <p className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-1">AI Summary</p>
                        <p className="text-xs text-brand-800">{dispute.latest_analysis.ai_summary}</p>
                      </div>
                    )}
                  </section>

                  {/* Fork recommendations — AI-suggested case splits */}
                  {forkRecs.length > 0 && (
                    <div className="space-y-3">
                      {forkRecs.map(rec => (
                        <ForkRecommendationCard
                          key={rec.recommendation_id}
                          rec={rec}
                          dispute={dispute}
                          onAccepted={newId => {
                            setForkRecs(prev => prev.filter(r => r.recommendation_id !== rec.recommendation_id));
                            toast.success(`Case PV-${String(newId).padStart(5, '0')} created and linked`);
                          }}
                          onDismissed={() =>
                            setForkRecs(prev => prev.filter(r => r.recommendation_id !== rec.recommendation_id))
                          }
                        />
                      ))}
                    </div>
                  )}

                  {/* Case meta grid */}
                  <section>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Case Details</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { label: 'Customer',     val: dispute.customer_id ?? '—' },
                        { label: 'Assigned To',  val: dispute.assigned_to ?? 'Unassigned' },
                        { label: 'Last Updated', val: formatDate(dispute.updated_at) },
                      ].map(({ label, val }) => (
                        <div key={label} className="bg-surface-50 border border-surface-100 rounded-xl px-3.5 py-3">
                          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-0.5">{label}</p>
                          <p className="text-sm font-bold text-surface-800 truncate">{val}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* AI response (if exists) */}
                  {dispute.latest_analysis?.ai_response && (
                    <section>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Brain size={11} /> Suggested Response
                        {dispute.latest_analysis.auto_response_generated && (
                          <span className="ml-auto flex items-center gap-1 text-green-600 text-[10px] font-semibold normal-case tracking-normal">
                            <CheckCheck size={11} /> Auto-sent
                          </span>
                        )}
                      </h3>
                      <div className="bg-surface-50 border border-surface-100 rounded-xl px-4 py-3.5">
                        <p className="text-sm text-surface-800 leading-relaxed whitespace-pre-wrap">{dispute.latest_analysis.ai_response}</p>
                      </div>
                    </section>
                  )}

                  {/* Update status */}
                  <section className="border-t border-surface-100 pt-5">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Update Status</h3>
                    <div className="flex flex-wrap gap-2">
                      {(['UNDER_REVIEW', 'RESOLVED', 'CLOSED'] as const).map(nextStatus => {
                        if (dispute.status === nextStatus) return null;
                        const isPrimary = nextStatus === 'RESOLVED';
                        return (
                          <button key={nextStatus} onClick={() => handleStatus(nextStatus)} disabled={updating !== null} className={clsx('btn-sm inline-flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed', isPrimary ? 'btn-primary' : 'btn-secondary')}>
                            {updating === nextStatus && <Loader2 size={11} className="animate-spin" />}
                            {nextStatus === 'UNDER_REVIEW' && 'Mark Under Review'}
                            {nextStatus === 'RESOLVED'     && 'Mark Resolved'}
                            {nextStatus === 'CLOSED'       && 'Close Case'}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>
              )}

              {/* TIMELINE */}
              {tab === 'timeline' && (
                <div className="px-8 py-6">
                  <div className="flex items-baseline justify-between mb-6">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Conversation History</p>
                    {!timelineLoading && episodes.length > 0 && <span className="text-xs text-gray-400">{episodes.length} message{episodes.length !== 1 ? 's' : ''}</span>}
                  </div>
                  {timelineLoading ? (<div className="flex flex-col items-center justify-center py-20 gap-3"><LoadingSpinner /><p className="text-sm text-gray-500">Loading conversation…</p></div>)
                    : episodes.length > 0 ? (<div className="space-y-0">{episodes.map((ep, i) => <TimelineMessage key={ep.episode_id} ep={ep} dispute={dispute} isLast={i === episodes.length - 1} />)}</div>)
                    : (<EmptyState icon={<MessageSquare size={32} />} title="No messages yet" description="The conversation history will appear here as emails are processed." />)}
                </div>
              )}

              {/* DOCUMENTS — AR graph docs + supporting files */}
              {tab === 'documents' && (
                <div className="px-6 py-5 space-y-6 overflow-y-auto">

                  {/* AR Documents section */}
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Link2 size={11} className="text-brand-500" /> Reference Documents
                      </h3>
                      <a href="/ar-documents" className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1">
                        Manage <ArrowUpRight size={11} />
                      </a>
                    </div>
                    <ARDocsInlinePanel disputeId={dispute.dispute_id} customerId={dispute.customer_id ?? ''} />
                  </section>

                  {/* Supporting files section */}
                  <section className="border-t border-surface-100 pt-5">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Upload size={11} /> Supporting Files
                      </h3>
                      <span className="text-xs text-gray-400 font-normal">(evidence, screenshots, PDFs)</span>
                    </div>
                    <DisputeDocumentsPanel dispute={dispute} />
                  </section>
                </div>
              )}

              {/* SEND EMAIL */}
              {tab === 'email' && <SendEmailPanel dispute={dispute} onEmailSent={refreshTimeline} />}
            </div>

            {/* Right sidebar — quick info (visible on overview/timeline/docs tabs) */}
            {tab !== 'email' && tab !== 'documents' && (
              <div className="hidden xl:flex flex-col w-72 border-l border-surface-100 bg-surface-50 overflow-y-auto">
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Customer</p>
                    <div className="flex items-center gap-2.5 bg-white border border-surface-200 rounded-xl px-3.5 py-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><User2 size={14} className="text-blue-600" /></div>
                      <div className="min-w-0"><p className="text-sm font-bold text-surface-800 truncate">{dispute.customer_id}</p><p className="text-xs text-gray-400">Customer ID</p></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Quick Actions</p>
                    <div className="space-y-2">
                      <button onClick={() => setTab('email')} className="w-full flex items-center gap-2.5 bg-white border border-brand-200 hover:border-brand-400 hover:bg-brand-50 text-brand-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all">
                        <Mail size={14} /> Send Email
                      </button>
                      <button onClick={() => setTab('timeline')} className="w-full flex items-center gap-2.5 bg-white border border-surface-200 hover:bg-surface-100 text-surface-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all">
                        <MessageSquare size={14} /> View Timeline
                      </button>
                    </div>
                  </div>
                  {dispute.latest_analysis && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AI Confidence</p>
                      <div className="bg-white border border-surface-200 rounded-xl px-3.5 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-surface-700 truncate max-w-[140px]">{dispute.latest_analysis.predicted_category}</span>
                          <span className="text-xs font-bold text-brand-700">{Math.round(dispute.latest_analysis.confidence_score * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-brand-100 rounded-full"><div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.round(dispute.latest_analysis.confidence_score * 100)}%` }} /></div>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Case Info</p>
                    <div className="space-y-2">
                      {[
                        { label: 'Created', val: formatDate(dispute.created_at) },
                        { label: 'Updated', val: formatDate(dispute.updated_at) },
                        { label: 'Assigned', val: dispute.assigned_to ?? 'Unassigned' },
                      ].map(({ label, val }) => (
                        <div key={label} className="flex justify-between items-center text-xs py-1 border-b border-surface-200 last:border-0">
                          <span className="text-gray-500 font-medium">{label}</span>
                          <span className="text-surface-800 font-semibold truncate max-w-[120px] text-right">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Table row ────────────────────────────────────────────────────────────────
const DisputeRow = ({ dispute, onClick }: { dispute: Dispute; onClick: () => void }) => {
  const s = sc(dispute.status);
  const p = pc(dispute.priority);
  const hasNew = dispute.has_new_customer_message ?? false;
  return (
    <tr className={clsx('group cursor-pointer transition-colors duration-100', hasNew ? 'bg-blue-50/40 hover:bg-blue-50' : 'hover:bg-brand-50/60')} onClick={onClick}>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          {hasNew && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 animate-pulse" title="New customer message" />}
          <code className="text-xs font-mono text-gray-700 bg-surface-100 px-2 py-0.5 rounded-lg">#{dispute.dispute_id}</code>
        </div>
      </td>
      <td className="px-5 py-3.5 max-w-[240px]">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-surface-800 truncate">{dispute.dispute_type?.reason_name ?? 'Unknown'}</p>
          {hasNew && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full shrink-0">
              <MessageSquare size={9} /> New message
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5">{dispute.customer_id}</p>
      </td>
      <td className="px-5 py-3.5">
        <span className={clsx('badge flex items-center gap-1.5 w-fit', { 'bg-red-50 text-red-700': s.badge === 'danger', 'bg-brand-50 text-brand-700': s.badge === 'warning', 'bg-green-50 text-green-700': s.badge === 'success', 'bg-surface-100 text-surface-800': s.badge === 'default' })}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />{s.label}
        </span>
      </td>
      <td className="px-5 py-3.5"><Badge variant={p.badge}>{p.label}</Badge></td>
      <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{formatDate(dispute.created_at)}</td>
      <td className="px-4 py-3.5"><ChevronRight size={16} className="text-gray-400 group-hover:text-brand-400 transition-colors" /></td>
    </tr>
  );
};

// ─── Create Dispute Modal ─────────────────────────────────────────────────────
// ─── Fork Recommendation Card ─────────────────────────────────────────────────

const ForkRecommendationCard = ({
  rec,
  dispute,
  onAccepted,
  onDismissed,
}: {
  rec:         ForkRecommendation;
  dispute:     Dispute;
  onAccepted:  (newDisputeId: number) => void;
  onDismissed: () => void;
}) => {
  const [dismissing, setDismissing] = useState(false);
  const [showAccept, setShowAccept] = useState(false);

  const handleDismiss = async () => {
    try {
      setDismissing(true);
      await forkRecommendationService.action(dispute.dispute_id, rec.recommendation_id, { action: 'DISMISS' });
      toast.success('Recommendation dismissed');
      onDismissed();
    } catch { toast.error('Failed to dismiss'); }
    finally { setDismissing(false); }
  };

  return (
    <>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Zap size={15} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">AI suggests splitting this case</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              {rec.reasoning || 'A new topic was detected in the email thread that may require separate handling.'}
            </p>
          </div>
          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">
            {Math.round(rec.confidence * 100)}% confidence
          </span>
        </div>

        {/* Suggested details */}
        <div className="bg-white border border-amber-100 rounded-xl px-3 py-2.5 space-y-1">
          {rec.suggested_type_hint && (
            <p className="text-xs text-surface-600">
              <span className="font-semibold text-surface-500">Type:</span> {rec.suggested_type_hint}
            </p>
          )}
          {rec.suggested_invoice_number && (
            <p className="text-xs text-surface-600">
              <span className="font-semibold text-surface-500">Reference:</span> {rec.suggested_invoice_number}
            </p>
          )}
          {rec.suggested_description && (
            <p className="text-xs text-surface-600 line-clamp-2">
              <span className="font-semibold text-surface-500">Issue:</span> {rec.suggested_description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={() => setShowAccept(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
          >
            <Plus size={12} /> Create New Case
          </button>
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 hover:border-amber-300 bg-white text-amber-700 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {dismissing ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
            Not relevant
          </button>
        </div>
      </div>

      {showAccept && (
        <AcceptForkModal
          rec={rec}
          dispute={dispute}
          onClose={() => setShowAccept(false)}
          onCreated={onAccepted}
        />
      )}
    </>
  );
};

// ─── Accept Fork Modal ────────────────────────────────────────────────────────

const AcceptForkModal = ({
  rec,
  dispute,
  onClose,
  onCreated,
}: {
  rec:      ForkRecommendation;
  dispute:  Dispute;
  onClose:  () => void;
  onCreated: (newDisputeId: number) => void;
}) => {
  const [disputeTypes, setDisputeTypes] = useState<DisputeTypeOption[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | ''>('');
  const [useCustom, setUseCustom] = useState(!rec.suggested_type_hint);
  const [customTypeName, setCustomTypeName] = useState(rec.suggested_type_hint || '');
  const [customTypeDesc, setCustomTypeDesc] = useState('');
  const [description, setDescription] = useState(rec.suggested_description || '');
  const [priority, setPriority] = useState<'LOW'|'MEDIUM'|'HIGH'>(
    (rec.suggested_priority as 'LOW'|'MEDIUM'|'HIGH') || 'MEDIUM'
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    disputeTypeService.list().then(types => {
      setDisputeTypes(types);
      // Pre-select if a type hint matches
      if (rec.suggested_type_hint) {
        const match = types.find(t =>
          t.reason_name.toLowerCase().includes(rec.suggested_type_hint!.toLowerCase())
        );
        if (match) {
          setSelectedTypeId(match.dispute_type_id);
          setUseCustom(false);
        } else {
          setUseCustom(true);
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!description.trim()) { toast.error('Description is required'); return; }
    if (!useCustom && !selectedTypeId) { toast.error('Select a case type'); return; }
    if (useCustom && !customTypeName.trim()) { toast.error('Custom type name is required'); return; }
    try {
      setSubmitting(true);
      const result = await forkRecommendationService.action(
        dispute.dispute_id,
        rec.recommendation_id,
        {
          action:           'ACCEPT',
          dispute_type_id:  useCustom ? null : Number(selectedTypeId),
          custom_type_name: useCustom ? customTypeName.trim() : null,
          custom_type_desc: useCustom ? customTypeDesc.trim() : null,
          description:      description.trim(),
          priority,
          customer_email:   dispute.customer_id,
        },
      );
      toast.success(`New case ${result.dispute_token} created`);
      onCreated(result.new_dispute_id!);
      onClose();
    } catch { toast.error('Failed to create case'); }
    finally { setSubmitting(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-modal w-full max-w-md animate-scale-in overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-surface-100 bg-gradient-to-r from-amber-50 to-white">
            <div>
              <h2 className="font-display font-bold text-surface-800">Create Forked Case</h2>
              <p className="text-xs text-gray-500 mt-0.5">Pre-filled from AI recommendation</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100 text-gray-400"><X size={18} /></button>
          </div>

          <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
            {/* Reference info */}
            {rec.suggested_invoice_number && (
              <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <Hash size={11} className="text-amber-500 shrink-0" />
                <span className="text-amber-700">Reference: <span className="font-mono font-bold">{rec.suggested_invoice_number}</span></span>
              </div>
            )}

            {/* Case Type */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Case Type *</label>
              <div className="flex items-center gap-2 p-1 bg-surface-100 rounded-xl mb-3 w-fit">
                <button onClick={() => setUseCustom(false)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', !useCustom ? 'bg-white text-brand-700 shadow-sm border border-brand-200' : 'text-gray-500')}>Pick existing</button>
                <button onClick={() => setUseCustom(true)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', useCustom ? 'bg-white text-brand-600 shadow-sm border border-brand-200' : 'text-gray-500')}>Create new</button>
              </div>
              {!useCustom ? (
                <CaseTypePicker types={disputeTypes} selected={selectedTypeId === '' ? null : Number(selectedTypeId)} onSelect={id => setSelectedTypeId(id)} />
              ) : (
                <div className="space-y-3">
                  <input className="input-base text-sm" placeholder="Type name" value={customTypeName} onChange={e => setCustomTypeName(e.target.value)} />
                  <textarea className="input-base text-sm resize-none" rows={2} placeholder="Description (optional)" value={customTypeDesc} onChange={e => setCustomTypeDesc(e.target.value)} />
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Priority</label>
              <div className="flex gap-2">
                {(['LOW','MEDIUM','HIGH'] as const).map(p => (
                  <button key={p} onClick={() => setPriority(p)} className={clsx('flex-1 py-2 rounded-xl text-xs font-bold border transition-all', priority === p ? p === 'HIGH' ? 'bg-red-500 text-white border-red-500' : p === 'MEDIUM' ? 'bg-brand-400 text-white border-brand-400' : 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-500 border-surface-200')}>{p}</button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Description *</label>
              <textarea className="input-base text-sm resize-none" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-100 bg-surface-50">
            <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-sm flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-4 py-2 font-semibold text-xs transition-colors disabled:opacity-50">
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {submitting ? 'Creating…' : 'Create Case'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Searchable case type picker ─────────────────────────────────────────────
const CaseTypePicker = ({
  types,
  selected,
  onSelect,
}: {
  types:    DisputeTypeOption[];
  selected: number | null;
  onSelect: (id: number) => void;
}) => {
  const [query, setQuery] = useState('');
  const filtered = query.trim()
    ? types.filter(t => t.reason_name.toLowerCase().includes(query.toLowerCase()))
    : types;
  const selectedType = types.find(t => t.dispute_type_id === selected);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          className="input-base text-sm pl-8"
          placeholder="Search case types…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 italic px-2 py-2">No types match "{query}"</p>
        ) : (
          filtered.map(t => (
            <button
              key={t.dispute_type_id}
              type="button"
              onClick={() => onSelect(t.dispute_type_id)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left text-xs transition-all',
                selected === t.dispute_type_id
                  ? 'border-brand-400 bg-brand-50 text-brand-700'
                  : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300 hover:bg-surface-50'
              )}
            >
              <div className={clsx(
                'w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center',
                selected === t.dispute_type_id ? 'border-brand-500' : 'border-gray-300'
              )}>
                {selected === t.dispute_type_id && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
              </div>
              <span className="font-medium truncate">{t.reason_name}</span>
            </button>
          ))
        )}
      </div>
      {selectedType && (
        <div className="flex items-center gap-2 text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2">
          <CheckCircle2 size={12} className="shrink-0 text-brand-500" />
          <span className="font-semibold">{selectedType.reason_name}</span> selected
        </div>
      )}
    </div>
  );
};

const CreateDisputeModal = ({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (d: Dispute) => void;
}) => {
  const [disputeTypes, setDisputeTypes] = useState<DisputeTypeOption[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | ''>('');
  const [customTypeName, setCustomTypeName] = useState('');
  const [customTypeDesc, setCustomTypeDesc] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [priority, setPriority] = useState<'LOW'|'MEDIUM'|'HIGH'>('MEDIUM');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // AR document picker — this is now the sole anchor for the case
  const [arDocs, setArDocs] = useState<ARDocRelated[]>([]);
  const [arDocsLoading, setArDocsLoading] = useState(false);
  const [arDocsFetched, setArDocsFetched] = useState(false);
  const [selectedArDocId, setSelectedArDocId] = useState<number | null>(null);

  useEffect(() => {
    disputeTypeService.list().then(setDisputeTypes).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Fetch AR docs when customer email is valid
  useEffect(() => {
    const email = customerId.trim();
    if (!email || !email.includes('@') || arDocsFetched) return;
    setArDocsFetched(true);
    setArDocsLoading(true);
    arDocumentService.listForCustomer(email)
      .then(setArDocs)
      .catch(() => setArDocs([]))
      .finally(() => setArDocsLoading(false));
  }, [customerId, arDocsFetched]);

  const handleCustomerIdChange = (val: string) => {
    setCustomerId(val);
    setArDocsFetched(false);
    setSelectedArDocId(null);
    setArDocs([]);
  };

  const handleSubmit = async () => {
    if (!customerId.trim()) { toast.error('Customer email is required'); return; }
    if (!description.trim()) { toast.error('Description is required'); return; }
    if (!useCustom && !selectedTypeId) { toast.error('Select a dispute type or enter a custom one'); return; }
    if (useCustom && !customTypeName.trim()) { toast.error('Custom type name is required'); return; }

    try {
      setSubmitting(true);
      const dispute = await faDisputeService.create({
        customer_id:      customerId.trim(),
        customer_email:   customerId.trim(),
        dispute_type_id:  useCustom ? null : Number(selectedTypeId),
        custom_type_name: useCustom ? customTypeName.trim() : null,
        custom_type_desc: useCustom ? customTypeDesc.trim() : null,
        priority,
        description:      description.trim(),
        ar_document_id:   selectedArDocId ?? null,
      });
      toast.success(`Dispute #${dispute.dispute_id} created`);
      onCreated(dispute);
      onClose();
    } catch { toast.error('Failed to create case'); }
    finally { setSubmitting(false); }
  };

  const selectedArDoc = arDocs.find(d => d.doc_id === selectedArDocId);

  // Natural key per doc type — show the identifier that actually names this document.
  // Falls back to the first available key if the preferred type isn't extracted.
  const DOC_TYPE_NATURAL_KEY: Record<string, string> = {
    PO:          'po_number',
    INVOICE:     'inv_number',
    GRN:         'grn_number',
    PAYMENT:     'payment_ref',
    CONTRACT:    'contract_number',
    CREDIT_NOTE: 'credit_note_number',
  };

  const docLabel = (doc: ARDocRelated): string => {
    if (!doc.all_keys?.length) return `${DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} — no keys extracted`;
    const preferred = DOC_TYPE_NATURAL_KEY[doc.doc_type];
    const primary   = (preferred ? doc.all_keys.find(k => k.key_type === preferred) : null)
                      ?? doc.all_keys[0];
    return primary.key_value_raw;
  };

  const DOC_TYPE_COLORS_MODAL: Record<string, string> = {
    PO:          'bg-violet-100 text-violet-700',
    INVOICE:     'bg-brand-100 text-brand-700',
    GRN:         'bg-green-100 text-green-700',
    PAYMENT:     'bg-teal-100 text-teal-700',
    CONTRACT:    'bg-slate-100 text-slate-700',
    CREDIT_NOTE: 'bg-pink-100 text-pink-700',
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-surface-100 bg-gradient-to-r from-brand-50 to-white">
            <div>
              <h2 className="font-display font-bold text-surface-800 text-lg">Create New Case</h2>
              <p className="text-xs text-gray-500 mt-0.5">Manually open a case without an inbound email</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100 text-gray-400"><X size={18} /></button>
          </div>

          {/* Body */}
          <div className="px-7 py-6 space-y-5 max-h-[70vh] overflow-y-auto">

            {/* Customer Email */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Customer Email *</label>
              <input
                className="input-base text-sm"
                placeholder="customer@domain.com"
                value={customerId}
                onChange={e => handleCustomerIdChange(e.target.value)}
              />
            </div>

            {/* AR Document — anchor for the whole case */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                Anchor Document *
                <span className="text-gray-400 font-normal normal-case ml-1">— the case is built around this document's graph</span>
              </label>

              {!customerId.trim() || !customerId.includes('@') ? (
                <p className="text-xs text-gray-400 italic py-1">Enter customer email above to load their documents</p>
              ) : arDocsLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <Loader2 size={12} className="animate-spin" /> Loading documents…
                </div>
              ) : arDocs.length === 0 ? (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>
                    No AR documents on file for this customer.{' '}
                    <a href="/ar-documents" className="font-semibold hover:underline">Upload one first</a>
                    {' '}so the case has document context.
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {arDocs.map(doc => (
                    <button
                      key={doc.doc_id}
                      type="button"
                      onClick={() => setSelectedArDocId(doc.doc_id)}
                      className={clsx(
                        'w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                        selectedArDocId === doc.doc_id
                          ? 'border-brand-400 bg-brand-50'
                          : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50'
                      )}
                    >
                      {/* Radio circle */}
                      <div className={clsx(
                        'w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center',
                        selectedArDocId === doc.doc_id ? 'border-brand-500' : 'border-gray-300'
                      )}>
                        {selectedArDocId === doc.doc_id && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                      </div>

                      {/* Type badge */}
                      <span className={clsx(
                        'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0',
                        DOC_TYPE_COLORS_MODAL[doc.doc_type] ?? 'bg-surface-100 text-surface-600'
                      )}>{doc.doc_type}</span>

                      {/* Key info */}
                      <div className="flex-1 min-w-0">
                        <p className={clsx(
                          'text-xs font-semibold truncate',
                          selectedArDocId === doc.doc_id ? 'text-brand-700' : 'text-surface-700'
                        )}>
                          {docLabel(doc)}
                        </p>
                        {doc.all_keys.length > 1 && (
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                            {doc.all_keys.slice(1, 3).map(k => k.key_value_raw).join(' · ')}
                            {doc.all_keys.length > 3 && ` +${doc.all_keys.length - 3} more`}
                          </p>
                        )}
                      </div>

                      {/* Date */}
                      {doc.doc_date && (
                        <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{doc.doc_date.slice(0, 10)}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Confirmation pill when doc selected */}
              {selectedArDoc && (
                <div className="mt-2 flex items-start gap-2 text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2.5">
                  <Link2 size={12} className="shrink-0 mt-0.5 text-brand-500" />
                  <span>
                    <span className="font-bold">{docLabel(selectedArDoc)}</span> selected —
                    full document graph will be pre-loaded as context for this case.
                  </span>
                </div>
              )}
            </div>

            {/* Case Type */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Case Type *</label>
              <div className="flex items-center gap-2 p-1 bg-surface-100 rounded-xl mb-3 w-fit">
                <button onClick={() => setUseCustom(false)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', !useCustom ? 'bg-white text-brand-700 shadow-sm border border-brand-200' : 'text-gray-500')}>
                  Pick existing
                </button>
                <button onClick={() => setUseCustom(true)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', useCustom ? 'bg-white text-brand-600 shadow-sm border border-brand-200' : 'text-gray-500')}>
                  Create new type
                </button>
              </div>
              {!useCustom ? (
                <CaseTypePicker
                  types={disputeTypes}
                  selected={selectedTypeId === '' ? null : Number(selectedTypeId)}
                  onSelect={id => setSelectedTypeId(id)}
                />
              ) : (
                <div className="space-y-3">
                  <input className="input-base text-sm" placeholder="Type name e.g. 'Currency Exchange Dispute'" value={customTypeName} onChange={e => setCustomTypeName(e.target.value)} />
                  <textarea className="input-base text-sm resize-none" rows={2} placeholder="Short description (optional)" value={customTypeDesc} onChange={e => setCustomTypeDesc(e.target.value)} />
                  <div className="flex items-start gap-2 text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    This will create a new case type in the system permanently.
                  </div>
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Priority</label>
              <div className="flex gap-2">
                {(['LOW','MEDIUM','HIGH'] as const).map(p => (
                  <button key={p} onClick={() => setPriority(p)} className={clsx('flex-1 py-2 rounded-xl text-xs font-bold border transition-all', priority === p
                    ? p === 'HIGH' ? 'bg-red-500 text-white border-red-500' : p === 'MEDIUM' ? 'bg-brand-400 text-white border-brand-400' : 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-500 border-surface-200 hover:border-surface-300'
                  )}>{p}</button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Description *</label>
              <textarea className="input-base text-sm resize-none" rows={4} placeholder="Describe the case — what's the issue, which document, what amount…" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-surface-100 bg-surface-50">
            <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary btn-sm flex items-center gap-2">
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {submitting ? 'Creating…' : 'Create Case'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Auth-aware file download helper ────────────────────────────────────────
// Fetches via axios (sends JWT cookie) so protected API endpoints work.
// Passes ?mode= so backend sets correct Content-Disposition header.
async function fetchAndOpenDoc(url: string, fileName: string, mode: 'view' | 'save') {
  try {
    const { default: axiosInst } = await import('@/lib/axios');
    // Append mode param so backend sets inline vs attachment disposition
    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${sep}mode=${mode}`;
    const response = await axiosInst.get(fullUrl, { responseType: 'blob' });
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const blob = new Blob([response.data], { type: contentType });
    const blobUrl = URL.createObjectURL(blob);

    if (mode === 'view') {
      // Open in new tab — browser will render PDF/images inline
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Force download
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    // Revoke after enough time for browser to load the content
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  } catch {
    toast.error('Could not open file — please try again');
  }
}

// ─── AR Docs Inline Panel ────────────────────────────────────────────────────

const DOC_TYPE_COLORS_INLINE: Record<string, string> = {
  PO:          'bg-violet-100 text-violet-700',
  INVOICE:     'bg-brand-100 text-brand-700',
  GRN:         'bg-green-100 text-green-700',
  PAYMENT:     'bg-teal-100 text-teal-700',
  CONTRACT:    'bg-slate-100 text-slate-700',
  CREDIT_NOTE: 'bg-pink-100 text-pink-700',
};

// ─── Anchor Picker Modal ──────────────────────────────────────────────────────

const AnchorPickerModal = ({
  disputeId,
  customerId,
  onClose,
  onUpdated,
}: {
  disputeId:  number;
  customerId: string;
  onClose:    () => void;
  onUpdated:  (newDocs: ARDocRelated[]) => void;
}) => {
  const [customerDocs, setCustomerDocs]   = useState<ARDocRelated[]>([]);
  const [loadingDocs,  setLoadingDocs]    = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [saving,       setSaving]         = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!customerId) return;
    arDocumentService.listForCustomer(customerId)
      .then(setCustomerDocs)
      .catch(() => setCustomerDocs([]))
      .finally(() => setLoadingDocs(false));
  }, [customerId]);

  const DOC_NATURAL_KEY: Record<string, string> = {
    PO: 'po_number', INVOICE: 'inv_number', GRN: 'grn_number',
    PAYMENT: 'payment_ref', CONTRACT: 'contract_number', CREDIT_NOTE: 'credit_note_number',
  };
  const docLabel = (doc: ARDocRelated) => {
    if (!doc.all_keys?.length) return `${DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} — no keys`;
    const preferred = DOC_NATURAL_KEY[doc.doc_type];
    const key = (preferred ? doc.all_keys.find(k => k.key_type === preferred) : null) ?? doc.all_keys[0];
    return key.key_value_raw;
  };

  const DOC_COLORS: Record<string, string> = {
    PO: 'bg-violet-100 text-violet-700', INVOICE: 'bg-brand-100 text-brand-700',
    GRN: 'bg-green-100 text-green-700',  PAYMENT: 'bg-teal-100 text-teal-700',
    CONTRACT: 'bg-slate-100 text-slate-700', CREDIT_NOTE: 'bg-pink-100 text-pink-700',
  };

  const handleConfirm = async () => {
    if (!selectedDocId) return;
    try {
      setSaving(true);
      const updated = await arDocumentService.updateAnchor(disputeId, selectedDocId, customerId);
      toast.success('Anchor document updated — linked docs refreshed');
      onUpdated(updated);
    } catch {
      toast.error('Failed to update anchor document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-modal w-full max-w-md animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-surface-100 bg-gradient-to-r from-surface-50 to-white">
            <div>
              <h2 className="font-display font-bold text-surface-800">Change Anchor Document</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Select a new anchor — all linked docs will be replaced with its graph
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100 text-gray-400">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {loadingDocs ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
                <Loader2 size={13} className="animate-spin" /> Loading documents…
              </div>
            ) : customerDocs.length === 0 ? (
              <div className="flex items-start gap-2 text-xs text-gray-500 bg-surface-50 border border-surface-200 rounded-xl px-3 py-3">
                <FileText size={13} className="shrink-0 mt-0.5 text-gray-400" />
                <span>No AR documents found for this customer. <a href="/ar-documents" className="text-brand-600 font-semibold hover:underline">Upload one</a> first.</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                {customerDocs.map(doc => (
                  <button
                    key={doc.doc_id}
                    type="button"
                    onClick={() => setSelectedDocId(doc.doc_id)}
                    className={clsx(
                      'w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                      selectedDocId === doc.doc_id
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50'
                    )}
                  >
                    {/* Radio */}
                    <div className={clsx(
                      'w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center',
                      selectedDocId === doc.doc_id ? 'border-brand-500' : 'border-gray-300'
                    )}>
                      {selectedDocId === doc.doc_id && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                    </div>
                    {/* Type badge */}
                    <span className={clsx(
                      'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0',
                      DOC_COLORS[doc.doc_type] ?? 'bg-surface-100 text-surface-600'
                    )}>{doc.doc_type}</span>
                    {/* Key info */}
                    <div className="flex-1 min-w-0">
                      <p className={clsx(
                        'text-xs font-semibold truncate',
                        selectedDocId === doc.doc_id ? 'text-brand-700' : 'text-surface-700'
                      )}>
                        {docLabel(doc)}
                      </p>
                      {doc.all_keys.length > 1 && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">
                          {doc.all_keys.slice(1, 3).map(k => k.key_value_raw).join(' · ')}
                          {doc.all_keys.length > 3 && ` +${doc.all_keys.length - 3} more`}
                        </p>
                      )}
                    </div>
                    {doc.doc_date && (
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{doc.doc_date.slice(0, 10)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-100 bg-surface-50">
            <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
            <button
              onClick={handleConfirm}
              disabled={!selectedDocId || saving}
              className="btn-primary btn-sm flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {saving ? 'Updating…' : 'Update Anchor'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── AR Docs Inline Panel ────────────────────────────────────────────────────
const ARDocsInlinePanel = ({ disputeId, customerId }: { disputeId: number; customerId: string }) => {
  const [docs,          setDocs]          = useState<ARDocRelated[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(false);
  const [expanded,      setExpanded]      = useState<Record<number, boolean>>({});
  const [showAnchorPicker, setShowAnchorPicker] = useState(false);

  const reload = () => {
    setLoading(true);
    setError(false);
    arDocumentService.getForDispute(disputeId)
      .then(setDocs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [disputeId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
        <Loader2 size={13} className="animate-spin" /> Loading AR documents…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
        <AlertCircle size={12} className="shrink-0" /> Failed to load AR documents
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex items-start gap-2 text-xs text-gray-500 bg-surface-50 border border-surface-200 rounded-xl px-3 py-3">
        <FileText size={13} className="shrink-0 mt-0.5 text-gray-400" />
        <span>
          No AR documents linked to this case yet.
          Documents are attached automatically when an email is processed,
          or you can{' '}
          <a href="/ar-documents" className="text-brand-600 font-semibold hover:underline">
            upload and link documents manually
          </a>.
        </span>
      </div>
    );
  }

  // Group docs by type for a cleaner view
  const byType = docs.reduce<Record<string, ARDocRelated[]>>((acc, d) => {
    (acc[d.doc_type] = acc[d.doc_type] ?? []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(byType) as [string, ARDocRelated[]][]).map(([type, items]) => (
          <span key={type} className={clsx(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border',
            DOC_TYPE_COLORS_INLINE[type] ?? 'bg-surface-100 text-surface-600 border-surface-200'
          )}>
            {DOC_TYPE_LABELS[type as keyof typeof DOC_TYPE_LABELS] ?? type}
            <span className="opacity-60 font-normal">×{items.length}</span>
          </span>
        ))}
      </div>

      {/* Doc cards */}
      <div className="space-y-2">
        {docs.map(doc => {
          const isExpanded = expanded[doc.doc_id] ?? false;
        const DOC_NATURAL_KEY: Record<string, string> = {
            PO: 'po_number', INVOICE: 'inv_number', GRN: 'grn_number',
            PAYMENT: 'payment_ref', CONTRACT: 'contract_number', CREDIT_NOTE: 'credit_note_number',
          };
          const preferred   = DOC_NATURAL_KEY[doc.doc_type];
          const primaryKey  = (preferred ? doc.all_keys?.find(k => k.key_type === preferred) : null)
                              ?? doc.all_keys?.[0];
          return (
            <div key={doc.doc_id} className="bg-white border border-surface-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Expand toggle — takes up most of the row */}
                <button
                  type="button"
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                  onClick={() => setExpanded(e => ({ ...e, [doc.doc_id]: !isExpanded }))}
                >
                  <span className={clsx(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0',
                    DOC_TYPE_COLORS_INLINE[doc.doc_type] ?? 'bg-surface-100 text-surface-600 border-surface-200'
                  )}>
                    {doc.doc_type}
                  </span>
                  <div className="flex-1 min-w-0">
                    {primaryKey ? (
                      <p className="text-xs font-semibold text-surface-700 truncate">
                        <span className="text-surface-400 font-normal">{KEY_TYPE_LABELS[primaryKey.key_type] ?? primaryKey.key_type}: </span>
                        {primaryKey.key_value_raw}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No keys extracted</p>
                    )}
                    {doc.all_keys.length > 1 && (
                      <p className="text-[10px] text-gray-400 truncate">
                        {doc.all_keys.slice(1, 3).map(k => k.key_value_raw).join(' · ')}
                        {doc.all_keys.length > 3 && ` +${doc.all_keys.length - 3} more`}
                      </p>
                    )}
                  </div>
                  {doc.doc_date && (
                    <span className="text-[10px] text-surface-400 shrink-0">{doc.doc_date.slice(0, 10)}</span>
                  )}
                  {isExpanded
                    ? <ChevronUp size={13} className="text-surface-400 shrink-0" />
                    : <ChevronDown size={13} className="text-surface-400 shrink-0" />
                  }
                </button>
                {/* View / Download — only shown when file exists on disk */}
                {doc.has_file && (
                  <div className="flex items-center gap-0.5 shrink-0 border-l border-surface-100 pl-2 ml-1">
                    <button
                      type="button"
                      title="View file"
                      onClick={e => { e.stopPropagation(); fetchAndOpenDoc(doc.download_url, doc.doc_type.toLowerCase() + '_doc', 'view'); }}
                      className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-colors"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      type="button"
                      title="Download file"
                      onClick={e => { e.stopPropagation(); fetchAndOpenDoc(doc.download_url, doc.doc_type.toLowerCase() + '_doc', 'save'); }}
                      className="p-1.5 rounded-lg hover:bg-surface-100 text-gray-400 hover:text-surface-700 transition-colors"
                    >
                      <Download size={13} />
                    </button>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 border-t border-surface-100 pt-2 space-y-2">
                  {/* All keys */}
                  <div>
                    <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-widest mb-1.5">All Reference Keys</p>
                    {doc.all_keys.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {doc.all_keys.map(k => (
                          <div key={k.key_id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-surface-200 bg-surface-50 text-xs">
                            <span className="font-semibold text-surface-500">{KEY_TYPE_LABELS[k.key_type] ?? k.key_type}:</span>
                            <span className="font-mono font-bold text-surface-700">{k.key_value_raw}</span>
                            <span className={clsx('text-[10px] font-semibold',
                              k.confidence >= 0.9 ? 'text-green-600' : k.confidence >= 0.7 ? 'text-brand-500' : 'text-red-500'
                            )}>
                              {k.source === 'manual' ? '✓' : k.source === 'regex' ? '⚡' : '🤖'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">No keys — add them manually on the AR Documents page</p>
                    )}
                  </div>
                  {/* context_note from the linking step */}
                  {(doc as any).context_note && (
                    <div className="mt-1">
                      <p className="text-[10px] text-gray-400 italic">{(doc as any).context_note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <a href="/ar-documents"
           className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-brand-200 hover:border-brand-400 hover:bg-brand-50 text-brand-600 text-xs font-semibold rounded-xl px-4 py-3 transition-all">
          <Upload size={13} /> Upload more documents for {customerId.split('@')[0]}
        </a>
        <button
          type="button"
          onClick={() => setShowAnchorPicker(true)}
          title="Change anchor document — replaces all linked docs with the graph of the selected document"
          className="flex items-center gap-1.5 border border-surface-200 hover:border-brand-300 hover:bg-brand-50 text-surface-600 hover:text-brand-700 text-xs font-semibold rounded-xl px-3 py-2.5 transition-all shrink-0"
        >
          <RefreshCw size={12} /> Change Anchor
        </button>
      </div>

      {showAnchorPicker && (
        <AnchorPickerModal
          disputeId={disputeId}
          customerId={customerId}
          onClose={() => setShowAnchorPicker(false)}
          onUpdated={newDocs => { setDocs(newDocs); setShowAnchorPicker(false); }}
        />
      )}
    </div>
  );
};

// ─── Dispute Documents Panel ──────────────────────────────────────────────────
const DisputeDocumentsPanel = ({ dispute }: { dispute: Dispute }) => {
  const [docs, setDocs] = useState<DisputeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await disputeDocumentService.list(dispute.dispute_id);
      setDocs(res.items);
    } catch { setDocs([]); }
    finally { setLoading(false); }
  }, [dispute.dispute_id]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      setUploading(true);
      const doc = await disputeDocumentService.upload(dispute.dispute_id, file, file.name, notes || undefined);
      setDocs(prev => [doc, ...prev]);
      setNotes('');
      toast.success(`${file.name} uploaded`);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDelete = async (docId: number, fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return;
    try {
      await disputeDocumentService.delete(dispute.dispute_id, docId);
      setDocs(prev => prev.filter(d => d.document_id !== docId));
      toast.success('Document deleted');
    } catch { toast.error('Delete failed'); }
  };

  /**
   * Open or download a document.
   * download_url is a protected API endpoint — we must fetch it with axios
   * (which sends the JWT cookie) then create a temporary blob URL.
   * This avoids the 401 that a bare <a href> would get.
   */
  const handleDocOpen = async (doc: DisputeDocument, forceDownload: boolean) => {
    try {
      const { default: axiosInstance } = await import('@/lib/axios');
      const res = await axiosInstance.get(doc.download_url, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: doc.file_type || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      if (forceDownload) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = doc.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        window.open(blobUrl, '_blank');
      }
      // Revoke after a short delay to allow the browser to start loading
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch {
      toast.error('Could not open file — try downloading instead');
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼';
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return '📊';
    if (type.includes('word') || type.includes('document')) return '📝';
    return '📎';
  };

  return (
    <div className="px-8 py-6 space-y-6">
      {/* Upload area */}
      <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
            <Upload size={18} className="text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-surface-800 mb-0.5">Upload Supporting Document</p>
            <p className="text-xs text-gray-500 mb-3">PDF, images, spreadsheets, Word docs — any file type accepted.</p>
            <div className="flex items-center gap-2 mb-3">
              <input
                className="input-base text-xs py-1.5 flex-1"
                placeholder="Notes about this document (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-50"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {uploading ? 'Uploading…' : 'Choose File'}
            </button>
          </div>
        </div>
      </div>

      {/* Document list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Uploaded Documents</p>
          {docs.length > 0 && <span className="text-xs text-gray-400">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 bg-surface-50 rounded-2xl border border-surface-100">
            <Loader2 size={16} className="animate-spin text-brand-400" />
            <span className="text-sm text-gray-500">Loading documents…</span>
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-surface-50 rounded-2xl border border-surface-100">
            <FileIcon size={28} className="text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-surface-700">No documents uploaded yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Upload any file above to attach it to this dispute.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map(doc => (
              <div key={doc.document_id} className="flex items-center gap-3 bg-white border border-surface-200 rounded-xl px-4 py-3 hover:border-brand-200 transition-all group">
                <span className="text-2xl leading-none shrink-0">{fileIcon(doc.file_type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-surface-800 truncate">{doc.display_name || doc.file_name}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {doc.file_size && <span className="text-xs text-gray-400">{formatSize(doc.file_size)}</span>}
                    {doc.uploader_name && <span className="text-xs text-gray-400">by {doc.uploader_name}</span>}
                    <span className="text-xs text-gray-400">{formatDate(doc.created_at)}</span>
                    {doc.notes && <span className="text-xs text-brand-600 italic truncate max-w-[180px]">{doc.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => fetchAndOpenDoc(doc.download_url, doc.file_name, 'view')}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-all"
                    title="View file"
                  >
                    <Eye size={12} /> View
                  </button>
                  <button
                    onClick={() => fetchAndOpenDoc(doc.download_url, doc.file_name, 'save')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-surface-800 bg-surface-100 hover:bg-surface-200 px-2.5 py-1.5 rounded-lg transition-all"
                    title="Download file"
                  >
                    <Download size={12} /> Save
                  </button>
                  <button
                    onClick={() => handleDelete(doc.document_id, doc.file_name)}
                    className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-all"
                    title="Delete document"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const DashboardPage = () => {
  const user = useUser();
  const { openDisputeId } = (useOutletContext<{ openDisputeId: number | null }>()) ?? { openDisputeId: null };
  const [disputes, setDisputes]             = useState<Dispute[]>([]);
  const [total, setTotal]                   = useState(0);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [search, setSearch]                 = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter]     = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selected, setSelected]             = useState<Dispute | null>(null);
  const [showCreate, setShowCreate]           = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Open dispute when notification bell is clicked ─────────────────────────
  useEffect(() => {
    if (!openDisputeId || !disputes.length) return;
    const target = disputes.find(d => d.dispute_id === openDisputeId);
    if (target) {
      setSelected(target);
      // Mark read when opened from notification
      newMessageService.markDisputeRead(openDisputeId).catch(() => {});
      updateLocalDispute(openDisputeId, { has_new_customer_message: false } as Partial<Dispute>);
    }
  }, [openDisputeId, disputes]);

  // Debounce search input — fires server call 400ms after user stops typing
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 400);
  };

  // ── Single bulk call — filters sent to server, no N+1 ─────────────────────
  const loadDisputes = useCallback(async (showToast = false) => {
    setLoading(true); setError(null);
    try {
      const params = {
        status:   statusFilter   !== 'all' ? statusFilter   : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        search:   debouncedSearch.trim()   || undefined,
        limit: 100, offset: 0,
      };
      // Always use list() with full params — myDisputes only for unfiltered "my" view
      const res = await disputeService.list(params);
      // Bulk detail: one call returns all enriched data — no per-row getDetail
      const ids = res.items.map((d: Dispute) => d.dispute_id);
      const enriched = ids.length ? await disputeService.bulkDetail(ids) : [];
      setDisputes(enriched);
      setTotal(res.total);
      if (showToast) toast.success('Refreshed');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to load disputes';
      setError(msg);
    } finally { setLoading(false); }
  }, [statusFilter, priorityFilter, debouncedSearch]);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  // ── Update single dispute in local state — no full reload on status change ─
  const updateLocalDispute = useCallback((disputeId: number, patch: Partial<Dispute>) => {
    setDisputes(prev => prev.map(d => d.dispute_id === disputeId ? { ...d, ...patch } : d));
    setSelected(prev => prev?.dispute_id === disputeId ? { ...prev, ...patch } : prev);
  }, []);

  const stats = {
    total:    disputes.length,
    open:     disputes.filter(d => d.status === 'OPEN').length,
    unverified: disputes.filter(d => d.status === 'UNVERIFIED').length,
    review:   disputes.filter(d => d.status === 'UNDER_REVIEW').length,
    resolved: disputes.filter(d => d.status === 'RESOLVED').length,
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'Associate'} 👋`}
        subtitle="Review and manage your assigned cases below."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all" style={{ background: '#9333ea' }} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#7e22ce'} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='#9333ea'}
            >
              <Plus size={15} /> New Case
            </button>
            <button onClick={() => loadDisputes(true)} title="Refresh" className="p-2 rounded-xl hover:bg-surface-100 text-gray-500 hover:text-surface-800 transition-colors"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileText}     label="Total"     value={stats.total}    accent="bg-brand-600" />
        <StatCard icon={AlertCircle}  label="Open"      value={stats.open}     accent="bg-red-500"    sub="Needs attention" />
        <StatCard icon={Clock}        label="In Review"  value={stats.review}   accent="bg-brand-500" />
        <StatCard icon={CheckCircle2} label="Resolved"  value={stats.resolved} accent="bg-green-500" />
      </div>

      <div className="card px-5 py-3.5 mb-6 flex items-center gap-3 bg-gradient-to-r from-brand-600 to-brand-700 border-0">
        <TrendingUp size={16} className="text-brand-200 shrink-0" />
        <span className="text-sm text-brand-100">{total} total case{total !== 1 ? 's' : ''} tracked</span>
        <span className="text-brand-200 mx-1">·</span>
        <span className="text-sm text-brand-200">Click any row to view full details, documents, timeline and send emails</span>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => loadDisputes()} className="ml-auto text-xs font-semibold text-red-600 hover:text-red-800 underline">Retry</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input className="input-base pl-9 py-2 text-sm" placeholder="Search by ID, customer, type…" value={search} onChange={e => handleSearchChange(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-gray-400" />
          <select className="input-base py-2 text-sm w-auto cursor-pointer" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
        </div>
        <select className="input-base py-2 text-sm w-auto cursor-pointer" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="all">All Priorities</option>
          {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{disputes.length} of {total}</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-50 border-b border-surface-100">
              {['ID', 'Type / Customer', 'Status', 'Priority', 'Created', ''].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {loading ? (
              <tr><td colSpan={6}><div className="flex items-center justify-center gap-3 py-20"><Loader2 size={22} className="animate-spin text-brand-400" /><span className="text-sm text-gray-500">Loading incidents…</span></div></td></tr>
            ) : disputes.length > 0 ? (
              disputes.map(d => (
                <DisputeRow
                  key={d.dispute_id}
                  dispute={d}
                  onClick={() => {
                    setSelected(d);
                    // Clear new message flag on backend + locally in row
                    newMessageService.markDisputeRead(d.dispute_id).catch(() => {});
                    updateLocalDispute(d.dispute_id, { has_new_customer_message: false } as Partial<Dispute>);
                  }}
                />
              ))
            ) : (
              <tr><td colSpan={6}><EmptyState title="No cases found" description={error ? 'Could not load from server.' : 'Try adjusting your filters or search query.'} /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <DisputeModal dispute={selected} onClose={() => setSelected(null)} onStatusUpdate={updateLocalDispute} />}
      {showCreate && <CreateDisputeModal onClose={() => setShowCreate(false)} onCreated={(d) => { loadDisputes(); }} />}
    </div>
  );
};

export default DashboardPage;
