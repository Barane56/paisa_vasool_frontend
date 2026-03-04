import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, Filter, Clock, CheckCircle2, AlertCircle, FileText,
  X, ChevronRight, Brain, MessageSquare, HelpCircle,
  User2, RefreshCw, Loader2, AlertTriangle, Receipt,
  Calendar, DollarSign, Building2, Hash, Zap,
  ArrowUpRight, Package, CheckCheck, TrendingUp,
} from 'lucide-react';
import { useUser } from '@/hooks';
import { Badge } from '@/components/ui';
import { PageHeader, EmptyState, LoadingSpinner } from '@/components/common';
import { formatDate, formatCurrency } from '@/utils';
import {
  disputeService,
  Dispute,
  InvoiceData,
  PaymentDetailData,
  TimelineEpisode,
} from '../services/disputeService';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// ─── Status / Priority helpers ────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badge: 'danger' | 'warning' | 'success' | 'default'; dot: string }> = {
  OPEN:         { label: 'Open',         badge: 'danger',  dot: 'bg-red-500' },
  UNDER_REVIEW: { label: 'Under Review', badge: 'warning', dot: 'bg-amber-400' },
  RESOLVED:     { label: 'Resolved',     badge: 'success', dot: 'bg-green-500' },
  CLOSED:       { label: 'Closed',       badge: 'default', dot: 'bg-surface-300' },
};

const PRIORITY_CONFIG: Record<string, { label: string; badge: 'danger' | 'warning' | 'default' }> = {
  HIGH:   { label: 'High',   badge: 'danger' },
  MEDIUM: { label: 'Medium', badge: 'warning' },
  LOW:    { label: 'Low',    badge: 'default' },
};

