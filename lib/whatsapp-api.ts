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
  GetWhatsAppCampaignResponse,
  RetryWhatsAppCampaignResponse,
  WhatsAppQueueStatusResponse,
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
      res = await apiClient.post<CreateWhatsAppCampaignResponse>(
        '/api/whatsapp/campaigns',
        payload
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 404) {
        res = await apiClient.post<CreateWhatsAppCampaignResponse>(
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
        data: raw.data,
      };
    }

    return raw;
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
  id: string | number
): Promise<GetWhatsAppCampaignResponse> {
  try {
    const res = await apiClient.get<GetWhatsAppCampaignResponse>(
      `/api/whatsapp/campaigns/${id}`
    );
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch campaign details.'),
    };
  }
}

export async function retryWhatsAppCampaign(
  id: string | number
): Promise<RetryWhatsAppCampaignResponse> {
  try {
    const res = await apiClient.post<RetryWhatsAppCampaignResponse>(
      `/api/whatsapp/campaigns/${id}/retry`
    );
    return res.data;
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

