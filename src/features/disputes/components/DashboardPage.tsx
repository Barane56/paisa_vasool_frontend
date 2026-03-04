import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, Filter, TrendingUp, Clock, CheckCircle2, AlertCircle, FileText,
  X, ExternalLink, Download, ChevronRight, Paperclip, Brain,
  MessageSquare, HelpCircle, User2, RefreshCw, Loader2, AlertTriangle,
} from 'lucide-react';
import { useUser } from '@/hooks';
import { Badge } from '@/components/ui';
import { PageHeader, EmptyState, LoadingSpinner } from '@/components/common';
import { formatDate } from '@/utils';
import {
  disputeService,
  Dispute,
  SupportingDoc,
  TimelineEpisode,
} from '../services/disputeService';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  OPEN:         'Open',
  UNDER_REVIEW: 'Under Review',
  RESOLVED:     'Resolved',
  CLOSED:       'Closed',
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW:    'Low',
  MEDIUM: 'Medium',
  HIGH:   'High',
};

const statusVariant = (s: string): 'danger' | 'warning' | 'success' | 'default' =>
  ({ OPEN: 'danger', UNDER_REVIEW: 'warning', RESOLVED: 'success', CLOSED: 'default' } as const)[s] ?? 'default';

const priorityVariant = (p: string): 'default' | 'info' | 'warning' =>
  ({ LOW: 'default', MEDIUM: 'info', HIGH: 'warning' } as const)[p] ?? 'default';

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) => (
  <div className="card p-5 flex items-start gap-4">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={18} className="text-white" />
    </div>
    <div>
      <p className="text-xs text-surface-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="font-display text-2xl font-bold text-surface-900 leading-none mt-1">{value}</p>
      {sub && <p className="text-xs text-surface-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Supporting doc ───────────────────────────────────────────────────────────

const DocItem = ({ doc }: { doc: SupportingDoc }) => {
  const ext = doc.file_name.split('.').pop()?.toUpperCase() ?? 'FILE';
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-surface-100 bg-surface-50 hover:bg-white transition-all group">
      <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
        <Paperclip size={15} className="text-brand-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-800 truncate" title={doc.file_name}>{doc.file_name}</p>
        <p className="text-xs text-surface-400">{formatDate(doc.uploaded_at)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="info">{ext}</Badge>
        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
           className="p-1.5 rounded-lg hover:bg-brand-50 text-surface-400 hover:text-brand-500 transition-colors">
          <ExternalLink size={14} />
        </a>
        <a href={doc.file_url} download={doc.file_name}
           className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition-colors">
          <Download size={14} />
        </a>
      </div>
    </div>
  );
};

// ─── Timeline episode ─────────────────────────────────────────────────────────

const EpisodeItem = ({ ep }: { ep: TimelineEpisode }) => {
  const isCustomer = ep.actor === 'CUSTOMER';
  const isAI       = ep.actor === 'AI';
  const Icon  = isCustomer ? MessageSquare : isAI ? Brain : User2;
  const label = isCustomer ? 'Customer Email' : isAI ? 'AI Response' : 'Associate Note';
  const iconBg    = isCustomer ? 'bg-blue-50'    : isAI ? 'bg-purple-50' : 'bg-amber-50';
  const iconColor = isCustomer ? 'text-blue-500' : isAI ? 'text-purple-500' : 'text-amber-500';

  return (
    <div className="flex gap-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
        <Icon size={13} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-surface-700">{label}</span>
          <span className="text-xs text-surface-400">{formatDate(ep.created_at)}</span>
        </div>
        <p className="text-xs text-surface-600 leading-relaxed line-clamp-4 bg-surface-50 rounded-lg px-3 py-2 border border-surface-100">
          {ep.content_text}
        </p>
      </div>
    </div>
  );
};

// ─── Dispute Drawer ───────────────────────────────────────────────────────────

const DisputeDrawer = ({
  dispute: init,
  onClose,
  onStatusUpdate,
}: {
  dispute: Dispute;
  onClose: () => void;
  onStatusUpdate: () => void;
}) => {
  const [dispute,      setDispute]      = useState<Dispute>(init);
  const [docs,         setDocs]         = useState<SupportingDoc[]>([]);
  const [episodes,     setEpisodes]     = useState<TimelineEpisode[]>([]);
  const [loadingDocs,  setLoadingDocs]  = useState(false);
  const [loadingEps,   setLoadingEps]   = useState(false);
  const [updatingStatus, setUpdating]   = useState(false);
  const [tab, setTab] = useState<'overview' | 'docs' | 'timeline'>('overview');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (tab !== 'docs' || !dispute.email_id) return;
    setLoadingDocs(true);
    disputeService.getSupportingDocs(dispute.email_id)
      .then(setDocs).catch(() => setDocs([])).finally(() => setLoadingDocs(false));
  }, [tab, dispute.email_id]);

  useEffect(() => {
    if (tab !== 'timeline') return;
    setLoadingEps(true);
    disputeService.getTimeline(dispute.dispute_id)
      .then((d) => setEpisodes(d.timeline)).catch(() => setEpisodes([])).finally(() => setLoadingEps(false));
  }, [tab, dispute.dispute_id]);

  const handleStatus = async (newStatus: string) => {
    try {
      setUpdating(true);
      await disputeService.updateStatus(dispute.dispute_id, newStatus);
      toast.success('Status updated');
      setDispute((prev) => ({ ...prev, status: newStatus }));
      onStatusUpdate();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const TABS = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'docs'     as const, label: 'Documents' },
    { id: 'timeline' as const, label: 'Timeline' },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-surface-100 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-surface-400">#{dispute.dispute_id}</span>
              <Badge variant={statusVariant(dispute.status)}>{STATUS_LABEL[dispute.status] ?? dispute.status}</Badge>
              <Badge variant={priorityVariant(dispute.priority)}>{PRIORITY_LABEL[dispute.priority] ?? dispute.priority}</Badge>
            </div>
            <h2 className="font-display font-bold text-surface-900 text-base leading-snug">
              {dispute.dispute_type?.reason_name ?? 'Unknown Dispute Type'}
            </h2>
            <p className="text-xs text-surface-400 mt-0.5">Customer: {dispute.customer_id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-100 text-surface-400 transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-100 px-6 shrink-0">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx('py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors',
                tab === t.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-surface-500 hover:text-surface-800'
              )}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {tab === 'overview' && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-surface-700 leading-relaxed bg-surface-50 rounded-xl px-4 py-3 border border-surface-100">
                  {dispute.description || 'No description provided.'}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Invoice ID',   value: dispute.invoice_id          ? `#${dispute.invoice_id}`          : null },
                    { label: 'Payment ID',   value: dispute.payment_detail_id   ? `#${dispute.payment_detail_id}`   : null },
                    { label: 'Email ID',     value: `#${dispute.email_id}` },
                    { label: 'Assigned to',  value: dispute.assigned_to         ?? 'Unassigned' },
                    { label: 'Created',      value: formatDate(dispute.created_at) },
                    { label: 'Last updated', value: formatDate(dispute.updated_at) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface-50 rounded-xl p-3 border border-surface-100">
                      <p className="text-xs text-surface-400 uppercase tracking-wider font-medium mb-1">{label}</p>
                      <p className="text-sm font-semibold text-surface-800">
                        {value ?? <span className="text-surface-300 font-normal italic">—</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {dispute.latest_analysis && (
                <div>
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Brain size={12} /> AI Analysis
                  </p>
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-700">{dispute.latest_analysis.predicted_category}</span>
                      <Badge variant="purple">{(dispute.latest_analysis.confidence_score * 100).toFixed(0)}% confidence</Badge>
                    </div>
                    <p className="text-xs text-purple-800 leading-relaxed">{dispute.latest_analysis.ai_summary}</p>
                    {dispute.latest_analysis.auto_response_generated && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={12} className="text-green-500" />
                        <span className="text-xs text-green-700 font-medium">Auto-response generated</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!!dispute.open_questions_count && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <HelpCircle size={16} className="text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-800">
                    <span className="font-semibold">{dispute.open_questions_count} pending question{dispute.open_questions_count > 1 ? 's' : ''}</span>{' '}
                    awaiting customer response.
                  </p>
                </div>
              )}

              {/* Status actions */}
              <div className="pt-2 border-t border-surface-100">
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {dispute.status !== 'UNDER_REVIEW' && (
                    <button onClick={() => handleStatus('UNDER_REVIEW')} disabled={updatingStatus}
                      className="btn-secondary btn-sm disabled:opacity-50 flex items-center gap-1.5">
                      {updatingStatus && <Loader2 size={11} className="animate-spin" />}
                      Mark Under Review
                    </button>
                  )}
                  {dispute.status !== 'RESOLVED' && (
                    <button onClick={() => handleStatus('RESOLVED')} disabled={updatingStatus}
                      className="btn-primary btn-sm disabled:opacity-50 flex items-center gap-1.5">
                      {updatingStatus && <Loader2 size={11} className="animate-spin" />}
                      Mark Resolved
                    </button>
                  )}
                  {dispute.status !== 'CLOSED' && (
                    <button onClick={() => handleStatus('CLOSED')} disabled={updatingStatus}
                      className="btn-secondary btn-sm disabled:opacity-50">
                      Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'docs' && (
            <div>
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Paperclip size={12} /> Supporting Documents
              </p>
              {loadingDocs ? (
                <div className="flex justify-center py-10"><LoadingSpinner /></div>
              ) : docs.length > 0 ? (
                <div className="space-y-2">{docs.map((d) => <DocItem key={d.attachment_id} doc={d} />)}</div>
              ) : (
                <EmptyState title="No documents" description="No supporting documents were attached to this dispute's email." />
              )}
            </div>
          )}

          {tab === 'timeline' && (
            <div>
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <MessageSquare size={12} /> Conversation Timeline
              </p>
              {loadingEps ? (
                <div className="flex justify-center py-10"><LoadingSpinner /></div>
              ) : episodes.length > 0 ? (
                <div className="space-y-4">{episodes.map((ep) => <EpisodeItem key={ep.episode_id} ep={ep} />)}</div>
              ) : (
                <EmptyState title="No episodes yet" description="Memory episodes will appear here as the dispute progresses." />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Dispute row ──────────────────────────────────────────────────────────────

const DisputeRow = ({ dispute, onClick }: { dispute: Dispute; onClick: () => void }) => (
  <tr className="group hover:bg-surface-50 transition-colors duration-100 cursor-pointer" onClick={onClick}>
    <td className="px-5 py-3.5"><span className="font-mono text-xs text-surface-400">#{dispute.dispute_id}</span></td>
    <td className="px-5 py-3.5 max-w-xs">
      <p className="text-sm font-medium text-surface-900 truncate">{dispute.dispute_type?.reason_name ?? 'Unknown'}</p>
      <p className="text-xs text-surface-400 truncate mt-0.5">{dispute.customer_id}</p>
    </td>
    <td className="px-5 py-3.5"><Badge variant={statusVariant(dispute.status)}>{STATUS_LABEL[dispute.status] ?? dispute.status}</Badge></td>
    <td className="px-5 py-3.5"><Badge variant={priorityVariant(dispute.priority)}>{PRIORITY_LABEL[dispute.priority] ?? dispute.priority}</Badge></td>
    <td className="px-5 py-3.5 text-sm text-surface-400">{dispute.assigned_to ?? <span className="italic text-surface-300">Unassigned</span>}</td>
    <td className="px-5 py-3.5 text-sm text-surface-400">{formatDate(dispute.created_at)}</td>
    <td className="px-5 py-3.5">
      <ChevronRight size={16} className="text-surface-300 group-hover:text-brand-400 transition-colors" />
    </td>
  </tr>
);

// ─── Dashboard Page ───────────────────────────────────────────────────────────

const DashboardPage = () => {
  const user = useUser();

  const [disputes,        setDisputes]        = useState<Dispute[]>([]);
  const [total,           setTotal]           = useState(0);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [search,          setSearch]          = useState('');
  const [statusFilter,    setStatusFilter]    = useState('all');
  const [priorityFilter,  setPriorityFilter]  = useState('all');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  const loadDisputes = useCallback(async (showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        status:   statusFilter   !== 'all' ? statusFilter   : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        search:   search || undefined,
        limit: 100, offset: 0,
      };
      let res = await disputeService.myDisputes(params).catch(() => null);
      if (!res || res.items.length === 0) {
        res = await disputeService.list(params);
      }
      const detailed = await Promise.all(
        res.items.map((d) => disputeService.getDetail(d.dispute_id).catch(() => d))
      );
      setDisputes(detailed);
      setTotal(res.total);
      if (showToast) toast.success('Dashboard refreshed');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message ?? 'Failed to load disputes.');
      toast.error('Failed to load disputes');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  const stats = useMemo(() => ({
    total:    disputes.length,
    open:     disputes.filter((d) => d.status === 'OPEN').length,
    inReview: disputes.filter((d) => d.status === 'UNDER_REVIEW').length,
    resolved: disputes.filter((d) => d.status === 'RESOLVED').length,
  }), [disputes]);

  const filtered = useMemo(() => disputes.filter((d) => {
    const matchSearch =
      !search ||
      String(d.dispute_id).includes(search) ||
      d.customer_id.toLowerCase().includes(search.toLowerCase()) ||
      (d.dispute_type?.reason_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus   = statusFilter   === 'all' || d.status   === statusFilter;
    const matchPriority = priorityFilter === 'all' || d.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  }), [disputes, search, statusFilter, priorityFilter]);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'Associate'} 👋`}
        subtitle="Here's a summary of your assigned dispute tickets."
        action={
          <button onClick={() => loadDisputes(true)}
            className="p-2 rounded-xl hover:bg-surface-100 text-surface-400 transition-colors" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileText}     label="Total Disputes" value={stats.total}    color="bg-brand-500" />
        <StatCard icon={AlertCircle}  label="Open"           value={stats.open}     color="bg-red-500"   sub="Needs attention" />
        <StatCard icon={Clock}        label="Under Review"   value={stats.inReview} color="bg-amber-500" />
        <StatCard icon={CheckCircle2} label="Resolved"       value={stats.resolved} color="bg-green-500" />
      </div>

      <div className="card px-5 py-4 mb-6 flex items-center gap-3 bg-gradient-to-r from-brand-600 to-brand-700 border-0">
        <TrendingUp size={18} className="text-brand-200" />
        <span className="text-sm text-brand-100">Total disputes tracked:</span>
        <span className="font-display font-bold text-white text-lg">{total}</span>
        <span className="ml-auto text-xs text-brand-200">Click any row to view details &amp; documents</span>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => loadDisputes()} className="ml-auto text-xs text-red-500 font-medium hover:underline">Retry</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
          <input className="input-base pl-9 py-2 text-sm" placeholder="Search disputes, customers…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-surface-400" />
          <select className="input-base py-2 text-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <select className="input-base py-2 text-sm w-auto" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="all">All Priorities</option>
          {Object.entries(PRIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="text-xs text-surface-400 ml-auto">{filtered.length} of {disputes.length} disputes</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100">
                {['ID', 'Type / Customer', 'Status', 'Priority', 'Assigned To', 'Created', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr><td colSpan={7}><div className="flex justify-center py-16"><Loader2 size={24} className="text-brand-400 animate-spin" /></div></td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((d) => (
                  <DisputeRow key={d.dispute_id} dispute={d} onClick={() => setSelectedDispute(d)} />
                ))
              ) : (
                <tr><td colSpan={7}>
                  <EmptyState title="No disputes found" description={error ? 'Could not load disputes from the server.' : 'Try adjusting your search or filters.'} />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDispute && (
        <DisputeDrawer
          dispute={selectedDispute}
          onClose={() => setSelectedDispute(null)}
          onStatusUpdate={() => loadDisputes()}
        />
      )}
    </div>
  );
};

export default DashboardPage;
