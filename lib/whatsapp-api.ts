import { AxiosError } from 'axios';
import { apiClient } from './api';
import {
  WhatsAppConfig,
  WhatsAppConfigStatusResponse,
  WhatsAppTemplate,
  ListWhatsAppTemplatesResponse,
  SyncTemplatesResponse,
  CreateWhatsAppCampaignRequest,
  CreateWhatsAppCampaignResponse,
  WhatsAppCampaignListParams,
  WhatsAppCampaignListResponse,
  WhatsAppCampaignSummary,
  WhatsAppCampaignDetail,
  GetWhatsAppCampaignResponse,
  RetryWhatsAppCampaignResponse,
  WhatsAppQueueStatusResponse,
  WhatsAppContactItem,
  WhatsAppContactListParams,
  WhatsAppContactListResponse,
  WhatsAppContactDetailResponse,
  CreateWhatsAppContactRequest,
  UpdateWhatsAppContactRequest,
  ValidatePhoneResponse,
  BulkImportContactsRequest,
  BulkImportContactsResponse,
  RecipientEligibilityResponse,
  ConversationWindowResponse,
} from '@/types/whatsapp';

export function extractErrorMessage(err: unknown, defaultMsg: string): string {
  if (err && typeof err === 'object') {
    const axiosErr = err as AxiosError<any>;
    const resData = axiosErr.response?.data;

    if (resData) {
      if (typeof resData === 'string' && resData.trim()) {
        return resData.trim();
      }
      if (typeof resData.error === 'string' && resData.error.trim()) {
        return resData.error.trim();
      }
      if (resData.error && typeof resData.error.message === 'string' && resData.error.message.trim()) {
        return resData.error.message.trim();
      }
      if (typeof resData.message === 'string' && resData.message.trim()) {
        return resData.message.trim();
      }
      if (typeof resData.msg === 'string' && resData.msg.trim()) {
        return resData.msg.trim();
      }
      if (typeof resData.detail === 'string' && resData.detail.trim()) {
        return resData.detail.trim();
      }
      if (Array.isArray(resData.errors) && resData.errors.length > 0) {
        const first = resData.errors[0];
        return typeof first === 'string' ? first : first.msg || first.message || JSON.stringify(first);
      }
      if (typeof resData.error === 'object') {
        try {
          return JSON.stringify(resData.error);
        } catch {
          // ignore
        }
      }
    }

    if (axiosErr.response?.status) {
      return `Server Error (HTTP ${axiosErr.response.status}): ${
        axiosErr.response.statusText || axiosErr.message || defaultMsg
      }`;
    }

    if (axiosErr.message) {
      return axiosErr.message;
    }
  }
  return defaultMsg;
}

/**
 * Diagnostic reason dictionary mapping Meta/Backend reason codes to friendly descriptions
 */
export const WHATSAPP_DIAGNOSTIC_REASONS: Record<string, string> = {
  RECIPIENT_NOT_ON_WHATSAPP: 'Phone number is not registered on WhatsApp',
  OUTSIDE_24H_WINDOW: 'Outside 24-hour service window (template required)',
  MARKETING_MESSAGE_THROTTLED: 'Meta throttled marketing volume for recipient',
  PAYMENT_METHOD_ISSUE: 'Meta Business account payment issue',
  MEDIA_DOWNLOAD_FAILED: 'Media file could not be processed',
  TEMPLATE_PARAM_COUNT_MISMATCH: 'Variables do not match template placeholders',
  TEMPLATE_NOT_FOUND: 'Template does not exist or is not approved',
  OPTED_OUT: 'Recipient has opted out of WhatsApp messages',
  TOKEN_EXPIRED: 'System WhatsApp access token expired',
  RATE_LIMIT: 'Meta rate limit reached',
  UNKNOWN: 'Meta API rejection',
};

/**
 * Get user-friendly diagnostic description from reason code. Gracefully falls back if unknown or missing.
 */
export function getFriendlyDiagnosticReason(reason?: string | null): string {
  if (!reason || !reason.trim()) return 'Message delivery failed';
  const normalized = reason.trim().toUpperCase();
  return WHATSAPP_DIAGNOSTIC_REASONS[normalized] || reason;
}

/**
 * Calculate campaign progress and success rate.
 * progress = ((sent_count + failed_count) / total_recipients) * 100
 * successRate = (sent_count / total_recipients) * 100
 * Clamped between 0% and 100%, handling total_recipients = 0 safely.
 */
