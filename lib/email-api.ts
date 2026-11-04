import { AxiosError } from 'axios';
import { apiClient, API_BASE_URL } from './api';
import { getAuthToken } from './auth';
import {
  extractHostedImageUrl,
  normalizeImageUrl,
  dataUrlToFile,
  fileToDataUrl,
  isDataUrl,
} from './image-utils';
import {
  EmailPreviewRequest,
  EmailPreviewResponse,
  ImageUploadResponse,
  CreateEmailCampaignRequest,
  CreateCampaignResponse,
  CampaignListParams,
  CampaignListResponse,
  GetCampaignResponse,
  RetryCampaignResponse,
  QueueStatusResponse,
  ListTemplatesResponse,
  GetTemplateResponse,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateActionResponse,
} from '@/types/email';

export function extractErrorMessage(err: unknown, defaultMsg: string): string {
  if (err && typeof err === 'object') {
    const axiosErr = err as AxiosError<{ success?: boolean; error?: string; message?: string }>;

    // Specific timeout handling
    if (axiosErr.code === 'ECONNABORTED' || axiosErr.message?.toLowerCase().includes('timeout')) {
      return 'The server took longer than expected to process the request. Your changes have been preserved in the editor so you will not lose your work. Please verify your connection and try saving again.';
    }

    // Cancellation / Network interruption
    if (axiosErr.code === 'ERR_CANCELED' || axiosErr.message?.toLowerCase().includes('canceled')) {
      return 'The request was canceled or interrupted. Your editor changes have been safely preserved.';
    }

    // Offline / No network
    if (!axiosErr.response && (axiosErr.code === 'ERR_NETWORK' || (typeof navigator !== 'undefined' && !navigator.onLine))) {
      return 'Network connection lost. Unable to reach the server. Your template changes are preserved in the editor.';
    }

    // Payload too large
    if (axiosErr.response?.status === 413) {
      return 'The template content is too large for the server. Images are being hosted to reduce size; please try saving again.';
    }

    // Auth expired
    if (axiosErr.response?.status === 401) {
      return 'Your authentication session has expired. Please sign in again in another tab, then re-click Save.';
    }

    if (axiosErr.response?.data?.error) {
      return axiosErr.response.data.error;
    }
    if (axiosErr.response?.data?.message) {
      return axiosErr.response.data.message;
    }
    if (axiosErr.message) {
      return axiosErr.message;
    }
  }
  return defaultMsg;
}

/**
 * 1. Email Preview API
 * POST /api/email/preview
 */
export async function previewEmail(
  payload: EmailPreviewRequest
): Promise<EmailPreviewResponse> {
  try {
    const res = await apiClient.post<EmailPreviewResponse>('/api/email/preview', payload, {
      timeout: 30000,
    });
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to generate email preview.'),
    };
  }
}

/**
 * 2. Image Upload API
 * POST /api/email/upload-image
 * Max size: 5MB. Formats: PNG, JPG, JPEG, GIF
 */
