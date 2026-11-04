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
} from 'lucide-react';
import {
  WhatsAppCampaignSummary,
  WhatsAppCampaignDetail,
  WhatsAppCampaignStatus,
  WhatsAppCampaignMode,
  WhatsAppQueueStatusResponse,
} from '@/types/whatsapp';
import {
  listWhatsAppCampaigns,
  getWhatsAppCampaign,
  retryWhatsAppCampaign,
  getWhatsAppQueueStatus,
} from '@/lib/whatsapp-api';
import { useToast } from '@/components/ui/Toast';

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

  // Auto-refresh when any campaigns are queued or processing
  useEffect(() => {
    const hasActive = campaigns.some(
      (c) => c.status === 'processing' || c.status === 'queued'
    );
    if (!hasActive) return;

    const timer = setInterval(() => {
      fetchCampaigns(true);
      fetchQueue();
    }, 4000);

    return () => clearInterval(timer);
  }, [campaigns, fetchCampaigns]);

  const handleOpenDetail = async (id: string | number) => {
    setSelectedCampaignId(id);
    setIsLoadingDetail(true);
    try {
      const res = await getWhatsAppCampaign(id);
      if (res.success && res.data) {
        const detail = res.data;
        const recs = detail.recipients || [];

        let resolvedStatus: WhatsAppCampaignStatus = detail.status;
        let resolvedTotal = detail.total_recipients;
        let resolvedSent = detail.sent_count;

        if (recs.length > 0) {
          const sentRecs = recs.filter((r) => r.status === 'sent').length;
          const failedRecs = recs.filter((r) => r.status === 'failed').length;
          const allSent = recs.every((r) => r.status === 'sent');
          const noPending = !recs.some(
            (r) => r.status === 'queued' || r.status === 'processing'
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
            c._id === id || c.id === id
              ? {
                  ...c,
                  status: resolvedStatus,
                  sent_count: resolvedSent,
                  total_recipients: resolvedTotal,
                }
              : c
          )
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
      const res = await retryWhatsAppCampaign(id);
      if (res.success) {
        toastSuccess(
          res.message || `Retrying ${res.count ?? 0} failed recipients.`,
          'Retry Queued'
        );
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

  const getStatusBadge = (status: WhatsAppCampaignStatus | 'sent' | string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'completed':
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Sent
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Queued
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
            Processing
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
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
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
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
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
                  <th className="py-3.5 px-5 text-right">Actions</th>
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

                  const progressPct = total > 0 ? Math.round((sent / total) * 100) : 0;

                  return (
                    <tr
                      key={camp._id || camp.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900">{camp.campaign_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          ID: {camp._id || camp.id}
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
                      <td className="py-4 px-4 min-w-[160px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-medium text-slate-600">
                            <span>
                              {sent}/{total} sent
                            </span>
                            {failed > 0 && (
                              <span className="text-rose-600 font-semibold">
                                {failed} failed
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${progressPct}%` }}
                              className="bg-emerald-500 h-full rounded-full transition-all"
                            />
                            {failed > 0 && (
                              <div
                                style={{
                                  width: `${Math.round((failed / total) * 100)}%`,
                                }}
                                className="bg-rose-500 h-full transition-all"
                              />
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(displayStatus)}</td>
                      <td className="py-4 px-4 text-slate-500 text-[11px]">
                        {new Date(camp.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(camp._id || camp.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100 hover:text-emerald-600 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
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
                  <h3 className="text-base font-bold text-slate-900">
                    {campaignDetail?.campaign_name || 'Campaign Details'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    ID: {selectedCampaignId} • Mode:{' '}
                    <span className="capitalize font-medium">{campaignDetail?.mode || '...'}</span>
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
                      <span className="text-slate-400">Status:</span>
                      <div className="mt-1">{getStatusBadge(campaignDetail.status)}</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-400">Total Contacts:</span>
                      <p className="text-base font-bold text-slate-900 mt-0.5">
                        {campaignDetail.total_recipients}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                      <span className="text-emerald-700">Delivered:</span>
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

                  {/* Retry Failed Option */}
                  {campaignDetail.failed_count > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <h5 className="font-bold text-amber-900">
                          {campaignDetail.failed_count} numbers failed delivery
                        </h5>
                        <p className="text-amber-700 mt-0.5">
                          Retry failed recipients with automatic exponential backoff.
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

                  {/* Recipients List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Recipient Delivery Details ({campaignDetail.recipients?.length || 0})
                    </h4>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase">
                          <tr>
                            <th className="py-2.5 px-4">Mobile Number</th>
                            <th className="py-2.5 px-3">Name</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Details / Message ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {campaignDetail.recipients?.map((rec, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                                {rec.phone}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">{rec.name || '—'}</td>
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

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedCampaignId(null);
                  setCampaignDetail(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