export function calculateCampaignMetrics(
  totalRecipients: number,
  sentCount: number,
  failedCount: number
): { progress: number; successRate: number } {
  if (!totalRecipients || totalRecipients <= 0) {
    return { progress: 0, successRate: 0 };
  }
  const rawProgress = ((sentCount + failedCount) / totalRecipients) * 100;
  const rawSuccessRate = (sentCount / totalRecipients) * 100;

  const progress = Math.min(100, Math.max(0, Math.round(rawProgress)));
  const successRate = Math.min(100, Math.max(0, Math.round(rawSuccessRate)));

  return { progress, successRate };
}

// 1. WhatsApp Configuration APIs
export async function getWhatsAppConfigStatus(): Promise<WhatsAppConfigStatusResponse> {
  try {
    const res = await apiClient.get<WhatsAppConfigStatusResponse>('/api/whatsapp/config/status');
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch WhatsApp configuration status.'),
    };
  }
}

export async function getWhatsAppConfig(): Promise<{ success: boolean; data?: WhatsAppConfig; error?: string }> {
  try {
    const res = await apiClient.get('/api/whatsapp/config');
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to load WhatsApp credentials.'),
    };
  }
}

export async function saveWhatsAppConfig(config: WhatsAppConfig): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await apiClient.post('/api/whatsapp/config', config);
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to save WhatsApp credentials.'),
    };
  }
}

export async function validateWhatsAppToken(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await apiClient.post('/api/whatsapp/config/validate');
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Token validation failed.'),
    };
  }
}

export async function verifyWhatsAppPhone(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await apiClient.post('/api/whatsapp/config/verify-phone');
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Phone number verification failed.'),
    };
  }
}

// 2. WhatsApp Templates APIs

/**
 * Fetch live Meta WhatsApp templates directly from Meta Cloud API
 * GET /whatsapp/templates/meta (fallback: /api/whatsapp/templates/meta)
 */
export async function listMetaWhatsAppTemplates(): Promise<ListWhatsAppTemplatesResponse> {
  try {
    let res;
    try {
      res = await apiClient.get<any>('/whatsapp/templates/meta');
    } catch (err: any) {
      if (err?.response?.status === 404) {
        // Fallback in case route mounted with /api prefix
        res = await apiClient.get<any>('/api/whatsapp/templates/meta');
      } else {
        throw err;
      }
    }

    const raw = res.data;
    let templates: WhatsAppTemplate[] = [];

    if (Array.isArray(raw)) {
      templates = raw;
    } else if (raw && Array.isArray(raw.data)) {
      templates = raw.data;
    } else if (raw && Array.isArray(raw.templates)) {
      templates = raw.templates;
    } else if (raw && raw.data && Array.isArray(raw.data.data)) {
      templates = raw.data.data;
    } else if (raw && raw.success && Array.isArray(raw.data)) {
      templates = raw.data;
    } else if (raw && raw.success === false) {
      return {
        success: false,
        error: raw.error || raw.message || 'Failed to fetch Meta WhatsApp templates.',
        data: [],
      };
    }

    return {
      success: true,
      data: templates,
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch Meta WhatsApp templates.'),
      data: [],
    };
  }
}

/**
 * Extract template image header details from components
 */
export function extractTemplateImageHeader(template?: WhatsAppTemplate | null): {
  hasImageHeader: boolean;
  headerFormat: 'IMAGE' | 'TEXT' | 'DOCUMENT' | 'VIDEO' | 'NONE';
  exampleImageUrl?: string;
  headerText?: string;
} {
  if (!template || !Array.isArray(template.components)) {
    return { hasImageHeader: false, headerFormat: 'NONE' };
  }

  const headerComp = template.components.find((c) => c.type === 'HEADER');
  if (!headerComp) {
    return { hasImageHeader: false, headerFormat: 'NONE' };
  }

  const format = (headerComp.format || (headerComp.text ? 'TEXT' : 'NONE')).toUpperCase() as
    | 'IMAGE'
    | 'TEXT'
    | 'DOCUMENT'
    | 'VIDEO'
    | 'NONE';

  const isImage = format === 'IMAGE';
  let exampleUrl: string | undefined = undefined;

  if (headerComp.example) {
    const ex = headerComp.example as any;
    if (Array.isArray(ex.header_handle) && ex.header_handle.length > 0) {
      exampleUrl = String(ex.header_handle[0]);
    } else if (typeof ex.header_handle === 'string' && ex.header_handle.trim()) {
      exampleUrl = ex.header_handle.trim();
    } else if (Array.isArray(ex.header_url) && ex.header_url.length > 0) {
      exampleUrl = String(ex.header_url[0]);
    } else if (typeof ex.header_url === 'string' && ex.header_url.trim()) {
      exampleUrl = ex.header_url.trim();
    }
  }

  if (!exampleUrl && isImage && headerComp.text && /^https?:\/\//i.test(headerComp.text.trim())) {
    exampleUrl = headerComp.text.trim();
  }

  return {
    hasImageHeader: isImage,
    headerFormat: format,
    exampleImageUrl: exampleUrl,
    headerText: headerComp.text,
  };
}

