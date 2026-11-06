'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RotateCcw,
  MessageSquare,
  Server,
  X,
  Phone,
  Trash2,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  WhatsAppCampaignSummary,
  WhatsAppCampaignDetail,
  WhatsAppCampaignStatus,
  WhatsAppRecipientStatus,
  WhatsAppCampaignMode,
  WhatsAppQueueStatusResponse,
} from '@/types/whatsapp';
import {
  listWhatsAppCampaigns,
  getWhatsAppCampaign,
  retryWhatsAppCampaign,
  getWhatsAppQueueStatus,
  deleteWhatsAppCampaign,
  calculateCampaignMetrics,
  getFriendlyDiagnosticReason,
} from '@/lib/whatsapp-api';
import { useToast } from '@/components/ui/Toast';

// Helper to safely format dates (supports created_at, createdAt, timestamps, and ISO strings)
export function formatDisplayDate(dateVal?: string | number | Date | null): string {
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

export function formatDisplayDateTime(dateVal?: string | number | Date | null): string {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// Helper to format campaign name to show only the first 3 words (e.g. coimbatore_corporate_marketing)
export function formatCampaignDisplayName(name?: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();

  // If underscore delimited (e.g. coimbatore_corporate_marketing_manager_emails...)
  if (trimmed.includes('_')) {
    const parts = trimmed.split('_').filter(Boolean);
    if (parts.length >= 3) {
      return parts.slice(0, 3).join('_');
    }
    return trimmed;
  }

  // If space delimited (e.g. Coimbatore Corporate Marketing Manager...)
  const spaceParts = trimmed.split(/\s+/).filter(Boolean);
  if (spaceParts.length >= 3) {
    return spaceParts.slice(0, 3).join(' ');
  }

  // If hyphen delimited (e.g. coimbatore-corporate-marketing-manager...)
  if (trimmed.includes('-')) {
    const hyphenParts = trimmed.split('-').filter(Boolean);
    if (hyphenParts.length >= 3) {
      return hyphenParts.slice(0, 3).join('-');
    }
  }

  return trimmed;
}

export default function WhatsAppCampaignsList() {
  const { error: toastError, success: toastSuccess } = useToast();

  const [campaigns, setCampaigns] = useState<WhatsAppCampaignSummary[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [queueStatus, setQueueStatus] = useState<WhatsAppQueueStatusResponse['data'] | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');

  // Detail Modal State
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | number | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<WhatsAppCampaignDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Delete Confirmation State
  const [campaignToDelete, setCampaignToDelete] = useState<WhatsAppCampaignSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCampaigns = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const params: {
        page: number;
        limit: number;
        status?: WhatsAppCampaignStatus;
        mode?: WhatsAppCampaignMode;
      } = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter as WhatsAppCampaignStatus;
      }
      if (modeFilter !== 'all') {
        params.mode = modeFilter as WhatsAppCampaignMode;
      }

      const res = await listWhatsAppCampaigns(params);
      if (res.success && res.data) {
        const reconciled = res.data.map((c) => {
          const sent = c.sent_count || 0;
          const total = c.total_recipients || 0;
          const failed = c.failed_count || 0;

          if (
            (c.status as string) === 'completed' ||
            (c.status as string) === 'sent' ||
            c.completed_at ||
            (total > 0 && sent + failed >= total)
          ) {
            const status: WhatsAppCampaignStatus =
              failed > 0 && sent > 0
                ? 'partially_failed'
                : failed > 0
                ? 'failed'
                : 'completed';
            return { ...c, status };
          }
          return c;
        });

        setCampaigns(reconciled);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else if (!isSilent) {
        toastError(res.error || 'Failed to fetch WhatsApp campaigns list.', 'Error');
      }
    } catch {
      if (!isSilent) {
        toastError('Could not load campaigns list.', 'Error');
      }
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, modeFilter]);

  const fetchQueue = async () => {
    try {
      const res = await getWhatsAppQueueStatus();
      if (res.success && res.data) {
        setQueueStatus(res.data);
      }
    } catch {
      // Ignore background queue fetch error
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchQueue();
  }, [fetchCampaigns]);

  // Auto-refresh when any campaigns are queued, sending, or processing
  useEffect(() => {
    const hasActive = campaigns.some(
      (c) =>
        (c.status as string) === 'processing' ||
        (c.status as string) === 'sending' ||
        c.status === 'queued'
    );
    if (!hasActive) return;

    const timer = setInterval(() => {
      fetchCampaigns(true);
      fetchQueue();
    }, 4000);

    return () => clearInterval(timer);
  }, [campaigns, fetchCampaigns]);

  const handleOpenDetail = async (
    id: string | number,
    fallbackId?: string | number,
    isSilent = false
  ) => {
    setSelectedCampaignId(id);
    if (!isSilent) setIsLoadingDetail(true);
    try {
      const res = await getWhatsAppCampaign(id, fallbackId);
      if (res.success && res.data) {
        const detail = res.data;
        const recs = detail.recipients || [];

        let resolvedStatus: WhatsAppCampaignStatus = detail.status;
        let resolvedTotal = detail.total_recipients;
        let resolvedSent = detail.sent_count;

        if (recs.length > 0) {
          const sentRecs = recs.filter(
            (r) => r.status === 'accepted' || (r.status as string) === 'sent'
          ).length;
          const failedRecs = recs.filter((r) => r.status === 'failed').length;
          const allSent = recs.every(
            (r) => r.status === 'accepted' || (r.status as string) === 'sent'
          );
          const noPending = !recs.some(
            (r) =>
              r.status === 'queued' ||
              r.status === 'sending' ||
              (r.status as string) === 'processing'
          );

          if (allSent || (sentRecs > 0 && noPending)) {
            resolvedStatus =
              failedRecs > 0 && sentRecs > 0
                ? 'partially_failed'
                : failedRecs > 0 && sentRecs === 0
                ? 'failed'
                : 'completed';
            resolvedSent = Math.max(detail.sent_count, sentRecs);
            if (
              recs.length < detail.total_recipients &&
              sentRecs === recs.length &&
              failedRecs === 0
            ) {
              resolvedTotal = recs.length;
            }
          }
        }

        const reconciledDetail: WhatsAppCampaignDetail = {
          ...detail,
          status: resolvedStatus,
          sent_count: resolvedSent,
          total_recipients: resolvedTotal,
        };

        setCampaignDetail(reconciledDetail);

        setCampaigns((prev) =>
          prev.map((c) =>
            c._id === id ||
            c.id === id ||
            (fallbackId && (c._id === fallbackId || c.id === fallbackId))
              ? {
                  ...c,
                  status: resolvedStatus,
                  sent_count: resolvedSent,
                  total_recipients: resolvedTotal,
                }
              : c
          )
        );
      } else if (!isSilent) {
        toastError(res.error || 'Failed to fetch campaign details.', 'Error');
      }
    } catch {
      if (!isSilent) {
        toastError('Could not load campaign details.', 'Error');
      }
    } finally {
      if (!isSilent) setIsLoadingDetail(false);
    }
  };

  // Live auto-refresh for open details modal while campaign is queued or sending
  useEffect(() => {
    if (!selectedCampaignId || !campaignDetail) return;
    const s = (campaignDetail.status as string || '').toLowerCase();
    const isActive = s === 'queued' || s === 'sending' || s === 'processing';
    if (!isActive) return;

    const timer = setInterval(() => {
      const primary = campaignDetail.id ?? campaignDetail._id ?? selectedCampaignId;
      const fallback = campaignDetail._id ?? campaignDetail.id;
      handleOpenDetail(primary, fallback, true);
    }, 3000);

    return () => clearInterval(timer);
  }, [selectedCampaignId, campaignDetail?.status, campaignDetail?.id, campaignDetail?._id]);

  const handleRetryFailed = async (id: string | number, fallbackId?: string | number) => {
    if (isRetrying) return;
    const currentStatus = campaignDetail?.status;
    if (
      (currentStatus as string) === 'sending' ||
      (currentStatus as string) === 'processing'
    ) {
      toastError(
        'Campaign is currently sending dispatches. Please wait until finished.',
        'Retry Unavailable'
      );
      return;
    }

    setIsRetrying(true);
    try {
      const res = await retryWhatsAppCampaign(id, fallbackId);
      if (res.success) {
        const retriedCount =
          res.retried_count ??
          res.count ??
          campaignDetail?.failed_count ??
          0;
        toastSuccess(
          res.message || `Retry queued for ${retriedCount} recipients.`,
          'Retry Queued'
        );
        await handleOpenDetail(id, fallbackId);
        fetchCampaigns(true);
      } else {
        toastError(res.error || 'Failed to retry recipients.', 'Retry Failed');
      }
    } catch {
      toastError('Retry request failed.', 'Error');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    const campId = campaignToDelete.id ?? campaignToDelete._id;
    const fallbackId = campaignToDelete._id ?? campaignToDelete.id;
    setIsDeleting(true);
    try {
      const res = await deleteWhatsAppCampaign(campId, fallbackId);
      setCampaigns((prev) =>
        prev.filter(
          (c) =>
            c.id !== campId &&
            c._id !== campId &&
            c.id !== fallbackId &&
            c._id !== fallbackId
        )
      );
      if (selectedCampaignId === campId || selectedCampaignId === fallbackId) {
        setSelectedCampaignId(null);
        setCampaignDetail(null);
      }
      setPagination((p) => ({
        ...p,
        total: Math.max(0, p.total - 1),
      }));
      toastSuccess(
        res.message || `WhatsApp campaign "${campaignToDelete.campaign_name}" was deleted successfully.`,
        'Campaign Deleted'
      );
      setCampaignToDelete(null);
    } catch {
      setCampaigns((prev) => prev.filter((c) => (c._id || c.id) !== campId));
      if (selectedCampaignId === campId) {
        setSelectedCampaignId(null);
        setCampaignDetail(null);
      }
      toastSuccess(
        `WhatsApp campaign "${campaignToDelete.campaign_name}" removed from history.`,
        'Campaign Removed'
      );
      setCampaignToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const getCampaignStatusBadge = (status: WhatsAppCampaignStatus | string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'completed':
      case 'accepted':
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Accepted
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Queued
          </span>
        );
      case 'sending':
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            Sending...
          </span>
        );
      case 'partially_failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            Partially Failed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
            {status}
          </span>
        );
    }
  };

  const getRecipientStatusBadge = (status: WhatsAppRecipientStatus | string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'accepted':
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Accepted
          </span>
        );
      case 'sending':
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
            Sending...
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            Queued
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Queue Status Strip */}
      {queueStatus && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900">WhatsApp Queue Engine: </span>
              <span className="font-mono text-slate-600">{queueStatus.queueName}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  queueStatus.isRedisAvailable ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span className="text-slate-600">
                Redis: {queueStatus.isRedisAvailable ? 'Connected' : 'Unavailable'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  queueStatus.bullmqActive ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="text-slate-600">
                BullMQ: {queueStatus.bullmqActive ? 'Active' : 'In-Process Fallback'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 shadow-sm"
            >
              <option value="all">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="sending">Sending...</option>
              <option value="completed">Accepted</option>
              <option value="partially_failed">Partially Failed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">Mode:</label>
            <select
              value={modeFilter}
              onChange={(e) => {
                setModeFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 shadow-sm"
            >
              <option value="all">All Modes</option>
              <option value="template">Template</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            fetchCampaigns();
            fetchQueue();
          }}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-emerald-600 shadow-sm transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium">Loading WhatsApp campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-800">No campaigns found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven&apos;t launched any WhatsApp bulk campaigns yet or no campaigns match the filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Campaign Name</th>
                  <th className="py-3.5 px-4">Mode / Template</th>
                  <th className="py-3.5 px-4">Progress / Recipients</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((camp) => {
                  const sent = camp.sent_count || 0;
                  const total = camp.total_recipients || 0;
                  const failed = camp.failed_count || 0;
                  const isCompletedOrSent =
                    (camp.status as string) === 'completed' ||
                    (camp.status as string) === 'sent' ||
                    Boolean(camp.completed_at) ||
                    (total > 0 && sent + failed >= total);

                  const displayStatus = isCompletedOrSent
                    ? failed > 0 && sent > 0
                    ? 'partially_failed'
                    : failed > 0
                    ? 'failed'
                    : 'completed'
                    : camp.status;

                  const { progress, successRate } = calculateCampaignMetrics(total, sent, failed);

                  return (
                    <tr
                      key={camp._id || camp.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900" title={camp.campaign_name}>
                          {formatCampaignDisplayName(camp.campaign_name)}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          ID: {camp.id ?? camp._id}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 capitalize">
                            {camp.mode}
                          </span>
                          {camp.template_name && (
                            <span className="text-[11px] font-mono text-emerald-600">
                              {camp.template_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 min-w-[180px]">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[11px] font-medium text-slate-700">
                            <span>
                              <strong className="text-emerald-700 font-bold">{sent}</strong>/{total} accepted
                            </span>
                            {failed > 0 && (
                              <span className="text-rose-600 font-semibold flex items-center gap-0.5">
                                <AlertCircle className="w-3 h-3 inline" />
                                {failed} failed
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0}%` }}
                              className="bg-emerald-500 h-full transition-all"
                              title={`${sent} accepted (${successRate}%)`}
                            />
                            {failed > 0 && (
                              <div
                                style={{
                                  width: `${total > 0 ? Math.min(100, Math.round((failed / total) * 100)) : 0}%`,
                                }}
                                className="bg-rose-500 h-full transition-all"
                                title={`${failed} failed`}
                              />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Progress: {progress}%</span>
                            <span>Success: {successRate}%</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">{getCampaignStatusBadge(displayStatus)}</td>
                      <td
                        className="py-4 px-4 text-slate-500 text-[11px] whitespace-nowrap"
                        title={formatDisplayDateTime(camp.created_at || (camp as any).createdAt)}
                      >
                        {formatDisplayDate(camp.created_at || (camp as any).createdAt)}
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenDetail(
                                camp.id ?? camp._id,
                                camp._id ?? camp.id
                              )
                            }
                            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-emerald-600 hover:bg-slate-50 hover:border-emerald-200 transition-colors shadow-2xs"
                            title="Preview Campaign"
                            aria-label="Preview Campaign"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setCampaignToDelete(camp)}
                            className="p-2 rounded-xl border border-rose-200 bg-white text-rose-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition-colors shadow-2xs"
                            title="Delete Campaign"
                            aria-label="Delete Campaign"
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

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {pagination.page} of {pagination.pages} ({pagination.total} campaigns)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Campaign Detail Modal */}
      {selectedCampaignId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 break-words">
                    {campaignDetail?.campaign_name || 'Campaign Details'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                    <span>
                      ID: <span className="font-mono">{campaignDetail?.id ?? campaignDetail?._id ?? selectedCampaignId}</span>
                    </span>
                    <span>•</span>
                    <span>
                      Mode: <span className="capitalize font-medium">{campaignDetail?.mode || '...'}</span>
                    </span>
                    {(campaignDetail?.created_at || (campaignDetail as any)?.createdAt) && (
                      <>
                        <span>•</span>
                        <span>
                          Date: <strong className="text-slate-700 font-semibold">{formatDisplayDateTime(campaignDetail?.created_at || (campaignDetail as any)?.createdAt)}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const primary =
                      campaignDetail?.id ?? campaignDetail?._id ?? selectedCampaignId;
                    const fallback = campaignDetail?._id ?? campaignDetail?.id;
                    if (primary) handleOpenDetail(primary, fallback);
                  }}
                  disabled={isLoadingDetail}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors disabled:opacity-50"
                  title="Refresh campaign status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDetail ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCampaignId(null);
                    setCampaignDetail(null);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {isLoadingDetail ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                  <p className="text-sm font-medium">Loading campaign details...</p>
                </div>
              ) : campaignDetail ? (
                <>
                  {/* Status & Counts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-400 font-medium">Status:</span>
                      <div className="mt-1">{getCampaignStatusBadge(campaignDetail.status)}</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-400 font-medium">Total Contacts:</span>
                      <p className="text-base font-bold text-slate-900 mt-0.5">
                        {campaignDetail.total_recipients || 0}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                      <span className="text-emerald-700 font-medium">Accepted:</span>
                      <p className="text-base font-bold text-emerald-700 mt-0.5">
                        {campaignDetail.sent_count || 0}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100">
                      <span className="text-rose-700 font-medium">Failed:</span>
                      <p className="text-base font-bold text-rose-700 mt-0.5">
                        {campaignDetail.failed_count || 0}
                      </p>
                    </div>
                  </div>

                  {/* Progress & Success Bar */}
                  {(() => {
                    const metrics = calculateCampaignMetrics(
                      campaignDetail.total_recipients || 0,
                      campaignDetail.sent_count || 0,
                      campaignDetail.failed_count || 0
                    );
                    const total = campaignDetail.total_recipients || 0;
                    const sent = campaignDetail.sent_count || 0;
                    const failed = campaignDetail.failed_count || 0;
                    return (
                      <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">
                            Dispatch Progress: <strong className="text-slate-900">{metrics.progress}%</strong> ({sent + failed}/{total})
                          </span>
                          <span className="font-semibold text-emerald-700">
                            Success Rate: {metrics.successRate}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden flex">
                          <div
                            style={{
                              width: `${total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0}%`,
                            }}
                            className="bg-emerald-500 h-full transition-all"
                            title={`${sent} accepted (${metrics.successRate}%)`}
                          />
                          {failed > 0 && (
                            <div
                              style={{
                                width: `${total > 0 ? Math.min(100, Math.round((failed / total) * 100)) : 0}%`,
                              }}
                              className="bg-rose-500 h-full transition-all"
                              title={`${failed} failed`}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Campaign Details Informational Notice */}
                  <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/70 flex items-start gap-2.5 text-xs text-blue-900">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Accepted status confirms Meta received and accepted the message. Final handset delivery can be monitored in Meta WhatsApp Manager &gt; Insights &gt; Message logs.
                    </p>
                  </div>

                  {/* Retry Failed Option */}
                  {(campaignDetail.status === 'partially_failed' ||
                    campaignDetail.status === 'failed' ||
                    campaignDetail.failed_count > 0) && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <h5 className="font-bold text-amber-900">
                          {campaignDetail.failed_count} numbers failed delivery
                        </h5>
                        <p className="text-amber-700 mt-0.5">
                          Retry failed recipients with automatic exponential backoff. Accepted recipients will not be re-sent.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleRetryFailed(
                            campaignDetail.id ?? campaignDetail._id,
                            campaignDetail._id ?? campaignDetail.id
                          )
                        }
                        disabled={
                          isRetrying ||
                          (campaignDetail.status as string) === 'sending' ||
                          (campaignDetail.status as string) === 'processing'
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm transition-all disabled:opacity-50 flex-shrink-0"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                        <span>
                          {isRetrying
                            ? 'Queueing Retry...'
                            : `Retry Failed Recipients (${campaignDetail.failed_count})`}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Message / Template Preview */}
                  {(campaignDetail.content || campaignDetail.media_url || campaignDetail.template_name) && (
                    <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                      <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp Message Preview</span>
                      </h4>

                      {campaignDetail.media_url && (
                        <div className="max-w-xs rounded-xl overflow-hidden border border-emerald-200 bg-white shadow-2xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={campaignDetail.media_url}
                            alt="Campaign Media"
                            className="w-full h-36 object-cover"
                          />
                        </div>
                      )}

                      {campaignDetail.content && (
                        <div className="p-3 bg-white rounded-xl border border-emerald-100 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                          {campaignDetail.content}
                        </div>
                      )}

                      {campaignDetail.campaign_name && (
                        <div className="text-[11px] text-slate-700">
                          <span className="font-semibold text-slate-600">Campaign / Company Name: </span>
                          <span className="font-bold text-slate-900 break-words">
                            {campaignDetail.campaign_name}
                          </span>
                        </div>
                      )}

                      {campaignDetail.template_name && (
                        <div className="text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700">Meta Template: </span>
                          <span className="font-mono text-emerald-700 font-bold">
                            {campaignDetail.template_name}
                          </span>
                        </div>
                      )}

                      {(campaignDetail.created_at || (campaignDetail as any).createdAt) && (
                        <div className="text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700">Created At: </span>
                          <span className="font-medium text-slate-800">
                            {formatDisplayDateTime(campaignDetail.created_at || (campaignDetail as any).createdAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recipients List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Recipient Delivery Details ({campaignDetail.recipients?.length || 0})
                    </h4>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase">
                          <tr>
                            <th className="py-2.5 px-4">Mobile Number</th>
                            <th className="py-2.5 px-3">Name</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Details / Diagnostics</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {campaignDetail.recipients?.map((rec, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                                {rec.whatsapp_number || rec.phone}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">{rec.name || '—'}</td>
                              <td className="py-2.5 px-3">
                                {getRecipientStatusBadge(rec.status)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                {rec.status === 'failed' ? (
                                  <div className="space-y-1 py-1 max-w-sm">
                                    <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                                      <span>
                                        {getFriendlyDiagnosticReason(rec.diagnostic_reason)}
                                      </span>
                                    </div>
                                    {rec.diagnostic_reason && (
                                      <div>
                                        <span className="inline-block px-1.5 py-0.5 font-mono text-[9px] rounded bg-rose-100 text-rose-800 border border-rose-200">
                                          {rec.diagnostic_reason}
                                        </span>
                                      </div>
                                    )}
                                    {rec.error_message && (
                                      <p className="text-[11px] text-rose-600 leading-snug break-words">
                                        {rec.error_message}
                                      </p>
                                    )}
                                  </div>
                                ) : rec.message_id ? (
                                  <div className="font-mono text-slate-500 text-[11px]">
                                    <span className="text-slate-400">ID:</span> {rec.message_id}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">
                                    {(rec.status as string) === 'sending' ||
                                    (rec.status as string) === 'processing'
                                      ? 'Dispatching via Meta API...'
                                      : 'Pending dispatch'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target =
                    campaigns.find(
                      (c) =>
                        c.id === selectedCampaignId ||
                        c._id === selectedCampaignId ||
                        (campaignDetail && (c.id === campaignDetail.id || c._id === campaignDetail._id))
                    ) || campaignDetail;
                  if (target) setCampaignToDelete(target);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Campaign</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCampaignId(null);
                  setCampaignDetail(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {campaignToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete WhatsApp Campaign</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete{' '}
                  <strong className="text-slate-800">&quot;{campaignToDelete.campaign_name}&quot;</strong>?
                  This action will permanently remove the campaign and its dispatch records from history.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Campaign ID:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {campaignToDelete._id || campaignToDelete.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipients:</span>
                <span className="font-semibold text-slate-800">
                  {campaignToDelete.total_recipients || 0} mobile contacts
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Status:</span>
                <span>{getCampaignStatusBadge(campaignToDelete.status)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCampaignToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteCampaign}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md shadow-rose-500/20 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Campaign</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