export async function uploadEmailImage(
  files: File | File[]
): Promise<ImageUploadResponse> {
  const fileList = Array.isArray(files) ? files : [files];
  if (fileList.length === 0) {
    return { success: false, error: 'No image files provided for upload.' };
  }

  // Endpoints to probe in priority order
  const endpoints = [
    '/api/email/upload-image',
    '/api/email/upload',
    '/api/upload',
    '/api/files/upload',
    '/api/media/upload',
  ];

  let lastError = 'Failed to upload image.';

  // Strategy 1: Multipart form-data with individual field names
  for (const ep of endpoints) {
    const fieldsToTry =
      fileList.length === 1 ? ['file', 'image', 'upload'] : ['images', 'files', 'file', 'image'];

    for (const field of fieldsToTry) {
      // 1. In browser environments, try native fetch first (safest for multipart boundary calculation)
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        try {
          const fetchFormData = new FormData();
          if (fileList.length === 1) {
            fetchFormData.append(field, fileList[0]);
          } else {
            fileList.forEach((f) => fetchFormData.append(field, f));
          }

          const token = getAuthToken();
          const fetchHeaders: Record<string, string> = {
            Accept: 'application/json',
          };
          if (token) {
            fetchHeaders['Authorization'] = `Bearer ${token}`;
            fetchHeaders['x-auth-token'] = token;
          }

          const fetchRes = await fetch(`${API_BASE_URL}${ep}`, {
            method: 'POST',
            headers: fetchHeaders,
            credentials: 'include',
            body: fetchFormData,
          });

          if (fetchRes.ok) {
            const rawData = await fetchRes.json().catch(() => null);
            const hostedUrl = extractHostedImageUrl(rawData);
            if (hostedUrl) {
              const rawObj = rawData as Record<string, unknown> | null;
              const urls: string[] = [hostedUrl];
              if (rawObj?.urls && Array.isArray(rawObj.urls)) {
                urls.push(...(rawObj.urls as string[]).map((u) => normalizeImageUrl(u)));
              }
              const dataObj = (rawObj?.data && typeof rawObj.data === 'object'
                ? rawObj.data
                : rawObj) as Record<string, unknown>;

              return {
                success: true,
                data: {
                  url: hostedUrl,
                  urls: Array.from(new Set(urls)),
                  filename: (dataObj?.filename as string) || fileList[0].name,
                  size: (dataObj?.size as number) || fileList[0].size,
                  mimetype: (dataObj?.mimetype as string) || fileList[0].type,
                },
              };
            }
          } else {
            const errData = await fetchRes.json().catch(() => null);
            const errMsg =
              errData?.error || errData?.message || `HTTP ${fetchRes.status}: ${fetchRes.statusText}`;
            lastError = errMsg || lastError;
            if (fetchRes.status === 404) break;
            if (fetchRes.status === 400 || errMsg.toLowerCase().includes('unexpected field')) continue;
          }
        } catch {
          // Native fetch failed, continue to apiClient.post
        }
      }

      // 2. Axios apiClient fallback
      try {
        const formData = new FormData();
        if (fileList.length === 1) {
          formData.append(field, fileList[0]);
        } else {
          fileList.forEach((f) => formData.append(field, f));
        }

        const res = await apiClient.post(ep, formData, {
          timeout: 60000,
        });

        const rawObj = res.data as Record<string, unknown> | null;
        if (rawObj && rawObj.success === false) {
          lastError =
            (rawObj.error as string) || (rawObj.message as string) || lastError;
          continue;
        }

        const hostedUrl = extractHostedImageUrl(res.data);
        if (hostedUrl) {
          const urls: string[] = [hostedUrl];
          if (rawObj?.urls && Array.isArray(rawObj.urls)) {
            urls.push(...(rawObj.urls as string[]).map((u) => normalizeImageUrl(u)));
          } else if (
            rawObj?.data &&
            typeof rawObj.data === 'object' &&
            Array.isArray((rawObj.data as Record<string, unknown>).urls)
          ) {
            urls.push(
              ...((rawObj.data as Record<string, unknown>).urls as string[]).map((u) =>
                normalizeImageUrl(u)
              )
            );
          }

          const dataObj = (rawObj?.data && typeof rawObj.data === 'object'
            ? rawObj.data
            : rawObj) as Record<string, unknown>;

          return {
            success: true,
            data: {
              url: hostedUrl,
              urls: Array.from(new Set(urls)),
              filename: (dataObj?.filename as string) || fileList[0].name,
              size: (dataObj?.size as number) || fileList[0].size,
              mimetype: (dataObj?.mimetype as string) || fileList[0].type,
            },
          };
        }
      } catch (err) {
        const axiosErr = err as AxiosError<{ error?: string; message?: string }>;
        const status = axiosErr.response?.status;
        const errMsg =
          axiosErr.response?.data?.error ||
          axiosErr.response?.data?.message ||
          axiosErr.message ||
          '';

        lastError = errMsg || lastError;

        // If 404, this endpoint is not found -> break field loop and try next endpoint
        if (status === 404) {
          break;
        }

        // If 400 or Multer error with 'Unexpected field', continue to next field name
        if (status === 400 || errMsg.toLowerCase().includes('unexpected field')) {
          continue;
        }
      }
    }
  }

  // Strategy 2: JSON Base64 payload fallback (for backends that accept JSON body instead of Multer)
  if (fileList.length === 1) {
    try {
      const dataUrl = await fileToDataUrl(fileList[0]);
      for (const ep of endpoints) {
        try {
          const jsonRes = await apiClient.post(
            ep,
            {
              image: dataUrl,
              file: dataUrl,
              filename: fileList[0].name,
              mimetype: fileList[0].type,
            },
            { timeout: 60000 }
          );

          const hostedUrl = extractHostedImageUrl(jsonRes.data);
          if (hostedUrl) {
            return {
              success: true,
              data: {
                url: hostedUrl,
                urls: [hostedUrl],
                filename: fileList[0].name,
                size: fileList[0].size,
                mimetype: fileList[0].type,
              },
            };
          }
        } catch {}
      }
    } catch {}
  }

  return {
    success: false,
    error: lastError || 'Failed to upload image to server storage.',
  };
}