/**
 * Parse only numbered and named placeholders from BODY text (e.g. {{1}}, {{2}})
 * Excludes raw URLs, protocol links, and header handles.
 */
export function extractTemplateBodyVariables(bodyText?: string): string[] {
  if (!bodyText) return [];
  const matches = bodyText.match(/\{\{([0-9a-zA-Z_]+)\}\}/g) || [];
  const vars: string[] = [];

  matches.forEach((m) => {
    const rawKey = m.replace(/[{}]/g, '').trim();
    if (
      rawKey &&
      !vars.includes(rawKey) &&
      !rawKey.startsWith('http') &&
      !rawKey.includes('://') &&
      !rawKey.toLowerCase().includes('header_handle')
    ) {
      vars.push(rawKey);
    }
  });

  // Sort numeric placeholders ascending (1, 2, 3...)
  vars.sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  return vars;
}

export async function listWhatsAppTemplates(): Promise<ListWhatsAppTemplatesResponse> {
  try {
    let res;
    try {
      res = await apiClient.get<any>('/api/whatsapp/templates');
    } catch (err: any) {
      if (err?.response?.status === 404) {
        // Fallback in case route mounted without /api prefix
        res = await apiClient.get<any>('/whatsapp/templates');
      } else {
        throw err;
      }
    }

    const raw = res.data;
    let templates: WhatsAppTemplate[] = [];

    if (Array.isArray(raw)) {
      templates = raw;
    } else if (raw && Array.isArray(raw.data)) {
      templates = raw.data;
    } else if (raw && Array.isArray(raw.templates)) {
      templates = raw.templates;
    } else if (raw && raw.success && Array.isArray(raw.data)) {
      templates = raw.data;
    } else if (raw && raw.success === false) {
      return {
        success: false,
        error: raw.error || raw.message || 'Failed to fetch WhatsApp templates.',
        data: [],
      };
    }

    return {
      success: true,
      data: templates,
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch WhatsApp templates.'),
      data: [],
    };
  }
}

export async function syncWhatsAppTemplates(): Promise<SyncTemplatesResponse> {
  try {
    let res;
    try {
      res = await apiClient.post<any>('/api/whatsapp/templates/sync');
    } catch (err: any) {
      if (err?.response?.status === 404) {
        res = await apiClient.post<any>('/whatsapp/templates/sync');
      } else {
        throw err;
      }
    }

    const raw = res.data;
    return {
      success: raw?.success ?? true,
      message: raw?.message || 'Templates synced successfully from Meta.',
      synced_count: raw?.synced_count ?? raw?.count ?? (Array.isArray(raw?.data) ? raw.data.length : undefined),
      data: raw?.data || raw?.templates,
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to sync templates from Meta. Please check your WhatsApp Business credentials.'),
    };
  }
}

export async function getWhatsAppTemplate(id: string | number): Promise<{ success: boolean; data?: WhatsAppTemplate; error?: string }> {
  try {
    const res = await apiClient.get(`/api/whatsapp/templates/${id}`);
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch template details.'),
    };
  }
}

export async function updateWhatsAppTemplateStatus(
  id: string | number,
  is_active: boolean
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await apiClient.put(`/api/whatsapp/templates/${id}/status`, { is_active });
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to update template status.'),
    };
  }
}

export async function deleteWhatsAppTemplate(id: string | number): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await apiClient.delete(`/api/whatsapp/templates/${id}`);
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to delete template.'),
    };
  }
}

// 3. WhatsApp Campaigns APIs
export async function createWhatsAppCampaign(
  payload: CreateWhatsAppCampaignRequest
): Promise<CreateWhatsAppCampaignResponse> {
  try {
    let res;
    try {
      res = await apiClient.post<any>(
        '/api/whatsapp/campaigns',
        payload
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 404) {
        res = await apiClient.post<any>(
          '/whatsapp/campaigns',
          payload
        );
      } else {
        throw err;
      }
    }

    const raw = res.data;
    if (raw && (raw.success === false || raw.error)) {
      return {
        success: false,
        error:
          raw.error ||
          raw.message ||
          'Failed to dispatch WhatsApp campaign (Server rejected request).',
        message: raw.message,
        data: raw.data || raw.campaign,
      };
    }

    return {
      ...raw,
      data: raw.data || raw.campaign,
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to queue WhatsApp campaign.'),
    };
  }
}

