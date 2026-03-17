import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Filter, Clock, CheckCircle2, AlertCircle, FileText,
  X, ChevronRight, Brain, MessageSquare,
  User2, RefreshCw, Loader2, AlertTriangle, Receipt,
  Calendar, DollarSign, Building2, Hash, Zap,
  ArrowUpRight, Package, CheckCheck, TrendingUp, CreditCard,
  Send, Paperclip, Mail, Download,
} from 'lucide-react';
import { useUser } from '@/hooks';
import { Badge } from '@/components/ui';
import { PageHeader, EmptyState, LoadingSpinner } from '@/components/common';
import { formatDate, formatCurrency } from '@/utils';
import {
  disputeService,
  Dispute, InvoiceData, PaymentDetailData, TimelineEpisode, TimelineAttachment,
} from '../services/disputeService';
import { mailboxService, OutboundEmail } from '@/services/mailboxService';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// ─── Status / Priority helpers ────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; badge: 'danger'|'warning'|'success'|'default'; dot: string }> = {
  OPEN:         { label: 'Open',         badge: 'danger',  dot: 'bg-red-500'      },
  UNVERIFIED:   { label: 'Unverified',   badge: 'warning', dot: 'bg-orange-400'   },
  UNDER_REVIEW: { label: 'Under Review', badge: 'warning', dot: 'bg-amber-400'    },
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
      <p className="font-display text-3xl font-bold text-surface-900 leading-tight">{value}</p>
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
      <div className="bg-violet-50 px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0"><Receipt size={16} className="text-violet-600" /></div>
          <div className="min-w-0">
            <p className="text-xs text-violet-500 font-semibold uppercase tracking-wider">Invoice</p>
            <p className="font-display font-bold text-surface-900 text-sm truncate">{d.invoice_number ?? invoice.invoice_number}</p>
          </div>
        </div>
        {invoice.invoice_url && (<a href={invoice.invoice_url} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 bg-white border border-violet-200 hover:border-violet-400 px-3 py-1.5 rounded-lg transition-all">View PDF <ArrowUpRight size={12} /></a>)}
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
            {items.map((item, i) => (<div key={i} className="flex items-baseline justify-between gap-4 text-sm"><span className="text-surface-800 flex-1 min-w-0 truncate">{item.description}</span><span className="text-gray-500 shrink-0 text-xs">{(item.qty ?? item.quantity) != null ? `× ${item.qty ?? item.quantity}` : ''}{item.unit_price != null ? ` @ ${formatCurrency(item.unit_price, cur)}` : ''}</span>{item.total != null && <span className="font-semibold text-surface-900 shrink-0">{formatCurrency(item.total, cur)}</span>}</div>))}
          </div>
        </div>
      )}
      <div className="px-5 py-4 space-y-2">
        {d.subtotal != null && <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium text-surface-800">{formatCurrency(d.subtotal, cur)}</span></div>}
        {d.tax_amount != null && <div className="flex justify-between text-sm"><span className="text-gray-500">Tax (GST/VAT)</span><span className="font-medium text-surface-800">{formatCurrency(d.tax_amount, cur)}</span></div>}
        {d.total_amount != null && <div className="flex justify-between items-center pt-2 mt-2 border-t border-surface-100"><span className="font-bold text-surface-900">Total</span><span className="font-display font-bold text-xl text-violet-600">{formatCurrency(d.total_amount, cur)}</span></div>}
      </div>
    </div>
  );
};

