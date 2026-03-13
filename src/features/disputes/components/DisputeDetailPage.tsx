import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Brain, MessageSquare, Paperclip, CheckCheck,
  Clock, HelpCircle, User2, CheckCircle2, Zap,
  ExternalLink, Download, AlertTriangle, Loader2,
  CircleDot, Hash, Calendar, CreditCard, Mail,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui';
import { LoadingSpinner, EmptyState } from '@/components/common';
import { formatDate } from '@/utils';
import axiosInstance from '@/lib/axios';
import clsx from 'clsx';
import {
  disputeService,
  Dispute,
  TimelineEpisode,
  AIAnalysis,
} from '../services/disputeService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenQuestion {
  question_id: number;
  question_text: string;
  status: 'PENDING' | 'ANSWERED' | 'EXPIRED';
  asked_at: string;
  answered_at: string | null;
}

interface SupportingDoc {
  attachment_id: number;
  file_name: string;
  file_type: string;
  file_url: string;
  uploaded_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open', UNDER_REVIEW: 'Under Review', RESOLVED: 'Resolved', CLOSED: 'Closed',
};

const statusVariant = (s: string): 'danger' | 'warning' | 'success' | 'default' =>
  ({ OPEN: 'danger', UNDER_REVIEW: 'warning', RESOLVED: 'success', CLOSED: 'default' } as const)[s as 'OPEN'] ?? 'default';

const priorityVariant = (p: string): 'danger' | 'warning' | 'info' | 'default' =>
  ({ HIGH: 'danger', MEDIUM: 'warning', LOW: 'info' } as const)[p as 'HIGH'] ?? 'default';

const episodeIcon = (actor: string) =>
  actor === 'CUSTOMER' ? MessageSquare : actor === 'AI' ? Brain : User2;

const episodeColors = (actor: string) =>
  actor === 'CUSTOMER'
    ? { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'text-blue-500', text: 'text-blue-700', spine: 'bg-blue-200' }
    : actor === 'AI'
    ? { bg: 'bg-violet-50', border: 'border-violet-100', icon: 'text-violet-500', text: 'text-violet-700', spine: 'bg-violet-200' }
    : { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-500', text: 'text-amber-700', spine: 'bg-amber-200' };

type PanelTab = 'overview' | 'documents' | 'timeline';

// ─── Sub-components ───────────────────────────────────────────────────────────

const DetailPill = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) => (
  <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-surface-100">
    <div className="w-8 h-8 rounded-lg bg-surface-50 border border-surface-100 flex items-center justify-center shrink-0">
      <Icon size={13} className="text-surface-400" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] text-surface-400 uppercase tracking-widest font-semibold">{label}</p>
      <p className="text-sm font-semibold text-surface-800 truncate">{value}</p>
    </div>
  </div>
);

const EpisodeItem = ({ ep, isLast }: { ep: TimelineEpisode; isLast: boolean }) => {
  const Icon   = episodeIcon(ep.actor);
  const c      = episodeColors(ep.actor);
  const label  =
    ep.actor === 'CUSTOMER' ? 'Customer Email' :
    ep.actor === 'AI' ? (ep.episode_type === 'AI_RESPONSE' ? 'AI Response · Auto-sent' : 'AI Acknowledgement') :
    'Associate Note';

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 ${c.bg} ${c.border}`}>
          <Icon size={14} className={c.icon} />
        </div>
        {!isLast && <div className={`w-0.5 flex-1 mt-2 ${c.spine} opacity-30`} />}
      </div>
      <div className={clsx('flex-1 min-w-0', !isLast && 'pb-5')}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-bold ${c.text}`}>{label}</span>
          <span className="text-[11px] text-surface-400">{formatDate(ep.created_at)}</span>
        </div>
        <div className={`text-sm text-surface-700 leading-relaxed rounded-xl px-4 py-3 border ${c.bg} ${c.border} whitespace-pre-wrap`}>
          {ep.content_text}
        </div>
      </div>
    </div>
  );
};

const DocItem = ({ doc }: { doc: SupportingDoc }) => {
  const ext = doc.file_name.split('.').pop()?.toUpperCase() ?? 'FILE';
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-surface-100 bg-white hover:border-brand-200 hover:shadow-sm transition-all group">
      <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
        <Paperclip size={15} className="text-brand-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-surface-800 truncate">{doc.file_name}</p>
        <p className="text-xs text-surface-400 mt-0.5">{formatDate(doc.uploaded_at)}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="info">{ext}</Badge>
        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
          className="p-1.5 rounded-lg hover:bg-brand-50 text-surface-400 hover:text-brand-500 transition-colors">
          <ExternalLink size={13} />
        </a>
        <a href={doc.file_url} download={doc.file_name}
          className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition-colors">
          <Download size={13} />
        </a>
      </div>
    </div>
  );
};

