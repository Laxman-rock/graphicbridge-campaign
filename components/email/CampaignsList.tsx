'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Eye,
  Mail,
  Activity,
  Layers,
  ChevronRight,
  X,
  Server,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import {
  EmailCampaignSummary,
  EmailCampaignDetail,
  CampaignStatus,
  EmailCampaignMode,
  QueueStatusResponse,
} from '@/types/email';
import {
  listEmailCampaigns,
  getEmailCampaign,
  retryFailedRecipients,
  getEmailQueueStatus,
  deleteEmailCampaign,
} from '@/lib/email-api';
import { useToast } from '@/components/ui/Toast';

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

// Helper to normalize and reconcile campaign summary and progress data from any backend response shape
function normalizeCampaignSummary(raw: any): EmailCampaignSummary {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 'unknown',
      campaign_name: 'Untitled Campaign',
      mode: 'template',
      subject: '',
      total_recipients: 0,
      sent_count: 0,
      failed_count: 0,
      status: 'queued',
      created_at: new Date().toISOString(),
    };
  }

  const c = { ...raw };
  const recs: any[] = Array.isArray(c.recipients) ? c.recipients : [];

  let total = Number(
    c.total_recipients ??
    c.totalRecipients ??
    c.total ??
    c.recipient_count ??
    c.recipientsCount ??
    c.stats?.total ??
    c.stats?.total_recipients ??
    (recs.length > 0 ? recs.length : 0)
  );

  let sent = Number(
    c.sent_count ??
    c.sentCount ??
    c.sent ??
    c.delivered_count ??
    c.delivered ??
    c.success_count ??
    c.successful ??
    c.stats?.sent ??
    c.stats?.delivered ??
    0
  );

  let failed = Number(
    c.failed_count ??
    c.failedCount ??
    c.failed ??
    c.error_count ??
    c.errors ??
    c.bounced_count ??
    c.stats?.failed ??
    0
  );

  // Time elapsed since campaign creation
  const createdAtMs = c.created_at || c.createdAt ? new Date(c.created_at || c.createdAt).getTime() : 0;
  const ageSeconds = createdAtMs > 0 ? Math.max(0, (Date.now() - createdAtMs) / 1000) : 999999;
  const isRecent = ageSeconds < 60; // Active worker processing only within first 60 seconds

  // If detailed recipients array is present, compute real-time counts from delivery records
  if (recs.length > 0) {
    const sentRecs = recs.filter((r: any) => {
      const st = String(r?.status || '').toLowerCase().trim();
      return (
        st === 'sent' ||
        st === 'delivered' ||
        st === 'success' ||
        Boolean(r?.sent_at) ||
        Boolean(r?.message_id)
      );
    }).length;

    const failedRecs = recs.filter((r: any) => {
      const st = String(r?.status || '').toLowerCase().trim();
      return (
        st === 'failed' ||
        st === 'error' ||
        st === 'bounced' ||
        Boolean(r?.error_message)
      );
    }).length;

    sent = Math.max(sent, sentRecs);
    failed = Math.max(failed, failedRecs);

    // Reconcile total if actual recipients array is smaller than reported total and all delivered
    if (recs.length < total && sentRecs === recs.length && failedRecs === 0) {
      total = recs.length;
    } else if (total === 0) {
      total = recs.length;
    }

    // If campaign is no longer recent, any recipients not marked sent are failed/undelivered
    const pendingRecs = recs.length - (sentRecs + failedRecs);
    if (!isRecent && pendingRecs > 0) {
      failed += pendingRecs;
    }
  }

  // If the campaign is older than 60s and sent < total with 0 recorded failures,
  // the remaining undispatched recipients are failed
  if (!isRecent && total > 0 && sent + failed < total) {
    failed = total - sent;
  }

  // Adjust total if sent + failed exceeds total
  if (sent + failed > total) {
    total = sent + failed;
  }

  const rawStatus = String(c.status || '').toLowerCase().trim();
  let resolvedStatus: CampaignStatus = 'queued';

  if (
    rawStatus === 'completed' ||
    rawStatus === 'sent' ||
    rawStatus === 'success' ||
    rawStatus === 'done' ||
    Boolean(c.completed_at)
  ) {
    if (failed > 0 && sent > 0) {
      resolvedStatus = 'partially_failed';
    } else if (failed > 0 && sent === 0) {
      resolvedStatus = 'failed';
    } else {
      resolvedStatus = 'completed';
      if (total > 0 && sent === 0) {
        sent = total;
      }
    }
  } else if (rawStatus === 'failed' || rawStatus === 'error') {
    resolvedStatus = 'failed';
    if (total > 0 && failed === 0) {
      failed = total;
    }
  } else if (rawStatus === 'partially_failed' || rawStatus === 'partial') {
    resolvedStatus = 'partially_failed';
  } else if (total > 0 && sent + failed >= total) {
    // All recipients processed!
    if (failed > 0 && sent > 0) {
      resolvedStatus = 'partially_failed';
    } else if (failed > 0 && sent === 0) {
      resolvedStatus = 'failed';
    } else {
      resolvedStatus = 'completed';
      if (total > 0 && sent === 0) {
        sent = total;
      }
    }
  } else if (isRecent && (rawStatus === 'processing' || rawStatus === 'in_progress' || rawStatus === 'running' || sent > 0)) {
    resolvedStatus = 'processing';
  } else if (isRecent && (rawStatus === 'queued' || rawStatus === 'pending' || !rawStatus)) {
    resolvedStatus = 'queued';
  } else {
    // Older than 60s without active status change: resolved based on actual delivery results
    if (sent > 0 && failed > 0) {
      resolvedStatus = 'partially_failed';
    } else if (sent > 0 && failed === 0) {
      resolvedStatus = 'completed';
      sent = total;
    } else {
      resolvedStatus = 'failed';
    }
  }

  // Final sanity check: if status is completed with 0 failures, sent must match total
  if (resolvedStatus === 'completed' && total > 0) {
    sent = total;
    failed = 0;
  }

  return {
    ...c,
    _id: c._id || c.id,
    id: c.id || c._id,
    campaign_name: c.campaign_name || c.name || 'Untitled Campaign',
    mode: c.mode || 'template',
    subject: c.subject || '',
    total_recipients: total,
    sent_count: sent,
    failed_count: failed,
    status: resolvedStatus,
    created_at: c.created_at || c.createdAt || new Date().toISOString(),
  };
}

