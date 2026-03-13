import { useEffect, useCallback, useRef, useState } from 'react';
import {
  Search, Filter, CheckCircle2, Clock, FileText,
  X, ChevronRight, Paperclip, Brain, MessageSquare, User2,
  RefreshCw, Loader2, AlertTriangle, HelpCircle, ExternalLink,
  Download, Zap, ShieldAlert, BarChart3, MessageCircle, Inbox,
  CheckCheck, CircleDot, ArrowLeft, SlidersHorizontal, Hash,
  Calendar, Mail, CreditCard, TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui';
import { PageHeader, EmptyState, LoadingSpinner } from '@/components/common';
import { formatDate } from '@/utils';
import axiosInstance from '@/lib/axios';
import { useDisputes } from '../hooks/useDisputes';
import { fetchDisputes } from '../slices/disputeSlice';
import { useAppDispatch } from '@/hooks';
import {
  disputeService,
  Dispute,
  TimelineEpisode,
  AIAnalysis,
} from '../services/disputeService';
import clsx from 'clsx';

// ─── Local types ──────────────────────────────────────────────────────────────

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
  OPEN: 'Open', UNDER_REVIEW: 'Under Review', RESOLVED: 'Resolved', CLOSED: 'Closed',
};
const STATUS_FILTERS  = ['all', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'] as const;
const PRIORITY_FILTERS = ['all', 'HIGH', 'MEDIUM', 'LOW'] as const;

const statusVariant = (s: string): 'danger' | 'warning' | 'success' | 'default' =>
  ({ OPEN: 'danger', UNDER_REVIEW: 'warning', RESOLVED: 'success', CLOSED: 'default' } as const)[s as 'OPEN'] ?? 'default';

const priorityVariant = (p: string): 'danger' | 'warning' | 'info' | 'default' =>
  ({ HIGH: 'danger', MEDIUM: 'warning', LOW: 'info' } as const)[p as 'HIGH'] ?? 'default';

const priorityDot = (p: string) =>
  ({ HIGH: 'bg-red-500', MEDIUM: 'bg-amber-400', LOW: 'bg-blue-400' } as const)[p] ?? 'bg-surface-300';

const episodeIcon = (actor: string) =>
  actor === 'CUSTOMER' ? MessageSquare : actor === 'AI' ? Brain : User2;

const episodeColors = (actor: string) =>
  actor === 'CUSTOMER'
    ? { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'text-blue-500', text: 'text-blue-700', spine: 'bg-blue-200' }
    : actor === 'AI'
    ? { bg: 'bg-violet-50', border: 'border-violet-100', icon: 'text-violet-500', text: 'text-violet-700', spine: 'bg-violet-200' }
    : { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-500', text: 'text-amber-700', spine: 'bg-amber-200' };

type ModalTab = 'overview' | 'documents' | 'timeline';

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, accent }: {
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

// ─── Timeline episode ─────────────────────────────────────────────────────────

const EpisodeItem = ({ ep, isLast }: { ep: TimelineEpisode; isLast: boolean }) => {
  const Icon = episodeIcon(ep.actor);
  const c    = episodeColors(ep.actor);
  const label =
    ep.actor === 'CUSTOMER' ? 'Customer Email' :
    ep.actor === 'AI'       ? (ep.episode_type === 'AI_RESPONSE' ? 'AI Response · Auto-sent' : 'AI Acknowledgement') :
    'Associate Note';

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 ${c.bg} ${c.border}`}>
          <Icon size={14} className={c.icon} />
        </div>
        {!isLast && <div className={`w-0.5 flex-1 mt-2 opacity-30 ${c.spine}`} />}
      </div>
      <div className={clsx('flex-1 min-w-0', !isLast && 'pb-5')}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-bold ${c.text}`}>{label}</span>
          <span className="text-[11px] text-surface-400">{formatDate(ep.created_at)}</span>
        </div>
        <div className={`text-sm text-surface-700 leading-relaxed rounded-xl px-4 py-3 border whitespace-pre-wrap ${c.bg} ${c.border}`}>
          {ep.content_text}
        </div>
      </div>
    </div>
  );
};

// ─── Doc item ─────────────────────────────────────────────────────────────────

