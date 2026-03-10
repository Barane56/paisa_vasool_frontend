import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, Filter, CheckCircle2, Clock, FileText,
  X, ChevronRight, Paperclip, Brain, MessageSquare, User2,
  RefreshCw, Loader2, AlertTriangle, HelpCircle, ExternalLink,
  Download, Zap, ShieldAlert, BarChart3, MessageCircle, Inbox,
  CheckCheck, CircleDot, ArrowUpRight, SlidersHorizontal, Hash,
} from 'lucide-react';
import { Badge } from '@/components/ui';
import { PageHeader, EmptyState, LoadingSpinner } from '@/components/common';
import { formatDate } from '@/utils';
import axiosInstance from '@/lib/axios';
import {
  disputeService,
  Dispute,
  TimelineEpisode,
  AIAnalysis,
} from '../services/disputeService';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

// Defined locally so this page is not coupled to whatever the service exports
interface SupportingDoc {
  attachment_id: number;
  file_name: string;
  file_type: string;
  file_url: string;
  uploaded_at: string;
}

interface OpenQuestion {
  question_id: number;
  question_text: string;
  status: 'PENDING' | 'ANSWERED' | 'EXPIRED';
  asked_at: string;
  answered_at: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  OPEN:         'Open',
  UNDER_REVIEW: 'Under Review',
  RESOLVED:     'Resolved',
  CLOSED:       'Closed',
};