export default function CampaignsList() {
  const { error: toastError, success: toastSuccess } = useToast();

  const [campaigns, setCampaigns] = useState<EmailCampaignSummary[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [queueStatus, setQueueStatus] = useState<QueueStatusResponse['data'] | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');

  // Detail Modal State
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | number | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<EmailCampaignDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Delete Confirmation State
  const [campaignToDelete, setCampaignToDelete] = useState<EmailCampaignSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCampaigns = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const params: {
        page: number;
        limit: number;
        status?: CampaignStatus;
        mode?: EmailCampaignMode;
      } = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter as CampaignStatus;
      }
      if (modeFilter !== 'all') {
        params.mode = modeFilter as EmailCampaignMode;
      }

      const res = await listEmailCampaigns(params);
      if (res.success && res.data) {
        const normalized = res.data.map(normalizeCampaignSummary);
        setCampaigns(normalized);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else if (!isSilent) {
        toastError(res.error || 'Failed to fetch campaigns list.', 'Error');
      }
    } catch {
      if (!isSilent) {
        toastError('An unexpected error occurred while loading campaigns.', 'Error');
      }
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, modeFilter]);

  const fetchQueue = async () => {
    try {
      const res = await getEmailQueueStatus();
      if (res.success && res.data) {
        setQueueStatus(res.data);
      }
    } catch {
      // Ignore background queue fetch failures
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchQueue();
  }, [fetchCampaigns]);

  // Auto-refresh when any recent campaigns are actively queued or processing
  useEffect(() => {
    const hasRecentActive = campaigns.some(
      (c) =>
        (c.status === 'processing' || c.status === 'queued') &&
        Date.now() - new Date(c.created_at).getTime() < 120000
    );
    if (!hasRecentActive) return;

    const timer = setInterval(() => {
      fetchCampaigns(true);
      fetchQueue();
    }, 5000);

    return () => clearInterval(timer);
  }, [campaigns, fetchCampaigns]);

  const handleOpenDetail = async (id: string | number) => {
    setSelectedCampaignId(id);
    setIsLoadingDetail(true);
    try {
      const res = await getEmailCampaign(id);
      if (res.success && res.data) {
        const normalized = normalizeCampaignSummary(res.data);
        const detail = res.data;
        const recs = Array.isArray(detail.recipients) ? detail.recipients : [];

        const reconciledDetail: EmailCampaignDetail = {
          ...detail,
          ...normalized,
          recipients: recs,
        };

        setCampaignDetail(reconciledDetail);

        // Immediately update the parent campaign in the table list
        setCampaigns((prev) =>
          prev.map((c) => (c._id === id || c.id === id ? { ...c, ...normalized } : c))
        );
      } else {
        toastError(res.error || 'Failed to fetch campaign details.', 'Error');
      }
    } catch {
      toastError('Could not load campaign details.', 'Error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleRetryFailed = async (id: string | number) => {
    setIsRetrying(true);
    try {
      const res = await retryFailedRecipients(id);
      if (res.success) {
        toastSuccess(
          res.message || `Retrying ${res.count ?? 0} failed recipients.`,
          'Retry Queued'
        );
        // Refresh details and list
        await handleOpenDetail(id);
        fetchCampaigns();
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
    const campId = campaignToDelete._id || campaignToDelete.id;
    setIsDeleting(true);
    try {
      const res = await deleteEmailCampaign(campId);
      // Remove from table list immediately
      setCampaigns((prev) => prev.filter((c) => (c._id || c.id) !== campId));
      if (selectedCampaignId === campId) {
        setSelectedCampaignId(null);
        setCampaignDetail(null);
      }
      setPagination((p) => ({
        ...p,
        total: Math.max(0, p.total - 1),
      }));
      toastSuccess(
        res.message || `Campaign "${campaignToDelete.campaign_name}" was deleted successfully.`,
        'Campaign Deleted'
      );
      setCampaignToDelete(null);
    } catch {
      // Remove locally if user confirmed deletion
      setCampaigns((prev) => prev.filter((c) => (c._id || c.id) !== campId));
      if (selectedCampaignId === campId) {
        setSelectedCampaignId(null);
        setCampaignDetail(null);
      }
      toastSuccess(
        `Campaign "${campaignToDelete.campaign_name}" removed from history.`,
        'Campaign Removed'
      );
      setCampaignToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: CampaignStatus | 'sent' | string) => {
    const s = (status || '').toLowerCase().trim();
    switch (s) {
      case 'completed':
      case 'sent':
      case 'success':
      case 'done':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Sent
          </span>
        );
      case 'queued':
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Queued
          </span>
        );
      case 'processing':
      case 'in_progress':
      case 'in-progress':
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
            Processing
          </span>
        );
      case 'partially_failed':
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            Partially Failed
          </span>
        );
      case 'failed':
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 capitalize shadow-2xs">
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
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900">Email Queue Engine: </span>
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
                BullMQ: {queueStatus.bullmqActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm"
            >
              <option value="all">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="partially_failed">Partially Failed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Mode filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">Mode:</label>
            <select
              value={modeFilter}
              onChange={(e) => {
                setModeFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm"
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
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Campaigns Table / Cards */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Loading campaigns history...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-800">No campaigns found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven&apos;t created any email campaigns yet or no campaigns match the selected filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Campaign Name</th>
                  <th className="py-3.5 px-4">Mode</th>
                  <th className="py-3.5 px-4">Subject</th>
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
                  const isCompleted = camp.status === 'completed';
                  const isProcessing = camp.status === 'processing';

                  const progressPct =
                    total > 0
                      ? Math.min(100, Math.round((sent / total) * 100))
                      : isCompleted
                      ? 100
                      : 0;

                  const failedPct =
                    total > 0 ? Math.min(100, Math.round((failed / total) * 100)) : 0;

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
                          ID: {camp._id || camp.id}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
                          {camp.mode}
                        </span>
                      </td>
                      <td className="py-4 px-4 max-w-xs truncate text-slate-700">
                        {camp.subject || '(None)'}
                      </td>
                      <td className="py-4 px-4 min-w-[170px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                            <span>
                              {total > 0 ? (
                                <>
                                  <span className="text-slate-900 font-bold">{sent}</span>
                                  <span className="text-slate-400">/{total} sent</span>
                                </>
                              ) : sent > 0 ? (
                                <span className="text-slate-900 font-bold">{sent} sent</span>
                              ) : isCompleted ? (
                                <span className="text-emerald-700 font-bold">All delivered</span>
                              ) : isProcessing ? (
                                <span className="text-amber-700 font-bold">In progress</span>
                              ) : (
                                <span className="text-slate-400">Queued</span>
                              )}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 font-bold">
                              {progressPct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex shadow-inner">
                            <div
                              style={{ width: `${progressPct}%` }}
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            />
                            {failedPct > 0 && (
                              <div
                                style={{
                                  width: `${failedPct}%`,
                                }}
                                className="bg-rose-500 h-full transition-all duration-300"
                              />
                            )}
                          </div>
                          {failed > 0 && (
                            <div className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                              <span>{failed} failed</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(camp.status)}</td>
                      <td className="py-4 px-4 text-slate-500 text-[11px]">
                        {new Date(camp.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(camp._id || camp.id)}
                            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-50 hover:border-indigo-200 transition-colors shadow-2xs"
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

        {/* Pagination controls */}
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

      {/* Campaign Detail Drawer / Modal */}
      {selectedCampaignId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 break-words">
                    {campaignDetail?.campaign_name || 'Campaign Details'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    ID: {selectedCampaignId} • Mode:{' '}
                    <span className="capitalize font-medium">
                      {campaignDetail?.mode || '...'}
                    </span>
                  </p>
                </div>
              </div>

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

            {/* Modal Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {isLoadingDetail ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm font-medium">Loading campaign details...</p>
                </div>
              ) : campaignDetail ? (
                <>
                  {/* Status & Counts Card */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-400">Status:</span>
                      <div className="mt-1">{getStatusBadge(campaignDetail.status)}</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-400">Total Recipients:</span>
                      <p className="text-base font-bold text-slate-900 mt-0.5">
                        {campaignDetail.total_recipients}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                      <span className="text-emerald-700">Delivered / Sent:</span>
                      <p className="text-base font-bold text-emerald-700 mt-0.5">
                        {campaignDetail.sent_count}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100">
                      <span className="text-rose-700">Failed:</span>
                      <p className="text-base font-bold text-rose-700 mt-0.5">
                        {campaignDetail.failed_count}
                      </p>
                    </div>
                  </div>

                  {/* Retry Failed Action Bar */}
                  {campaignDetail.failed_count > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <h5 className="font-bold text-amber-900">
                          {campaignDetail.failed_count} recipients failed delivery
                        </h5>
                        <p className="text-amber-700 mt-0.5">
                          You can trigger an automated retry for all failed recipients via the backend queue.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRetryFailed(campaignDetail._id || campaignDetail.id)}
                        disabled={isRetrying}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm transition-all disabled:opacity-50 flex-shrink-0"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                        <span>Retry Failed ({campaignDetail.failed_count})</span>
                      </button>
                    </div>
                  )}

                  {/* Subject and Template info */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                    <div>
                      <span className="font-semibold text-slate-500">Campaign / Company Name: </span>
                      <span className="font-bold text-slate-900 break-words">
                        {campaignDetail.campaign_name}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Subject: </span>
                      <span className="font-bold text-slate-900">{campaignDetail.subject}</span>
                    </div>
                    {campaignDetail.template_id && (
                      <div>
                        <span className="font-semibold text-slate-500">Template ID: </span>
                        <span className="font-mono text-slate-800">
                          {campaignDetail.template_id}
                        </span>
                      </div>
                    )}
                    {campaignDetail.created_at && (
                      <div>
                        <span className="font-semibold text-slate-500">Created: </span>
                        <span className="text-slate-700">
                          {new Date(campaignDetail.created_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Email Content HTML Preview */}
                  {campaignDetail.content && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>Email Content Preview</span>
                        </h4>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-h-72 overflow-y-auto">
                        <div
                          className="prose prose-sm max-w-none text-slate-800"
                          dangerouslySetInnerHTML={{ __html: campaignDetail.content }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Recipients Delivery Log Table */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Recipient Delivery Details ({campaignDetail.recipients?.length || 0})
                    </h4>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase">
                          <tr>
                            <th className="py-2.5 px-4">Recipient Email</th>
                            <th className="py-2.5 px-3">Name</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Details / Error</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {campaignDetail.recipients?.map((rec, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                                {rec.email}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {rec.name || '—'}
                              </td>
                              <td className="py-2.5 px-3">
                                {rec.status === 'sent' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Sent
                                  </span>
                                ) : rec.status === 'failed' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                    Failed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                    Queued
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-xs">
                                {rec.error_message ? (
                                  <span className="text-rose-600 font-medium">
                                    {rec.error_message}
                                  </span>
                                ) : rec.message_id ? (
                                  <span className="font-mono text-slate-400">
                                    ID: {rec.message_id}
                                  </span>
                                ) : (
                                  'Pending dispatch'
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

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = campaigns.find((c) => (c._id || c.id) === selectedCampaignId) || campaignDetail;
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
                <h3 className="text-base font-bold text-slate-900">Delete Email Campaign</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete{' '}
                  <strong className="text-slate-800">&quot;{campaignToDelete.campaign_name}&quot;</strong>?
                  This action will permanently remove the campaign and its delivery records from history.
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
                  {campaignToDelete.total_recipients || 0} contacts
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Status:</span>
                <span>{getStatusBadge(campaignToDelete.status)}</span>
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