const DocItem = ({ doc }: { doc: SupportingDoc }) => {
  const ext = doc.file_name.split('.').pop()?.toUpperCase() ?? 'FILE';
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-surface-100 bg-white hover:border-brand-200 hover:shadow-sm transition-all">
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

// ─── Open question ────────────────────────────────────────────────────────────

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

// ─── Metadata pill ────────────────────────────────────────────────────────────

const MetaPill = ({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: React.ReactNode;
}) => (
  <div className="flex items-center gap-3 px-4 py-3 bg-surface-50 rounded-xl border border-surface-100">
    <div className="w-7 h-7 rounded-lg bg-white border border-surface-100 flex items-center justify-center shrink-0">
      <Icon size={12} className="text-surface-400" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] text-surface-400 uppercase tracking-widest font-semibold">{label}</p>
      <p className="text-sm font-semibold text-surface-800 truncate leading-tight mt-0.5">{value}</p>
    </div>
  </div>
);

// ─── Dispute Detail Modal ─────────────────────────────────────────────────────

const DisputeModal = ({ dispute, onClose }: { dispute: Dispute; onClose: () => void }) => {
  const [tab,          setTab]          = useState<ModalTab>('overview');
  const [analysis,     setAnalysis]     = useState<AIAnalysis | null>(dispute.latest_analysis ?? null);
  const [questions,    setQuestions]    = useState<OpenQuestion[]>([]);
  const [episodes,     setEpisodes]     = useState<TimelineEpisode[]>([]);
  const [docs,         setDocs]         = useState<SupportingDoc[]>([]);
  const [loadingInit,  setLoadingInit]  = useState(true);
  const [loadingTab,   setLoadingTab]   = useState(false);
  const episodesLoaded = useRef(false);
  const docsLoaded     = useRef(false);

  // Load analysis + questions on mount
  useEffect(() => {
    Promise.all([
      analysis
        ? Promise.resolve(analysis)
        : axiosInstance.get<AIAnalysis>(`/dispute/api/v1/disputes/${dispute.dispute_id}/analysis`)
            .then(r => r.data).catch(() => null),
      axiosInstance.get<OpenQuestion[]>(`/dispute/api/v1/disputes/${dispute.dispute_id}/open-questions`)
        .then(r => r.data).catch(() => []),
    ]).then(([a, qs]) => {
      if (a) setAnalysis(a);
      setQuestions(qs);
    }).finally(() => setLoadingInit(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispute.dispute_id]);

  // Load tab data lazily
  useEffect(() => {
    if (tab === 'timeline' && !episodesLoaded.current) {
      episodesLoaded.current = true;
      setLoadingTab(true);
      disputeService.getTimeline(dispute.dispute_id)
        .then(d => setEpisodes(d.timeline))
        .catch(() => setEpisodes([]))
        .finally(() => setLoadingTab(false));
    }
    if (tab === 'documents' && !docsLoaded.current && dispute.email_id) {
      docsLoaded.current = true;
      setLoadingTab(true);
      axiosInstance.get(`/dispute/api/v1/emails/${dispute.email_id}`)
        .then(({ data }) => setDocs((data.attachments ?? []).map((a: {
          attachment_id: number; file_name: string; file_type: string; uploaded_at: string;
        }) => ({
          attachment_id: a.attachment_id,
          file_name:     a.file_name,
          file_type:     a.file_type,
          file_url:      `/dispute/api/v1/emails/attachments/${a.attachment_id}`,
          uploaded_at:   a.uploaded_at,
        }))))
        .catch(() => setDocs([]))
        .finally(() => setLoadingTab(false));
    }
  }, [tab, dispute.dispute_id, dispute.email_id]);

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const pendingQs = questions.filter(q => q.status === 'PENDING').length;

  const TABS: { id: ModalTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Overview',  icon: CircleDot     },
    { id: 'documents', label: 'Documents', icon: Paperclip     },
    { id: 'timeline',  label: 'Timeline',  icon: MessageSquare },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — large centered panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl"
          style={{ height: 'min(88vh, 820px)' }}
          onClick={e => e.stopPropagation()}
        >

          {/* ── Modal header ── */}
          <div className="px-6 py-5 border-b border-surface-100 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
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
                <h2 className="text-xl font-display font-bold text-surface-900 leading-snug">
                  {dispute.dispute_type?.reason_name ?? 'Unknown Dispute Type'}
                </h2>
                <p className="text-xs text-surface-400 mt-0.5">
                  {dispute.customer_id} · Opened {formatDate(dispute.created_at)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-surface-100 text-surface-400 transition-colors shrink-0 mt-0.5"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab bar inside header */}
            <div className="flex gap-0 mt-4 -mb-5 border-b-0">
              {TABS.map(t => {
                const Icon   = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={clsx(
                      'flex items-center gap-1.5 py-2.5 px-4 mr-1 text-xs font-semibold border-b-2 transition-colors rounded-t-lg whitespace-nowrap',
                      active
                        ? 'border-brand-500 text-brand-600 bg-brand-50/60'
                        : 'border-transparent text-surface-400 hover:text-surface-700 hover:bg-surface-50'
                    )}
                  >
                    <Icon size={12} />
                    {t.label}
                    {t.id === 'overview' && pendingQs > 0 && (
                      <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold">
                        {pendingQs}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Modal body ── */}
          <div className="flex-1 overflow-hidden flex">

            {/* ── OVERVIEW ── */}
            {tab === 'overview' && (
              <div className="flex-1 flex gap-0 overflow-hidden">

                {/* Left: AI analysis — main content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                  {loadingInit ? (
                    <div className="flex justify-center py-16"><LoadingSpinner /></div>
                  ) : analysis ? (
                    <>
                      {/* AI Summary — the primary description */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
                            <Brain size={12} className="text-violet-600" />
                          </div>
                          <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold">AI Analysis</p>
                          <div className="ml-auto flex items-center gap-2">
                            <span className="text-[11px] text-violet-500 font-medium">
                              {(analysis.confidence_score * 100).toFixed(0)}% confidence
                            </span>
                            {analysis.auto_response_generated && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
                                <CheckCheck size={9} /> Auto-sent
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3.5">
                          <p className="text-sm text-violet-900 leading-relaxed">
                            {analysis.ai_summary || 'No AI summary available.'}
                          </p>
                        </div>
                      </div>

                      {/* Response sent to customer */}
                      {analysis.ai_response && (
                        <div>
                          <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                            <MessageCircle size={11} /> Response Sent to Customer
                          </p>
                          <div className="bg-white border border-surface-100 rounded-xl px-4 py-3.5 relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-violet-300 rounded-r-full" />
                            <p className="text-sm text-surface-700 leading-relaxed pl-3 whitespace-pre-wrap">
                              {analysis.ai_response}
                            </p>
                          </div>
                          <p className="text-[11px] text-surface-400 mt-1.5">
                            {analysis.auto_response_generated
                              ? 'Automatically sent to the customer.'
                              : 'Drafted — pending FA review before sending.'}
                          </p>
                        </div>
                      )}

                      {/* Open questions */}
                      {questions.length > 0 && (
                        <div>
                          <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                            <HelpCircle size={11} /> Questions for Customer
                          </p>
                          <div className="space-y-2">
                            {questions.map(q => <QuestionItem key={q.question_id} q={q} />)}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      icon={<Brain size={28} />}
                      title="No AI analysis yet"
                      description="Analysis will appear once the email has been processed."
                    />
                  )}
                </div>

                {/* Right: metadata sidebar */}
                <div className="w-64 shrink-0 border-l border-surface-100 overflow-y-auto p-4 space-y-3 bg-surface-50/50">
                  <p className="text-[10px] text-surface-400 uppercase tracking-widest font-semibold px-1 pt-1">Case Details</p>
                  <MetaPill icon={Hash}       label="Dispute ID"   value={`#${dispute.dispute_id}`} />
                  <MetaPill icon={User2}      label="Assigned To"  value={dispute.assigned_to ?? 'Unassigned'} />
                  <MetaPill icon={Calendar}   label="Opened"       value={formatDate(dispute.created_at)} />
                  <MetaPill icon={Calendar}   label="Last Updated" value={formatDate(dispute.updated_at)} />
                  {dispute.invoice_id && (
                    <MetaPill icon={CreditCard} label="Invoice"    value={`#${dispute.invoice_id}`} />
                  )}
                  {dispute.payment_detail_id && (
                    <MetaPill icon={CreditCard} label="Payment"    value={`#${dispute.payment_detail_id}`} />
                  )}
                  <MetaPill icon={Mail} label="Email ID" value={`#${dispute.email_id}`} />

                  {analysis && (
                    <>
                      <p className="text-[10px] text-surface-400 uppercase tracking-widest font-semibold px-1 pt-2">AI Confidence</p>
                      <div className="px-4 py-3 bg-surface-50 rounded-xl border border-surface-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-surface-500 truncate">{analysis.predicted_category}</span>
                          <span className="text-sm font-bold text-surface-800 ml-2 shrink-0">
                            {(analysis.confidence_score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-surface-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                            style={{ width: `${analysis.confidence_score * 100}%` }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── DOCUMENTS ── */}
            {tab === 'documents' && (
              <div className="flex-1 overflow-y-auto p-6">
                <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold mb-4 flex items-center gap-1.5">
                  <Paperclip size={11} /> Supporting Documents
                </p>
                {loadingTab ? (
                  <div className="flex justify-center py-16"><LoadingSpinner /></div>
                ) : docs.length > 0 ? (
                  <div className="space-y-2">
                    {docs.map(d => <DocItem key={d.attachment_id} doc={d} />)}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Paperclip size={28} />}
                    title="No documents"
                    description="No attachments were included with this dispute's email."
                  />
                )}
              </div>
            )}

            {/* ── TIMELINE ── */}
            {tab === 'timeline' && (
              <div className="flex-1 overflow-y-auto p-6">
                <p className="text-[11px] text-surface-400 uppercase tracking-widest font-semibold mb-4 flex items-center gap-1.5">
                  <MessageSquare size={11} /> Conversation Timeline
                </p>
                {loadingTab ? (
                  <div className="flex justify-center py-16"><LoadingSpinner /></div>
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
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Dispute Row ──────────────────────────────────────────────────────────────

const DisputeRow = ({ dispute, onClick }: { dispute: Dispute; onClick: () => void }) => (
  <tr
    className="group hover:bg-surface-50/80 transition-colors duration-100 cursor-pointer"
    onClick={onClick}
  >
    <td className="px-5 py-3.5 whitespace-nowrap">
      <span className="font-mono text-xs text-surface-400 bg-surface-100 group-hover:bg-white px-2 py-0.5 rounded-lg transition-colors">
        #{dispute.dispute_id}
      </span>
    </td>
    <td className="px-5 py-3.5 max-w-[220px]">
      <p className="text-sm font-semibold text-surface-900 truncate">
        {dispute.dispute_type?.reason_name ?? 'Unknown'}
      </p>
      <p className="text-xs text-surface-400 truncate mt-0.5">{dispute.customer_id}</p>
    </td>
    <td className="px-5 py-3.5 whitespace-nowrap">
      <Badge variant={statusVariant(dispute.status)}>
        {STATUS_LABEL[dispute.status] ?? dispute.status}
      </Badge>
    </td>
    <td className="px-5 py-3.5 whitespace-nowrap">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDot(dispute.priority)}`} />
        <span className="text-xs font-medium text-surface-700">{dispute.priority}</span>
      </div>
    </td>
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
    <td className="px-5 py-3.5 whitespace-nowrap">
      {!!dispute.open_questions_count && dispute.open_questions_count > 0 ? (
        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 font-medium">
          <HelpCircle size={10} /> {dispute.open_questions_count}
        </span>
      ) : (
        <span className="text-xs text-surface-300">—</span>
      )}
    </td>
    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-surface-400">
      {formatDate(dispute.created_at)}
    </td>
    <td className="px-5 py-3.5 whitespace-nowrap">
      <ChevronRight size={15} className="text-surface-300 group-hover:text-brand-400 transition-colors" />
    </td>
  </tr>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const DisputesPage = () => {
  const dispatch = useAppDispatch();
  const {
    disputes, total, loading, error, filters,
    updateSearch, updateStatus_filter, updatePriority, selectDispute, selected,
  } = useDisputes();

  const [localSearch,   setLocalSearch]   = useState(filters.search);
  const [showFilters,   setShowFilters]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
  useEffect(() => {
    dispatch(fetchDisputes());
  }, [dispatch]);

  // Debounced search → backend
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateSearch(value);
      dispatch(fetchDisputes());
    }, 400);
  }, [updateSearch, dispatch]);

  // Filter change → backend immediately
  const handleStatusChange = useCallback((value: string) => {
    updateStatus_filter(value);
    dispatch(fetchDisputes());
  }, [updateStatus_filter, dispatch]);

  const handlePriorityChange = useCallback((value: string) => {
    updatePriority(value);
    dispatch(fetchDisputes());
  }, [updatePriority, dispatch]);

  const handleRefresh = useCallback(() => {
    dispatch(fetchDisputes());
  }, [dispatch]);

  const stats = {
    total:    disputes.length,
    open:     disputes.filter(d => d.status === 'OPEN').length,
    inReview: disputes.filter(d => d.status === 'UNDER_REVIEW').length,
    resolved: disputes.filter(d => ['RESOLVED', 'CLOSED'].includes(d.status)).length,
    autoSent: disputes.filter(d => d.latest_analysis?.auto_response_generated).length,
  };

  const activeFilterCount = [filters.status, filters.priority].filter(f => f !== 'all').length;

  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="All Disputes"
        subtitle={`${total} total disputes across all customers`}
        action={
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl hover:bg-surface-100 text-surface-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Inbox}       label="Total"          value={stats.total}    accent="bg-brand-500" />
        <StatCard icon={ShieldAlert} label="Open"           value={stats.open}     accent="bg-red-500"   sub="Needs attention" />
        <StatCard icon={Clock}       label="Under Review"   value={stats.inReview} accent="bg-amber-500" />
        <StatCard icon={CheckCircle2}label="Resolved"       value={stats.resolved} accent="bg-green-500" />
        <StatCard icon={TrendingUp}  label="Auto-Responded" value={stats.autoSent} accent="bg-violet-500" sub="AI handled" />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={handleRefresh} className="ml-auto text-xs text-red-500 font-medium hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search — debounced, hits backend */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
          <input
            className="input-base pl-9 py-2 text-sm"
            placeholder="Search by ID, customer, type…"
            value={localSearch}
            onChange={e => handleSearchChange(e.target.value)}
          />
          {localSearch && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-300 hover:text-surface-500"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
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
          {total} disputes
        </span>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-surface-50 rounded-xl border border-surface-100">
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-surface-400" />
            <span className="text-xs text-surface-500 font-medium">Status:</span>
            <div className="flex gap-1.5">
              {STATUS_FILTERS.map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    filters.status === s
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
              {PRIORITY_FILTERS.map(p => (
                <button
                  key={p}
                  onClick={() => handlePriorityChange(p)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                    filters.priority === p
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
              onClick={() => { handleStatusChange('all'); handlePriorityChange('all'); }}
              className="ml-auto flex items-center gap-1 text-xs text-surface-400 hover:text-red-500 transition-colors"
            >
              <X size={12} /> Clear all
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
                  { label: 'ID',           icon: Hash          },
                  { label: 'Type / Customer' },
                  { label: 'Status'        },
                  { label: 'Priority'      },
                  { label: 'AI Response',  icon: Brain         },
                  { label: 'Open Qs',      icon: HelpCircle    },
                  { label: 'Created'       },
                  { label: ''              },
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
              ) : disputes.length > 0 ? (
                disputes.map(d => (
                  <DisputeRow
                    key={d.dispute_id}
                    dispute={d}
                    onClick={() => selectDispute(d)}
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

        {!loading && disputes.length > 0 && (
          <div className="px-5 py-3 border-t border-surface-100 bg-surface-50/50 flex items-center justify-between">
            <p className="text-xs text-surface-400">
              Showing {disputes.length} of {total} disputes
            </p>
            <p className="text-xs text-surface-400">
              Click any row to view details
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && (
        <DisputeModal
          dispute={selected}
          onClose={() => selectDispute(null)}
        />
      )}
    </div>
  );
};

export default DisputesPage;