// ─── Payment row ──────────────────────────────────────────────────────────────
const PaymentRow = ({ payment, index }: { payment: PaymentDetailData; index: number }) => {
  const d = payment.payment_details ?? {};
  const statusColor = d.status === 'CLEARED' ? 'bg-green-100 text-green-700' : d.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : d.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-surface-100 text-surface-800';
  return (
    <div className={clsx('border-b border-surface-100 last:border-b-0', index % 2 === 1 ? 'bg-surface-50' : 'bg-white')}>
      <div className="px-5 py-3.5 flex items-start gap-4">
        <div className="w-7 h-7 rounded-full bg-surface-100 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-surface-600">{d.payment_sequence ?? index + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-semibold text-surface-900 text-sm">{d.payment_reference ?? `Payment #${payment.payment_detail_id}`}</span>
            <div className="flex items-center gap-2 shrink-0">
              {d.status && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor}`}>{d.status as string}</span>}
              {payment.payment_url && <a href={payment.payment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">PDF <ArrowUpRight size={10} /></a>}
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-4 flex-wrap text-xs text-gray-500">
            {d.payment_date && <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(d.payment_date as string)}</span>}
            {d.payment_mode && <span className="flex items-center gap-1"><Zap size={11} />{d.payment_mode as string}</span>}
            {d.amount_paid != null && <span className="flex items-center gap-1 font-bold text-green-700 text-sm"><DollarSign size={11} />{formatCurrency(d.amount_paid as number)}</span>}
          </div>
          {(d.note || d.failure_reason) && (<div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5"><AlertTriangle size={11} className="shrink-0 mt-0.5 text-amber-500" />{(d.failure_reason ?? d.note) as string}</div>)}
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
          <div className="min-w-0"><p className="text-xs text-green-600 font-semibold uppercase tracking-wider">Payments</p><p className="font-display font-bold text-surface-900 text-sm">{payments.length} record{payments.length !== 1 ? 's' : ''}</p></div>
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
  AI:        { color: 'bg-purple-600', ring: 'ring-purple-200', bubble: 'bg-purple-50 border border-purple-100',  text: 'text-purple-600' },
  ASSOCIATE: { color: 'bg-violet-600', ring: 'ring-violet-200', bubble: 'bg-violet-50 border border-violet-100',  text: 'text-violet-600' },
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
          : (<><p className="font-display font-bold text-surface-900">{sublabel}</p>{meta && meta.length > 0 && (<div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">{meta.map(({ icon: Ic, text }, i) => (<div key={i} className="flex items-center gap-1.5"><Ic size={12} className="text-gray-500 shrink-0" /><span className="text-xs text-surface-800">{text}</span></div>))}</div>)}</>)}
      </div>
      {!loading && !missing && url && (<a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3 py-2 rounded-xl transition-all shrink-0">{urlLabel} <ArrowUpRight size={12} /></a>)}
    </div>
  </div>
);

// ─── Send Email Panel ─────────────────────────────────────────────────────────
const SendEmailPanel = ({ dispute, onEmailSent }: { dispute: Dispute; onEmailSent: () => void }) => {
  const defaultSubject = `Re: Dispute #${dispute.dispute_id} – ${dispute.dispute_type?.reason_name ?? 'Dispute'}`;
  const [to, setTo]           = useState(dispute.customer_id ?? '');
  const [subject, setSubj]    = useState(defaultSubject);
  const [body, setBody]       = useState('');
  const [files, setFiles]     = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [newThread, setNewThread] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // When toggling thread mode, update subject to match expected behaviour
  const handleToggleThread = (val: boolean) => {
    setNewThread(val);
    if (val) {
      setSubj(`[DISP-${String(dispute.dispute_id).padStart(5, '0')}] ${dispute.dispute_type?.reason_name ?? 'Your Dispute'}`);
    } else {
      setSubj(defaultSubject);
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
        <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2 mb-5">
          <Mail size={15} className="text-violet-500" /> Compose Email
        </h3>

        {/* Thread mode toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-100 rounded-xl mb-5 w-fit">
          <button
            onClick={() => handleToggleThread(false)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              !newThread
                ? 'bg-white text-violet-700 shadow-sm border border-violet-200'
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
                ? 'bg-white text-orange-600 shadow-sm border border-orange-200'
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
            ? 'bg-orange-50 border border-orange-100 text-orange-700'
            : 'bg-violet-50 border border-violet-100 text-violet-700'
        )}>
          {newThread
            ? <><AlertTriangle size={13} className="shrink-0 mt-0.5" /> <span>This will appear as a <strong>new conversation</strong> in the customer's inbox — not linked to any previous email thread.</span></>
            : <><CheckCircle2 size={13} className="shrink-0 mt-0.5" /> <span>This reply will be <strong>grouped with previous emails</strong> in the customer's inbox as part of the same conversation.</span></>
          }
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
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Message</label>
            <textarea className="input-base text-sm py-2 resize-none" rows={7} placeholder="Type your message here…" value={body} onChange={e => setBody(e.target.value)} />
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
                newThread ? 'bg-orange-500 hover:bg-orange-600' : 'bg-violet-600 hover:bg-violet-700'
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
  dispute: Dispute; onClose: () => void; onStatusUpdate: () => void;
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
      setDispute(prev => ({ ...prev, status: newStatus }));
      toast.success('Status updated');
      onStatusUpdate();
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
                  <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold', s.badge === 'danger' ? 'bg-red-50 text-red-700' : s.badge === 'warning' ? 'bg-amber-50 text-amber-700' : s.badge === 'success' ? 'bg-green-50 text-green-700' : 'bg-surface-100 text-surface-700')}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                  </span>
                  <Badge variant={p.badge}>{p.label} Priority</Badge>
                </div>
                <h2 className="font-display font-bold text-surface-900 text-xl leading-snug">{dispute.dispute_type?.reason_name ?? 'Unknown Dispute'}</h2>
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
              <button key={t.id} onClick={() => setTab(t.id)} className={clsx('relative flex items-center gap-2 py-4 mr-7 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-500 hover:text-surface-800')}>
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
                  <section>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Dispute Description</h3>
                    <p className="text-sm text-surface-800 leading-relaxed bg-surface-50 border border-surface-100 rounded-xl px-4 py-3.5">{dispute.latest_analysis?.ai_summary || <em className="text-gray-400">No description available</em>}</p>
                  </section>

                  <section>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Case Details</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: 'Assigned To',  val: dispute.assigned_to ?? 'Unassigned' },
                        { label: 'Last Updated', val: formatDate(dispute.updated_at) },
                        { label: 'Invoice',      val: invoice?.invoice_details?.invoice_number ?? invoice?.invoice_number ?? (dispute.invoice_id ? `#${dispute.invoice_id}` : '—') },
                        { label: 'Payments',     val: payments.length > 0 ? `${payments.length} record${payments.length !== 1 ? 's' : ''}` : (dispute.payment_detail_id ? `#${dispute.payment_detail_id}` : '—') },
                      ].map(({ label, val }) => (
                        <div key={label} className="bg-surface-50 border border-surface-100 rounded-xl px-3.5 py-3">
                          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-0.5">{label}</p>
                          <p className="text-sm font-bold text-surface-900 truncate">{val}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {dispute.invoice_id && (
                    <section>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Receipt size={11} /> Invoice Details</h3>
                      {invoiceLoading ? (<div className="flex items-center justify-center gap-2 py-10 bg-surface-50 rounded-2xl border border-surface-100"><LoadingSpinner /><span className="text-sm text-gray-500">Loading invoice…</span></div>)
                        : invoice ? (<InvoiceCard invoice={invoice} />) : (<div className="bg-surface-50 border border-surface-100 rounded-xl px-4 py-3.5 flex items-center gap-2"><Receipt size={14} className="text-gray-400" /><span className="text-sm text-gray-500">Invoice #{dispute.invoice_id} — details not available</span></div>)}
                    </section>
                  )}

                  {(dispute.payment_detail_id || payments.length > 0 || paymentLoading) && (
                    <section>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><DollarSign size={11} /> Payment Details</h3>
                      {paymentLoading ? (<div className="flex items-center justify-center gap-2 py-10 bg-surface-50 rounded-2xl border border-surface-100"><LoadingSpinner /><span className="text-sm text-gray-500">Loading payments…</span></div>)
                        : payments.length > 0 ? (<PaymentListCard payments={payments} />)
                        : dispute.payment_detail_id ? (<div className="bg-surface-50 border border-surface-100 rounded-xl px-4 py-3.5 flex items-center gap-2"><DollarSign size={14} className="text-gray-400" /><span className="text-sm text-gray-500">Payment #{dispute.payment_detail_id} — details not available</span></div>) : null}
                    </section>
                  )}

                  {/* {dispute.latest_analysis && (
                    <section>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Brain size={11} /> AI Analysis</h3>
                      <div className="bg-purple-50 border border-purple-100 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-purple-100">
                          <p className="text-sm font-bold text-purple-900">{dispute.latest_analysis.predicted_category}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-20 h-1.5 bg-purple-200 rounded-full overflow-hidden"><div className="h-full bg-purple-600 rounded-full" style={{ width: `${Math.round(dispute.latest_analysis.confidence_score * 100)}%` }} /></div>
                            <span className="text-xs font-bold text-purple-700">{Math.round(dispute.latest_analysis.confidence_score * 100)}%</span>
                          </div>
                        </div>
                        <div className="px-5 py-4"><p className="text-sm text-purple-900 leading-relaxed">{dispute.latest_analysis.ai_summary}</p></div>
                        {dispute.latest_analysis.ai_response && (<div className="px-5 py-4 bg-white border-t border-purple-100"><p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1.5">Suggested Response</p><p className="text-sm text-surface-800 leading-relaxed">{dispute.latest_analysis.ai_response}</p></div>)}
                        {(dispute.latest_analysis.auto_response_generated || dispute.latest_analysis.memory_context_used) && (
                          <div className="px-5 py-2.5 bg-purple-100 flex items-center gap-4 flex-wrap">
                            {dispute.latest_analysis.auto_response_generated && <div className="flex items-center gap-1.5"><CheckCheck size={13} className="text-green-600" /><span className="text-xs font-semibold text-green-700">Auto-response sent</span></div>}
                            {dispute.latest_analysis.memory_context_used && <div className="flex items-center gap-1.5"><Brain size={13} className="text-purple-600" /><span className="text-xs font-semibold text-purple-700">Memory context used</span></div>}
                          </div>
                        )}
                      </div>
                    </section>
                  )} */}

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
                            {nextStatus === 'CLOSED'       && 'Close Dispute'}
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

              {/* DOCUMENTS */}
              {tab === 'documents' && (
                <div className="px-8 py-6 space-y-5">
                  <section>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Receipt size={11} /> Invoice</h3>
                    <DocRow icon={Receipt} iconBg="bg-violet-600" label="Invoice Document" sublabel={invoice ? (invoice.invoice_details?.invoice_number ?? invoice.invoice_number) : dispute.invoice_id ? `Invoice #${dispute.invoice_id}` : undefined} loading={invoiceLoading} missing={!invoiceLoading && !invoice && !dispute.invoice_id} missingText="No invoice linked" url={invoice?.invoice_url} urlLabel="Open Invoice"
                      meta={invoice ? [...(invoice.invoice_details?.invoice_date ? [{ icon: Calendar, text: formatDate(invoice.invoice_details.invoice_date as string) }] : []), ...(invoice.invoice_details?.total_amount != null ? [{ icon: DollarSign, text: formatCurrency(invoice.invoice_details.total_amount, invoice.invoice_details?.currency ?? 'INR') }] : []), ...(invoice.invoice_details?.vendor_name ? [{ icon: Building2, text: invoice.invoice_details.vendor_name as string }] : [])] : []} />
                  </section>
                  <section>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><CreditCard size={11} /> Payment Records {payments.length > 0 && <span className="ml-1 text-xs bg-green-100 text-green-700 rounded-full px-2 py-px font-bold normal-case tracking-normal">{payments.length}</span>}</h3>
                    {paymentLoading ? (<DocRow icon={CreditCard} iconBg="bg-green-600" label="Payment Records" loading urlLabel="Open" />)
                      : payments.length > 0 ? (
                        <div className="space-y-3">
                          {payments.map(p => {
                            const d = p.payment_details ?? {};
                            return (<DocRow key={p.payment_detail_id} icon={CreditCard} iconBg="bg-green-600" label={`Payment${d.payment_type ? ` · ${d.payment_type}` : ''}`} sublabel={d.payment_reference as string ?? `Payment #${p.payment_detail_id}`}
                              meta={[...(d.payment_date ? [{ icon: Calendar, text: formatDate(d.payment_date as string) }] : []), ...(d.amount_paid != null ? [{ icon: DollarSign, text: formatCurrency(d.amount_paid as number, d.currency as string ?? 'INR') }] : []), ...(d.status ? [{ icon: CheckCircle2, text: d.status as string }] : [])]}
                              url={p.payment_url} urlLabel="Open PDF" />);
                          })}
                        </div>
                      ) : (<DocRow icon={CreditCard} iconBg="bg-green-600" label="Payment Records" missing missingText="No payment records found" urlLabel="Open" />)}
                  </section>
                </div>
              )}

              {/* SEND EMAIL */}
              {tab === 'email' && <SendEmailPanel dispute={dispute} onEmailSent={refreshTimeline} />}
            </div>

            {/* Right sidebar — quick info (visible on overview/timeline/docs tabs) */}
            {tab !== 'email' && (
              <div className="hidden xl:flex flex-col w-72 border-l border-surface-100 bg-surface-50 overflow-y-auto">
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Customer</p>
                    <div className="flex items-center gap-2.5 bg-white border border-surface-200 rounded-xl px-3.5 py-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><User2 size={14} className="text-blue-600" /></div>
                      <div className="min-w-0"><p className="text-sm font-bold text-surface-900 truncate">{dispute.customer_id}</p><p className="text-xs text-gray-400">Customer ID</p></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Quick Actions</p>
                    <div className="space-y-2">
                      <button onClick={() => setTab('email')} className="w-full flex items-center gap-2.5 bg-white border border-violet-200 hover:border-violet-400 hover:bg-violet-50 text-violet-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all">
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
                          <span className="text-xs font-bold text-purple-700">{Math.round(dispute.latest_analysis.confidence_score * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-purple-100 rounded-full"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.round(dispute.latest_analysis.confidence_score * 100)}%` }} /></div>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Dispute Info</p>
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
  return (
    <tr className="group cursor-pointer hover:bg-violet-50/60 transition-colors duration-100" onClick={onClick}>
      <td className="px-5 py-3.5"><code className="text-xs font-mono text-gray-700 bg-surface-100 px-2 py-0.5 rounded-lg">#{dispute.dispute_id}</code></td>
      <td className="px-5 py-3.5 max-w-[240px]">
        <p className="text-sm font-semibold text-surface-900 truncate">{dispute.dispute_type?.reason_name ?? 'Unknown'}</p>
        <p className="text-xs text-gray-500 truncate mt-0.5">{dispute.customer_id}</p>
      </td>
      <td className="px-5 py-3.5">
        <span className={clsx('badge flex items-center gap-1.5 w-fit', { 'bg-red-50 text-red-700': s.badge === 'danger', 'bg-amber-50 text-amber-700': s.badge === 'warning', 'bg-green-50 text-green-700': s.badge === 'success', 'bg-surface-100 text-surface-800': s.badge === 'default' })}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />{s.label}
        </span>
      </td>
      <td className="px-5 py-3.5"><Badge variant={p.badge}>{p.label}</Badge></td>
      <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{formatDate(dispute.created_at)}</td>
      <td className="px-4 py-3.5"><ChevronRight size={16} className="text-gray-400 group-hover:text-violet-400 transition-colors" /></td>
    </tr>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const DashboardPage = () => {
  const user = useUser();
  const [disputes, setDisputes]               = useState<Dispute[]>([]);
  const [total, setTotal]                     = useState(0);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [search, setSearch]                   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter]       = useState('all');
  const [priorityFilter, setPriorityFilter]   = useState('all');
  const [selected, setSelected]               = useState<Dispute | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(val), 350);
  };

  const loadDisputes = useCallback(async (showToast = false) => {
    setLoading(true); setError(null);
    try {
      const params = { status: statusFilter !== 'all' ? statusFilter : undefined, priority: priorityFilter !== 'all' ? priorityFilter : undefined, search: debouncedSearch.trim() || undefined, limit: 100, offset: 0 };
      let res = await disputeService.myDisputes(params).catch(() => null);
      if (!res || res.items.length === 0) res = await disputeService.list(params);
      const enriched = await Promise.all(res.items.map(d => disputeService.getDetail(d.dispute_id).catch(() => d)));
      setDisputes(enriched); setTotal(res.total);
      if (showToast) toast.success('Refreshed');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to load disputes';
      setError(msg); toast.error('Failed to load');
    } finally { setLoading(false); }
  }, [statusFilter, priorityFilter, debouncedSearch]);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

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
        subtitle="Review and manage your assigned incident tickets below."
        action={<button onClick={() => loadDisputes(true)} title="Refresh" className="p-2 rounded-xl hover:bg-surface-100 text-gray-500 hover:text-surface-800 transition-colors"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileText}     label="Total"     value={stats.total}    accent="bg-violet-600" />
        <StatCard icon={AlertCircle}  label="Open"      value={stats.open}     accent="bg-red-500"    sub="Needs attention" />
        <StatCard icon={Clock}        label="In Review"  value={stats.review}   accent="bg-amber-500" />
        <StatCard icon={CheckCircle2} label="Resolved"  value={stats.resolved} accent="bg-green-500" />
      </div>

      <div className="card px-5 py-3.5 mb-6 flex items-center gap-3 bg-gradient-to-r from-violet-600 to-purple-700 border-0">
        <TrendingUp size={16} className="text-violet-200 shrink-0" />
        <span className="text-sm text-violet-100">{total} total incident{total !== 1 ? 's' : ''} tracked</span>
        <span className="text-violet-300 mx-1">·</span>
        <span className="text-sm text-violet-200">Click any row to view full details, documents, timeline and send emails</span>
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
        <span className="text-xs text-gray-400 ml-auto">{disputes.length} of {disputes.length}</span>
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
              <tr><td colSpan={6}><div className="flex items-center justify-center gap-3 py-20"><Loader2 size={22} className="animate-spin text-violet-400" /><span className="text-sm text-gray-500">Loading incidents…</span></div></td></tr>
            ) : disputes.length > 0 ? (
              disputes.map(d => <DisputeRow key={d.dispute_id} dispute={d} onClick={() => setSelected(d)} />)
            ) : (
              <tr><td colSpan={6}><EmptyState title="No incidents found" description={error ? 'Could not load from server.' : 'Try adjusting your filters or search query.'} /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <DisputeModal dispute={selected} onClose={() => setSelected(null)} onStatusUpdate={loadDisputes} />}
    </div>
  );
};

export default DashboardPage;
