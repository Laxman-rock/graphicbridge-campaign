'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  Check,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import {
  WhatsAppContactItem,
  WhatsAppContactListParams,
  UnifiedWhatsAppRecipient,
} from '@/types/whatsapp';
import { listWhatsAppContacts, normalizePhoneNumber } from '@/lib/whatsapp-api';
import { useToast } from '@/components/ui/Toast';

interface WhatsAppContactsPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPhones: Set<string>;
  onImportSelected: (contacts: UnifiedWhatsAppRecipient[]) => void;
}

interface ContactGridBatch {
  gridNumber: number;
  start: number;
  end: number;
  contacts: WhatsAppContactItem[];
}

const DEFAULT_BATCH_SIZE = 500;

export default function WhatsAppContactsPickerModal({
  isOpen,
  onClose,
  existingPhones,
  onImportSelected,
}: WhatsAppContactsPickerModalProps) {
  const { error: toastError, success: toastSuccess } = useToast();

  // Complete filtered eligible dataset & directory totals
  const [eligibleContacts, setEligibleContacts] = useState<WhatsAppContactItem[]>([]);
  const [totalDirectoryContacts, setTotalDirectoryContacts] = useState(0);
  const [batchSize, setBatchSize] = useState<number>(DEFAULT_BATCH_SIZE);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [optInFilter, setOptInFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('');

  // Selected contacts keyed by unique contact identifier
  const [selectedContacts, setSelectedContacts] = useState<Map<string, WhatsAppContactItem>>(
    new Map()
  );

  // Import confirmation dialog state & double-click guard
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fetchSeqRef = useRef(0);

  const getContactKey = useCallback((c: WhatsAppContactItem): string => {
    const rawId = c.id ?? c._id ?? c.contact_id;
    const normalizedPhone = normalizePhoneNumber(c.whatsapp_number);
    return rawId !== undefined && rawId !== null && String(rawId).trim() !== ''
      ? String(rawId)
      : normalizedPhone;
  }, []);

  // Eligibility check:
  // ONLY contacts with valid phone numbers, active status, and opt_in_status === 'opted_in' are eligible.
  const isContactEligible = useCallback(
    (c: WhatsAppContactItem): { eligible: boolean; reason?: string } => {
      const rawOpt = c.opt_in_status?.toLowerCase();
      const isOptedIn =
        rawOpt === 'opted_in' ||
        rawOpt === 'opt-in' ||
        rawOpt === 'yes' ||
        rawOpt === 'true';

      if (!isOptedIn) {
        if (rawOpt === 'opted_out' || rawOpt === 'opt-out' || rawOpt === 'no') {
          return { eligible: false, reason: 'Ineligible (Opted Out)' };
        }
        return { eligible: false, reason: 'Ineligible (Pending Opt-In)' };
      }

      const isActive = c.is_active ?? c.active ?? true;
      if (!isActive) {
        return { eligible: false, reason: 'Ineligible (Inactive Contact)' };
      }

      const normalized = normalizePhoneNumber(c.whatsapp_number);
      if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
        return { eligible: false, reason: 'Invalid phone format' };
      }

      return { eligible: true };
    },
    []
  );

  // Fetch all pages for the active filter set so grid boundaries are stable across the full eligible dataset
  const fetchAllFilteredContacts = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setIsLoading(true);
    setLoadError(null);
    setLoadProgress('Loading contacts...');

    try {
      const baseParams: WhatsAppContactListParams = {
        limit: 1000,
      };
      if (searchQuery.trim()) {
        baseParams.search = searchQuery.trim();
      }
      if (optInFilter !== 'all') {
        baseParams.opt_in_status = optInFilter;
      }
      if (tagFilter.trim()) {
        baseParams.tag = tagFilter.trim();
      }

      const firstRes = await listWhatsAppContacts({ ...baseParams, page: 1 });
      if (seq !== fetchSeqRef.current) return;

      if (!firstRes.success || !firstRes.data) {
        setLoadError(firstRes.error || 'Failed to fetch WhatsApp contacts.');
        setEligibleContacts([]);
        setTotalDirectoryContacts(0);
        return;
      }

      const allRaw: WhatsAppContactItem[] = [...firstRes.data];
      const totalPages = Math.max(1, Number(firstRes.pagination?.pages ?? 1));
      const totalReported = Number(
        firstRes.pagination?.total ?? firstRes.total ?? firstRes.data.length
      );

      for (let pg = 2; pg <= totalPages; pg++) {
        if (seq !== fetchSeqRef.current) return;
        setLoadProgress(`Loading batch ${pg} of ${totalPages}...`);
        const nextRes = await listWhatsAppContacts({ ...baseParams, page: pg });
        if (seq !== fetchSeqRef.current) return;
        if (nextRes.success && Array.isArray(nextRes.data)) {
          allRaw.push(...nextRes.data);
        }
      }

      // Deduplicate by contact key and normalized phone, keeping only eligible contacts
      const seenKeys = new Set<string>();
      const seenPhones = new Set<string>();
      const nextEligible: WhatsAppContactItem[] = [];

      for (const contact of allRaw) {
        if (!isContactEligible(contact).eligible) continue;
        const key = getContactKey(contact);
        const normPhone = normalizePhoneNumber(contact.whatsapp_number);
        if (seenKeys.has(key) || (normPhone && seenPhones.has(normPhone))) {
          continue;
        }
        seenKeys.add(key);
        if (normPhone) seenPhones.add(normPhone);
        nextEligible.push(contact);
      }

      setEligibleContacts(nextEligible);
      setTotalDirectoryContacts(Math.max(totalReported, allRaw.length));

      // Preserve only selections that still exist in the updated eligible dataset
      const validKeySet = new Set(nextEligible.map((c) => getContactKey(c)));
      setSelectedContacts((prev) => {
        if (prev.size === 0) return prev;
        const pruned = new Map<string, WhatsAppContactItem>();
        prev.forEach((val, key) => {
          if (validKeySet.has(key)) {
            pruned.set(key, val);
          }
        });
        return pruned;
      });
    } catch (err: any) {
      if (seq !== fetchSeqRef.current) return;
      setLoadError(err?.message || 'Could not connect to contacts server.');
    } finally {
      if (seq === fetchSeqRef.current) {
        setIsLoading(false);
        setLoadProgress(null);
      }
    }
  }, [searchQuery, optInFilter, tagFilter, isContactEligible, getContactKey]);

  // Load initial dataset when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsConfirmModalOpen(false);
      setIsImporting(false);
      fetchAllFilteredContacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Build dynamic grids: Number of Grids = Ceiling(Total Eligible Contacts / Batch Size)
  const grids: ContactGridBatch[] = useMemo(() => {
    if (eligibleContacts.length === 0) return [];
    const safeBatch = Math.max(1, batchSize);
    const totalGrids = Math.ceil(eligibleContacts.length / safeBatch);
    const batches: ContactGridBatch[] = [];

    for (let i = 0; i < totalGrids; i++) {
      const startIdx = i * safeBatch;
      const slice = eligibleContacts.slice(startIdx, startIdx + safeBatch);
      batches.push({
        gridNumber: i + 1,
        start: startIdx + 1,
        end: startIdx + slice.length,
        contacts: slice,
      });
    }
    return batches;
  }, [eligibleContacts, batchSize]);

  // Check if a specific grid is fully selected
  const isGridSelected = useCallback(
    (grid: ContactGridBatch): boolean => {
      if (grid.contacts.length === 0) return false;
      return grid.contacts.every((c) => selectedContacts.has(getContactKey(c)));
    },
    [selectedContacts, getContactKey]
  );

  const selectedGridCount = useMemo(() => {
    return grids.filter((g) => isGridSelected(g)).length;
  }, [grids, isGridSelected]);

  // Toggle an entire grid of eligible contacts
  const handleToggleGrid = (grid: ContactGridBatch) => {
    const currentlySelected = isGridSelected(grid);
    setSelectedContacts((prev) => {
      const next = new Map(prev);
      if (currentlySelected) {
        grid.contacts.forEach((c) => {
          next.delete(getContactKey(c));
        });
      } else {
        grid.contacts.forEach((c) => {
          next.set(getContactKey(c), c);
        });
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedContacts(new Map());
  };

  const handleOpenImportConfirm = () => {
    if (selectedContacts.size === 0) {
      toastError('Please select at least one contact grid to import.', 'Selection Empty');
      return;
    }
    setIsConfirmModalOpen(true);
  };

  // Finalize import after user confirms
  const handleConfirmImport = () => {
    if (isImporting) return;
    if (selectedContacts.size === 0) {
      toastError('No eligible contacts selected.', 'Selection Empty');
      setIsConfirmModalOpen(false);
      return;
    }

    setIsImporting(true);
    try {
      let duplicateCount = 0;
      let ineligibleSkipped = 0;
      const seenBatchPhones = new Set<string>();
      const newRecipients: UnifiedWhatsAppRecipient[] = [];

      selectedContacts.forEach((contact) => {
        if (!isContactEligible(contact).eligible) {
          ineligibleSkipped++;
          return;
        }

        const normalized = normalizePhoneNumber(contact.whatsapp_number);
        if (!normalized) {
          ineligibleSkipped++;
          return;
        }

        if (existingPhones.has(normalized) || seenBatchPhones.has(normalized)) {
          duplicateCount++;
          return;
        }
        seenBatchPhones.add(normalized);

        const details = contact.contact_details || {};
        const name =
          details.name ||
          details.contact_name ||
          (details.first_name
            ? `${details.first_name} ${details.last_name || ''}`.trim()
            : null) ||
          contact.custom_variables?.name ||
          contact.custom_variables?.first_name;

        const rawVars: Record<string, string> = {
          phone: normalized,
          whatsapp_number: contact.whatsapp_number || normalized,
          contact_id: String(contact.contact_id ?? ''),
          ...(name ? { name, customer_name: name, original_name: name } : {}),
        };

        if (contact.custom_variables && typeof contact.custom_variables === 'object') {
          Object.entries(contact.custom_variables).forEach(([k, v]) => {
            rawVars[k] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
          });
        }

        newRecipients.push({
          id: `contact_${getContactKey(contact)}_${Date.now()}`,
          phone: normalized,
          formattedPhone: contact.whatsapp_number,
          name: name || undefined,
          source: 'whatsapp_contacts',
          contact_id: contact.contact_id,
          status: 'valid',
          whatsapp_opt_in: true,
          opt_in_status: contact.opt_in_status,
          tags: contact.tags,
          groups: contact.groups,
          raw: rawVars,
        });
      });

      onImportSelected(newRecipients);

      const skippedParts: string[] = [];
      if (duplicateCount > 0) skippedParts.push(`${duplicateCount} duplicate(s) skipped`);
      if (ineligibleSkipped > 0) skippedParts.push(`${ineligibleSkipped} ineligible skipped`);

      toastSuccess(
        `Imported ${newRecipients.length.toLocaleString()} contact(s) from ${selectedGridCount} grid(s).${
          skippedParts.length > 0 ? ` (${skippedParts.join(', ')})` : ''
        }`,
        'Contacts Imported'
      );
      setIsConfirmModalOpen(false);
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  const ineligibleFilteredOut = Math.max(0, totalDirectoryContacts - eligibleContacts.length);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Import from WhatsApp Contacts
              </h3>
              <p className="text-xs text-slate-500">
                Select one or more eligible contact batches to include in this campaign
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/30 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchAllFilteredContacts();
                  }
                }}
                placeholder="Search by phone number or contact name..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Opt-In Filter */}
            <select
              value={optInFilter}
              onChange={(e) => setOptInFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">Opt-In: All</option>
              <option value="opted_in">Opted In Only</option>
              <option value="pending">Pending</option>
              <option value="opted_out">Opted Out</option>
            </select>

            {/* Tag Filter */}
            <input
              type="text"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  fetchAllFilteredContacts();
                }
              }}
              placeholder="Tag (e.g. vip)..."
              className="w-full sm:w-32 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />

            {/* Apply & Refresh */}
            <button
              type="button"
              onClick={fetchAllFilteredContacts}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={fetchAllFilteredContacts}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
              title="Refresh contacts"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Selection Summary & Grid Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-xs font-medium text-slate-500">
                {loadProgress || 'Loading eligible WhatsApp contacts...'}
              </p>
            </div>
          ) : loadError ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{loadError}</div>
            </div>
          ) : eligibleContacts.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No eligible contacts found</p>
              <p className="text-xs text-slate-400 mt-1">
                Try adjusting your search query, opt-in status, or tag filters.
              </p>
            </div>
          ) : (
            <>
              {/* Selection Summary Bar */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-500">Total eligible contacts: </span>
                    <strong className="text-slate-900 font-bold">
                      {eligibleContacts.length.toLocaleString()}
                    </strong>
                    {ineligibleFilteredOut > 0 && (
                      <span className="text-[11px] text-slate-400 ml-1">
                        ({ineligibleFilteredOut.toLocaleString()} ineligible excluded)
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500">Selected grids: </span>
                    <strong className="text-emerald-700 font-bold">{selectedGridCount}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Selected contacts: </span>
                    <strong className="text-emerald-700 font-bold">
                      {selectedContacts.size.toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[11px] text-slate-500">Batch size:</span>
                    <select
                      value={batchSize}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value={250}>250</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                    </select>
                  </div>

                  {selectedContacts.size > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-xs font-semibold text-rose-600 hover:underline whitespace-nowrap"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              </div>

              {/* Responsive Grid Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {grids.map((grid) => {
                  const selected = isGridSelected(grid);
                  return (
                    <button
                      key={`grid-${grid.gridNumber}-${grid.start}-${grid.end}`}
                      type="button"
                      onClick={() => handleToggleGrid(grid)}
                      aria-pressed={selected}
                      className={`group relative text-left p-4 rounded-2xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                        selected
                          ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 shadow-sm'
                          : 'bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                              selected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700'
                            }`}
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </span>
                          <span
                            className={`text-sm font-bold ${
                              selected ? 'text-emerald-900' : 'text-slate-900'
                            }`}
                          >
                            Grid {grid.gridNumber}
                          </span>
                        </div>

                        {selected ? (
                          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full border border-slate-300 bg-white group-hover:border-emerald-400 transition-colors" />
                        )}
                      </div>

                      <div className="mt-3 space-y-1">
                        <p
                          className={`text-xs font-medium ${
                            selected ? 'text-emerald-800' : 'text-slate-600'
                          }`}
                        >
                          Contacts {grid.start.toLocaleString()}–{grid.end.toLocaleString()}
                        </p>
                        <p
                          className={`text-sm font-extrabold ${
                            selected ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {grid.contacts.length.toLocaleString()} Contacts
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                        <span
                          className={`font-semibold flex items-center gap-1 ${
                            selected ? 'text-emerald-700' : 'text-slate-400 group-hover:text-emerald-600'
                          }`}
                        >
                          {selected ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Selected
                            </>
                          ) : (
                            'Click to select'
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {selectedContacts.size > 0 ? (
              <span>
                Ready to import{' '}
                <strong className="text-emerald-700 font-bold">
                  {selectedContacts.size.toLocaleString()}
                </strong>{' '}
                eligible contact(s) from{' '}
                <strong className="text-slate-800">{selectedGridCount}</strong> grid(s).
              </span>
            ) : (
              <span>Select one or more contact grids above to import.</span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedContacts.size === 0 || isLoading || isImporting}
              onClick={handleOpenImportConfirm}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
            >
              <span>Import Selected ({selectedContacts.size})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Import Confirmation Dialog */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h4 className="text-base font-bold text-slate-900">Confirm Contact Import</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Import{' '}
                <span className="font-bold text-emerald-700">
                  {selectedContacts.size.toLocaleString()}
                </span>{' '}
                eligible contact(s) from{' '}
                <span className="font-semibold text-slate-800">{selectedGridCount}</span>{' '}
                selected grid(s) into your campaign audience?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isImporting}
                onClick={handleConfirmImport}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