export async function listWhatsAppCampaigns(
  params?: WhatsAppCampaignListParams
): Promise<WhatsAppCampaignListResponse> {
  try {
    let res;
    try {
      res = await apiClient.get<any>('/api/whatsapp/campaigns', { params });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        res = await apiClient.get<any>('/whatsapp/campaigns', { params });
      } else {
        throw err;
      }
    }

    const raw = res.data;
    let campaigns: WhatsAppCampaignSummary[] = [];

    if (Array.isArray(raw)) {
      campaigns = raw;
    } else if (raw && Array.isArray(raw.data)) {
      campaigns = raw.data;
    } else if (raw && Array.isArray(raw.campaigns)) {
      campaigns = raw.campaigns;
    } else if (raw && raw.success && Array.isArray(raw.data)) {
      campaigns = raw.data;
    }

    // Normalize date and ID fields across diverse backend schemas
    campaigns = campaigns.map((c: any) => ({
      ...c,
      created_at: c.created_at || c.createdAt || c.updated_at || c.updatedAt || undefined,
      createdAt: c.createdAt || c.created_at || undefined,
    }));

    return {
      success: raw?.success ?? true,
      data: campaigns,
      pagination: raw?.pagination || raw?.meta,
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch WhatsApp campaigns.'),
    };
  }
}

export async function getWhatsAppCampaign(
  id: string | number,
  fallbackId?: string | number
): Promise<GetWhatsAppCampaignResponse> {
  const tryFetch = async (targetId: string | number) => {
    try {
      return await apiClient.get<any>(`/api/whatsapp/campaigns/${targetId}`);
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 400 || err?.response?.status === 500) {
        return await apiClient.get<any>(`/whatsapp/campaigns/${targetId}`);
      }
      throw err;
    }
  };

  try {
    let res;
    try {
      res = await tryFetch(id);
    } catch (primaryErr) {
      if (fallbackId && String(fallbackId) !== String(id)) {
        try {
          res = await tryFetch(fallbackId);
        } catch {
          throw primaryErr;
        }
      } else {
        throw primaryErr;
      }
    }

    const raw = res.data;
    let campaignData: WhatsAppCampaignDetail | undefined =
      raw?.data ||
      raw?.campaign ||
      raw?.result ||
      (raw?._id || raw?.id ? raw : undefined);

    if (campaignData) {
      campaignData = {
        ...campaignData,
        created_at:
          campaignData.created_at ||
          (campaignData as any).createdAt ||
          campaignData.updated_at ||
          (campaignData as any).updatedAt ||
          undefined,
        createdAt:
          (campaignData as any).createdAt ||
          campaignData.created_at ||
          undefined,
      };
    }

    if (raw && raw.success === false) {
      return {
        success: false,
        error: raw.error || raw.message || 'Failed to fetch campaign details.',
      };
    }

    return {
      success: raw?.success ?? true,
      data: campaignData,
      message: raw?.message,
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch campaign details.'),
    };
  }
}

export async function retryWhatsAppCampaign(
  id: string | number,
  fallbackId?: string | number
): Promise<RetryWhatsAppCampaignResponse> {
  const tryRetry = async (targetId: string | number) => {
    try {
      return await apiClient.post<any>(`/api/whatsapp/campaigns/${targetId}/retry`);
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 400) {
        return await apiClient.post<any>(`/whatsapp/campaigns/${targetId}/retry`);
      }
      throw err;
    }
  };

  try {
    let res;
    try {
      res = await tryRetry(id);
    } catch (primaryErr) {
      if (fallbackId && String(fallbackId) !== String(id)) {
        try {
          res = await tryRetry(fallbackId);
        } catch {
          throw primaryErr;
        }
      } else {
        throw primaryErr;
      }
    }

    const raw = res.data;
    return {
      success: raw?.success ?? true,
      retried_count: raw?.retried_count ?? raw?.count,
      count: raw?.count ?? raw?.retried_count,
      message: raw?.message,
      error: raw?.error,
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to retry failed recipients.'),
    };
  }
}