/**
 * Automatically hosts any Base64 data:image/... URLs embedded in an email template
 * by uploading them to persistent storage and replacing them with stable HTTPS URLs.
 */
export async function replaceTemplateBase64Images(
  content: string
): Promise<{ success: boolean; newContent: string; replacedCount: number; error?: string }> {
  if (!content) return { success: true, newContent: content, replacedCount: 0 };

  const base64Matches = Array.from(
    new Set(
      Array.from(
        content.matchAll(/data:image\/[a-zA-Z0-9+.-]+;base64,[a-zA-Z0-9+/=]+/gi)
      ).map((m) => m[0])
    )
  );

  if (base64Matches.length === 0) {
    return { success: true, newContent: content, replacedCount: 0 };
  }

  let updatedContent = content;
  let replacedCount = 0;
  const replacedMap = new Map<string, string>();

  for (let i = 0; i < base64Matches.length; i++) {
    const dataUrl = base64Matches[i];
    const file = dataUrlToFile(dataUrl, `template-image-${i + 1}.jpg`);
    if (!file) continue;

    const uploadRes = await uploadEmailImage(file);
    if (uploadRes.success && uploadRes.data?.url) {
      const publicHttpsUrl = normalizeImageUrl(uploadRes.data.url);
      replacedMap.set(dataUrl, publicHttpsUrl);
      updatedContent = updatedContent.replaceAll(dataUrl, publicHttpsUrl);
      replacedCount++;
    } else {
      return {
        success: false,
        newContent: updatedContent,
        error: uploadRes.error || `Failed to upload image #${i + 1} to storage.`,
        replacedCount,
      };
    }
  }

  // Also update embedded metadata comment if present using the exact URL replacement map
  const metaMatch = updatedContent.match(/<!-- CAMPAIGN_STUDIO_DATA: (.*?) -->/);
  if (metaMatch && metaMatch[1]) {
    try {
      const parsed = JSON.parse(metaMatch[1]);
      if (Array.isArray(parsed.elements)) {
        parsed.elements = parsed.elements.map((el: any) => {
          if (el.imageUrl && replacedMap.has(el.imageUrl)) {
            return { ...el, imageUrl: replacedMap.get(el.imageUrl) };
          }
          return el;
        });
        const newMetaComment = `<!-- CAMPAIGN_STUDIO_DATA: ${JSON.stringify(parsed)} -->`;
        updatedContent = updatedContent.replace(
          /<!-- CAMPAIGN_STUDIO_DATA: (.*?) -->/,
          newMetaComment
        );
      }
    } catch {}
  }

  return {
    success: true,
    newContent: updatedContent,
    replacedCount,
  };
}

/**
 * 3. Create Email Campaign
 * POST /api/email/campaigns
 */
export async function createEmailCampaign(
  payload: CreateEmailCampaignRequest
): Promise<CreateCampaignResponse> {
  try {
    const res = await apiClient.post<CreateCampaignResponse>('/api/email/campaigns', payload);
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to create and queue email campaign.'),
    };
  }
}

/**
 * 4. List Campaigns
 * GET /api/email/campaigns
 */
export async function listEmailCampaigns(
  params?: CampaignListParams
): Promise<CampaignListResponse> {
  try {
    const res = await apiClient.get<CampaignListResponse>('/api/email/campaigns', {
      params,
    });
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch campaigns list.'),
    };
  }
}

/**
 * 5. Get Campaign by ID
 * GET /api/email/campaigns/:id
 */
export async function getEmailCampaign(
  id: string | number
): Promise<GetCampaignResponse> {
  try {
    const res = await apiClient.get<GetCampaignResponse>(`/api/email/campaigns/${id}`);
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch campaign details.'),
    };
  }
}

