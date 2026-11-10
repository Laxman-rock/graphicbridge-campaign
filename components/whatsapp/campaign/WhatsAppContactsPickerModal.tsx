'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowRight,
  RefreshCw,
  Phone,
  Tag,
  Folder,
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

export default function WhatsAppContactsPickerModal({
  isOpen,
  onClose,
  existingPhones,
  onImportSelected,
}: WhatsAppContactsPickerModalProps) {
  const { error: toastError, success: toastSuccess } = useToast();

  const [contacts, setContacts] = useState<WhatsAppContactItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [optInFilter, setOptInFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [groupFilter, setGroupFilter] = useState<string>('');

  // Selected contacts: map of contact ID -> WhatsAppContactItem (persists across page changes)
  const [selectedContacts, setSelectedContacts] = useState<Map<string, WhatsAppContactItem>>(
    new Map()
  );

  // Fetch contacts for a specific page and limit
  const fetchContacts = useCallback(
    async (pageToLoad: number, limitToLoad = pagination.limit) => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const params: WhatsAppContactListParams = {
          page: pageToLoad,
          limit: limitToLoad,
        };

        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
          params.phone_number = searchQuery.trim();
        }
        if (optInFilter !== 'all') {
          params.opt_in_status = optInFilter;
        }
        if (tagFilter.trim()) {
          params.tag = tagFilter.trim();
        }
        if (groupFilter.trim()) {
          params.group = groupFilter.trim();
        }

        const res = await listWhatsAppContacts(params);
        if (res.success && res.data) {
          setContacts(res.data);
          if (res.pagination) {
            setPagination({
              page: Number(res.pagination.page ?? pageToLoad),
              limit: Number(res.pagination.limit ?? limitToLoad),
              total: Number(res.pagination.total ?? res.data.length),
              pages: Math.max(1, Number(res.pagination.pages ?? 1)),
            });
          } else {
            const tot = Number(res.total ?? res.data.length);
            setPagination({
              page: pageToLoad,
              limit: limitToLoad,
              total: tot,
              pages: Math.max(1, Math.ceil(tot / limitToLoad)),
            });
          }
        } else {
          setLoadError(res.error || 'Failed to fetch WhatsApp contacts.');
        }
      } catch (err: any) {
        setLoadError(err?.message || 'Could not connect to contacts server.');
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery, optInFilter, tagFilter, groupFilter, pagination.limit]
  );

  // Load initial page whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setPagination((prev) => ({ ...prev, page: 1 }));
      fetchContacts(1, pagination.limit);
    }
  }, [isOpen]); // Only runs on modal open/close transitions

  // Navigate to any page
  const goToPage = (newPage: number) => {
    const totalPages = pagination.pages || 1;
    if (newPage < 1 || newPage > totalPages || newPage === pagination.page || isLoading) {
      return;
    }
    setPagination((prev) => ({ ...prev, page: newPage }));
    fetchContacts(newPage, pagination.limit);
  };

  // Change page size limit
  const handleLimitChange = (newLimit: number) => {
    setPagination((prev) => ({ ...prev, page: 1, limit: newLimit }));
    fetchContacts(1, newLimit);
  };

  // Apply filters
  const handleApplyFilter = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchContacts(1, pagination.limit);
  };

  // Eligibility check:
  // ONLY contacts with valid phone numbers and opt_in_status === 'opted_in' are eligible!
  const isContactEligible = (c: WhatsAppContactItem): { eligible: boolean; reason?: string } => {
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
  };

  // Toggle selection for a single contact
  const handleToggleSelect = (contact: WhatsAppContactItem) => {
    const key = String(contact.id ?? contact._id ?? contact.contact_id);
    setSelectedContacts((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, contact);
      }
      return next;
    });
  };

  // Eligible contacts on current page
  const eligibleOnCurrentPage = useMemo(() => {
    return contacts.filter((c) => isContactEligible(c).eligible);
  }, [contacts]);

  const areAllCurrentPageEligibleSelected =
    eligibleOnCurrentPage.length > 0 &&
    eligibleOnCurrentPage.every((c) =>
      selectedContacts.has(String(c.id ?? c._id ?? c.contact_id))
    );

  const handleToggleSelectAllPage = () => {
    setSelectedContacts((prev) => {
      const next = new Map(prev);
      if (areAllCurrentPageEligibleSelected) {
        eligibleOnCurrentPage.forEach((c) => {
          next.delete(String(c.id ?? c._id ?? c.contact_id));
        });
      } else {
        eligibleOnCurrentPage.forEach((c) => {
          next.set(String(c.id ?? c._id ?? c.contact_id), c);
        });
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedContacts(new Map());
  };

  // Import selected contacts into audience
  const handleConfirmImport = () => {
    if (selectedContacts.size === 0) {
      toastError('No contacts selected.', 'Selection Empty');
      return;
    }

    let duplicateCount = 0;
    const newRecipients: UnifiedWhatsAppRecipient[] = [];

    selectedContacts.forEach((contact) => {
      const normalized = normalizePhoneNumber(contact.whatsapp_number);

      if (existingPhones.has(normalized)) {
        duplicateCount++;
        return;
      }

      const details = contact.contact_details || {};
      const name =
        details.name ||
        details.contact_name ||
        (details.first_name ? `${details.first_name} ${details.last_name || ''}`.trim() : null) ||
        contact.custom_variables?.name ||
        contact.custom_variables?.first_name;

      const rawVars: Record<string, string> = {
        phone: normalized,
        whatsapp_number: normalized,
        contact_id: String(contact.contact_id ?? ''),
        ...(name ? { name, customer_name: name } : {}),
      };

      if (contact.custom_variables && typeof contact.custom_variables === 'object') {
        Object.entries(contact.custom_variables).forEach(([k, v]) => {
          rawVars[k] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
        });
      }

      newRecipients.push({
        id: `contact_${contact.id ?? contact._id ?? contact.contact_id}_${Date.now()}`,
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
    toastSuccess(
      `Imported ${newRecipients.length} contact(s) to audience.${
        duplicateCount > 0 ? ` (${duplicateCount} duplicate(s) skipped)` : ''
      }`,
      'Contacts Imported'
    );
    onClose();
  };

  // Helper to generate numbered page array with ellipsis
  const pageNumbers = useMemo(() => {
    const total = pagination.pages || 1;
    const current = pagination.page || 1;

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    if (current <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', total];
    }

    if (current >= total - 3) {
      return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
    }

    return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
  }, [pagination.pages, pagination.page]);

  if (!isOpen) return null;

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
                Select verified opted-in recipients from your directory to include in this campaign
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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
                    handleApplyFilter();
                  }
                }}
                placeholder="Search by phone number or contact name..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Opt-In Filter */}
            <select
              value={optInFilter}
              onChange={(e) => {
                setOptInFilter(e.target.value);
              }}
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
              placeholder="Tag (e.g. vip)..."
              className="w-full sm:w-32 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />

            {/* Apply & Refresh */}
            <button
              type="button"
              onClick={handleApplyFilter}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={() => fetchContacts(pagination.page, pagination.limit)}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>

          {/* Selection Status Bar */}
          <div className="flex flex-wrap items-center justify-between text-xs pt-1 gap-2">
            <div className="flex items-center gap-3">
              <span className="text-slate-600">
                <strong className="text-emerald-700 font-bold">{selectedContacts.size}</strong> contact(s) selected
              </span>
              {eligibleOnCurrentPage.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAllPage}
                  className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  {areAllCurrentPageEligibleSelected
                    ? 'Deselect all on this page'
                    : `Select all eligible on page (${eligibleOnCurrentPage.length})`}
                </button>
              )}
            </div>

            {selectedContacts.size > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs font-semibold text-rose-600 hover:underline"
              >
                Clear All Selected
              </button>
            )}
          </div>
        </div>

        {/* Contacts Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-xs font-medium text-slate-500">Loading directory contacts...</p>
            </div>
          ) : loadError ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{loadError}</div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No contacts found</p>
              <p className="text-xs text-slate-400 mt-1">
                Try adjusting your search query or filters.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={areAllCurrentPageEligibleSelected}
                          onChange={handleToggleSelectAllPage}
                          disabled={eligibleOnCurrentPage.length === 0}
                          className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:opacity-40"
                          title="Select all eligible on this page"
                        />
                      </th>
                      <th className="py-3 px-3">Contact</th>
                      <th className="py-3 px-3">WhatsApp Number</th>
                      <th className="py-3 px-3">Opt-In Status</th>
                      <th className="py-3 px-3">Tags &amp; Groups</th>
                      <th className="py-3 px-3">Eligibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contacts.map((c) => {
                      const key = String(c.id ?? c._id ?? c.contact_id);
                      const isSelected = selectedContacts.has(key);
                      const eligibility = isContactEligible(c);
                      const isEligible = eligibility.eligible;
                      const details = c.contact_details || {};
                      const contactName =
                        details.name ||
                        details.contact_name ||
                        (details.first_name ? `${details.first_name} ${details.last_name || ''}`.trim() : null) ||
                        c.custom_variables?.name ||
                        c.custom_variables?.first_name ||
                        '—';

                      return (
                        <tr
                          key={key}
                          onClick={() => {
                            if (isEligible) handleToggleSelect(c);
                          }}
                          className={`transition-colors ${
                            !isEligible
                              ? 'bg-slate-50/50 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-emerald-50/60 cursor-pointer'
                              : 'hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isEligible}
                              onChange={() => handleToggleSelect(c)}
                              className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* Contact Info */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{contactName}</div>
                            {c.contact_id && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                ID: #{c.contact_id}
                              </div>
                            )}
                          </td>

                          {/* WhatsApp Phone */}
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {c.whatsapp_number}
                          </td>

                          {/* Opt-In Status */}
                          <td className="py-2.5 px-3">
                            {isEligible ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                Opted In
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <ShieldAlert className="w-3 h-3 text-amber-600" />
                                {c.opt_in_status || 'Pending'}
                              </span>
                            )}
                          </td>

                          {/* Tags & Groups */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {Array.isArray(c.tags) &&
                                c.tags.slice(0, 2).map((t) => (
                                  <span
                                    key={t}
                                    className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md"
                                  >
                                    #{t}
                                  </span>
                                ))}
                              {Array.isArray(c.groups) &&
                                c.groups.slice(0, 2).map((g) => (
                                  <span
                                    key={g}
                                    className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md"
                                  >
                                    {g}
                                  </span>
                                ))}
                            </div>
                          </td>

                          {/* Eligibility Status */}
                          <td className="py-2.5 px-3">
                            {isEligible ? (
                              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Eligible
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-rose-600 flex items-center gap-1" title={eligibility.reason}>
                                <AlertCircle className="w-3.5 h-3.5" />
                                {eligibility.reason || 'Ineligible'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Rich Pagination & Action Buttons */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Pagination Navigation & Info */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 w-full lg:w-auto justify-between sm:justify-start">
            {/* Showing items text */}
            <span className="font-medium text-slate-500">
              Showing{' '}
              <strong className="text-slate-800">
                {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
              </strong>
              –
              <strong className="text-slate-800">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </strong>{' '}
              of <strong className="text-slate-800">{pagination.total}</strong>
            </span>

            {/* Rows Per Page Selector */}
            <div className="flex items-center gap-1.5 sm:pl-2 sm:border-l sm:border-slate-200">
              <span className="text-[11px] text-slate-400">Rows:</span>
              <select
                value={pagination.limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>

            {/* Page Navigation Controls */}
            <div className="flex items-center gap-1 sm:pl-2 sm:border-l sm:border-slate-200">
              {/* First Page button */}
              <button
                type="button"
                disabled={pagination.page <= 1 || isLoading}
                onClick={() => goToPage(1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors"
                title="Go to first page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>

              {/* Prev Page button */}
              <button
                type="button"
                disabled={pagination.page <= 1 || isLoading}
                onClick={() => goToPage(pagination.page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors"
                title="Go to previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Numbered Page Buttons */}
              <div className="flex items-center gap-1">
                {pageNumbers.map((p, idx) => {
                  if (p === 'ellipsis') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold select-none">
                        ...
                      </span>
                    );
                  }
                  const pageNum = p as number;
                  const isCurrent = pageNum === pagination.page;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      disabled={isLoading}
                      onClick={() => goToPage(pageNum)}
                      className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition-all ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-xs font-bold'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                      title={`Go to page ${pageNum}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              {/* Next Page button */}
              <button
                type="button"
                disabled={pagination.page >= (pagination.pages || 1) || isLoading}
                onClick={() => goToPage(pagination.page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors"
                title="Go to next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Last Page button */}
              <button
                type="button"
                disabled={pagination.page >= (pagination.pages || 1) || isLoading}
                onClick={() => goToPage(pagination.pages || 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors"
                title="Go to last page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>

              {/* Quick Jump Dropdown if more than 3 pages */}
              {(pagination.pages || 1) > 3 && (
                <div className="hidden md:flex items-center gap-1 ml-1.5">
                  <span className="text-[11px] text-slate-400">Jump:</span>
                  <select
                    value={pagination.page}
                    onChange={(e) => goToPage(Number(e.target.value))}
                    disabled={isLoading}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((pg) => (
                      <option key={pg} value={pg}>
                        {pg}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Cancel and Import */}
          <div className="flex items-center gap-2 self-end lg:self-auto flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedContacts.size === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
            >
              <span>Import Selected ({selectedContacts.size})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