export async function getWhatsAppQueueStatus(): Promise<WhatsAppQueueStatusResponse> {
  try {
    const res = await apiClient.get<WhatsAppQueueStatusResponse>(
      '/api/whatsapp/campaigns/queue-status'
    );
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch queue status.'),
    };
  }
}

/**
 * Delete WhatsApp Campaign
 * DELETE /api/whatsapp/campaigns/:id (fallback: /whatsapp/campaigns/:id)
 */
export async function deleteWhatsAppCampaign(
  id: string | number,
  fallbackId?: string | number
): Promise<{ success: boolean; message?: string; error?: string }> {
  const tryDelete = async (targetId: string | number) => {
    try {
      return await apiClient.delete<any>(`/api/whatsapp/campaigns/${targetId}`);
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 400) {
        return await apiClient.delete<any>(`/whatsapp/campaigns/${targetId}`);
      }
      throw err;
    }
  };

  try {
    let res;
    try {
      res = await tryDelete(id);
    } catch (primaryErr) {
      if (fallbackId && String(fallbackId) !== String(id)) {
        try {
          res = await tryDelete(fallbackId);
        } catch {
          throw primaryErr;
        }
      } else {
        throw primaryErr;
      }
    }

    return {
      success: res.data?.success ?? true,
      message: res.data?.message || 'WhatsApp campaign deleted successfully.',
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to delete WhatsApp campaign.'),
    };
  }
}

// ==========================================
// 4. WhatsApp Contacts Management APIs
// ==========================================

/**
 * Normalizes a phone number string:
 * - Removes spaces, dashes, parentheses
 * - Automatically prepends +91 for standard Indian 10-digit mobile numbers
 * - Ensures leading '+' for international numbers
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  // Strip common punctuation / spacing
  let cleaned = trimmed.replace(/[\s\-\(\)\.]/g, '');
  if (!cleaned) return '';

  // Standard Indian 10-digit mobile (starts with 6-9 or any 10 digits)
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // 12-digit Indian number starting with 91 but lacking +
  if (/^91\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // If number starts with 00 (e.g. 0091...), replace with +
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  } else if (!cleaned.startsWith('+') && cleaned.length >= 11) {
    cleaned = `+${cleaned}`;
  }

  return cleaned;
}

/**
 * Fetch contacts list with filters and pagination
 * GET /api/whatsapp/contacts
 */
export async function listWhatsAppContacts(
  params: WhatsAppContactListParams = {}
): Promise<WhatsAppContactListResponse> {
  const queryParams: Record<string, any> = {};
  if (params.page !== undefined) queryParams.page = params.page;
  if (params.limit !== undefined) queryParams.limit = params.limit;
  if (params.phone_number?.trim()) {
    queryParams.phone_number = params.phone_number.trim();
  }
  if (params.search?.trim()) {
    queryParams.search = params.search.trim();
    if (!queryParams.phone_number) {
      queryParams.phone_number = params.search.trim();
    }
  }
  if (params.opt_in_status && params.opt_in_status !== 'all') {
    queryParams.opt_in_status = params.opt_in_status;
  }
  if (params.tag?.trim()) {
    queryParams.tag = params.tag.trim();
  }
  if (params.group?.trim()) {
    queryParams.group = params.group.trim();
  }
  if (params.is_active !== undefined && params.is_active !== 'all') {
    queryParams.is_active = params.is_active;
  }

  const tryGetContacts = async (url: string) => {
    return await apiClient.get<any>(url, { params: queryParams });
  };

  try {
    let res;
    try {
      res = await tryGetContacts('/api/whatsapp/contacts');
    } catch (err: any) {
      if (err?.response?.status === 404) {
        res = await tryGetContacts('/whatsapp/contacts');
      } else {
        throw err;
      }
    }

    const raw = res.data;
    let contactsList: WhatsAppContactItem[] = [];

    if (Array.isArray(raw)) {
      contactsList = raw;
    } else if (raw && Array.isArray(raw.data)) {
      contactsList = raw.data;
    } else if (raw && Array.isArray(raw.contacts)) {
      contactsList = raw.contacts;
    } else if (raw && raw.success === false) {
      return {
        success: false,
        error: raw.error || raw.message || 'Failed to fetch WhatsApp contacts.',
        data: [],
        pagination: {
          page: params.page || 1,
          limit: params.limit || 10,
          total: 0,
          pages: 1,
        },
      };
    }

    // Extract pagination metadata reliably
    const reqPage = Math.max(1, Number(params.page || 1));
    const reqLimit = Math.max(1, Number(params.limit || 10));

    const backendPagination = raw?.pagination || {};
    const totalCount = Number(
      backendPagination.total ??
      backendPagination.totalCount ??
      backendPagination.count ??
      raw?.total ??
      raw?.totalCount ??
      raw?.count ??
      (Array.isArray(contactsList) ? contactsList.length : 0)
    );

    const limitVal = Math.max(
      1,
      Number(
        backendPagination.limit ??
        backendPagination.perPage ??
        raw?.limit ??
        reqLimit
      )
    );

    const pageVal = Math.max(
      1,
      Number(
        backendPagination.page ??
        backendPagination.currentPage ??
        raw?.page ??
        reqPage
      )
    );

    const calculatedPages = limitVal > 0 ? Math.ceil(totalCount / limitVal) : 1;
    const pagesVal = Number(
      backendPagination.pages ??
      backendPagination.totalPages ??
      backendPagination.total_pages ??
      raw?.pages ??
      raw?.totalPages ??
      calculatedPages
    );

    // If backend returned more items than the requested limit (e.g. unpaginated array from backend),
    // provide client-side slicing fallback so pagination always works!
    if (contactsList.length > limitVal) {
      const startIndex = (pageVal - 1) * limitVal;
      contactsList = contactsList.slice(startIndex, startIndex + limitVal);
    }

    const paginationData = {
      page: pageVal,
      limit: limitVal,
      total: Math.max(0, totalCount),
      pages: Math.max(1, pagesVal),
    };

    return {
      success: true,
      data: contactsList,
      contacts: contactsList,
      pagination: paginationData,
      total: paginationData.total,
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch WhatsApp contacts list.'),
      data: [],
      pagination: {
        page: params.page || 1,
        limit: params.limit || 10,
        total: 0,
        pages: 1,
      },
    };
  }
}

