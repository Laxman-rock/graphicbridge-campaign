'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit3,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  SlidersHorizontal,
  X,
  Phone,
  Tag,
  Folder,
  Layers,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  WhatsAppContactItem,
  WhatsAppContactListParams,
} from '@/types/whatsapp';
import {
  listWhatsAppContacts,
  deleteWhatsAppContact,
  optInWhatsAppContact,
  optOutWhatsAppContact,
} from '@/lib/whatsapp-api';
import { hasPermission } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import WhatsAppContactModal from './contacts/WhatsAppContactModal';
import WhatsAppContactDetailsModal from './contacts/WhatsAppContactDetailsModal';
import WhatsAppContactImportModal from './contacts/WhatsAppContactImportModal';

// Helper to format display date safely
function formatDate(dateVal?: string | number | null): string {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function WhatsAppContactsManager() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  // Contacts & Pagination state
  const [contacts, setContacts] = useState<WhatsAppContactItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters state
  const [searchPhone, setSearchPhone] = useState('');
  const [optInStatus, setOptInStatus] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<WhatsAppContactItem | null>(null);

  // Details Modal
  const [detailsContactId, setDetailsContactId] = useState<string | number | null>(null);
  const [detailsInitialContact, setDetailsInitialContact] = useState<WhatsAppContactItem | null>(null);

  // Delete Confirmation Modal
  const [contactToDelete, setContactToDelete] = useState<WhatsAppContactItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Opt-Out Confirmation Modal
  const [contactToOptOut, setContactToOptOut] = useState<WhatsAppContactItem | null>(null);
  const [isOptingOut, setIsOptingOut] = useState(false);

  // Permissions
  const canCreate = hasPermission('whatsapp.contacts.create');
  const canImport = hasPermission('whatsapp.contacts.import');
  const canView = hasPermission('whatsapp.contacts.view');
  const canEdit = hasPermission('whatsapp.contacts.edit');
  const canDelete = hasPermission('whatsapp.contacts.delete');

  // Fetch contacts from backend
  const fetchContacts = useCallback(
    async (pageToLoad = pagination.page, isSilent = false) => {
      if (!isSilent) setIsLoading(true);
      setLoadError(null);

      try {
        const params: WhatsAppContactListParams = {
          page: pageToLoad,
          limit: pagination.limit,
        };

        if (searchPhone.trim()) {
          params.phone_number = searchPhone.trim();
        }
        if (optInStatus !== 'all') {
          params.opt_in_status = optInStatus;
        }
        if (tagFilter.trim()) {
          params.tag = tagFilter.trim();
        }
        if (groupFilter.trim()) {
          params.group = groupFilter.trim();
        }
        if (activeFilter !== 'all') {
          params.is_active = activeFilter === 'active';
        }

        const res = await listWhatsAppContacts(params);
        if (res.success && res.data) {
          setContacts(res.data);
          if (res.pagination) {
            setPagination(res.pagination);
          } else {
            setPagination((prev) => ({
              ...prev,
              page: pageToLoad,
              total: res.total ?? res.data?.length ?? 0,
              pages: Math.max(1, Math.ceil((res.total ?? res.data?.length ?? 0) / prev.limit)),
            }));
          }
        } else {
          const msg = res.error || 'Failed to load WhatsApp contacts.';
          setLoadError(msg);
          if (!isSilent) toastError(msg, 'Error');
        }
      } catch (err: any) {
        const msg = err?.message || 'Could not connect to backend server.';
        setLoadError(msg);
        if (!isSilent) toastError(msg, 'Connection Error');
      } finally {
        if (!isSilent) setIsLoading(false);
      }
    },
    [pagination.page, pagination.limit, searchPhone, optInStatus, tagFilter, groupFilter, activeFilter]
  );

  useEffect(() => {
    fetchContacts(pagination.page);
  }, [fetchContacts, pagination.page]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchContacts(1);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchPhone('');
    setOptInStatus('all');
    setTagFilter('');
    setGroupFilter('');
    setActiveFilter('all');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Handle Soft Delete
  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteWhatsAppContact(
        contactToDelete.id ?? contactToDelete._id ?? contactToDelete.contact_id
      );
      if (res.success) {
        toastSuccess(res.message || 'Contact removed successfully.', 'Deleted');
        setContactToDelete(null);
        fetchContacts(pagination.page, true);
      } else {
        toastError(res.error || 'Failed to delete contact.', 'Error');
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to delete contact.', 'Error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Opt-in quick toggle
  const handleQuickOptIn = async (item: WhatsAppContactItem) => {
    if (!canEdit) {
      toastError('Permission required: whatsapp.contacts.edit', 'Unauthorized');
      return;
    }
    try {
      const res = await optInWhatsAppContact(item.id ?? item._id ?? item.contact_id, 'manual');
      if (res.success) {
        toastSuccess('Consent updated to Opted In.', 'Opt-In Confirmed');
        fetchContacts(pagination.page, true);
      } else {
        toastError(res.error || 'Failed to opt in contact.', 'Error');
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to update consent.', 'Error');
    }
  };

  // Handle Opt-out confirmation
  const handleConfirmOptOut = async () => {
    if (!contactToOptOut) return;
    setIsOptingOut(true);
    try {
      const res = await optOutWhatsAppContact(
        contactToOptOut.id ?? contactToOptOut._id ?? contactToOptOut.contact_id
      );
      if (res.success) {
        toastSuccess('Contact consent updated to Opted Out.', 'Opt-Out Confirmed');
        setContactToOptOut(null);
        fetchContacts(pagination.page, true);
      } else {
        toastError(res.error || 'Failed to opt out contact.', 'Error');
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to update consent.', 'Error');
    } finally {
      setIsOptingOut(false);
    }
  };

  // Copy number to clipboard
  const handleCopyPhone = (phoneNum: string) => {
    navigator.clipboard.writeText(phoneNum);
    toastInfo(`Copied ${phoneNum} to clipboard`, 'Copied');
  };

  const hasActiveFilters =
    searchPhone.trim() !== '' ||
    optInStatus !== 'all' ||
    tagFilter.trim() !== '' ||
    groupFilter.trim() !== '' ||
    activeFilter !== 'all';

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Controls: Refresh, Import, Add */}
      <div className="flex items-center justify-end gap-2.5">
        {/* Refresh Button */}
        <button
            type="button"
            onClick={() => fetchContacts(pagination.page)}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-colors"
            title="Refresh contacts"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {/* Import CSV Button */}
          <button
            type="button"
            disabled={!canImport}
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canImport ? 'Permission required: whatsapp.contacts.import' : undefined}
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Import CSV</span>
          </button>

          {/* Add Contact Button */}
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canCreate ? 'Permission required: whatsapp.contacts.create' : undefined}
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Phone Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              placeholder="Search by WhatsApp phone number..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchPhone && (
              <button
                type="button"
                onClick={() => {
                  setSearchPhone('');
                  fetchContacts(1);
                }}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Opt-In Status Filter */}
          <select
            value={optInStatus}
            onChange={(e) => {
              setOptInStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">Opt-In: All</option>
            <option value="opted_in">Opted In</option>
            <option value="opted_out">Opted Out</option>
            <option value="pending">Pending</option>
          </select>

          {/* Active Status Filter */}
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">Status: All</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {/* Tag Filter */}
          <input
            type="text"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Filter by tag (e.g. vip)..."
            className="w-full md:w-44 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />

          {/* Group Filter */}
          <input
            type="text"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            placeholder="Filter by group..."
            className="w-full md:w-44 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Apply
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Contacts Table Container */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {/* Loading Skeleton */}
        {isLoading && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs font-medium text-slate-500">Loading WhatsApp contacts from server...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && loadError && (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Failed to Load Contacts</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">{loadError}</p>
            <button
              type="button"
              onClick={() => fetchContacts(pagination.page)}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xs hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !loadError && contacts.length === 0 && (
          <div className="py-20 px-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">
                {hasActiveFilters ? 'No contacts match your filters' : 'No WhatsApp Contacts Found'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'Try clearing your search query or filters to view all enrolled recipients.'
                  : 'Start building your audience by adding individual contacts or importing a CSV file.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Clear Filters
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!canCreate}
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    Add First Contact
                  </button>
                  <button
                    type="button"
                    disabled={!canImport}
                    onClick={() => setIsImportModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    Import CSV
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !loadError && contacts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">WhatsApp Number</th>
                  <th className="py-3.5 px-4">Contact ID</th>
                  <th className="py-3.5 px-4">Opt-In Status</th>
                  <th className="py-3.5 px-4">Method</th>
                  <th className="py-3.5 px-4">Tags &amp; Groups</th>
                  <th className="py-3.5 px-4">Custom Vars</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((c) => {
                  const details = c.contact_details || {};
                  const displayName =
                    details.name ||
                    details.contact_name ||
                    (details.first_name ? `${details.first_name} ${details.last_name || ''}`.trim() : null) ||
                    c.custom_variables?.name ||
                    c.custom_variables?.first_name ||
                    'Contact';

                  const optInStatusLower = c.opt_in_status?.toLowerCase();
                  const isOptIn =
                    optInStatusLower === 'opted_in' ||
                    optInStatusLower === 'opt-in' ||
                    optInStatusLower === 'yes' ||
                    optInStatusLower === 'true';
                  const isOptOut =
                    optInStatusLower === 'opted_out' ||
                    optInStatusLower === 'opt-out' ||
                    optInStatusLower === 'no' ||
                    optInStatusLower === 'false';

                  const isActive = c.is_active ?? c.active ?? true;

                  const customVarCount = c.custom_variables
                    ? Object.keys(c.custom_variables).length
                    : 0;

                  return (
                    <tr
                      key={String(c.id ?? c._id ?? c.contact_id)}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => {
                        setDetailsContactId(c.id ?? c._id ?? c.contact_id);
                        setDetailsInitialContact(c);
                      }}
                    >
                      {/* Contact Name & Master Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                            {displayName.charAt(0) || <Phone className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate group-hover:text-emerald-600 transition-colors">
                              {displayName}
                            </span>
                            {details.email && (
                              <span className="text-[10px] text-slate-400 block truncate">
                                {details.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* WhatsApp Phone Number */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-900">
                          <span>{c.whatsapp_number}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(c.whatsapp_number)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            title="Copy number"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Contact ID */}
                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-500">
                        {c.contact_id}
                      </td>

                      {/* Opt-In Badge */}
                      <td className="py-3 px-4">
                        {isOptIn ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Opted In
                          </span>
                        ) : isOptOut ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldAlert className="w-3 h-3" />
                            Opted Out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Opt-in Method */}
                      <td className="py-3 px-4 text-[11px] text-slate-500 capitalize">
                        {c.opt_in_method || 'manual'}
                      </td>

                      {/* Tags & Groups */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1 max-w-xs">
                          {Array.isArray(c.tags) &&
                            c.tags.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="text-[10px] font-medium bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md border border-emerald-200"
                              >
                                #{t}
                              </span>
                            ))}
                          {Array.isArray(c.groups) &&
                            c.groups.slice(0, 1).map((g) => (
                              <span
                                key={g}
                                className="text-[10px] font-medium bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md border border-indigo-200"
                              >
                                {g}
                              </span>
                            ))}
                          {((c.tags?.length || 0) + (c.groups?.length || 0) > 3) && (
                            <span className="text-[10px] text-slate-400 font-semibold">
                              +{(c.tags?.length || 0) + (c.groups?.length || 0) - 3}
                            </span>
                          )}
                          {(!c.tags || c.tags.length === 0) && (!c.groups || c.groups.length === 0) && (
                            <span className="text-[11px] text-slate-300">—</span>
                          )}
                        </div>
                      </td>

                      {/* Custom Variables */}
                      <td className="py-3 px-4">
                        {customVarCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Layers className="w-3 h-3 text-slate-400" />
                            {customVarCount} vars
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Active Status */}
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {formatDate(c.created_at || c.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* View Details */}
                          <button
                            type="button"
                            onClick={() => {
                              setDetailsContactId(c.id ?? c._id ?? c.contact_id);
                              setDetailsInitialContact(c);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="View Contact Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setEditingContact(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={!canEdit ? 'Permission required: whatsapp.contacts.edit' : 'Edit Contact'}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Opt-In / Opt-Out Quick Toggle */}
                          {isOptIn ? (
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => setContactToOptOut(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={!canEdit ? 'Permission required: whatsapp.contacts.edit' : 'Opt-Out Contact'}
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => handleQuickOptIn(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={!canEdit ? 'Permission required: whatsapp.contacts.edit' : 'Opt-In Contact'}
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete (Soft) */}
                          <button
                            type="button"
                            disabled={!canDelete}
                            onClick={() => setContactToDelete(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={!canDelete ? 'Permission required: whatsapp.contacts.delete' : 'Delete Contact'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && !loadError && contacts.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/50">
            <span className="text-slate-500 font-medium">
              Showing{' '}
              <strong className="text-slate-800">
                {(pagination.page - 1) * pagination.limit + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-800">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </strong>{' '}
              of <strong className="text-slate-800">{pagination.total}</strong> contacts
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => {
                  const newPage = pagination.page - 1;
                  setPagination((p) => ({ ...p, page: newPage }));
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold shadow-xs flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <span className="text-xs font-semibold text-slate-600 px-2">
                Page {pagination.page} of {pagination.pages || 1}
              </span>

              <button
                type="button"
                disabled={pagination.page >= (pagination.pages || 1)}
                onClick={() => {
                  const newPage = pagination.page + 1;
                  setPagination((p) => ({ ...p, page: newPage }));
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold shadow-xs flex items-center gap-1 transition-colors"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal */}
      <WhatsAppContactModal
        isOpen={isAddModalOpen || !!editingContact}
        contact={editingContact}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingContact(null);
        }}
        onSuccess={() => {
          fetchContacts(pagination.page, true);
        }}
      />

      {/* View Contact Details Modal */}
      <WhatsAppContactDetailsModal
        isOpen={!!detailsContactId}
        contactId={detailsContactId}
        initialContact={detailsInitialContact}
        onClose={() => {
          setDetailsContactId(null);
          setDetailsInitialContact(null);
        }}
        onStatusChanged={() => {
          fetchContacts(pagination.page, true);
        }}
      />

      {/* Bulk CSV Import Modal */}
      <WhatsAppContactImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          fetchContacts(1);
        }}
      />

      {/* Soft Delete Confirmation Dialog */}
      {contactToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">Delete WhatsApp Contact</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to remove contact{' '}
                <strong className="text-slate-800 font-mono">
                  {contactToDelete.whatsapp_number}
                </strong>{' '}
                (Contact ID: {contactToDelete.contact_id})? This is a soft delete on the server.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setContactToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete Contact</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Opt-Out Confirmation Dialog */}
      {contactToOptOut && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">Revoke WhatsApp Opt-In Consent</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Opt out recipient{' '}
                <strong className="text-slate-800 font-mono">
                  {contactToOptOut.whatsapp_number}
                </strong>
                ? This contact will immediately become ineligible for future marketing and transactional dispatches.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={isOptingOut}
                onClick={() => setContactToOptOut(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isOptingOut}
                onClick={handleConfirmOptOut}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {isOptingOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Opting Out...</span>
                  </>
                ) : (
                  <span>Confirm Opt-Out</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