const STATUS_FILTERS = ['all', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'] as const;
const PRIORITY_FILTERS = ['all', 'HIGH', 'MEDIUM', 'LOW'] as const;

const statusVariant = (s: string): 'danger' | 'warning' | 'success' | 'default' =>
  ({ OPEN: 'danger', UNDER_REVIEW: 'warning', RESOLVED: 'success', CLOSED: 'default' } as const)[s as 'OPEN'] ?? 'default';

const priorityVariant = (p: string): 'danger' | 'warning' | 'info' | 'default' =>
  ({ HIGH: 'danger', MEDIUM: 'warning', LOW: 'info' } as const)[p as 'HIGH'] ?? 'default';

const priorityDot = (p: string) =>
  ({ HIGH: 'bg-red-500', MEDIUM: 'bg-amber-400', LOW: 'bg-blue-400' } as const)[p] ?? 'bg-surface-300';

const episodeIcon = (actor: string) =>
  actor === 'CUSTOMER' ? MessageSquare : actor === 'AI' ? Brain : User2;

const episodeColor = (actor: string) =>
  actor === 'CUSTOMER'
    ? { bg: 'bg-blue-50', icon: 'text-blue-500', border: 'border-blue-100', text: 'text-blue-700' }
    : actor === 'AI'
    ? { bg: 'bg-purple-50', icon: 'text-purple-500', border: 'border-purple-100', text: 'text-purple-700' }
    : { bg: 'bg-amber-50', icon: 'text-amber-500', border: 'border-amber-100', text: 'text-amber-700' };

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard = ({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType; label: string; value: number; sub?: string; accent: string;
}) => (
  <div className="card p-5 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${accent}`}>
      <Icon size={18} className="text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] text-surface-400 font-medium uppercase tracking-widest truncate">{label}</p>
      <p className="font-display text-2xl font-bold text-surface-900 leading-none mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-surface-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── AI Response Block ────────────────────────────────────────────────────────

const AIResponseBlock = ({ analysis }: { analysis: AIAnalysis }) => (
  <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white overflow-hidden">
    {/* Header */}
    <div className="px-4 py-3 border-b border-purple-100 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
          <Brain size={12} className="text-purple-600" />
        </div>
        <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">AI Analysis</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-purple-500">{(analysis.confidence_score * 100).toFixed(0)}% confidence</span>
        {analysis.auto_response_generated && (
          <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
            <CheckCheck size={10} /> Auto-sent
          </span>
        )}
        {analysis.memory_context_used && (
          <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
            <Zap size={10} /> Memory used
          </span>
        )}
      </div>
    </div>

    <div className="p-4 space-y-4">
      {/* Category + summary */}
      <div>
        <p className="text-[11px] text-surface-400 uppercase tracking-widest font-medium mb-1">Category</p>
        <p className="text-sm font-semibold text-purple-800">{analysis.predicted_category}</p>
      </div>

      <div>
        <p className="text-[11px] text-surface-400 uppercase tracking-widest font-medium mb-1.5">Summary</p>
        <p className="text-sm text-surface-700 leading-relaxed bg-white/70 rounded-xl px-3 py-2.5 border border-purple-100">
          {analysis.ai_summary}
        </p>
      </div>

      {/* Response sent to customer */}
      {analysis.ai_response && (
        <div>
          <p className="text-[11px] text-surface-400 uppercase tracking-widest font-medium mb-1.5 flex items-center gap-1.5">
            <MessageCircle size={11} /> Response Sent to Customer
          </p>
          <div className="bg-white border border-purple-100 rounded-xl px-3 py-2.5 relative">
            <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-purple-300 rounded-r-full ml-0" />
            <p className="text-sm text-surface-800 leading-relaxed pl-3">
              {analysis.ai_response}
            </p>
          </div>
          <p className="text-[11px] text-surface-400 mt-1.5 flex items-center gap-1">
            <ArrowUpRight size={10} />
            {analysis.auto_response_generated
              ? 'This response was automatically sent to the customer.'
              : 'This response was drafted but not auto-sent — pending FA review.'}
          </p>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-[11px] text-surface-400">Analysed {formatDate(analysis.created_at)}</p>
    </div>
  </div>
);

// ─── Open Questions ───────────────────────────────────────────────────────────

const OpenQuestionsBlock = ({ questions }: { questions: OpenQuestion[] }) => {
  if (!questions.length) return (
    <div className="flex items-center gap-3 bg-surface-50 rounded-xl px-4 py-3 border border-surface-100">
      <CheckCircle2 size={15} className="text-green-400 shrink-0" />
      <p className="text-sm text-surface-500">No open questions for this dispute.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {questions.map((q) => (
        <div
          key={q.question_id}
          className={clsx(
            'rounded-xl border px-4 py-3 flex items-start gap-3',
            q.status === 'PENDING'  && 'bg-amber-50 border-amber-100',
            q.status === 'ANSWERED' && 'bg-green-50 border-green-100',
            q.status === 'EXPIRED'  && 'bg-surface-50 border-surface-100',
          )}
        >
          <div className="mt-0.5 shrink-0">
            {q.status === 'PENDING'  && <HelpCircle size={14} className="text-amber-500" />}
            {q.status === 'ANSWERED' && <CheckCircle2 size={14} className="text-green-500" />}
            {q.status === 'EXPIRED'  && <Clock size={14} className="text-surface-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={clsx(
              'text-sm leading-relaxed',
              q.status === 'PENDING'  && 'text-amber-800',
              q.status === 'ANSWERED' && 'text-green-800',
              q.status === 'EXPIRED'  && 'text-surface-500',
            )}>
              {q.question_text}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className={clsx(
                'text-[11px] font-medium',
                q.status === 'PENDING'  && 'text-amber-600',
                q.status === 'ANSWERED' && 'text-green-600',
                q.status === 'EXPIRED'  && 'text-surface-400',
              )}>
                {q.status}
              </span>
              <span className="text-[11px] text-surface-400">Asked {formatDate(q.asked_at)}</span>
              {q.answered_at && (
                <span className="text-[11px] text-green-600">Answered {formatDate(q.answered_at)}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Timeline episode ─────────────────────────────────────────────────────────

const EpisodeItem = ({ ep, isLast }: { ep: TimelineEpisode; isLast: boolean }) => {
  const Icon   = episodeIcon(ep.actor);
  const colors = episodeColor(ep.actor);
  const label  =
    ep.actor === 'CUSTOMER' ? 'Customer Email' :
    ep.actor === 'AI'       ? ep.episode_type === 'AI_RESPONSE' ? 'AI Response (Auto-sent)' : 'AI Acknowledgement' :
    'Associate Note';

  return (
    <div className="flex gap-3">
      {/* Spine */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${colors.bg} ${colors.border}`}>
          <Icon size={13} className={colors.icon} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-surface-100 mt-1.5" />}
      </div>

      {/* Content */}
      <div className={clsx('flex-1 min-w-0', !isLast && 'pb-4')}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-xs font-semibold ${colors.text}`}>{label}</span>
          <span className="text-[11px] text-surface-400">{formatDate(ep.created_at)}</span>
        </div>
        <div className={`text-sm text-surface-700 leading-relaxed rounded-xl px-3 py-2.5 border ${colors.bg} ${colors.border} whitespace-pre-wrap`}>
          {ep.content_text}
        </div>
      </div>
    </div>
  );
};

// ─── Supporting Doc ───────────────────────────────────────────────────────────

const DocItem = ({ doc }: { doc: SupportingDoc }) => {
  const ext = doc.file_name.split('.').pop()?.toUpperCase() ?? 'FILE';
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-surface-100 bg-surface-50 hover:bg-white hover:border-surface-200 transition-all group">
      <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
        <Paperclip size={14} className="text-brand-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-800 truncate" title={doc.file_name}>
          {doc.file_name}
        </p>
        <p className="text-[11px] text-surface-400">{formatDate(doc.uploaded_at)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
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

// ─── Dispute Detail Drawer ────────────────────────────────────────────────────

type DrawerTab = 'overview' | 'response' | 'timeline' | 'docs';

const DisputeDrawer = ({
  dispute,
  onClose,
}: {
  dispute: Dispute;
  onClose: () => void;
}) => {
  const [tab,           setTab]           = useState<DrawerTab>('overview');
  const [docs,          setDocs]          = useState<SupportingDoc[]>([]);
  const [episodes,      setEpisodes]      = useState<TimelineEpisode[]>([]);
  const [analysis,      setAnalysis]      = useState<AIAnalysis | null>(dispute.latest_analysis ?? null);
  const [questions,     setQuestions]     = useState<OpenQuestion[]>([]);
  const [loadingDocs,   setLoadingDocs]   = useState(false);
  const [loadingEps,    setLoadingEps]    = useState(false);
  const [loadingQs,     setLoadingQs]     = useState(false);

  // Load docs — call the emails endpoint directly to avoid coupling to service shape
  useEffect(() => {
    if (tab === 'docs' && dispute.email_id) {
      setLoadingDocs(true);
      axiosInstance
        .get(`/dispute/api/v1/emails/${dispute.email_id}`)
        .then(({ data }) => {
          const mapped: SupportingDoc[] = (data.attachments ?? []).map((a: {
            attachment_id: number; file_name: string; file_type: string; uploaded_at: string;
          }) => ({
            attachment_id: a.attachment_id,
            file_name:     a.file_name,
            file_type:     a.file_type,
            file_url:      `/dispute/api/v1/emails/attachments/${a.attachment_id}`,
            uploaded_at:   a.uploaded_at,
          }));
          setDocs(mapped);
        })
        .catch(() => setDocs([]))
        .finally(() => setLoadingDocs(false));
    }
  }, [tab, dispute.email_id]);

  // Load timeline
  useEffect(() => {
    if (tab === 'timeline') {
      setLoadingEps(true);
      disputeService.getTimeline(dispute.dispute_id)
        .then((d) => setEpisodes(d.timeline)).catch(() => setEpisodes([]))
        .finally(() => setLoadingEps(false));
    }
  }, [tab, dispute.dispute_id]);

  // Load AI analysis + open questions when response tab opens
  useEffect(() => {
    if (tab === 'response') {
      if (!analysis) {
        axiosInstance
          .get<AIAnalysis>(`/dispute/api/v1/disputes/${dispute.dispute_id}/analysis`)
          .then(({ data }) => setAnalysis(data))
          .catch(() => {});
      }
      setLoadingQs(true);
      // Fetch open questions — cookies sent automatically via axiosInstance (withCredentials)
      axiosInstance
        .get<OpenQuestion[]>(`/dispute/api/v1/disputes/${dispute.dispute_id}/open-questions`)
        .then(({ data }) => setQuestions(data))
        .catch(() => setQuestions([]))
        .finally(() => setLoadingQs(false));
    }
  }, [tab, dispute.dispute_id, analysis]);

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const TABS: { id: DrawerTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Overview',   icon: CircleDot    },
    { id: 'response',  label: 'AI Response', icon: Brain        },
    { id: 'timeline',  label: 'Timeline',   icon: MessageSquare },
    { id: 'docs',      label: 'Documents',  icon: Paperclip    },
  ];

  const pendingQs = questions.filter((q) => q.status === 'PENDING').length;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-6 py-5 border-b border-surface-100 shrink-0 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-mono text-xs text-surface-400 bg-surface-100 px-2 py-0.5 rounded-lg">
                  #{dispute.dispute_id}
                </span>
                <Badge variant={statusVariant(dispute.status)}>
                  {STATUS_LABEL[dispute.status] ?? dispute.status}
                </Badge>
                <Badge variant={priorityVariant(dispute.priority)}>{dispute.priority}</Badge>
                {dispute.latest_analysis?.auto_response_generated && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
                    <CheckCheck size={9} /> Auto-responded
                  </span>
                )}
              </div>
              <h2 className="font-display font-bold text-surface-900 text-lg leading-snug truncate">
                {dispute.dispute_type?.reason_name ?? 'Unknown Dispute Type'}
              </h2>
              <p className="text-xs text-surface-400 mt-0.5">
                Customer: <span className="font-medium text-surface-600">{dispute.customer_id}</span>
                {dispute.assigned_to && (
                  <> · Assigned: <span className="font-medium text-surface-600">{dispute.assigned_to}</span></>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-surface-100 text-surface-400 transition-colors shrink-0 mt-0.5"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-100 px-6 shrink-0 bg-white">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-1.5 py-3 px-1 mr-5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-surface-400 hover:text-surface-700'
                )}
              >
                <Icon size={12} />
                {t.label}
                {t.id === 'response' && pendingQs > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                    {pendingQs}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-surface-50">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Description */}
              <div>
                <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold mb-2">Description</p>
                <p className="text-sm text-surface-700 leading-relaxed bg-white rounded-xl px-4 py-3 border border-surface-100">
                  {dispute.description || 'No description provided.'}
                </p>
              </div>

              {/* Detail grid */}
              <div>
                <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold mb-3">Dispute Details</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Invoice ID',   value: dispute.invoice_id        ? `#${dispute.invoice_id}`        : null },
                    { label: 'Payment ID',   value: dispute.payment_detail_id ? `#${dispute.payment_detail_id}` : null },
                    { label: 'Email ID',     value: `#${dispute.email_id}` },
                    { label: 'Assigned To',  value: dispute.assigned_to       ?? 'Unassigned' },
                    { label: 'Created',      value: formatDate(dispute.created_at) },
                    { label: 'Last Updated', value: formatDate(dispute.updated_at) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-xl p-3 border border-surface-100">
                      <p className="text-[10px] text-surface-400 uppercase tracking-widest font-medium mb-1">{label}</p>
                      <p className="text-sm font-semibold text-surface-800">
                        {value ?? <span className="text-surface-300 font-normal italic">—</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Summary quick view */}
              {dispute.latest_analysis && (
                <div>
                  <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                    <Brain size={11} /> AI Summary
                  </p>
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3.5 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-purple-800 leading-relaxed">
                        {dispute.latest_analysis.ai_summary}
                      </p>
                      <button
                        onClick={() => setTab('response')}
                        className="mt-2 text-[11px] text-purple-600 font-semibold hover:text-purple-800 flex items-center gap-1 transition-colors"
                      >
                        View full AI response <ChevronRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending questions banner */}
              {!!dispute.open_questions_count && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <HelpCircle size={15} className="text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">{dispute.open_questions_count} pending question{dispute.open_questions_count > 1 ? 's' : ''}</span>{' '}
                    awaiting customer response.
                  </p>
                  <button
                    onClick={() => setTab('response')}
                    className="ml-auto text-xs text-amber-600 font-semibold hover:underline shrink-0"
                  >
                    View
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── AI RESPONSE ── */}
          {tab === 'response' && (
            <div className="space-y-5">
              {analysis ? (
                <AIResponseBlock analysis={analysis} />
              ) : (
                <div className="flex justify-center py-10">
                  <LoadingSpinner />
                </div>
              )}

              {/* Open Questions */}
              <div>
                <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold mb-3 flex items-center gap-1.5">
                  <HelpCircle size={11} /> Questions Asked to Customer
                </p>
                {loadingQs ? (
                  <div className="flex justify-center py-6">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <OpenQuestionsBlock questions={questions} />
                )}
              </div>
            </div>
          )}

          {/* ── TIMELINE ── */}
          {tab === 'timeline' && (
            <div>
              <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold mb-4 flex items-center gap-1.5">
                <MessageSquare size={11} /> Conversation Timeline
              </p>
              {loadingEps ? (
                <div className="flex justify-center py-10">
                  <LoadingSpinner />
                </div>
              ) : episodes.length > 0 ? (
                <div>
                  {episodes.map((ep, i) => (
                    <EpisodeItem key={ep.episode_id} ep={ep} isLast={i === episodes.length - 1} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<MessageSquare size={28} />}
                  title="No episodes yet"
                  description="Conversation episodes will appear here as the dispute progresses."
                />
              )}
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {tab === 'docs' && (
            <div>
              <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold mb-3 flex items-center gap-1.5">
                <Paperclip size={11} /> Supporting Documents
              </p>
              {loadingDocs ? (
                <div className="flex justify-center py-10">
                  <LoadingSpinner />
                </div>
              ) : docs.length > 0 ? (
                <div className="space-y-2">
                  {docs.map((d) => <DocItem key={d.attachment_id} doc={d} />)}
                </div>
              ) : (
                <EmptyState
                  icon={<Paperclip size={28} />}
                  title="No documents"
                  description="No supporting documents were attached to this dispute's email."
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Dispute Row ──────────────────────────────────────────────────────────────

const DisputeRow = ({
  dispute,
  onClick,
}: {
  dispute: Dispute;
  onClick: () => void;
}) => (
  <tr
    className="group hover:bg-surface-50/80 transition-colors duration-100 cursor-pointer"
    onClick={onClick}
  >
    {/* ID */}
    <td className="px-5 py-3.5 whitespace-nowrap">
      <span className="font-mono text-xs text-surface-400 bg-surface-100 group-hover:bg-white px-2 py-0.5 rounded-lg transition-colors">
        #{dispute.dispute_id}
      </span>
    </td>

    {/* Type / Customer */}
    <td className="px-5 py-3.5 max-w-[220px]">
      <p className="text-sm font-semibold text-surface-900 truncate">
        {dispute.dispute_type?.reason_name ?? 'Unknown'}
      </p>
      <p className="text-xs text-surface-400 truncate mt-0.5">{dispute.customer_id}</p>
    </td>

    {/* Status */}
    <td className="px-5 py-3.5 whitespace-nowrap">
      <Badge variant={statusVariant(dispute.status)}>
        {STATUS_LABEL[dispute.status] ?? dispute.status}
      </Badge>
    </td>

    {/* Priority */}
    <td className="px-5 py-3.5 whitespace-nowrap">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDot(dispute.priority)}`} />
        <span className="text-xs font-medium text-surface-700">{dispute.priority}</span>
      </div>
    </td>

    {/* AI Response */}
    <td className="px-5 py-3.5 whitespace-nowrap">
      {dispute.latest_analysis?.auto_response_generated ? (
        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 font-medium">
          <CheckCheck size={10} /> Sent
        </span>
      ) : dispute.latest_analysis ? (
        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 font-medium">
          <Clock size={10} /> Pending FA
        </span>
      ) : (
        <span className="text-xs text-surface-300 italic">—</span>
      )}
    </td>

    {/* Pending Qs */}
    <td className="px-5 py-3.5 whitespace-nowrap">
      {!!dispute.open_questions_count && dispute.open_questions_count > 0 ? (
        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 font-medium">
          <HelpCircle size={10} /> {dispute.open_questions_count}
        </span>
      ) : (
        <span className="text-xs text-surface-300">—</span>
      )}
    </td>

    {/* Created */}
    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-surface-400">
      {formatDate(dispute.created_at)}
    </td>

    {/* Arrow */}
    <td className="px-5 py-3.5 whitespace-nowrap">
      <ChevronRight size={15} className="text-surface-300 group-hover:text-brand-400 transition-colors" />
    </td>
  </tr>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const DisputesPage = () => {
  const [disputes,         setDisputes]         = useState<Dispute[]>([]);
  const [total,            setTotal]            = useState(0);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [selectedDispute,  setSelectedDispute]  = useState<Dispute | null>(null);

  // Filters
  const [search,           setSearch]           = useState('');
  const [statusFilter,     setStatusFilter]     = useState<string>('all');
  const [priorityFilter,   setPriorityFilter]   = useState<string>('all');
  const [showFilters,      setShowFilters]       = useState(false);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load all disputes (not just "my") — this is the all-disputes view
      const res = await disputeService.list({ limit: 100, offset: 0 });

      // Hydrate with detail (latest_analysis, open_questions_count)
      const detailed = await Promise.allSettled(
        res.items.map((d) => disputeService.getDetail(d.dispute_id))
      );
      const hydrated = detailed.map((result, i) =>
        result.status === 'fulfilled' ? result.value : res.items[i]
      );

      setDisputes(hydrated);
      setTotal(res.total);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message ?? 'Failed to load disputes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  const stats = useMemo(() => ({
    total:      disputes.length,
    open:       disputes.filter((d) => d.status === 'OPEN').length,
    inReview:   disputes.filter((d) => d.status === 'UNDER_REVIEW').length,
    resolved:   disputes.filter((d) => ['RESOLVED', 'CLOSED'].includes(d.status)).length,
    autoSent:   disputes.filter((d) => d.latest_analysis?.auto_response_generated).length,
  }), [disputes]);

  const filtered = useMemo(() => disputes.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      String(d.dispute_id).includes(q) ||
      d.customer_id.toLowerCase().includes(q) ||
      (d.dispute_type?.reason_name ?? '').toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q);
    const matchStatus   = statusFilter   === 'all' || d.status   === statusFilter;
    const matchPriority = priorityFilter === 'all' || d.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  }), [disputes, search, statusFilter, priorityFilter]);

  const activeFilterCount = [statusFilter, priorityFilter].filter((f) => f !== 'all').length;

  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="All Disputes"
        subtitle={`${total} total disputes across all customers`}
        action={
          <button
            onClick={loadDisputes}
            className="p-2 rounded-xl hover:bg-surface-100 text-surface-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Inbox}        label="Total"        value={stats.total}    accent="bg-brand-500" />
        <StatCard icon={ShieldAlert}  label="Open"         value={stats.open}     accent="bg-red-500"   sub="Needs attention" />
        <StatCard icon={Clock}        label="Under Review" value={stats.inReview} accent="bg-amber-500" />
        <StatCard icon={CheckCircle2} label="Resolved"     value={stats.resolved} accent="bg-green-500" />
        <StatCard icon={Zap}          label="Auto-Responded" value={stats.autoSent} accent="bg-purple-500" sub="AI handled" />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={loadDisputes} className="ml-auto text-xs text-red-500 font-medium hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
          <input
            className="input-base pl-9 py-2 text-sm"
            placeholder="Search by ID, customer, type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors',
            showFilters || activeFilterCount > 0
              ? 'bg-brand-50 border-brand-200 text-brand-700'
              : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'
          )}
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        <span className="text-xs text-surface-400 ml-auto">
          {filtered.length} of {disputes.length} disputes
        </span>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-surface-50 rounded-xl border border-surface-100">
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-surface-400" />
            <span className="text-xs text-surface-500 font-medium">Status:</span>
            <div className="flex gap-1.5">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    statusFilter === s
                      ? 'bg-brand-600 text-white'
                      : 'bg-white border border-surface-200 text-surface-600 hover:border-brand-300'
                  )}
                >
                  {s === 'all' ? 'All' : STATUS_LABEL[s] ?? s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BarChart3 size={13} className="text-surface-400" />
            <span className="text-xs text-surface-500 font-medium">Priority:</span>
            <div className="flex gap-1.5">
              {PRIORITY_FILTERS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                    priorityFilter === p
                      ? 'bg-brand-600 text-white'
                      : 'bg-white border border-surface-200 text-surface-600 hover:border-brand-300'
                  )}
                >
                  {p !== 'all' && <div className={`w-1.5 h-1.5 rounded-full ${priorityDot(p)}`} />}
                  {p === 'all' ? 'All' : p}
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); }}
              className="ml-auto flex items-center gap-1 text-xs text-surface-400 hover:text-red-500 transition-colors"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50/50">
                {[
                  { label: 'ID',          icon: Hash         },
                  { label: 'Type / Customer' },
                  { label: 'Status'       },
                  { label: 'Priority'     },
                  { label: 'AI Response', icon: Brain        },
                  { label: 'Open Qs',     icon: HelpCircle   },
                  { label: 'Created'      },
                  { label: ''             },
                ].map(({ label, icon: Icon }) => (
                  <th key={label} className="px-5 py-3 text-left text-[11px] font-semibold text-surface-400 uppercase tracking-widest whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      {Icon && <Icon size={11} />}
                      {label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex justify-center py-20">
                      <Loader2 size={24} className="text-brand-400 animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((d) => (
                  <DisputeRow
                    key={d.dispute_id}
                    dispute={d}
                    onClick={() => setSelectedDispute(d)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={<FileText size={28} />}
                      title="No disputes found"
                      description={error ? 'Could not load disputes from the server.' : 'Try adjusting your search or filters.'}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-surface-100 bg-surface-50/50 flex items-center justify-between">
            <p className="text-xs text-surface-400">
              Showing {filtered.length} of {total} disputes
            </p>
            <p className="text-xs text-surface-400">
              Click any row to view full details, AI response & timeline
            </p>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedDispute && (
        <DisputeDrawer
          dispute={selectedDispute}
          onClose={() => setSelectedDispute(null)}
        />
      )}
    </div>
  );
};

export default DisputesPage;