/**
 * Get detailed contact information
 * GET /api/whatsapp/contacts/:id
 */
export async function getWhatsAppContact(
  id: string | number
): Promise<WhatsAppContactDetailResponse> {
  const tryGet = async (targetId: string | number) => {
    try {
      return await apiClient.get<any>(`/api/whatsapp/contacts/${targetId}`);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return await apiClient.get<any>(`/whatsapp/contacts/${targetId}`);
      }
      throw err;
    }
  };

  try {
    const res = await tryGet(id);
    const raw = res.data;
    const contact = raw?.data || raw?.contact || (raw?.whatsapp_number ? raw : undefined);

    if (raw && raw.success === false) {
      return {
        success: false,
        error: raw.error || raw.message || 'Contact not found.',
      };
    }

    return {
      success: true,
      data: contact,
      contact,
      message: raw?.message,
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch contact details.'),
    };
  }
}

/**
 * Validate phone number with backend
 * POST /api/whatsapp/contacts/validate-phone
 */
export async function validateWhatsAppPhone(
  phoneNumber: string
): Promise<ValidatePhoneResponse> {
  const trimmed = phoneNumber.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Phone number cannot be empty.',
    };
  }

  const tryValidate = async () => {
    try {
      return await apiClient.post<any>('/api/whatsapp/contacts/validate-phone', {
        phone_number: trimmed,
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return await apiClient.post<any>('/whatsapp/contacts/validate-phone', {
          phone_number: trimmed,
        });
      }
      throw err;
    }
  };

  try {
    const res = await tryValidate();
    const raw = res.data;
    const info = raw?.data || raw;

    const valid = info?.valid === true;
    const normalized = info?.normalized || normalizePhoneNumber(trimmed);

    return {
      success: true,
      valid,
      normalized,
      message: info?.message || (valid ? 'Phone number is valid' : 'Invalid phone number format'),
      error: valid ? undefined : info?.error || info?.message || 'Phone number format is invalid',
    };
  } catch (err: any) {
    // If backend endpoint is unavailable or returns 400, perform local E.164 normalization check as graceful fallback
    const normalized = normalizePhoneNumber(trimmed);
    const isValidE164 = /^\+[1-9]\d{6,14}$/.test(normalized);

    if (isValidE164) {
      return {
        success: true,
        valid: true,
        normalized,
      };
    }

    return {
      success: false,
      valid: false,
      normalized,
      error: extractErrorMessage(err, 'Invalid phone number format. Must be a valid E.164 number.'),
    };
  }
}

/**
 * Create a new WhatsApp contact
 * POST /api/whatsapp/contacts
 */