const sc = (s: string) => STATUS_CONFIG[s]   ?? { label: s,   badge: 'default' as const, dot: 'bg-surface-200' };
const pc = (p: string) => PRIORITY_CONFIG[p] ?? { label: p,   badge: 'default' as const };

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: string; // tailwind bg class for icon
  sub?: string;
}
const StatCard = ({ icon: Icon, label, value, accent, sub }: StatCardProps) => (
  <div className="card p-5 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
      <Icon size={20} className="text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold text-surface-300 uppercase tracking-widest truncate">{label}</p>
      <p className="font-display text-3xl font-bold text-surface-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-surface-300 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Invoice detail card (Overview tab) ───────────────────────────────────────

const InvoiceCard = ({ invoice }: { invoice: InvoiceData }) => {
  const d  = invoice.invoice_details ?? {};
  const cur = d.currency ?? 'INR';
  const items = d.line_items ?? [];

  return (
    <div className="rounded-2xl border border-surface-200 overflow-hidden">
      {/* Header band */}
      <div className="bg-brand-50 px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
            <Receipt size={16} className="text-brand-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-brand-500 font-semibold uppercase tracking-wider">Invoice</p>
            <p className="font-display font-bold text-surface-900 text-sm truncate">
              {d.invoice_number ?? invoice.invoice_number}
            </p>
          </div>
        </div>
        {invoice.invoice_url && (
          <a
            href={invoice.invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-white border border-brand-200 hover:border-brand-400 px-3 py-1.5 rounded-lg transition-all"
          >
            View PDF <ArrowUpRight size={12} />
          </a>
        )}
      </div>

      {/* Key facts */}
      <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 border-b border-surface-100">
        {d.vendor_name && (
          <div className="col-span-2 flex items-center gap-2">
            <Building2 size={13} className="text-surface-300 shrink-0" />
            <span className="text-sm text-surface-800 font-medium">{d.vendor_name}</span>
            {d.customer_name && (
              <>
                <ChevronRight size={13} className="text-surface-200" />
                <span className="text-sm text-surface-800 font-medium">{d.customer_name}</span>
              </>
            )}
          </div>
        )}
        {[
          { icon: Calendar,    label: 'Invoice Date',  val: d.invoice_date  ? formatDate(d.invoice_date as string)  : null },
          { icon: Calendar,    label: 'Due Date',      val: d.due_date      ? formatDate(d.due_date as string)      : null },
          { icon: Hash,        label: 'Terms',         val: d.payment_terms as string ?? null },
          { icon: DollarSign,  label: 'Currency',      val: cur },
        ].filter(r => r.val).map(({ icon: Ic, label, val }) => (
          <div key={label} className="flex items-start gap-2">
            <Ic size={13} className="text-surface-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-surface-300 font-medium">{label}</p>
              <p className="text-sm font-semibold text-surface-800">{val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Line items */}
      {items.length > 0 && (
        <div className="px-5 py-4 border-b border-surface-100">
          <div className="flex items-center gap-1.5 mb-3">
            <Package size={13} className="text-surface-300" />
            <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Line Items</p>
          </div>
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-surface-800 flex-1 min-w-0 truncate">{item.description}</span>
                <span className="text-surface-300 shrink-0 text-xs">
                  {(item.qty ?? item.quantity) != null ? `× ${item.qty ?? item.quantity}` : ''}
                  {item.unit_price != null ? ` @ ${formatCurrency(item.unit_price, cur)}` : ''}
                </span>
                {item.total != null && (
                  <span className="font-semibold text-surface-900 shrink-0">
                    {formatCurrency(item.total, cur)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="px-5 py-4 space-y-2">
        {d.subtotal != null && (
          <div className="flex justify-between text-sm">
            <span className="text-surface-300">Subtotal</span>
            <span className="font-medium text-surface-800">{formatCurrency(d.subtotal, cur)}</span>
          </div>
        )}
        {d.tax_amount != null && (
          <div className="flex justify-between text-sm">
            <span className="text-surface-300">Tax (GST/VAT)</span>
            <span className="font-medium text-surface-800">{formatCurrency(d.tax_amount, cur)}</span>
          </div>
        )}
        {d.total_amount != null && (
          <div className="flex justify-between items-center pt-2 mt-2 border-t border-surface-100">
            <span className="font-bold text-surface-900">Total</span>
            <span className="font-display font-bold text-xl text-brand-600">{formatCurrency(d.total_amount, cur)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Payment detail card (Overview tab) ──────────────────────────────────────

const PaymentCard = ({ payment }: { payment: PaymentDetailData }) => {
  const d   = payment.payment_details ?? {};
  const statusColor =
    d.status === 'CLEARED' ? 'bg-green-100 text-green-700' :
    d.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
    d.status === 'FAILED'  ? 'bg-red-100 text-red-700'     :
    'bg-surface-100 text-surface-800';

  return (
    <div className="rounded-2xl border border-surface-200 overflow-hidden">
      {/* Header band */}
      <div className="bg-green-50 px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-green-200 flex items-center justify-center shrink-0">
            <DollarSign size={16} className="text-green-700" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-green-600 font-semibold uppercase tracking-wider">Payment</p>
            <p className="font-display font-bold text-surface-900 text-sm truncate">
              {d.payment_reference ?? `Payment #${payment.payment_detail_id}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {d.status && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusColor}`}>
              {d.status}
            </span>
          )}
          {payment.payment_url && (
            <a
              href={payment.payment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 bg-white border border-green-200 hover:border-green-400 px-3 py-1.5 rounded-lg transition-all"
            >
              View PDF <ArrowUpRight size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Key facts */}
      <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 border-b border-surface-100">
        {[
          { icon: Calendar,   label: 'Payment Date',  val: d.payment_date    ? formatDate(d.payment_date as string) : null },
          { icon: Zap,        label: 'Mode',          val: d.payment_mode    as string ?? null },
          { icon: Hash,       label: 'Bank Reference',val: d.bank_reference  as string ?? null },
          { icon: Receipt,    label: 'Invoice Ref',   val: d.invoice_number  as string ?? payment.invoice_number },
        ].filter(r => r.val).map(({ icon: Ic, label, val }) => (
          <div key={label} className="flex items-start gap-2">
            <Ic size={13} className="text-surface-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-surface-300 font-medium">{label}</p>
              <p className="text-sm font-semibold text-surface-800 break-all">{val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Amount paid */}
      {d.amount_paid != null && (
        <div className="px-5 py-4 flex items-center justify-between border-b border-surface-100">
          <span className="font-bold text-surface-900">Amount Paid</span>
          <span className="font-display font-bold text-xl text-green-700">
            {formatCurrency(d.amount_paid as number)}
          </span>
        </div>
      )}

      {/* Note / discrepancy */}
      {d.note && (
        <div className="px-5 py-3.5 flex items-start gap-2.5 bg-amber-50">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 leading-relaxed">{d.note as string}</p>
        </div>
      )}
    </div>
  );
};

const actorConfig = {
  CUSTOMER:  { label: 'Customer',       color: 'bg-blue-500',   ring: 'ring-blue-200',   bubble: 'bg-surface-50 border border-surface-200',       text: 'text-blue-600' },
  AI:        { label: 'AI Assistant',   color: 'bg-purple-600', ring: 'ring-purple-200', bubble: 'bg-purple-50 border border-purple-100',      text: 'text-purple-600' },
  ASSOCIATE: { label: 'Associate',      color: 'bg-brand-600',  ring: 'ring-brand-200',  bubble: 'bg-brand-50 border border-brand-100',           text: 'text-brand-600' },
  SYSTEM:    { label: 'System',         color: 'bg-surface-300',ring: 'ring-surface-200',bubble: 'bg-surface-100 border border-surface-200',      text: 'text-surface-300' },
};

const getActorCfg = (actor: string) => actorConfig[actor as keyof typeof actorConfig] ?? actorConfig.ASSOCIATE;

const ActorIcon = ({ actor }: { actor: string }) => {
  if (actor === 'CUSTOMER')  return <MessageSquare size={13} className="text-white" />;
  if (actor === 'AI')        return <Brain size={13} className="text-white" />;
  if (actor === 'ASSOCIATE') return <User2 size={13} className="text-white" />;
  return <Zap size={13} className="text-white" />;
};

const TimelineMessage = ({ ep, isLast }: { ep: TimelineEpisode; isLast: boolean }) => {
  const cfg = getActorCfg(ep.actor);
  const typeLabel = ep.episode_type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="flex gap-3 group">
      {/* Left column: avatar + connector line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-full ${cfg.color} ring-2 ${cfg.ring} flex items-center justify-center shrink-0 shadow-sm`}>
          <ActorIcon actor={ep.actor} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-surface-200 mt-2 mb-0 min-h-4" />}
      </div>

      {/* Right column: bubble */}
      <div className={`flex-1 min-w-0 pb-${isLast ? '0' : '6'}`}>
        {/* Meta row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</span>
          <span className="text-xs text-surface-200 font-mono">·</span>
          <span className="text-xs text-surface-300 font-medium">{typeLabel}</span>
          <span className="text-xs text-surface-200 font-mono">·</span>
          <span className="text-xs text-surface-300">{formatDate(ep.created_at)}</span>
        </div>

        {/* Bubble */}
        <div className={`${cfg.bubble} rounded-2xl rounded-tl-sm px-4 py-3`}>
          <p className="text-sm text-surface-800 leading-relaxed whitespace-pre-wrap break-words">
            {ep.content_text}
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Supporting document row (Documents tab) ──────────────────────────────────

const DocRow = ({
  icon: Icon,
  iconBg,
  label,
  sublabel,
  meta,
  url,
  urlLabel,
  loading,
  missing,
  missingText,
}: {
  icon: React.ElementType;
  iconBg: string;
  label: string;
  sublabel?: string;
  meta?: Array<{ icon: React.ElementType; text: string }>;
  url?: string;
  urlLabel: string;
  loading?: boolean;
  missing?: boolean;
  missingText?: string;
}) => (
  <div className="rounded-2xl border border-surface-200 overflow-hidden">
    <div className="flex items-start gap-4 p-5">
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider mb-0.5">{label}</p>
        {loading ? (
          <div className="flex items-center gap-2 mt-1">
            <Loader2 size={14} className="animate-spin text-surface-300" />
            <span className="text-sm text-surface-300">Fetching details…</span>
          </div>
        ) : missing ? (
          <p className="text-sm text-surface-300 italic">{missingText}</p>
        ) : (
          <>
            <p className="font-display font-bold text-surface-900">{sublabel}</p>
            {meta && meta.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {meta.map(({ icon: Ic, text }, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Ic size={12} className="text-surface-300 shrink-0" />
                    <span className="text-xs text-surface-800">{text}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {!loading && !missing && url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 hover:border-brand-400 px-3 py-2 rounded-xl transition-all"
        >
          {urlLabel} <ArrowUpRight size={12} />
        </a>
      )}
    </div>
  </div>
);

// ─── Dispute Drawer ───────────────────────────────────────────────────────────

const DisputeDrawer = ({
  dispute: initDispute,
  onClose,
  onStatusUpdate,
}: {
  dispute: Dispute;
  onClose: () => void;
  onStatusUpdate: () => void;
}) => {
  const [dispute, setDispute]         = useState<Dispute>(initDispute);
  const [invoice, setInvoice]         = useState<InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceL] = useState(false);
  const [invoiceTried, setInvoiceTried] = useState(false);
  const [payment, setPayment]         = useState<PaymentDetailData | null>(null);
  const [paymentLoading, setPaymentL] = useState(false);
  const [paymentTried, setPaymentTried] = useState(false);
  const [episodes, setEpisodes]       = useState<TimelineEpisode[]>([]);
  const [timelineLoading, setTimelineL] = useState(false);
  const [timelineTried, setTimelineTried] = useState(false);
  const [updating, setUpdating]       = useState<string | null>(null);
  const [tab, setTab]                 = useState<'overview' | 'docs' | 'timeline'>('overview');

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Fetch invoice (once, when overview or docs tab is opened and invoice_id exists)
  useEffect(() => {
    if (invoiceTried || !dispute.invoice_id) return;
    if (tab !== 'overview' && tab !== 'docs') return;
    setInvoiceTried(true);
    setInvoiceL(true);
    disputeService.getInvoice(dispute.invoice_id)
      .then(setInvoice)
      .catch(() => {})
      .finally(() => setInvoiceL(false));
  }, [tab, dispute.invoice_id, invoiceTried]);

  // Fetch payment detail (once, when overview or docs tab opened and payment_detail_id exists)
  useEffect(() => {
    if (paymentTried || !dispute.payment_detail_id) return;
    if (tab !== 'overview' && tab !== 'docs') return;
    setPaymentTried(true);
    setPaymentL(true);
    disputeService.getPaymentDetail(dispute.payment_detail_id)
      .then(setPayment)
      .catch(() => {})
      .finally(() => setPaymentL(false));
  }, [tab, dispute.payment_detail_id, paymentTried]);

  // Fetch timeline (once, when timeline tab opened)
  useEffect(() => {
    if (timelineTried || tab !== 'timeline') return;
    setTimelineTried(true);
    setTimelineL(true);
    disputeService.getTimeline(dispute.dispute_id)
      .then(r => setEpisodes(r.timeline))
      .catch(() => setEpisodes([]))
      .finally(() => setTimelineL(false));
  }, [tab, dispute.dispute_id, timelineTried]);

  const handleStatus = async (newStatus: string) => {
    try {
      setUpdating(newStatus);
      await disputeService.updateStatus(dispute.dispute_id, newStatus);
      setDispute(prev => ({ ...prev, status: newStatus }));
      toast.success('Status updated');
      onStatusUpdate();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const s = sc(dispute.status);
  const p = pc(dispute.priority);

  const TABS = [
    { id: 'overview'  as const, label: 'Overview' },
    { id: 'docs'      as const, label: 'Documents' },
    { id: 'timeline'  as const, label: 'Timeline',
      pill: timelineTried ? episodes.length : undefined },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-surface-900/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-screen w-full max-w-[560px] z-50 flex flex-col bg-white shadow-2xl animate-slide-up" style={{ animationName: 'slideRight' }}>

        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-surface-100">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <code className="text-xs font-mono bg-surface-100 text-surface-800 px-2 py-0.5 rounded-lg">
                  #{dispute.dispute_id}
                </code>
                <span className={`inline-flex items-center gap-1.5 badge ${
                  s.badge === 'danger'  ? 'bg-red-50 text-red-700'    :
                  s.badge === 'warning' ? 'bg-amber-50 text-amber-700' :
                  s.badge === 'success' ? 'bg-green-50 text-green-700' :
                  'bg-surface-100 text-surface-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                <Badge variant={p.badge}>{p.label} Priority</Badge>
              </div>
              <h2 className="font-display font-bold text-surface-900 text-lg leading-snug">
                {dispute.dispute_type?.reason_name ?? 'Unknown Dispute'}
              </h2>
              <p className="text-xs text-surface-300 mt-1 flex items-center gap-1.5">
                <Building2 size={11} />
                {dispute.customer_id}
                <span className="text-surface-200 mx-1">·</span>
                <Calendar size={11} />
                Opened {formatDate(dispute.created_at)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-surface-100 text-surface-300 hover:text-surface-800 transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex-shrink-0 flex gap-0 border-b border-surface-100 px-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'relative flex items-center gap-2 py-3.5 mr-6 text-sm font-semibold border-b-2 transition-colors',
                tab === t.id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-surface-300 hover:text-surface-800'
              )}
            >
              {t.label}
              {t.pill != null && t.pill > 0 && (
                <span className="text-xs bg-surface-100 text-surface-800 rounded-full px-1.5 py-px leading-none font-bold">
                  {t.pill}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ═══════════════════════════════════════════
              OVERVIEW TAB
          ═══════════════════════════════════════════ */}
          {tab === 'overview' && (
            <div className="px-6 py-5 space-y-6">

              {/* Description */}
              <section>
                <h3 className="text-xs font-bold text-surface-300 uppercase tracking-widest mb-2">
                  Dispute Description
                </h3>
                <p className="text-sm text-surface-800 leading-relaxed bg-surface-50 border border-surface-100 rounded-xl px-4 py-3.5">
                  {dispute.description || <em className="text-surface-300">No description available</em>}
                </p>
              </section>

              {/* Core meta */}
              <section>
                <h3 className="text-xs font-bold text-surface-300 uppercase tracking-widest mb-3">
                  Case Details
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Assigned To',   val: dispute.assigned_to ?? 'Unassigned' },
                    { label: 'Last Updated',  val: formatDate(dispute.updated_at) },
                    { label: 'Invoice Ref',   val: dispute.invoice_id        ? `#${dispute.invoice_id}`        : '—' },
                    { label: 'Payment Ref',   val: dispute.payment_detail_id ? `#${dispute.payment_detail_id}` : '—' },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-surface-50 border border-surface-100 rounded-xl px-3.5 py-3">
                      <p className="text-xs text-surface-300 font-semibold uppercase tracking-wider mb-0.5">{label}</p>
                      <p className="text-sm font-bold text-surface-900 truncate">{val}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Invoice details */}
              {dispute.invoice_id && (
                <section>
                  <h3 className="text-xs font-bold text-surface-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Receipt size={11} /> Invoice Details
                  </h3>
                  {invoiceLoading ? (
                    <div className="flex items-center justify-center gap-2 py-10 bg-surface-50 rounded-2xl border border-surface-100">
                      <LoadingSpinner />
                      <span className="text-sm text-surface-300">Loading invoice…</span>
                    </div>
                  ) : invoice ? (
                    <InvoiceCard invoice={invoice} />
                  ) : (
                    <div className="bg-surface-50 border border-surface-100 rounded-xl px-4 py-3.5 flex items-center gap-2">
                      <Receipt size={14} className="text-surface-300" />
                      <span className="text-sm text-surface-300">Invoice #{dispute.invoice_id} — details not available</span>
                    </div>
                  )}
                </section>
              )}

              {/* Payment detail */}
              {dispute.payment_detail_id && (
                <section>
                  <h3 className="text-xs font-bold text-surface-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <DollarSign size={11} /> Payment Details
                  </h3>
                  {paymentLoading ? (
                    <div className="flex items-center justify-center gap-2 py-10 bg-surface-50 rounded-2xl border border-surface-100">
                      <LoadingSpinner />
                      <span className="text-sm text-surface-300">Loading payment…</span>
                    </div>
                  ) : payment ? (
                    <PaymentCard payment={payment} />
                  ) : (
                    <div className="bg-surface-50 border border-surface-100 rounded-xl px-4 py-3.5 flex items-center gap-2">
                      <DollarSign size={14} className="text-surface-300" />
                      <span className="text-sm text-surface-300">Payment #{dispute.payment_detail_id} — details not available</span>
                    </div>
                  )}
                </section>
              )}

              {/* AI Analysis */}
              {dispute.latest_analysis && (
                <section>
                  <h3 className="text-xs font-bold text-surface-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Brain size={11} /> AI Analysis
                  </h3>
                  <div className="bg-purple-50 border border-purple-100 rounded-2xl overflow-hidden">
                    {/* Category + confidence */}
                    <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-purple-100">
                      <p className="text-sm font-bold text-purple-900">{dispute.latest_analysis.predicted_category}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-20 h-1.5 bg-purple-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 rounded-full transition-all"
                            style={{ width: `${Math.round(dispute.latest_analysis.confidence_score * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-purple-700">
                          {Math.round(dispute.latest_analysis.confidence_score * 100)}%
                        </span>
                      </div>
                    </div>
                    {/* Summary */}
                    <div className="px-4 py-3.5">
                      <p className="text-sm text-purple-900 leading-relaxed">{dispute.latest_analysis.ai_summary}</p>
                    </div>
                    {/* AI response if present */}
                    {dispute.latest_analysis.ai_response && (
                      <div className="px-4 py-3.5 bg-white border-t border-purple-100">
                        <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1.5">Suggested Response</p>
                        <p className="text-sm text-surface-800 leading-relaxed">{dispute.latest_analysis.ai_response}</p>
                      </div>
                    )}
                    {/* Flags */}
                    {(dispute.latest_analysis.auto_response_generated || dispute.latest_analysis.memory_context_used) && (
                      <div className="px-4 py-2.5 bg-purple-100 flex items-center gap-3 flex-wrap">
                        {dispute.latest_analysis.auto_response_generated && (
                          <div className="flex items-center gap-1.5">
                            <CheckCheck size={13} className="text-green-600" />
                            <span className="text-xs font-semibold text-green-700">Auto-response sent</span>
                          </div>
                        )}
                        {dispute.latest_analysis.memory_context_used && (
                          <div className="flex items-center gap-1.5">
                            <Brain size={13} className="text-purple-600" />
                            <span className="text-xs font-semibold text-purple-700">Memory context used</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Open questions */}
              {!!dispute.open_questions_count && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
                  <HelpCircle size={16} className="text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-900">
                    <span className="font-bold">{dispute.open_questions_count} open question{dispute.open_questions_count > 1 ? 's' : ''}</span>
                    {' '}awaiting customer response
                  </p>
                </div>
              )}

              {/* Status actions */}
              <section className="border-t border-surface-100 pt-5">
                <h3 className="text-xs font-bold text-surface-300 uppercase tracking-widest mb-3">Update Status</h3>
                <div className="flex flex-wrap gap-2">
                  {(['UNDER_REVIEW', 'RESOLVED', 'CLOSED'] as const).map(nextStatus => {
                    if (dispute.status === nextStatus) return null;
                    const isPrimary = nextStatus === 'RESOLVED';
                    const isActive  = updating === nextStatus;
                    return (
                      <button
                        key={nextStatus}
                        onClick={() => handleStatus(nextStatus)}
                        disabled={updating !== null}
                        className={clsx(
                          'btn-sm inline-flex items-center gap-1.5 transition-all',
                          isPrimary ? 'btn-primary' : 'btn-secondary',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        {isActive && <Loader2 size={11} className="animate-spin" />}
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

          {/* ═══════════════════════════════════════════
              DOCUMENTS TAB
          ═══════════════════════════════════════════ */}
          {tab === 'docs' && (
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-surface-300">
                Supporting documents for this dispute — the original invoice and payment record files.
              </p>

              {/* Invoice PDF */}
              <DocRow
                icon={Receipt}
                iconBg="bg-brand-600"
                label="Invoice Document"
                sublabel={
                  invoice
                    ? invoice.invoice_details?.invoice_number ?? invoice.invoice_number
                    : invoiceLoading
                    ? undefined
                    : dispute.invoice_id
                    ? `Invoice #${dispute.invoice_id}`
                    : undefined
                }
                loading={invoiceLoading}
                missing={!invoiceLoading && !invoice && !dispute.invoice_id}
                missingText="No invoice linked to this dispute"
                url={invoice?.invoice_url}
                urlLabel="Open Invoice"
                meta={invoice ? [
                  ...(invoice.invoice_details?.invoice_date
                    ? [{ icon: Calendar, text: formatDate(invoice.invoice_details.invoice_date as string) }]
                    : []),
                  ...(invoice.invoice_details?.total_amount != null
                    ? [{ icon: DollarSign, text: formatCurrency(invoice.invoice_details.total_amount, invoice.invoice_details?.currency ?? 'INR') }]
                    : []),
                  ...(invoice.invoice_details?.vendor_name
                    ? [{ icon: Building2, text: invoice.invoice_details.vendor_name as string }]
                    : []),
                ] : []}
              />

              {/* Payment PDF */}
              <DocRow
                icon={DollarSign}
                iconBg="bg-green-600"
                label="Payment Document"
                sublabel={
                  payment
                    ? payment.payment_details?.payment_reference ?? `Payment #${payment.payment_detail_id}`
                    : paymentLoading
                    ? undefined
                    : dispute.payment_detail_id
                    ? `Payment #${dispute.payment_detail_id}`
                    : undefined
                }
                loading={paymentLoading}
                missing={!paymentLoading && !payment && !dispute.payment_detail_id}
                missingText="No payment record linked to this dispute"
                url={payment?.payment_url}
                urlLabel="Open Payment"
                meta={payment ? [
                  ...(payment.payment_details?.payment_date
                    ? [{ icon: Calendar, text: formatDate(payment.payment_details.payment_date as string) }]
                    : []),
                  ...(payment.payment_details?.amount_paid != null
                    ? [{ icon: DollarSign, text: formatCurrency(payment.payment_details.amount_paid as number) }]
                    : []),
                  ...(payment.payment_details?.payment_mode
                    ? [{ icon: Zap, text: payment.payment_details.payment_mode as string }]
                    : []),
                  ...(payment.payment_details?.status
                    ? [{ icon: CheckCircle2, text: payment.payment_details.status as string }]
                    : []),
                ] : []}
              />

              {/* Note if payment has a discrepancy */}
              {payment?.payment_details?.note && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3.5">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">{payment.payment_details.note as string}</p>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════
              TIMELINE TAB
          ═══════════════════════════════════════════ */}
          {tab === 'timeline' && (
            <div className="px-6 py-5">
              <div className="flex items-baseline justify-between mb-5">
                <p className="text-xs font-bold text-surface-300 uppercase tracking-widest">
                  Conversation History
                </p>
                {!timelineLoading && episodes.length > 0 && (
                  <span className="text-xs text-surface-300">
                    {episodes.length} message{episodes.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {timelineLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <LoadingSpinner />
                  <p className="text-sm text-surface-300">Loading conversation…</p>
                </div>
              ) : episodes.length > 0 ? (
                <div className="space-y-0">
                  {episodes.map((ep, i) => (
                    <TimelineMessage key={ep.episode_id} ep={ep} isLast={i === episodes.length - 1} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<MessageSquare size={32} />}
                  title="No messages yet"
                  description="The conversation history will appear here as emails are processed."
                />
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

// ─── Table row ────────────────────────────────────────────────────────────────

const DisputeRow = ({ dispute, onClick }: { dispute: Dispute; onClick: () => void }) => {
  const s = sc(dispute.status);
  const p = pc(dispute.priority);
  return (
    <tr
      className="group cursor-pointer hover:bg-brand-50 transition-colors duration-100"
      onClick={onClick}
    >
      <td className="px-5 py-3.5">
        <code className="text-xs font-mono text-surface-300 bg-surface-100 px-2 py-0.5 rounded-lg">
          #{dispute.dispute_id}
        </code>
      </td>
      <td className="px-5 py-3.5 max-w-[240px]">
        <p className="text-sm font-semibold text-surface-900 truncate">
          {dispute.dispute_type?.reason_name ?? 'Unknown'}
        </p>
        <p className="text-xs text-surface-300 truncate mt-0.5">{dispute.customer_id}</p>
      </td>
      <td className="px-5 py-3.5">
        <span className={clsx('badge flex items-center gap-1.5 w-fit', {
          'bg-red-50 text-red-700':     s.badge === 'danger',
          'bg-amber-50 text-amber-700': s.badge === 'warning',
          'bg-green-50 text-green-700': s.badge === 'success',
          'bg-surface-100 text-surface-800': s.badge === 'default',
        })}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
          {s.label}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <Badge variant={p.badge}>{p.label}</Badge>
      </td>
      <td className="px-5 py-3.5 text-sm text-surface-300 max-w-[140px]">
        {dispute.assigned_to
          ? <span className="truncate block">{dispute.assigned_to}</span>
          : <span className="italic text-surface-200">Unassigned</span>
        }
      </td>
      <td className="px-5 py-3.5 text-sm text-surface-300 whitespace-nowrap">
        {formatDate(dispute.created_at)}
      </td>
      <td className="px-4 py-3.5">
        <ChevronRight size={16} className="text-surface-200 group-hover:text-brand-400 transition-colors" />
      </td>
    </tr>
  );
};

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

const DashboardPage = () => {
  const user = useUser();

  const [disputes,       setDisputes]       = useState<Dispute[]>([]);
  const [total,          setTotal]          = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selected,       setSelected]       = useState<Dispute | null>(null);

  const loadDisputes = useCallback(async (showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        status:   statusFilter   !== 'all' ? statusFilter   : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        limit: 100,
        offset: 0,
      };
      // Try /my first, fall back to /
      let res = await disputeService.myDisputes(params).catch(() => null);
      if (!res || res.items.length === 0) res = await disputeService.list(params);

      // Enrich with detail (provides latest_analysis, open_questions_count, assigned_to)
      const enriched = await Promise.all(
        res.items.map(d => disputeService.getDetail(d.dispute_id).catch(() => d))
      );
      setDisputes(enriched);
      setTotal(res.total);
      if (showToast) toast.success('Refreshed');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to load disputes';
      setError(msg);
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  const stats = useMemo(() => ({
    total:    disputes.length,
    open:     disputes.filter(d => d.status === 'OPEN').length,
    review:   disputes.filter(d => d.status === 'UNDER_REVIEW').length,
    resolved: disputes.filter(d => d.status === 'RESOLVED').length,
  }), [disputes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return disputes.filter(d => {
      if (q && !(
        String(d.dispute_id).includes(q) ||
        d.customer_id.toLowerCase().includes(q) ||
        (d.dispute_type?.reason_name ?? '').toLowerCase().includes(q)
      )) return false;
      if (statusFilter   !== 'all' && d.status   !== statusFilter)   return false;
      if (priorityFilter !== 'all' && d.priority !== priorityFilter) return false;
      return true;
    });
  }, [disputes, search, statusFilter, priorityFilter]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* Page header */}
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'Associate'} 👋`}
        subtitle="Review and manage your assigned dispute tickets below."
        action={
          <button
            onClick={() => loadDisputes(true)}
            title="Refresh"
            className="p-2 rounded-xl hover:bg-surface-100 text-surface-300 hover:text-surface-800 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileText}     label="Total"       value={stats.total}    accent="bg-brand-600" />
        <StatCard icon={AlertCircle}  label="Open"        value={stats.open}     accent="bg-red-500"   sub="Needs attention" />
        <StatCard icon={Clock}        label="In Review"   value={stats.review}   accent="bg-amber-500" />
        <StatCard icon={CheckCircle2} label="Resolved"    value={stats.resolved} accent="bg-green-500" />
      </div>

      {/* Summary banner */}
      <div className="card px-5 py-3.5 mb-6 flex items-center gap-3 bg-gradient-to-r from-brand-600 to-brand-700 border-0">
        <TrendingUp size={16} className="text-brand-200 shrink-0" />
        <span className="text-sm text-brand-100">{total} total dispute{total !== 1 ? 's' : ''} tracked</span>
        <span className="text-brand-200 mx-1">·</span>
        <span className="text-sm text-brand-200">Click any row to view full details, documents, and conversation</span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => loadDisputes()}
            className="ml-auto text-xs font-semibold text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300 pointer-events-none" />
          <input
            className="input-base pl-9 py-2 text-sm"
            placeholder="Search by ID, customer, type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-surface-300" />
          <select
            className="input-base py-2 text-sm w-auto cursor-pointer"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>
        </div>
        <select
          className="input-base py-2 text-sm w-auto cursor-pointer"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
        >
          <option value="all">All Priorities</option>
          {Object.entries(PRIORITY_CONFIG).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
        <span className="text-xs text-surface-300 ml-auto">
          {filtered.length} of {disputes.length}
        </span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-50 border-b border-surface-100">
              {['ID', 'Type / Customer', 'Status', 'Priority', 'Assigned To', 'Created', ''].map(h => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-bold text-surface-300 uppercase tracking-widest whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <div className="flex items-center justify-center gap-3 py-20">
                    <Loader2 size={22} className="animate-spin text-brand-400" />
                    <span className="text-sm text-surface-300">Loading disputes…</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length > 0 ? (
              filtered.map(d => (
                <DisputeRow key={d.dispute_id} dispute={d} onClick={() => setSelected(d)} />
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title="No disputes found"
                    description={error ? 'Could not load from server.' : 'Try adjusting your filters or search query.'}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {selected && (
        <DisputeDrawer
          dispute={selected}
          onClose={() => setSelected(null)}
          onStatusUpdate={loadDisputes}
        />
      )}
    </div>
  );
};

export default DashboardPage;
