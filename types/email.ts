export type EmailCampaignMode = 'template' | 'custom';

export type CampaignStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'partially_failed';

export type RecipientStatus = 'queued' | 'processing' | 'sent' | 'failed';

export interface RecipientObject {
  email: string;
  name?: string;
  variables?: Record<string, string>;
}

export type EmailRecipientInput = string | RecipientObject;

export interface EmailAttachment {
  filename: string;
  url: string;
  contentType: string;
}

// 1. Email Preview API
export interface EmailPreviewTemplateRequest {
  mode: 'template';
  template_id: string;
  subject?: string;
  content?: string;
  variables?: Record<string, string>;
}

export interface EmailPreviewCustomRequest {
  mode: 'custom';
  subject: string;
  content: string;
  images?: string[];
  attachments?: EmailAttachment[];
}

export type EmailPreviewRequest = EmailPreviewTemplateRequest | EmailPreviewCustomRequest;

export interface EmailPreviewResponse {
  success: boolean;
  data?: {
    subject: string;
    html: string;
    text: string;
    content_type: string;
    attachments: EmailAttachment[];
  };
  error?: string;
}

// 2. Image Upload API
export interface UploadedImageData {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
  storage?: string;
}

export interface ImageUploadResponse {
  success: boolean;
  data?: {
    url: string;
    urls?: string[];
    filename?: string;
    size?: number;
    mimetype?: string;
    storage?: string;
    files?: UploadedImageData[];
  };
  error?: string;
}

// 3. Create Email Campaign
export interface CreateTemplateCampaignRequest {
  campaign_name: string;
  mode: 'template';
  template_id: string;
  subject?: string;
  content?: string;
  recipients: EmailRecipientInput[];
  variables?: Record<string, string>;
  images?: string[];
  attachments?: EmailAttachment[];
}

export interface CreateCustomCampaignRequest {
  campaign_name: string;
  mode: 'custom';
  subject: string;
  content: string;
  recipients: EmailRecipientInput[];
  variables?: Record<string, string>;
  images?: string[];
  attachments?: EmailAttachment[];
}

export type CreateEmailCampaignRequest =
  | CreateTemplateCampaignRequest
  | CreateCustomCampaignRequest;

export interface CampaignRecipientRecord {
  email: string;
  name?: string;
  variables?: Record<string, string>;
  status: RecipientStatus;
  sent_at?: string | null;
  message_id?: string | null;
  error_message?: string | null;
  attempts?: number;
}

export interface EmailCampaignSummary {
  _id?: string;
  id: number | string;
  campaign_name: string;
  mode: EmailCampaignMode;
  template_id?: string;
  subject: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: CampaignStatus;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface EmailCampaignDetail extends EmailCampaignSummary {
  content?: string;
  variables?: Record<string, string>;
  images?: string[];
  attachments?: EmailAttachment[];
  recipients: CampaignRecipientRecord[];
  created_by?: string;
}

export interface CreateCampaignResponse {
  success: boolean;
  message?: string;
  data?: EmailCampaignDetail;
  error?: string;
}

// 4. List Campaigns
export interface CampaignListParams {
  page?: number;
  limit?: number;
  mode?: EmailCampaignMode;
  status?: CampaignStatus;
}

export interface CampaignListResponse {
  success: boolean;
  data?: EmailCampaignSummary[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

// 5. Get Campaign by ID
export interface GetCampaignResponse {
  success: boolean;
  data?: EmailCampaignDetail;
  error?: string;
}

// 6. Retry Failed Recipients
export interface RetryCampaignResponse {
  success: boolean;
  count?: number;
  message?: string;
  error?: string;
}

// 7. Queue Status
export interface QueueStatusResponse {
  success: boolean;
  data?: {
    queueName: string;
    isRedisAvailable: boolean;
    bullmqActive: boolean;
  };
  error?: string;
}

// 8-12. Templates API
export interface EmailTemplate {
  _id?: string;
  id?: number | string;
  template_id: string;
  name: string;
  subject: string;
  content: string;
  category?: string;
  variables: string[];
  status: boolean;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ListTemplatesResponse {
  success: boolean;
  data?: EmailTemplate[];
  error?: string;
}

export interface GetTemplateResponse {
  success: boolean;
  data?: EmailTemplate;
  error?: string;
}

export interface CreateTemplateRequest {
  template_id: string;
  name: string;
  subject: string;
  content: string;
  category?: string;
  variables?: string[];
  status?: boolean;
}

export interface UpdateTemplateRequest {
  template_id?: string;
  name?: string;
  subject?: string;
  content?: string;
  category?: string;
  variables?: string[];
  status?: boolean;
}

export interface TemplateActionResponse {
  success: boolean;
  data?: EmailTemplate;
  message?: string;
  error?: string;
}

// Visual Element Model for Visual Studio Editor
export type VisualElementType =
  | 'logo'
  | 'banner'
  | 'image'
  | 'heading'
  | 'subheading'
  | 'text'
  | 'button'
  | 'link'
  | 'divider'
  | 'footer'
  | 'badge'
  | 'card';

export interface VisualElement {
  id: string;
  type: VisualElementType;
  content?: string;
  imageUrl?: string;
  imageFilename?: string;
  altText?: string;
  url?: string;
  fontSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  textAlign?: 'left' | 'center' | 'right';
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  paddingY?: number;
  paddingX?: number;
  bgColor?: string;
  borderColor?: string;
  letterSpacing?: string;
}

export interface EmailTemplateStyle {
  canvasBgColor: string;
  outerBgColor: string;
  fontFamily: 'sans' | 'serif';
  cardBorderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  cardBorder: string;
  cardShadow?: string;
  primaryColor: string;
  designId?: string;
}