export async function createWhatsAppContact(
  payload: CreateWhatsAppContactRequest
): Promise<{ success: boolean; data?: WhatsAppContactItem; message?: string; error?: string; status?: number }> {
  // Normalize phone number
  const normalizedNumber = normalizePhoneNumber(payload.whatsapp_number);
  const body = {
    ...payload,
    whatsapp_number: normalizedNumber,
  };

  const tryCreate = async () => {
    try {
      return await apiClient.post<any>('/api/whatsapp/contacts', body);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return await apiClient.post<any>('/whatsapp/contacts', body);
      }
      throw err;
    }
  };

  try {
    const res = await tryCreate();
    const raw = res.data;
    return {
      success: raw?.success ?? true,
      data: raw?.data || raw?.contact,
      message: raw?.message || 'WhatsApp contact created successfully!',
      status: res.status,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    let errorMsg = extractErrorMessage(err, 'Failed to create WhatsApp contact.');
    if (status === 409) {
      errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Conflict: A contact with this WhatsApp number or Contact ID already exists.';
    } else if (status === 403) {
      errorMsg = 'Permission denied: whatsapp.contacts.create is required to add contacts.';
    }

    return {
      success: false,
      error: errorMsg,
      status,
    };
  }
}

/**
 * Update existing WhatsApp contact
 * PUT /api/whatsapp/contacts/:id
 */
export async function updateWhatsAppContact(
  id: string | number,
  payload: UpdateWhatsAppContactRequest
): Promise<{ success: boolean; data?: WhatsAppContactItem; message?: string; error?: string; status?: number }> {
  const body = {
    ...payload,
    ...(payload.whatsapp_number
      ? { whatsapp_number: normalizePhoneNumber(payload.whatsapp_number) }
      : {}),
  };

  const tryUpdate = async (targetId: string | number) => {
    try {
      return await apiClient.put<any>(`/api/whatsapp/contacts/${targetId}`, body);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return await apiClient.put<any>(`/whatsapp/contacts/${targetId}`, body);
      }
      throw err;
    }
  };

  try {
    const res = await tryUpdate(id);
    const raw = res.data;
    return {
      success: raw?.success ?? true,
      data: raw?.data || raw?.contact,
      message: raw?.message || 'WhatsApp contact updated successfully!',
      status: res.status,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    let errorMsg = extractErrorMessage(err, 'Failed to update contact.');
    if (status === 409) {
      errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Conflict: Another contact is already registered with this phone number or ID.';
    } else if (status === 403) {
      errorMsg = 'Permission denied: whatsapp.contacts.edit is required to edit contacts.';
    }

    return {
      success: false,
      error: errorMsg,
      status,
    };
  }
}

/**
 * Opt-In a WhatsApp contact
 * POST /api/whatsapp/contacts/:id/opt-in
 */
export async function optInWhatsAppContact(
  id: string | number,
  method: string = 'manual'
): Promise<{ success: boolean; data?: WhatsAppContactItem; message?: string; error?: string }> {
  const tryOptIn = async (targetId: string | number) => {
    try {
      return await apiClient.post<any>(`/api/whatsapp/contacts/${targetId}/opt-in`, {
        method,
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return await apiClient.post<any>(`/whatsapp/contacts/${targetId}/opt-in`, {
          method,
        });
      }
      throw err;
    }
  };

  try {
    const res = await tryOptIn(id);
    const raw = res.data;
    return {
      success: raw?.success ?? true,
      data: raw?.data || raw?.contact,
      message: raw?.message || 'Contact consent successfully updated to Opted In.',
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to update opt-in status.'),
    };
  }
}

/**
 * Opt-Out a WhatsApp contact
 * POST /api/whatsapp/contacts/:id/opt-out
 */
export async function optOutWhatsAppContact(
  id: string | number,
  reason?: string
): Promise<{ success: boolean; data?: WhatsAppContactItem; message?: string; error?: string }> {
  const tryOptOut = async (targetId: string | number) => {
    try {
      return await apiClient.post<any>(`/api/whatsapp/contacts/${targetId}/opt-out`, {
        ...(reason ? { reason } : {}),
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return await apiClient.post<any>(`/whatsapp/contacts/${targetId}/opt-out`, {
          ...(reason ? { reason } : {}),
        });
      }
      throw err;
    }
  };

  try {
    const res = await tryOptOut(id);
    const raw = res.data;
    return {
      success: raw?.success ?? true,
      data: raw?.data || raw?.contact,
      message: raw?.message || 'Contact has been opted out.',
    };
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to update opt-out status.'),
    };
  }
}

/**
 * Soft Delete a WhatsApp contact
 * DELETE /api/whatsapp/contacts/:id
 */
export async function deleteWhatsAppContact(
  id: string | number
): Promise<{ success: boolean; message?: string; error?: string }> {
  const tryDelete = async (targetId: string | number) => {
    try {
      return await apiClient.delete<any>(`/api/whatsapp/contacts/${targetId}`);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return await apiClient.delete<any>(`/whatsapp/contacts/${targetId}`);
      }
      throw err;
    }
  };

  try {
    const res = await tryDelete(id);
    const raw = res.data;
    return {
      success: raw?.success ?? true,
      message: raw?.message || 'Contact removed successfully.',
    };
  } catch (err: any) {
    if (err?.response?.status === 403) {
      return {
        success: false,
        error: 'Permission denied: whatsapp.contacts.delete is required to delete contacts.',
      };
    }
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to delete contact.'),
    };
  }
}

