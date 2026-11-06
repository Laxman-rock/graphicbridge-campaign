export type WhatsAppCampaignMode = 'template' | 'custom';

export type WhatsAppMessageType =
  | 'text'
  | 'template'
  | 'image'
  | 'video'
  | 'document'
  | 'interactive';

export type WhatsAppCampaignStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'partially_failed';

export type WhatsAppRecipientStatus =
  | 'queued'
  | 'sending'
  | 'accepted'
  | 'failed'
  | 'processing'
  | 'sent';

export interface WhatsAppRecipientObject {
  whatsapp_number?: string;
  phone?: string;
  name?: string;
  variables?: Record<string, string>;
  whatsapp_opt_in?: boolean;
}

export type WhatsAppRecipientInput = string | WhatsAppRecipientObject;

// 1. WhatsApp Configuration
export interface WhatsAppConfig {
  whatsapp_meta_app_id?: string;
  whatsapp_meta_app_secret?: string;
  whatsapp_business_account_id?: string;
  whatsapp_phone_number_id?: string;
  whatsapp_access_token?: string;
  whatsapp_api_version?: string;
  whatsapp_config_status?: string;
  whatsapp_last_verified_at?: string;
  whatsapp_phone_info?: {
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
  };
}

export interface WhatsAppConfigStatusResponse {
  success: boolean;
  data?: {
    isConfigured: boolean;
    hasAccessToken: boolean;
    hasPhoneNumberId: boolean;
    hasBusinessAccountId: boolean;
    lastVerifiedAt?: string;
    phoneInfo?: {
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
    };
  };
  error?: string;
}

// 2. WhatsApp Templates
export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  text?: string;
  example?: {
    header_text?: string[];
    header_handle?: string[];
    header_url?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP' | string;
    text: string;
    url?: string;
    phone_number?: string;
    example?: string;
  }>;
}

export interface WhatsAppTemplate {
  _id?: string;
  id?: string | number;
  template_id?: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | string;
  components: WhatsAppTemplateComponent[];
  variables?: string[];
  is_active: boolean;
  quality_score?: string | { score?: string };
  last_synced_at?: string;
}

export interface ListWhatsAppTemplatesResponse {
  success: boolean;
  data?: WhatsAppTemplate[];
  error?: string;
}

export interface SyncTemplatesResponse {
  success: boolean;
  message?: string;
  synced_count?: number;
  data?: WhatsAppTemplate[];
  error?: string;
}

// 3. WhatsApp Campaign
export interface CreateWhatsAppCampaignRequest {
  campaign_name: string;
  template_name?: string;
  language_code?: string;
  media_id?: string;
  media_url?: string;
  header_image_url?: string;
  media_filename?: string;
  media_caption?: string;
  default_opt_in?: boolean;
  whatsapp_opt_in?: boolean;
  recipients: WhatsAppRecipientInput[];
  mode?: WhatsAppCampaignMode;
  message_type?: WhatsAppMessageType;
  template_id?: string;
  variables?: Record<string, string>;
  content?: string;
}

export interface WhatsAppCampaignRecipientRecord {
  phone: string;
  whatsapp_number?: string;
  name?: string;
  variables?: Record<string, string>;
  status: WhatsAppRecipientStatus;
  sent_at?: string | null;
  message_id?: string | null;
  error_message?: string | null;
  diagnostic_reason?: string | null;
  whatsapp_opt_in?: boolean;
  attempts?: number;
}

export interface WhatsAppCampaignSummary {
  _id?: string;
  id: number | string;
  campaign_name: string;
  mode: WhatsAppCampaignMode;
  template_name?: string;
  template_id?: string;
  message_type?: WhatsAppMessageType;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: WhatsAppCampaignStatus;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface WhatsAppCampaignDetail extends WhatsAppCampaignSummary {
  content?: string;
  variables?: Record<string, string>;
  media_url?: string;
  media_caption?: string;
  recipients: WhatsAppCampaignRecipientRecord[];
  created_by?: string;
}

export interface CreateWhatsAppCampaignResponse {
  success: boolean;
  message?: string;
  data?: WhatsAppCampaignDetail;
  campaign?: WhatsAppCampaignDetail;
  error?: string;
}

export interface WhatsAppCampaignListParams {
  page?: number;
  limit?: number;
  mode?: WhatsAppCampaignMode;
  status?: WhatsAppCampaignStatus;
}

export interface WhatsAppCampaignListResponse {
  success: boolean;
  data?: WhatsAppCampaignSummary[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

export interface GetWhatsAppCampaignResponse {
  success: boolean;
  data?: WhatsAppCampaignDetail;
  campaign?: WhatsAppCampaignDetail;
  message?: string;
  error?: string;
}

export interface RetryWhatsAppCampaignResponse {
  success: boolean;
  retried_count?: number;
  count?: number;
  message?: string;
  error?: string;
}

export interface WhatsAppQueueStatusResponse {
  success: boolean;
  data?: {
    queueName: string;
    isRedisAvailable: boolean;
    bullmqActive: boolean;
  };
  error?: string;
}

