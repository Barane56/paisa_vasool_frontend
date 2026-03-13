import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Filter, Clock, CheckCircle2, AlertCircle, FileText,
  X, ChevronRight, Brain, MessageSquare, HelpCircle,
  User2, RefreshCw, Loader2, AlertTriangle, Receipt,
  Calendar, DollarSign, Building2, Hash, Zap,
  ArrowUpRight, Package, CheckCheck, TrendingUp, CreditCard,
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
} from '@/features/disputes/services/disputeService';
import clsx from 'clsx';
import toast from 'react-hot-toast';

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

// ─── Incident Drawer ──────────────────────────────────────────────────────────

const IncidentDrawer = ({
  dispute: initDispute,
  onClose,
  onStatusUpdate,
}: {
  dispute: Dispute;
  onClose: () => void;
  onStatusUpdate: () => void;
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
      toast.success('Status updated');
      onStatusUpdate();
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
                tab === t ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-600 hover:text-surface-800'
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
                  <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 space-y-2">
                    <p className="text-sm font-bold text-purple-900">{dispute.latest_analysis.predicted_category}</p>
                    <p className="text-sm text-purple-800 leading-relaxed">{dispute.latest_analysis.ai_summary}</p>
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
                <div className="space-y-4">
                  {episodes.map(ep => (
                    <div key={ep.episode_id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        {ep.actor === 'CUSTOMER' ? <MessageSquare size={13} className="text-amber-600" /> :
                         ep.actor === 'AI'       ? <Brain size={13} className="text-amber-600" /> :
                                                   <User2 size={13} className="text-amber-600" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-amber-700 mb-1">
                          {ep.actor} · {formatDate(ep.created_at)}
                        </p>
                        <div className="bg-surface-50 border border-surface-100 rounded-xl px-3 py-2.5">
                          <p className="text-sm text-surface-800 leading-relaxed whitespace-pre-wrap">{ep.content_text}</p>
                        </div>
                      </div>
                    </div>
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
    <tr className="group cursor-pointer hover:bg-amber-50 transition-colors duration-100" onClick={onClick}>
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
          'bg-amber-50 text-amber-700': s.badge === 'warning',
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
        <ChevronRight size={16} className="text-gray-400 group-hover:text-amber-500 transition-colors" />
      </td>
    </tr>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AdminIncidentsPage = () => {
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
      const res = await disputeService.list({ limit: 100, offset: 0 });
      const enriched = await Promise.all(
        res.items.map(d => disputeService.getDetail(d.dispute_id).catch(() => d))
      );
      setDisputes(enriched);
      setTotal(res.total);
      if (showToast) toast.success('Refreshed');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: unknown } }; message?: string };
      const detail = e?.response?.data?.detail;
      const msg =
        typeof detail === 'string' ? detail :
        Array.isArray(detail)      ? detail.map((d: { msg?: string }) => d.msg).join(', ') :
        e?.message                 ?? 'Failed to load incidents';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  const stats = {
    total:    disputes.length,
    open:     disputes.filter(d => d.status === 'OPEN').length,
    review:   disputes.filter(d => d.status === 'UNDER_REVIEW').length,
    resolved: disputes.filter(d => d.status === 'RESOLVED').length,
  };

  const filtered = useMemo(() => disputes.filter(d => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      String(d.dispute_id).includes(q) ||
      d.customer_id.toLowerCase().includes(q) ||
      (d.dispute_type?.reason_name ?? '').toLowerCase().includes(q) ||
      d.status.toLowerCase().includes(q) ||
      d.priority.toLowerCase().includes(q);
    const matchStatus   = statusFilter   === 'all' || d.status   === statusFilter;
    const matchPriority = priorityFilter === 'all' || d.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  }), [disputes, search, statusFilter, priorityFilter]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <PageHeader
        title="All Incidents"
        subtitle="Monitor and manage all dispute incidents across the platform."
        action={
          <button onClick={() => loadDisputes(true)} title="Refresh"
            className="p-2 rounded-xl hover:bg-surface-100 text-gray-600 transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileText}     label="Total"     value={stats.total}    accent="bg-amber-500" />
        <StatCard icon={AlertCircle}  label="Open"      value={stats.open}     accent="bg-red-500"   sub="Needs attention" />
        <StatCard icon={Clock}        label="In Review" value={stats.review}   accent="bg-amber-400" />
        <StatCard icon={CheckCircle2} label="Resolved"  value={stats.resolved} accent="bg-green-500" />
      </div>

      <div className="card px-5 py-3.5 mb-6 flex items-center gap-3 bg-gradient-to-r from-amber-600 to-amber-700 border-0">
        <TrendingUp size={16} className="text-amber-200 shrink-0" />
        <span className="text-sm text-amber-100">{total} total incident{total !== 1 ? 's' : ''} tracked</span>
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
            onChange={e => setSearch(e.target.value)}
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
        <span className="text-xs text-gray-600 ml-auto">{filtered.length} of {disputes.length} incidents</span>
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
                  <Loader2 size={22} className="animate-spin text-amber-400" />
                  <span className="text-sm text-gray-600">Loading incidents…</span>
                </div>
              </td></tr>
            ) : filtered.length > 0 ? (
              filtered.map(d => <IncidentRow key={d.dispute_id} dispute={d} onClick={() => setSelected(d)} />)
            ) : (
              <tr><td colSpan={6}>
                <EmptyState title="No incidents found" description="Try adjusting your filters." />
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <IncidentDrawer dispute={selected} onClose={() => setSelected(null)} onStatusUpdate={loadDisputes} />
      )}
    </div>
  );
};

export default AdminIncidentsPage;