/**
 * Bulk Import WhatsApp Contacts
 * POST /api/whatsapp/contacts/bulk-import
 */
export async function bulkImportWhatsAppContacts(
  contacts: BulkImportContactsRequest['contacts']
): Promise<BulkImportContactsResponse> {
  const tryBulkImport = async () => {
    try {
      return await apiClient.post<any>('/api/whatsapp/contacts/bulk-import', {
        contacts,
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return await apiClient.post<any>('/whatsapp/contacts/bulk-import', {
          contacts,
        });
      }
      throw err;
    }
  };

  try {
    const res = await tryBulkImport();
    const raw = res.data;
    return {
      success: raw?.success ?? true,
      message: raw?.message || 'Bulk contacts import completed.',
      data: raw?.data || raw,
      imported: raw?.data?.imported ?? raw?.imported ?? raw?.data?.successful,
      duplicates: raw?.data?.duplicates ?? raw?.duplicates,
      errors: raw?.data?.errors ?? raw?.errors,
    };
  } catch (err: any) {
    if (err?.response?.status === 403) {
      return {
        success: false,
        error: 'Permission denied: whatsapp.contacts.import is required to import contacts.',
      };
    }
    return {
      success: false,
      error: extractErrorMessage(err, 'Bulk contacts import failed.'),
    };
  }
}

/**
 * Validate recipient eligibility
 * POST /api/whatsapp/validate-recipient
 */
export async function validateWhatsAppRecipient(
  phoneNumber: string
): Promise<RecipientEligibilityResponse> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const tryValidate = async () => {
    try {
      return await apiClient.post<any>('/api/whatsapp/validate-recipient', {
        phone_number: normalized,
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return await apiClient.post<any>('/whatsapp/validate-recipient', {
          phone_number: normalized,
        });
      }
      throw err;
    }
  };

  try {
    const res = await tryValidate();
    const raw = res.data;
    const data = raw?.data || raw;

    const isEligible = data?.is_eligible ?? data?.eligible ?? (raw?.success === true);
    return {
      success: true,
      is_eligible: isEligible,
      eligible: isEligible,
      opt_in_status: data?.opt_in_status,
      reason: data?.reason,
      message: data?.message || raw?.message,
    };
  } catch (err) {
    return {
      success: false,
      is_eligible: false,
      eligible: false,
      error: extractErrorMessage(err, 'Failed to check recipient eligibility.'),
    };
  }
}

/**
 * Check 24-hour WhatsApp customer care conversation window
 * POST /api/whatsapp/check-conversation-window
 */
export async function checkWhatsAppConversationWindow(
  phoneNumber: string
): Promise<ConversationWindowResponse> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const tryCheck = async () => {
    try {
      return await apiClient.post<any>('/api/whatsapp/check-conversation-window', {
        phone_number: normalized,
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return await apiClient.post<any>('/whatsapp/check-conversation-window', {
          phone_number: normalized,
        });
      }
      throw err;
    }
  };

  try {
    const res = await tryCheck();
    const raw = res.data;
    const data = raw?.data || raw;

    const isWindowOpen = data?.is_window_open ?? data?.window_open ?? false;
    const requiresTemplate = data?.requires_template ?? !isWindowOpen;

    return {
      success: true,
      is_window_open: isWindowOpen,
      window_open: isWindowOpen,
      window_expires_at: data?.window_expires_at || data?.expires_at,
      requires_template: requiresTemplate,
      message: data?.message || raw?.message,
    };
  } catch (err) {
    return {
      success: false,
      is_window_open: false,
      window_open: false,
      requires_template: true,
      error: extractErrorMessage(err, 'Failed to inspect 24-hour conversation window.'),
    };
  }
}




