import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronUp, Download, Calendar, Tag, Check, FileText } from 'lucide-react';
import clsx from 'clsx';
import { ARDocRelated, ARDocType, DOC_TYPE_LABELS, KEY_TYPE_LABELS } from '../services/arDocumentService';
import { formatDate } from '@/utils';

const DOC_TYPE_COLORS: Record<ARDocType, { bg: string; text: string; badge: string; icon: string }> = {
  PO:           { bg: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700 border-amber-200',   icon: 'text-amber-600' },
  INVOICE:      { bg: 'bg-blue-50',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700 border-blue-200',     icon: 'text-blue-600' },
  GRN:          { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700 border-purple-200', icon: 'text-purple-600' },
  PAYMENT:      { bg: 'bg-green-50',   text: 'text-green-700',   badge: 'bg-green-100 text-green-700 border-green-200',   icon: 'text-green-600' },
  CONTRACT:     { bg: 'bg-slate-50',   text: 'text-slate-700',   badge: 'bg-slate-100 text-slate-700 border-slate-200',   icon: 'text-slate-600' },
  CREDIT_NOTE:  { bg: 'bg-red-50',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700 border-red-200',      icon: 'text-red-600' },
};

interface ConfidenceBadgeProps {
  confidence: number;
  source: string;
}

const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence, source }) => {
  const isHighConfidence = confidence >= 0.9;
  const isMediumConfidence = confidence >= 0.7;

  const sourceIcon = source === 'manual' ? '✓' : source === 'regex' ? '⚡' : '🤖';
  const sourceLabel = source === 'manual' ? 'manual' : source === 'regex' ? 'regex' : 'ai';

  const bgColor = isHighConfidence ? 'bg-green-50' : isMediumConfidence ? 'bg-amber-50' : 'bg-surface-50';
  const textColor = isHighConfidence ? 'text-green-700' : isMediumConfidence ? 'text-amber-700' : 'text-surface-700';

  return (
    <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${bgColor} ${textColor}`}>
      {sourceIcon} {sourceLabel} {(confidence * 100).toFixed(0)}%
    </span>
  );
};

interface GroupedDocumentsDisplayProps {
  documents: ARDocRelated[];
  onSelectDocument?: (doc: ARDocRelated) => void;
  isLoading?: boolean;
  readonly?: boolean;
}

type DocTypeMode = ARDocType | 'ALL';

const normalizeDocType = (type: string): ARDocType => {
  const candidate = (type || '').toString().toUpperCase().trim() as ARDocType;
  return DOC_TYPE_LABELS[candidate as ARDocType] ? candidate : (type as ARDocType);
};

const getDocColors = (type: string) => {
  return DOC_TYPE_COLORS[type as ARDocType] ?? {
    bg: 'bg-surface-50',
    text: 'text-surface-700',
    badge: 'bg-surface-100 text-surface-700',
    icon: 'text-surface-400',
  };
};

export const GroupedDocumentsDisplay: React.FC<GroupedDocumentsDisplayProps> = ({
  documents,
  onSelectDocument,
  isLoading = false,
  readonly = false,
}) => {
  const [activeType, setActiveType] = useState<DocTypeMode>('ALL');
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null);

  const groupedDocs = useMemo(() => {
    const groups: Record<string, ARDocRelated[]> = {};
    documents.forEach(doc => {
      const normalizedType = normalizeDocType(doc.doc_type);
      if (!groups[normalizedType]) groups[normalizedType] = [];
      groups[normalizedType].push({ ...doc, doc_type: normalizedType });
    });
    return groups;
  }, [documents]);

  const types = Object.keys(groupedDocs);

  useEffect(() => {
    if (activeType !== 'ALL' && activeType && !types.includes(activeType)) {
      setActiveType('ALL');
    }
  }, [types, activeType]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
          <p className="text-sm text-surface-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-surface-200 bg-surface-50 px-6 py-8 text-center">
        <FileText size={32} className="mx-auto mb-3 text-surface-400" />
        <p className="text-sm font-semibold text-surface-700 mb-1">No documents found</p>
        <p className="text-xs text-surface-500">Upload documents to get started</p>
      </div>
    );
  }

  const visibleTypes = activeType === 'ALL' ? types : activeType ? [activeType] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-surface-200 pb-3 sm:pb-4">
        <button
          onClick={() => setActiveType('ALL')}
          className={clsx(
            'flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg transition-all duration-150',
            'border font-medium text-xs sm:text-sm whitespace-nowrap',
            activeType === 'ALL'
              ? 'bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
              : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'
          )}
        >
          <FileText size={14} className={clsx('shrink-0', activeType === 'ALL' ? 'text-brand-600' : 'text-surface-400')} />
          <span className="hidden sm:inline">All</span>
          <span className="sm:hidden text-[11px]">All</span>
          <span className={clsx('ml-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold', activeType === 'ALL' ? '' : 'bg-surface-100')}>
            {documents.length}
          </span>
        </button>

        {types.map(type => {
          const count = groupedDocs[type]?.length || 0;
          const typeColors = getDocColors(type);
          const isActive = activeType === type;

          return (
            <button
              key={type}
              onClick={() => setActiveType(type as DocTypeMode)}
              className={clsx(
                'flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg transition-all duration-150',
                'border font-medium text-xs sm:text-sm whitespace-nowrap',
                isActive
                  ? `${typeColors.badge} border-current shadow-sm`
                  : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'
              )}
            >
              <FileText size={14} className={clsx('shrink-0', isActive ? typeColors.icon : 'text-surface-400')} />
              <span className="hidden sm:inline">{DOC_TYPE_LABELS[type as keyof typeof DOC_TYPE_LABELS] ?? type}</span>
              <span className="sm:hidden text-[11px]">{type}</span>
              <span className={clsx(
                'ml-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold',
                isActive ? '' : 'bg-surface-100'
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {visibleTypes.length === 0 ? (
          <div className="text-center py-8 text-surface-500">
            <p className="text-sm">No documents available</p>
          </div>
        ) : (
          visibleTypes.map(type => {
            const docsForType = groupedDocs[type] || [];
            const typeLabel = DOC_TYPE_LABELS[type as keyof typeof DOC_TYPE_LABELS] ?? type;

            return (
              <section key={type} className="space-y-2">
                <div className={clsx('flex items-center justify-between px-2 sm:px-3 py-2 rounded-lg border', getDocColors(type).badge)}>
                  <p className="text-xs sm:text-sm font-semibold">
                    {typeLabel} <span className="opacity-70 font-normal">({docsForType.length})</span>
                  </p>
                </div>

                <div className="space-y-3">
                  {docsForType.map(doc => {
                    const colors = getDocColors(doc.doc_type);
                    const isExpanded = expandedDocId === doc.doc_id;
                    const primaryKey = doc.all_keys?.[0];

                    return (
                      <div
                        key={doc.doc_id}
                        className={clsx(
                          'rounded-lg border transition-all duration-150',
                          isExpanded
                            ? `border-brand-500 ${colors.bg} shadow-md`
                            : `border-surface-200 bg-white hover:border-brand-300 hover:shadow-sm`
                        )}
                      >
                        <button
                          onClick={() => {
                            setExpandedDocId(isExpanded ? null : doc.doc_id);
                            onSelectDocument?.(doc);
                          }}
                          className={clsx(
                            'w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3',
                            'hover:opacity-90 transition-opacity',
                            isExpanded && colors.bg
                          )}
                        >
                          <div className={`w-8 sm:w-10 h-8 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${colors.badge}`}>
                            <FileText size={16} className={clsx(colors.icon, 'sm:w-[18px] sm:h-[18px]')} />
                          </div>

                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-baseline gap-1 sm:gap-2 mb-1 flex-wrap">
                              <p className="font-semibold text-xs sm:text-sm text-surface-800 truncate min-w-0">
                                {primaryKey
                                  ? `${KEY_TYPE_LABELS[primaryKey.key_type] || primaryKey.key_type}: ${primaryKey.key_value_raw}`
                                  : `${typeLabel} #${doc.doc_id}`
                                }
                              </p>
                              <span className={clsx('text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0', colors.badge)}>
                                {typeLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 text-[11px] sm:text-xs text-surface-500 flex-wrap">
                              {doc.doc_date && (
                                <span className="flex items-center gap-0.5">
                                  <Calendar size={11} className="sm:w-3 sm:h-3" />
                                  {formatDate(doc.doc_date)}
                                </span>
                              )}
                              <span className={`text-[10px] sm:text-[11px] font-medium ${doc.status === 'ACTIVE' ? 'text-brand-600' : 'text-surface-500'}`}>
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 text-surface-400">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className={clsx('border-t', isExpanded ? `border-current opacity-60` : 'border-surface-200')}>
                            <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
                              {doc.all_keys && doc.all_keys.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <Tag size={14} className={colors.icon} />
                                    <p className="text-[10px] sm:text-xs font-bold text-surface-700 uppercase tracking-wider">Reference Keys</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {doc.all_keys.map(key => (
                                      <div key={key.key_id} className={clsx('flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border text-[10px] sm:text-xs', 'bg-white border-surface-200 text-surface-700')}>
                                        <span className="font-semibold text-surface-500">{KEY_TYPE_LABELS[key.key_type] || key.key_type}:</span>
                                        <span className="font-mono font-bold text-surface-800 break-all">{key.key_value_raw}</span>
                                        <ConfidenceBadge confidence={key.confidence} source={key.source} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {doc.shared_keys && doc.shared_keys.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Check size={14} className="text-brand-600" />
                                    <p className="text-[10px] sm:text-xs font-bold text-surface-700 uppercase tracking-wider">Linked Keys</p>
                                  </div>
                                  <p className="text-[10px] sm:text-xs text-surface-600 mb-2">Shared with {doc.shared_keys.length} related document{doc.shared_keys.length !== 1 ? 's' : ''}</p>
                                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                    {doc.shared_keys.slice(0, 3).map((key, idx) => (
                                      <span key={idx} className={clsx('text-[9px] sm:text-[10px] px-2 py-1 rounded-full', 'bg-brand-50 text-brand-700 border border-brand-200')}>
                                        {KEY_TYPE_LABELS[key.key_type] || key.key_type}: {key.key_value_raw}
                                      </span>
                                    ))}
                                    {doc.shared_keys.length > 3 && (
                                      <span className={clsx('text-[9px] sm:text-[10px] px-2 py-1 rounded-full', 'bg-surface-100 text-surface-600')}>+{doc.shared_keys.length - 3} more</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-[10px] sm:text-xs border-t border-surface-200 pt-3 sm:pt-4">
                                <div>
                                  <p className="text-surface-500 font-medium">Document ID</p>
                                  <p className="text-surface-800 font-mono font-bold mt-1 break-all">{doc.doc_id}</p>
                                </div>
                                <div>
                                  <p className="text-surface-500 font-medium">Customer Scope</p>
                                  <p className="text-surface-800 font-bold mt-1 truncate">{doc.customer_scope}</p>
                                </div>
                                <div>
                                  <p className="text-surface-500 font-medium">Created</p>
                                  <p className="text-surface-800 font-bold mt-1">{formatDate(doc.created_at)}</p>
                                </div>
                                {doc.download_url && (
                                  <div>
                                    <p className="text-surface-500 font-medium">File</p>
                                    <a href={doc.download_url} target="_blank" rel="noopener noreferrer" className={clsx('inline-flex items-center gap-1 font-semibold mt-1 text-xs', 'text-brand-600 hover:text-brand-700 transition-colors')}>
                                      <Download size={11} />
                                      Download
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GroupedDocumentsDisplay;
