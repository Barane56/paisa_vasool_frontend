import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Filter, Clock, CheckCircle2, AlertCircle, FileText,
  X, ChevronRight, Brain, MessageSquare, HelpCircle,
  User2, RefreshCw, Loader2, AlertTriangle, Receipt,
  Calendar, DollarSign, Building2, Hash, Zap,
  ArrowUpRight, Package, CheckCheck, TrendingUp, CreditCard,
  Paperclip, Download,
} from 'lucide-react';
import { Badge } from '@/components/ui';
import { PageHeader, EmptyState, LoadingSpinner } from '@/components/common';
import { formatDate, formatCurrency } from '@/utils';
import {
  disputeService,
  Dispute,
  InvoiceData,
  PaymentDetailData,
  TimelineEpisode,
  TimelineAttachment,
} from '@/features/disputes/services/disputeService';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; badge: 'danger' | 'warning' | 'success' | 'default'; dot: string }> = {
  OPEN:         { label: 'Open',         badge: 'danger',  dot: 'bg-red-500' },
  UNDER_REVIEW: { label: 'Under Review', badge: 'warning', dot: 'bg-brand-400' },
  RESOLVED:     { label: 'Resolved',     badge: 'success', dot: 'bg-green-500' },
  CLOSED:       { label: 'Closed',       badge: 'default', dot: 'bg-surface-300' },
};

const PRIORITY_CONFIG: Record<string, { label: string; badge: 'danger' | 'warning' | 'default' }> = {
  HIGH:   { label: 'High',   badge: 'danger' },
  MEDIUM: { label: 'Medium', badge: 'warning' },
  LOW:    { label: 'Low',    badge: 'default' },
};

