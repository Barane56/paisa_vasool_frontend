import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, Loader2, Search } from 'lucide-react';
import clsx from 'clsx';
import { ARDocRelated, DOC_TYPE_LABELS, KEY_TYPE_LABELS } from '../services/arDocumentService';

interface AnchorDocumentSelectorProps {
  documents: ARDocRelated[];
  selectedDocId: number | null;
  onSelect: (docId: number) => void;
  isLoading?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  isLoadingText?: string;
}

// Type-to-label mapping for display
const DOC_TYPE_NATURAL_KEY: Record<string, string> = {
  PO: 'po_number',
  INVOICE: 'inv_number',
  GRN: 'grn_number',
  PAYMENT: 'payment_ref',
  CONTRACT: 'contract_number',
  CREDIT_NOTE: 'credit_note_number',
};

const DOC_TYPE_COLORS: Record<string, string> = {
  PO:          'bg-amber-100 text-amber-700 border-amber-200',
  INVOICE:     'bg-blue-100 text-blue-700 border-blue-200',
  GRN:         'bg-purple-100 text-purple-700 border-purple-200',
  PAYMENT:     'bg-green-100 text-green-700 border-green-200',
  CONTRACT:    'bg-slate-100 text-slate-700 border-slate-200',
  CREDIT_NOTE: 'bg-red-100 text-red-700 border-red-200',
};

const getDocumentLabel = (doc: ARDocRelated): string => {
  if (!doc.all_keys?.length) return `${DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} #${doc.doc_id}`;
  const preferredKey = DOC_TYPE_NATURAL_KEY[doc.doc_type] ? doc.all_keys.find(k => k.key_type === DOC_TYPE_NATURAL_KEY[doc.doc_type]) : null;
  const primaryKey = preferredKey ?? doc.all_keys[0];
  const label = `${KEY_TYPE_LABELS[primaryKey.key_type] || primaryKey.key_type}: ${primaryKey.key_value_raw}`;

  return `${DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} - ${label}`;
};

export const AnchorDocumentSelector: React.FC<AnchorDocumentSelectorProps> = ({
  documents,
  selectedDocId,
  onSelect,
  isLoading = false,
  hasError = false,
  errorMessage = 'No AR documents on file for this customer.',
  isLoadingText = 'Loading documents…',
}) => {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Filter and group documents
  const groupedDocs = useMemo(() => {
    const groups: Record<string, ARDocRelated[]> = {};
    const lowerSearch = search.toLowerCase().trim();

    documents.forEach(doc => {
      const label = getDocumentLabel(doc).toLowerCase();
      const matchesSearch = !lowerSearch || label.includes(lowerSearch);

      if (matchesSearch) {
        if (!groups[doc.doc_type]) {
          groups[doc.doc_type] = [];
        }
        groups[doc.doc_type].push(doc);
      }
    });

    return groups;
  }, [documents, search]);

  const docTypes = Object.keys(groupedDocs);

  // Auto-expand first group when docTypes change — must be useEffect, NOT inline in render
  useEffect(() => {
    if (docTypes.length > 0) {
      setExpandedTypes(prev => prev.size === 0 ? new Set([docTypes[0]]) : prev);
    }
  }, [docTypes.join(',')]); // stable dep — re-runs only when the list of types actually changes

  const toggleType = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Empty state
  if (!isLoading && documents.length === 0) {
    return (
      <div className={clsx(
        'flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg border',
        hasError
          ? 'text-brand-700 bg-brand-50 border-brand-200'
          : 'text-surface-500 bg-surface-50 border-surface-200'
      )}>
        <AlertCircle size={13} className="shrink-0 mt-0.5" />
        <span>{errorMessage}</span>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-surface-600 py-3">
        <Loader2 size={13} className="animate-spin" />
        {isLoadingText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by ID or document number..."
          className="w-full bg-surface-50 border border-surface-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
        />
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
      {docTypes.map(type => {
        const docs = groupedDocs[type];
        const isExpanded = expandedTypes.has(type);

        return (
          <div key={type} className="border border-surface-200 rounded-lg overflow-hidden">
            {/* Type header - collapsible */}
            <button
              type="button"
              onClick={() => toggleType(type)}
              className={clsx(
                'w-full flex items-center justify-between px-4 py-3',
                'bg-white hover:bg-surface-50 transition-colors',
                'border-b border-surface-200'
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Type label */}
                <span className={clsx(
                  'text-xs font-bold px-2 py-1 rounded border',
                  DOC_TYPE_COLORS[type] ?? 'bg-surface-100 text-surface-600 border-surface-200'
                )}>
                  {DOC_TYPE_LABELS[type as keyof typeof DOC_TYPE_LABELS] || type}
                </span>

                {/* Count */}
                <span className="text-xs font-semibold text-surface-600">
                  {docs.length} document{docs.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Chevron */}
              <div className="text-surface-400 shrink-0 ml-2">
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {/* Document list */}
            {isExpanded && (
              <div className="bg-white divide-y divide-surface-100">
                {docs.map(doc => {
                  const isSelected = selectedDocId === doc.doc_id;

                  return (
                    <button
                      key={doc.doc_id}
                      type="button"
                      onClick={() => onSelect(doc.doc_id)}
                      className={clsx(
                        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                        isSelected
                          ? 'bg-brand-50'
                          : 'bg-white hover:bg-surface-50'
                      )}
                    >
                      {/* Selection indicator */}
                      <div className={clsx(
                        'w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center',
                        isSelected
                          ? 'border-brand-600 bg-brand-600'
                          : 'border-surface-300 bg-white'
                      )}>
                        {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                      </div>

                      {/* Document info */}
                      <div className="flex-1 min-w-0">
                        <p className={clsx(
                          'text-xs font-semibold truncate',
                          isSelected ? 'text-brand-700' : 'text-surface-800'
                        )}>
                          {getDocumentLabel(doc)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default AnchorDocumentSelector;