const QuestionItem = ({ q }: { q: OpenQuestion }) => (
  <div className={clsx(
    'rounded-xl border px-4 py-3.5 flex items-start gap-3',
    q.status === 'PENDING'  && 'bg-amber-50 border-amber-100',
    q.status === 'ANSWERED' && 'bg-green-50 border-green-100',
    q.status === 'EXPIRED'  && 'bg-surface-50 border-surface-100',
  )}>
    <div className="mt-0.5 shrink-0">
      {q.status === 'PENDING'  && <HelpCircle size={14} className="text-amber-500" />}
      {q.status === 'ANSWERED' && <CheckCircle2 size={14} className="text-green-500" />}
      {q.status === 'EXPIRED'  && <Clock size={14} className="text-surface-400" />}
    </div>
    <div className="flex-1 min-w-0">
      <p className={clsx('text-sm leading-relaxed',
        q.status === 'PENDING'  && 'text-amber-800',
        q.status === 'ANSWERED' && 'text-green-800',
        q.status === 'EXPIRED'  && 'text-surface-500',
      )}>{q.question_text}</p>
      <div className="flex items-center gap-3 mt-1.5">
        <span className={clsx('text-[11px] font-semibold uppercase tracking-wide',
          q.status === 'PENDING'  && 'text-amber-600',
          q.status === 'ANSWERED' && 'text-green-600',
          q.status === 'EXPIRED'  && 'text-surface-400',
        )}>{q.status}</span>
        <span className="text-[11px] text-surface-400">Asked {formatDate(q.asked_at)}</span>
        {q.answered_at && <span className="text-[11px] text-green-600">Answered {formatDate(q.answered_at)}</span>}
      </div>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const DisputeDetailPage = () => {
  const { disputeId } = useParams<{ disputeId: string }>();
  const navigate = useNavigate();
  const id = Number(disputeId);

  const [dispute,    setDispute]    = useState<Dispute | null>(null);
  const [analysis,   setAnalysis]   = useState<AIAnalysis | null>(null);
  const [episodes,   setEpisodes]   = useState<TimelineEpisode[]>([]);
  const [docs,       setDocs]       = useState<SupportingDoc[]>([]);
  const [questions,  setQuestions]  = useState<OpenQuestion[]>([]);
  const [activeTab,  setActiveTab]  = useState<PanelTab>('overview');
  const [loadingMain,setLoadingMain]= useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Load dispute + analysis on mount
  useEffect(() => {
    if (!id) return;
    setLoadingMain(true);
    Promise.all([
      disputeService.getDetail(id),
      axiosInstance.get<AIAnalysis>(`/dispute/api/v1/disputes/${id}/analysis`).then(r => r.data).catch(() => null),
      axiosInstance.get<OpenQuestion[]>(`/dispute/api/v1/disputes/${id}/open-questions`).then(r => r.data).catch(() => []),
    ]).then(([d, a, qs]) => {
      setDispute(d);
      setAnalysis(a ?? d.latest_analysis ?? null);
      setQuestions(qs);
    }).catch((e) => {
      setError(e?.message ?? 'Failed to load dispute.');
    }).finally(() => setLoadingMain(false));
  }, [id]);

  // Load tab-specific data
  useEffect(() => {
    if (!dispute) return;
    if (activeTab === 'timeline' && episodes.length === 0) {
      setLoadingTab(true);
      disputeService.getTimeline(id)
        .then(d => setEpisodes(d.timeline))
        .catch(() => setEpisodes([]))
        .finally(() => setLoadingTab(false));
    }
    if (activeTab === 'documents' && docs.length === 0 && dispute.email_id) {
      setLoadingTab(true);
      axiosInstance.get(`/dispute/api/v1/emails/${dispute.email_id}`)
        .then(({ data }) => {
          setDocs((data.attachments ?? []).map((a: { attachment_id: number; file_name: string; file_type: string; uploaded_at: string }) => ({
            attachment_id: a.attachment_id,
            file_name: a.file_name,
            file_type: a.file_type,
            file_url: `/dispute/api/v1/emails/attachments/${a.attachment_id}`,
            uploaded_at: a.uploaded_at,
          })));
        })
        .catch(() => setDocs([]))
        .finally(() => setLoadingTab(false));
    }
  }, [activeTab, dispute, id, episodes.length, docs.length]);

  const TABS: { id: PanelTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',   label: 'Overview',   icon: CircleDot    },
    { id: 'documents',  label: 'Documents',  icon: Paperclip    },
    { id: 'timeline',   label: 'Timeline',   icon: MessageSquare },
  ];

  const pendingQs = questions.filter(q => q.status === 'PENDING').length;

  if (loadingMain) return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="text-brand-400 animate-spin" />
        <p className="text-sm text-surface-400">Loading dispute…</p>
      </div>
    </div>
  );

  if (error || !dispute) return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="text-center">
        <AlertTriangle size={28} className="text-red-400 mx-auto mb-3" />
        <p className="text-sm text-surface-600">{error ?? 'Dispute not found.'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-brand-600 font-medium hover:underline flex items-center gap-1 mx-auto">
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto">

      {/* ── Back + breadcrumb ── */}
      <div className="flex items-center gap-2 mb-6 text-sm text-surface-400">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 hover:text-surface-700 transition-colors font-medium"
        >
          <ArrowLeft size={14} /> All Disputes
        </button>
        <ChevronRight size={12} className="text-surface-300" />
        <span className="text-surface-600 font-mono">#{dispute.dispute_id}</span>
      </div>

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-mono text-xs text-surface-400 bg-surface-100 px-2.5 py-1 rounded-lg">
              #{dispute.dispute_id}
            </span>
            <Badge variant={statusVariant(dispute.status)}>
              {STATUS_LABEL[dispute.status] ?? dispute.status}
            </Badge>
            <Badge variant={priorityVariant(dispute.priority)}>
              {dispute.priority} Priority
            </Badge>
            {analysis?.auto_response_generated && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-0.5">
                <CheckCheck size={10} /> Auto-responded
              </span>
            )}
            {analysis?.memory_context_used && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-0.5">
                <Zap size={10} /> Memory used
              </span>
            )}
          </div>
          <h1 className="text-2xl font-display font-bold text-surface-900 leading-tight">
            {dispute.dispute_type?.reason_name ?? 'Unknown Dispute Type'}
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            {dispute.customer_id} · Opened {formatDate(dispute.created_at)}
          </p>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex gap-6 items-start">

        {/* ── Left: metadata sidebar ── */}
        <div className="w-72 shrink-0 space-y-4">

          {/* Case details */}
          <div className="bg-white rounded-2xl border border-surface-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100">
              <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold">Case Details</p>
            </div>
            <div className="p-3 space-y-2">
              <DetailPill icon={Hash}       label="Dispute ID"   value={`#${dispute.dispute_id}`} />
              <DetailPill icon={User2}      label="Assigned To"  value={dispute.assigned_to ?? 'Unassigned'} />
              <DetailPill icon={Calendar}   label="Last Updated" value={formatDate(dispute.updated_at)} />
              {dispute.invoice_id && (
                <DetailPill icon={CreditCard} label="Invoice"    value={`INV-${dispute.invoice_id}`} />
              )}
              {dispute.payment_detail_id && (
                <DetailPill icon={CreditCard} label="Payments"   value={`${dispute.payment_detail_id} records`} />
              )}
              <DetailPill icon={Mail}       label="Email ID"     value={`#${dispute.email_id}`} />
            </div>
          </div>

          {/* Pending questions */}
          {pendingQs > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5 flex items-start gap-3">
              <HelpCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {pendingQs} pending question{pendingQs > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">Awaiting customer response</p>
              </div>
            </div>
          )}

          {/* AI confidence */}
          {analysis && (
            <div className="bg-white rounded-2xl border border-surface-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-100">
                <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold">AI Confidence</p>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-surface-500">{analysis.predicted_category}</span>
                  <span className="text-sm font-bold text-surface-800">{(analysis.confidence_score * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-surface-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
                    style={{ width: `${analysis.confidence_score * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: tabbed panels ── */}
        <div className="flex-1 min-w-0">
          {/* Tab bar */}
          <div className="flex border-b border-surface-100 mb-5 bg-white rounded-t-2xl overflow-hidden border border-b-0 border-surface-100">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={clsx(
                    'flex items-center gap-2 px-5 py-3.5 text-xs font-semibold border-b-2 transition-colors flex-1 justify-center',
                    active
                      ? 'border-brand-500 text-brand-600 bg-brand-50/50'
                      : 'border-transparent text-surface-400 hover:text-surface-700 hover:bg-surface-50'
                  )}
                >
                  <Icon size={13} />
                  {t.label}
                  {t.id === 'overview' && pendingQs > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center">
                      {pendingQs}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Panel body */}
          <div className="bg-white rounded-b-2xl rounded-tr-2xl border border-surface-100 p-5 min-h-[400px]">

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">

                {/* AI Summary as the main description */}
                <div>
                  <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold mb-2.