const sc = (s: string) => STATUS_CONFIG[s]   ?? { label: s, badge: 'default' as const, dot: 'bg-surface-200' };
const pc = (p: string) => PRIORITY_CONFIG[p] ?? { label: p, badge: 'default' as const };

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, accent, sub }: {
  icon: React.ElementType; label: string; value: number; accent: string; sub?: string;
}) => (
  <div className="card p-5 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
      <Icon size={20} className="text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest truncate">{label}</p>
      <p className="font-display text-3xl font-bold text-surface-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Timeline helpers (exact replica of FA timeline) ─────────────────────────

const actorConfig: Record<string, { color: string; ring: string; bubble: string; text: string }> = {
  CUSTOMER:  { color: 'bg-surface-500', ring: 'ring-surface-200', bubble: 'bg-white border border-surface-200',   text: 'text-surface-700' },
  AI:        { color: 'bg-brand-600',   ring: 'ring-brand-200',   bubble: 'bg-brand-50 border border-brand-100',  text: 'text-brand-600'   },
  ASSOCIATE: { color: 'bg-brand-600',   ring: 'ring-brand-200',   bubble: 'bg-brand-50 border border-brand-100',  text: 'text-brand-600'   },
  SYSTEM:    { color: 'bg-slate-400',   ring: 'ring-slate-200',   bubble: 'bg-slate-100 border border-slate-200', text: 'text-slate-600'   },
};
const getActorCfg = (actor: string) => actorConfig[actor as keyof typeof actorConfig] ?? actorConfig.ASSOCIATE;

const getActorLabel = (ep: TimelineEpisode, dispute: Dispute): string => {
  if (ep.actor === 'AI')        return 'AI · Accounts Receivable';
  if (ep.actor === 'SYSTEM')    return 'System';
  if (ep.actor === 'CUSTOMER')  return dispute.customer_id ?? 'Customer';
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

const AttachmentChip = ({ att }: { att: TimelineAttachment }) => {
  const [loading, setLoading] = useState(false);
  const isImage = att.file_type?.startsWith('image/');
  const isPdf   = att.file_type === 'application/pdf' || att.file_name.endsWith('.pdf');
  const icon    = isImage ? '🖼' : isPdf ? '📄' : '📎';
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (loading) return;
    try {
      setLoading(true);
      const { default: axiosInstance } = await import('@/lib/axios');
      const response = await axiosInstance.get(att.download_url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = att.file_name; a.target = '_blank';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch { toast.error(`Failed to download ${att.file_name}`); }
    finally { setLoading(false); }
  };
  return (
    <button onClick={handleClick} disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-current/20 bg-white/60 hover:bg-white transition-all text-xs font-medium group/chip disabled:opacity-60">
      <span className="text-sm leading-none">{icon}</span>
      <span className="max-w-[140px] truncate">{att.file_name}</span>
      {loading ? <Loader2 size={11} className="shrink-0 animate-spin" /> : <Download size={11} className="shrink-0 opacity-50 group-hover/chip:opacity-100 transition-opacity" />}
    </button>
  );
};

const AdminTimelineMessage = ({ ep, dispute, isLast }: { ep: TimelineEpisode; dispute: Dispute; isLast: boolean }) => {
  const cfg   = getActorCfg(ep.actor);
  const label = getActorLabel(ep, dispute);
  const hasAttachments = ep.attachments && ep.attachments.length > 0;
  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-full ${cfg.color} ring-2 ${cfg.ring} flex items-center justify-center shrink-0 shadow-sm`}>
          <ActorIcon actor={ep.actor} />
        </div>
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

// ─── Incident Drawer ──────────────────────────────────────────────────────────

const IncidentDrawer = ({
  dispute: initDispute,
  onClose,
  onStatusUpdate,
}: {
  dispute: Dispute;
  onClose: () => void;
  onStatusUpdate: (disputeId: number, patch: Partial<Dispute>) => void;
}) => {
  const [dispute, setDispute]   = useState<Dispute>(initDispute);
  const [invoice, setInvoice]   = useState<InvoiceData | null>(null);
  const [payments, setPayments] = useState<PaymentDetailData[]>([]);
  const [episodes, setEpisodes] = useState<TimelineEpisode[]>([]);
  const [invoiceLoading, setInvoiceL]   = useState(false);
  const [paymentLoading, setPaymentL]   = useState(false);
  const [timelineLoading, setTimelineL] = useState(false);
  const [invoiceTried,  setInvoiceTried]  = useState(false);
  const [paymentTried,  setPaymentTried]  = useState(false);
  const [timelineTried, setTimelineTried] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'timeline'>('overview');

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (invoiceTried || tab !== 'overview' || !dispute.invoice_id) return;
    setInvoiceTried(true);
    setInvoiceL(true);
    disputeService.getInvoice(dispute.invoice_id)
      .then(setInvoice).catch(() => {}).finally(() => setInvoiceL(false));
  }, [tab, dispute.invoice_id, invoiceTried]);

  useEffect(() => {
    if (paymentTried || tab !== 'overview') return;
    if (!dispute.invoice_id && !dispute.payment_detail_id) return;
    setPaymentTried(true);
    setPaymentL(true);
    const run = async () => {
      try {
        if (dispute.invoice_id) {
          const inv = invoice ?? await disputeService.getInvoice(dispute.invoice_id);
          const res = await disputeService.getPaymentsByInvoice(inv.invoice_number);
          setPayments(res.items);
        } else {
          const p = await disputeService.getPaymentDetail(dispute.payment_detail_id!);
          setPayments([p]);
        }
      } catch { /* empty */ } finally { setPaymentL(false); }
    };
    run();
  }, [tab, dispute.invoice_id, dispute.payment_detail_id, paymentTried, invoice]);

  useEffect(() => {
    if (timelineTried || tab !== 'timeline') return;
    setTimelineTried(true);
    setTimelineL(true);
    disputeService.getTimeline(dispute.dispute_id)
      .then(r => setEpisodes(r.timeline)).catch(() => setEpisodes([]))
      .finally(() => setTimelineL(false));
  }, [tab, dispute.dispute_id, timelineTried]);

  const handleStatus = async (newStatus: string) => {
    try {
      setUpdating(newStatus);
      await disputeService.updateStatus(dispute.dispute_id, newStatus);
      setDispute(prev => ({ ...prev, status: newStatus }));
      onStatusUpdate(dispute.dispute_id, { status: newStatus });
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); } finally { setUpdating(null); }
  };

  const s = sc(dispute.status);
  const p = pc(dispute.priority);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-surface-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-full max-w-[560px] z-50 flex flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-surface-100">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <code className="text-xs font-mono bg-surface-100 text-surface-800 px-2 py-0.5 rounded-lg">
                  #{dispute.dispute_id}
                </code>
                <span className={`inline-flex items-center gap-1.5 badge ${
                  s.badge === 'danger'  ? 'bg-red-50 text-red-700'    :
                  s.badge === 'warning' ? 'bg-brand-50 text-brand-700' :
                  s.badge === 'success' ? 'bg-green-50 text-green-700' :
                  'bg-surface-100 text-surface-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                <Badge variant={p.badge}>{p.label} Priority</Badge>
              </div>
              <h2 className="font-display font-bold text-surface-900 text-lg leading-snug">
                {dispute.dispute_type?.reason_name ?? 'Unknown Incident'}
              </h2>
              <p className="text-xs text-gray-600 mt-1 flex items-center gap-1.5">
                <Building2 size={11} />
                {dispute.customer_id}
                <span className="text-gray-400 mx-1">·</span>
                <Calendar size={11} />
                Opened {formatDate(dispute.created_at)}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100 text-gray-600 transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex gap-0 border-b border-surface-100 px-6">
          {(['overview', 'timeline'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'relative py-3.5 mr-6 text-sm font-semibold border-b-2 transition-colors capitalize',
                tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-600 hover:text-surface-800'
              )}
            >
              {t === 'overview' ? 'Overview' : 'Timeline'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {tab === 'overview' && (
            <>
              <section>
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Description</h3>
                <p className="text-sm text-surface-800 leading-relaxed bg-surface-50 border border-surface-100 rounded-xl px-4 py-3.5">
                  {dispute.description || <em className="text-gray-600">No description available</em>}
                </p>
              </section>

              <section>
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Case Details</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Assigned To',  val: dispute.assigned_to ?? 'Unassigned' },
                    { label: 'Last Updated', val: formatDate(dispute.updated_at) },
                    { label: 'Invoice',      val: invoice?.invoice_number ?? (dispute.invoice_id ? `#${dispute.invoice_id}` : '—') },
                    { label: 'Payments',     val: payments.length > 0 ? `${payments.length} record${payments.length !== 1 ? 's' : ''}` : '—' },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-surface-50 border border-surface-100 rounded-xl px-3.5 py-3">
                      <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider mb-0.5">{label}</p>
                      <p className="text-sm font-bold text-surface-900 truncate">{val}</p>
                    </div>
                  ))}
                </div>
              </section>

              {dispute.latest_analysis && (
                <section>
                  <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Brain size={11} /> AI Analysis
                  </h3>
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
                    <p className="text-sm font-bold text-blue-900">{dispute.latest_analysis.predicted_category}</p>
                    <p className="text-sm text-blue-800 leading-relaxed">{dispute.latest_analysis.ai_summary}</p>
                  </div>
                </section>
              )}

              <section className="border-t border-surface-100 pt-5">
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Update Status</h3>
                <div className="flex flex-wrap gap-2">
                  {(['UNDER_REVIEW', 'RESOLVED', 'CLOSED'] as const).map(nextStatus => {
                    if (dispute.status === nextStatus) return null;
                    const isActive = updating === nextStatus;
                    return (
                      <button
                        key={nextStatus}
                        onClick={() => handleStatus(nextStatus)}
                        disabled={updating !== null}
                        className={clsx(
                          'btn-sm inline-flex items-center gap-1.5 transition-all',
                          nextStatus === 'RESOLVED' ? 'btn-primary' : 'btn-secondary',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        {isActive && <Loader2 size={11} className="animate-spin" />}
                        {nextStatus === 'UNDER_REVIEW' && 'Mark Under Review'}
                        {nextStatus === 'RESOLVED'     && 'Mark Resolved'}
                        {nextStatus === 'CLOSED'       && 'Close Incident'}
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {tab === 'timeline' && (
            <div>
              {timelineLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <LoadingSpinner />
                  <p className="text-sm text-gray-600">Loading timeline…</p>
                </div>
              ) : episodes.length > 0 ? (
                <div className="space-y-0">
                  {episodes.map((ep, i) => (
                    <AdminTimelineMessage key={ep.episode_id} ep={ep} dispute={dispute} isLast={i === episodes.length - 1} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<MessageSquare size={28} />} title="No timeline" description="No episodes yet." />
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

// ─── Incident Row ─────────────────────────────────────────────────────────────

const IncidentRow = ({ dispute, onClick }: { dispute: Dispute; onClick: () => void }) => {
  const s = sc(dispute.status);
  const p = pc(dispute.priority);
  return (
    <tr className="group cursor-pointer hover:bg-brand-50 transition-colors duration-100" onClick={onClick}>
      <td className="px-5 py-3.5">
        <code className="text-xs font-mono text-gray-900 bg-surface-100 px-2 py-0.5 rounded-lg">
          #{dispute.dispute_id}
        </code>
      </td>
      <td className="px-5 py-3.5 max-w-[240px]">
        <p className="text-sm font-semibold text-surface-900 truncate">{dispute.dispute_type?.reason_name ?? 'Unknown'}</p>
        <p className="text-xs text-gray-900 truncate mt-0.5">{dispute.customer_id}</p>
      </td>
      <td className="px-5 py-3.5">
        <span className={clsx('badge flex items-center gap-1.5 w-fit', {
          'bg-red-50 text-red-700':     s.badge === 'danger',
          'bg-brand-50 text-brand-700': s.badge === 'warning',
          'bg-green-50 text-green-700': s.badge === 'success',
          'bg-surface-100 text-surface-800': s.badge === 'default',
        })}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
          {s.label}
        </span>
      </td>
      <td className="px-5 py-3.5"><Badge variant={p.badge}>{p.label}</Badge></td>
      <td className="px-5 py-3.5 text-sm text-gray-900 whitespace-nowrap">{formatDate(dispute.created_at)}</td>
      <td className="px-4 py-3.5">
        <ChevronRight size={16} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
      </td>
    </tr>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AdminCasesPage = () => {
  const [disputes,       setDisputes]       = useState<Dispute[]>([]);
  const [total,          setTotal]          = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [search,         setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selected,       setSelected]       = useState<Dispute | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search — fires server call 400ms after user stops typing
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 400);
  };

  // Filters + search sent to server — bulk detail in one round-trip
  const loadDisputes = useCallback(async (showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        status:   statusFilter   !== 'all' ? statusFilter   : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        search:   debouncedSearch.trim()   || undefined,
        limit: 100, offset: 0,
      };
      const res = await disputeService.list(params);
      const ids = res.items.map((d: Dispute) => d.dispute_id);
      const enriched = ids.length ? await disputeService.bulkDetail(ids) : [];
      setDisputes(enriched);
      setTotal(res.total);
      if (showToast) toast.success('Refreshed');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: unknown } }; message?: string };
      const detail = e?.response?.data?.detail;
      const msg =
        typeof detail === 'string' ? detail :
        Array.isArray(detail)      ? detail.map((d: { msg?: string }) => d.msg).join(', ') :
        e?.message                 ?? 'Failed to load cases';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, debouncedSearch]);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  // ── Update single dispute in place — no full reload on status change ───────
  const updateLocalDispute = useCallback((disputeId: number, patch: Partial<Dispute>) => {
    setDisputes(prev => prev.map(d => d.dispute_id === disputeId ? { ...d, ...patch } : d));
    setSelected(prev => prev?.dispute_id === disputeId ? { ...prev, ...patch } : prev);
  }, []);

  const stats = {
    total:    disputes.length,
    open:     disputes.filter(d => d.status === 'OPEN').length,
    review:   disputes.filter(d => d.status === 'UNDER_REVIEW').length,
    resolved: disputes.filter(d => d.status === 'RESOLVED').length,
  };

  // filtered = disputes (server already filtered; kept for count display consistency)
  const filtered = disputes;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <PageHeader
        title="All Cases"
        subtitle="Monitor and manage all dispute cases across the platform."
        action={
          <button onClick={() => loadDisputes(true)} title="Refresh"
            className="p-2 rounded-xl hover:bg-surface-100 text-gray-600 transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileText}     label="Total"     value={stats.total}    accent="bg-brand-500" />
        <StatCard icon={AlertCircle}  label="Open"      value={stats.open}     accent="bg-red-500"   sub="Needs attention" />
        <StatCard icon={Clock}        label="In Review" value={stats.review}   accent="bg-brand-400" />
        <StatCard icon={CheckCircle2} label="Resolved"  value={stats.resolved} accent="bg-green-500" />
      </div>

      <div className="card px-5 py-3.5 mb-6 flex items-center gap-3 bg-gradient-to-r from-brand-600 to-brand-700 border-0">
        <TrendingUp size={16} className="text-brand-200 shrink-0" />
        <span className="text-sm text-brand-100">{total} total case{total !== 1 ? 's' : ''} tracked</span>
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
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
          <input
            className="input-base pl-9 py-2 text-sm"
            placeholder="Search by ID, customer, type…"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-gray-600" />
          <select className="input-base py-2 text-sm w-auto cursor-pointer"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
        </div>
        <select className="input-base py-2 text-sm w-auto cursor-pointer"
          value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="all">All Priorities</option>
          {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <span className="text-xs text-gray-600 ml-auto">{filtered.length} of {disputes.length} cases</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-50 border-b border-surface-100">
              {['ID', 'Type / Customer', 'Status', 'Priority', 'Created', ''].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {loading ? (
              <tr><td colSpan={6}>
                <div className="flex items-center justify-center gap-3 py-20">
                  <Loader2 size={22} className="animate-spin text-brand-400" />
                  <span className="text-sm text-gray-600">Loading cases…</span>
                </div>
              </td></tr>
            ) : filtered.length > 0 ? (
              filtered.map(d => <IncidentRow key={d.dispute_id} dispute={d} onClick={() => setSelected(d)} />)
            ) : (
              <tr><td colSpan={6}>
                <EmptyState title="No cases found" description="Try adjusting your filters." />
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <IncidentDrawer dispute={selected} onClose={() => setSelected(null)} onStatusUpdate={updateLocalDispute} />
      )}
    </div>
  );
};

export default AdminCasesPage;