/**
 * 6. Retry Failed Recipients
 * POST /api/email/campaigns/:id/retry
 */
export async function retryFailedRecipients(
  id: string | number
): Promise<RetryCampaignResponse> {
  try {
    const res = await apiClient.post<RetryCampaignResponse>(
      `/api/email/campaigns/${id}/retry`
    );
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to retry failed recipients.'),
    };
  }
}

/**
 * 7. Get Queue Status
 * GET /api/email/queue-status
 */
export async function getEmailQueueStatus(): Promise<QueueStatusResponse> {
  try {
    const res = await apiClient.get<QueueStatusResponse>('/api/email/queue-status');
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to get queue status.'),
    };
  }
}

/**
 * 8. List Email Templates
 * GET /api/email/templates
 */
export async function listEmailTemplates(): Promise<ListTemplatesResponse> {
  try {
    const res = await apiClient.get<ListTemplatesResponse>('/api/email/templates');
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch email templates.'),
    };
  }
}

/**
 * 9. Get Template by ID
 * GET /api/email/templates/:id
 */
export async function getEmailTemplate(
  id: string | number
): Promise<GetTemplateResponse> {
  try {
    const res = await apiClient.get<GetTemplateResponse>(`/api/email/templates/${id}`);
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to fetch template details.'),
    };
  }
}

/**
 * 10. Create Email Template
 * POST /api/email/templates
 */
export async function createEmailTemplate(
  payload: CreateTemplateRequest
): Promise<TemplateActionResponse> {
  try {
    const res = await apiClient.post<TemplateActionResponse>(
      '/api/email/templates',
      payload,
      {
        timeout: 45000, // 45s timeout for template save
      }
    );
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to create email template.'),
    };
  }
}

/**
 * 11. Update Email Template
 * PUT /api/email/templates/:id
 */
export async function updateEmailTemplate(
  id: string | number,
  payload: UpdateTemplateRequest
): Promise<TemplateActionResponse> {
  try {
    const res = await apiClient.put<TemplateActionResponse>(
      `/api/email/templates/${id}`,
      payload,
      {
        timeout: 45000, // 45s timeout for template save
      }
    );
    return res.data;
  } catch (err: unknown) {
    // If PUT returns 404 Not Found (PUT endpoint not supported on staging server),
    // automatically fall back to POST /api/email/templates using the SAME template_id.
    // Critical: Do NOT generate random versioned slugs to prevent duplicate saves!
    const axiosErr = err as { response?: { status?: number }; status?: number };
    if (axiosErr?.response?.status === 404 || axiosErr?.status === 404) {
      const canonicalSlug =
        payload.template_id ||
        (typeof id === 'string' && !id.match(/^[0-9a-fA-F]{24}$/) ? id : undefined);

      // If id was a mongo _id and canonicalSlug is different, try PUT by template_id first
      if (canonicalSlug && canonicalSlug !== String(id)) {
        try {
          const putSlugRes = await apiClient.put<TemplateActionResponse>(
            `/api/email/templates/${canonicalSlug}`,
            payload,
            { timeout: 45000 }
          );
          return putSlugRes.data;
        } catch {
          // Fall through to POST upsert
        }
      }

      try {
        const slugId = canonicalSlug || String(id);
        const postRes = await apiClient.post<TemplateActionResponse>(
          '/api/email/templates',
          {
            template_id: slugId,
            name: payload.name || 'Email Template',
            subject: payload.subject || '',
            content: payload.content || '',
            category: payload.category || 'marketing',
            variables: payload.variables || [],
            status: payload.status ?? true,
          },
          { timeout: 45000 }
        );
        return postRes.data;
      } catch (postErr) {
        return {
          success: false,
          error: extractErrorMessage(postErr, 'Failed to save email template.'),
        };
      }
    }

    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to update email template.'),
    };
  }
}

/**
 * 12. Delete Email Template
 * DELETE /api/email/templates/:id
 */
export async function deleteEmailTemplate(
  id: string | number
): Promise<TemplateActionResponse> {
  try {
    const res = await apiClient.delete<TemplateActionResponse>(
      `/api/email/templates/${id}`
    );
    return res.data;
  } catch (err) {
    return {
      success: false,
      error: extractErrorMessage(err, 'Failed to deactivate email template.'),
    };
  }
}

