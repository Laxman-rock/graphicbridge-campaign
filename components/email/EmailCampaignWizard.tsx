'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Mail,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Layers,
  Plus,
  Trash2,
  Tag,
  Paperclip,
} from 'lucide-react';
import { CsvImportResult, EmailContactRecord } from '@/types/campaign';
import {
  EmailCampaignMode,
  EmailTemplate,
  EmailAttachment,
  CreateEmailCampaignRequest,
  EmailPreviewResponse,
} from '@/types/email';
import {
  listEmailTemplates,
  createEmailCampaign,
  previewEmail,
  updateEmailTemplate,
  replaceTemplateBase64Images,
} from '@/lib/email-api';
import { EMAIL_PRESETS } from '@/lib/email-presets';
import {
  validateEmailHtmlImages,
  sanitizeEmailHtmlImageUrls,
  normalizeImageUrl,
  extractImageUrlsFromHtml,
} from '@/lib/image-utils';
import { useToast } from '@/components/ui/Toast';
import CsvImporter from '@/components/campaign/CsvImporter';
import ImageUploader from './ImageUploader';
import EmailPreviewModal from './EmailPreviewModal';

interface EmailCampaignWizardProps {
  onCampaignCreated?: () => void;
}

export default function EmailCampaignWizard({
  onCampaignCreated,
}: EmailCampaignWizardProps) {
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();

  // Wizard Step: 1 = CSV & Contacts, 2 = Compose & Content, 3 = Review & Launch
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Contacts
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);

  // Step 2: Campaign Configuration
  const [campaignName, setCampaignName] = useState('');
  const [mode, setMode] = useState<EmailCampaignMode>('template');

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [isFixingImages, setIsFixingImages] = useState(false);

  // Variables mapping: for each variable in template -> { type: 'column' | 'static', value: string }
  const [variableMappings, setVariableMappings] = useState<
    Record<string, { type: 'column' | 'static'; value: string }>
  >({});

  // Custom Mode fields
  const [customSubject, setCustomSubject] = useState('');
  const [customContent, setCustomContent] = useState(
    '<h2>Hello {{customer_name}}!</h2>\n<p>We are thrilled to share an important announcement with you.</p>\n<p>Best regards,<br/>The Team</p>'
  );
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [newAttachment, setNewAttachment] = useState<EmailAttachment>({
    filename: '',
    url: '',
    contentType: 'application/pdf',
  });
  const [showAddAttachment, setShowAddAttachment] = useState(false);

  // Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<EmailPreviewResponse['data'] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<any>(null);

  // Fetch templates on mount
  useEffect(() => {
    async function loadTemplates() {
      setIsLoadingTemplates(true);
      try {
        const res = await listEmailTemplates();
        if (res.success && res.data) {
          setTemplates(res.data);
          if (res.data.length > 0) {
            const first = res.data[0];
            setSelectedTemplateId(first.template_id);
            setTemplateSubject(first.subject || '');
          }
        }
      } catch {
        // Silently catch
      } finally {
        setIsLoadingTemplates(false);
      }
    }
    loadTemplates();
  }, []);

  // When selectedTemplateId changes, update default variable mappings
  useEffect(() => {
    const tmpl = templates.find((t) => t.template_id === selectedTemplateId);
    if (tmpl) {
      setTemplateSubject(tmpl.subject || '');
      const initialMap: Record<string, { type: 'column' | 'static'; value: string }> = {};

      if (tmpl.variables && Array.isArray(tmpl.variables)) {
        tmpl.variables.forEach((v) => {
          // If CSV has a column matching this variable name (e.g. name, customer_name)
          if (importResult) {
            const matchedHeader = importResult.headers.find(
              (h) => h.toLowerCase().replace(/[\s\-_]+/g, '') === v.toLowerCase().replace(/[\s\-_]+/g, '')
            );
            if (matchedHeader) {
              initialMap[v] = { type: 'column', value: matchedHeader };
              return;
            }
          }
          // Default to static
          initialMap[v] = { type: 'static', value: '' };
        });
      }
      setVariableMappings(initialMap);
    }
  }, [selectedTemplateId, templates, importResult]);

  // Handle continuing from Step 1
  const handleProceedFromContacts = (result: CsvImportResult) => {
    setImportResult(result);
    if (!campaignName) {
      const baseName = result.fileName.replace(/\.csv$/i, '');
      setCampaignName(`${baseName} Campaign`);
    }
    setStep(2);
  };

  // Helper: Build recipients payload with row variables
  const buildRecipientsPayload = () => {
    if (!importResult) return [];

    const validRecords = importResult.records.filter(
      (r) => r.status === 'valid'
    ) as EmailContactRecord[];

    return validRecords.map((rec) => {
      const recipientVars: Record<string, string> = {};

      if (mode === 'template') {
        Object.entries(variableMappings).forEach(([varKey, mapping]) => {
          if (mapping.type === 'column' && mapping.value) {
            recipientVars[varKey] = rec.raw[mapping.value] || '';
          }
        });
      }

      // If user selected a name column
      const nameVal = rec.name || (importResult.selectedNameCol ? rec.raw[importResult.selectedNameCol] : undefined);
      if (nameVal && !recipientVars.customer_name) {
        recipientVars.customer_name = nameVal;
      }

      const hasVars = Object.keys(recipientVars).length > 0;

      if (!hasVars && !nameVal) {
        return rec.email;
      }

      return {
        email: rec.email,
        name: nameVal || undefined,
        variables: hasVars ? recipientVars : undefined,
      };
    });
  };

  // Helper: Build global variables (static values from mapping)
  const buildGlobalVariables = () => {
    const globals: Record<string, string> = {};
    if (mode === 'template') {
      Object.entries(variableMappings).forEach(([varKey, mapping]) => {
        if (mapping.type === 'static' && mapping.value) {
          globals[varKey] = mapping.value;
        }
      });
    }
    return globals;
  };

  // Trigger preview
  const handleGeneratePreview = async () => {
    setIsPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);

    const firstValid = importResult?.records.find((r) => r.status === 'valid') as
      | EmailContactRecord
      | undefined;

    const sampleVars: Record<string, string> = {};

    if (mode === 'template') {
      Object.entries(variableMappings).forEach(([key, mapping]) => {
        if (mapping.type === 'column' && firstValid && mapping.value) {
          sampleVars[key] = firstValid.raw[mapping.value] || `[${key}]`;
        } else if (mapping.type === 'static') {
          sampleVars[key] = mapping.value || `[${key}]`;
        }
      });
      if (firstValid?.name && !sampleVars.customer_name) {
        sampleVars.customer_name = firstValid.name;
      }
    } else {
      sampleVars.customer_name = firstValid?.name || 'Customer';
    }

    try {
      let res: EmailPreviewResponse;
      const selectedTmpl = templates.find((t) => t.template_id === selectedTemplateId);

      if (mode === 'template') {
        const resolvedTmplContent = selectedTmpl?.content
          ? sanitizeEmailHtmlImageUrls(selectedTmpl.content)
          : undefined;

        res = await previewEmail({
          mode: 'template',
          template_id: selectedTemplateId,
          subject: templateSubject || undefined,
          content: resolvedTmplContent,
          variables: sampleVars,
        });
      } else {
        const sanitizedCustom = sanitizeEmailHtmlImageUrls(customContent);
        const allCustomImages = Array.from(
          new Set([...extractImageUrlsFromHtml(sanitizedCustom), ...images.map((u) => normalizeImageUrl(u))])
        );

        res = await previewEmail({
          mode: 'custom',
          subject: customSubject,
          content: sanitizedCustom,
          images: allCustomImages,
          attachments,
        });
      }

      if (res.success && res.data) {
        setPreviewData(res.data);
      } else {
        // Fallback local renderer if server preview API encounters missing template
        let renderedHtml = mode === 'template' ? (selectedTmpl?.content || '<p>Template Content</p>') : customContent;
        let renderedSubj = mode === 'template' ? templateSubject : customSubject;
        Object.entries(sampleVars).forEach(([k, v]) => {
          const rg = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
          renderedHtml = renderedHtml.replace(rg, v);
          renderedSubj = renderedSubj.replace(rg, v);
        });

        const safeRenderedHtml = sanitizeEmailHtmlImageUrls(renderedHtml);

        setPreviewData({
          subject: renderedSubj,
          html: safeRenderedHtml,
          text: safeRenderedHtml.replace(/<[^>]*>/g, ''),
          content_type: 'HTML',
          attachments: attachments,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to preview email';
      setPreviewError(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  // One-click repair: uploads all Base64 images to persistent storage & updates template
  const handleAutoFixTemplateImages = async () => {
    const tmpl = templates.find((t) => t.template_id === selectedTemplateId);
    if (!tmpl || !tmpl.content) return;

    setIsFixingImages(true);
    try {
      const fixRes = await replaceTemplateBase64Images(tmpl.content);
      if (fixRes.success && fixRes.newContent) {
        // Update on backend
        const targetId = tmpl._id || tmpl.id || tmpl.template_id;
        const updateRes = await updateEmailTemplate(targetId, {
          template_id: tmpl.template_id,
          name: tmpl.name,
          subject: tmpl.subject,
          category: tmpl.category,
          variables: tmpl.variables,
          content: fixRes.newContent,
          status: tmpl.status ?? true,
        });

        if (updateRes.success) {
          // Update local templates state
          setTemplates((prev) =>
            prev.map((t) =>
              t.template_id === selectedTemplateId
                ? { ...t, content: fixRes.newContent }
                : t
            )
          );
          toastSuccess(
            `Successfully hosted ${fixRes.replacedCount} image(s) on public HTTPS and updated template "${tmpl.name}"!`,
            'Template Fixed'
          );
        } else {
          toastError(
            updateRes.error || 'Images were uploaded but template could not be updated on server.',
            'Update Failed'
          );
        }
      } else {
        toastError(
          fixRes.error || 'Failed to upload and host template images.',
          'Hosting Error'
        );
      }
    } catch {
      toastError('Network error while hosting template images.', 'Error');
    } finally {
      setIsFixingImages(false);
    }
  };

  // Submit campaign
  const handleLaunchCampaign = async () => {
    if (!campaignName.trim()) {
      toastError('Campaign name is required.', 'Missing Campaign Name');
      return;
    }

    const recipients = buildRecipientsPayload();
    if (recipients.length === 0) {
      toastError('No valid recipients found to send campaign.', 'No Recipients');
      return;
    }

    setIsSubmitting(true);
    try {
      let payload: CreateEmailCampaignRequest;

      if (mode === 'template') {
        if (!selectedTemplateId) {
          toastError('Please select an email template.', 'Template Missing');
          setIsSubmitting(false);
          return;
        }

        const selectedTmpl = templates.find((t) => t.template_id === selectedTemplateId);
        if (!selectedTmpl) {
          toastError('Selected template was not found.', 'Template Missing');
          setIsSubmitting(false);
          return;
        }

        let resolvedTmplContent = selectedTmpl.content;

        if (resolvedTmplContent) {
          const imgValidation = validateEmailHtmlImages(resolvedTmplContent);
          if (!imgValidation.valid) {
            toastInfo?.(
              'Auto-hosting local template images to persistent storage before sending...',
              'Hosting Images'
            );
            const fixRes = await replaceTemplateBase64Images(resolvedTmplContent);
            if (fixRes.success && fixRes.newContent) {
              resolvedTmplContent = fixRes.newContent;
              const targetId = selectedTmpl._id || selectedTmpl.id || selectedTmpl.template_id;
              // Asynchronously persist clean template with public HTTPS URLs on backend
              updateEmailTemplate(targetId, {
                template_id: selectedTmpl.template_id,
                name: selectedTmpl.name,
                subject: selectedTmpl.subject,
                category: selectedTmpl.category,
                variables: selectedTmpl.variables,
                content: fixRes.newContent,
                status: selectedTmpl.status ?? true,
              }).catch(() => {});

              // Update local state so wizard doesn't flag it again
              setTemplates((prev) =>
                prev.map((t) =>
                  t.template_id === selectedTemplateId
                    ? { ...t, content: fixRes.newContent }
                    : t
                )
              );
            } else {
              const firstErr = imgValidation.detailedErrors?.[0];
              toastError(
                `The selected template contains un-hosted image (${firstErr?.label || firstErr?.url || 'image'}). Auto-hosting failed: ${fixRes.error || 'Server storage upload failed'}. Recipients in Gmail and Outlook will see broken icons. Please host or replace this image before sending.`,
                'Un-hosted Image Detected'
              );
              setIsSubmitting(false);
              return;
            }
          }
        }

        // Post-verification: Ensure NO un-hosted images remain before sending
        if (resolvedTmplContent) {
          const postCheck = validateEmailHtmlImages(resolvedTmplContent);
          if (!postCheck.valid) {
            const firstErr = postCheck.detailedErrors?.[0];
            toastError(
              `Sending blocked: Image "${firstErr?.label || firstErr?.url}" is not accessible over public HTTPS. Reason: ${firstErr?.reason || 'Invalid format'}.`,
              'Image Validation Failed'
            );
            setIsSubmitting(false);
            return;
          }
        }

        const sanitizedTmplContent = resolvedTmplContent
          ? sanitizeEmailHtmlImageUrls(resolvedTmplContent)
          : undefined;

        // Extract all hosted image URLs from template HTML so the email dispatch worker has full image inventory
        const extractedImages = sanitizedTmplContent ? extractImageUrlsFromHtml(sanitizedTmplContent) : [];
        const combinedImages = Array.from(new Set([...extractedImages, ...images.map((u) => normalizeImageUrl(u))]));

        payload = {
          campaign_name: campaignName.trim(),
          mode: 'template',
          template_id: selectedTemplateId,
          subject: templateSubject || undefined,
          content: sanitizedTmplContent,
          recipients,
          variables: buildGlobalVariables(),
          images: combinedImages,
          attachments,
        };
      } else {
        if (!customSubject.trim() || !customContent.trim()) {
          toastError('Subject and HTML content are required for custom campaigns.', 'Incomplete Content');
          setIsSubmitting(false);
          return;
        }

        let customContentToSend = customContent;
        const imgValidation = validateEmailHtmlImages(customContent);
        if (!imgValidation.valid) {
          toastInfo?.(
            'Auto-hosting custom email images to persistent storage...',
            'Hosting Images'
          );
          const fixRes = await replaceTemplateBase64Images(customContent);
          if (fixRes.success && fixRes.newContent) {
            customContentToSend = fixRes.newContent;
            setCustomContent(fixRes.newContent);
          } else {
            const firstErr = imgValidation.detailedErrors?.[0];
            toastError(
              `The email body contains un-hosted image (${firstErr?.label || firstErr?.url || 'image'}). Auto-hosting failed: ${fixRes.error || 'Storage upload failed'}. Recipients will see broken image icons.`,
              'Un-hosted Image Detected'
            );
            setIsSubmitting(false);
            return;
          }
        }

        const postCheck = validateEmailHtmlImages(customContentToSend);
        if (!postCheck.valid) {
          const firstErr = postCheck.detailedErrors?.[0];
          toastError(
            `Sending blocked: Image "${firstErr?.label || firstErr?.url}" is not accessible over public HTTPS. Reason: ${firstErr?.reason || 'Invalid format'}.`,
            'Image Validation Failed'
          );
          setIsSubmitting(false);
          return;
        }

        const sanitizedCustomContent = sanitizeEmailHtmlImageUrls(customContentToSend);
        const extractedImages = extractImageUrlsFromHtml(sanitizedCustomContent);
        const combinedImages = Array.from(new Set([...extractedImages, ...images.map((u) => normalizeImageUrl(u))]));

        payload = {
          campaign_name: campaignName.trim(),
          mode: 'custom',
          subject: customSubject.trim(),
          content: sanitizedCustomContent,
          recipients,
          images: combinedImages,
          attachments,
        };
      }

      const res = await createEmailCampaign(payload);
      if (res.success) {
        setCreatedResult(res);
        toastSuccess(
          res.message || `Campaign "${campaignName}" queued successfully!`,
          'Campaign Created'
        );
      } else {
        toastError(res.error || 'Failed to dispatch campaign.', 'Creation Error');
      }
    } catch {
      toastError('An unexpected server error occurred during dispatch.', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAttachment = () => {
    if (!newAttachment.filename.trim() || !newAttachment.url.trim()) {
      toastError('Filename and file URL are required.', 'Missing Fields');
      return;
    }
    setAttachments([...attachments, { ...newAttachment }]);
    setNewAttachment({ filename: '', url: '', contentType: 'application/pdf' });
    setShowAddAttachment(false);
    toastSuccess('Attachment added.', 'Attachment Added');
  };

  return (
    <div className="space-y-8">
      {/* Step Progress Tracker */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {/* Step 1 */}
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-3 group focus:outline-none"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                step === 1
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : importResult
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {importResult && step > 1 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Step 1
              </span>
              <span
                className={`text-xs font-bold ${
                  step === 1 ? 'text-slate-900' : 'text-slate-600'
                }`}
              >
                Audience & Columns
              </span>
            </div>
          </button>

          <div className="w-12 sm:w-20 h-0.5 bg-slate-200" />

          {/* Step 2 */}
          <button
            type="button"
            onClick={() => {
              if (importResult && importResult.summary.validCount > 0) setStep(2);
            }}
            disabled={!importResult || importResult.summary.validCount === 0}
            className="flex items-center gap-3 group focus:outline-none disabled:opacity-40"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                step === 2
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : step > 2
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step > 2 ? <CheckCircle2 className="w-5 h-5" /> : '2'}
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Step 2
              </span>
              <span
                className={`text-xs font-bold ${
                  step === 2 ? 'text-slate-900' : 'text-slate-600'
                }`}
              >
                Compose & Setup
              </span>
            </div>
          </button>

          <div className="w-12 sm:w-20 h-0.5 bg-slate-200" />

          {/* Step 3 */}
          <button
            type="button"
            onClick={() => {
              if (importResult && campaignName) setStep(3);
            }}
            disabled={!importResult || !campaignName}
            className="flex items-center gap-3 group focus:outline-none disabled:opacity-40"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                step === 3
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              3
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Step 3
              </span>
              <span
                className={`text-xs font-bold ${
                  step === 3 ? 'text-slate-900' : 'text-slate-600'
                }`}
              >
                Review & Launch
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* STEP 1: CSV IMPORT & COLUMN SELECTION */}
      {step === 1 && (
        <CsvImporter
          campaignType="email"
          onProceedToWorkflow={handleProceedFromContacts}
          hideHeaderNavigation={true}
        />
      )}

      {/* STEP 2: COMPOSE & SETUP */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Campaign Top Info */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Campaign Details</h3>
                <p className="text-xs text-slate-500">
                  Targeting {importResult?.summary.validCount} verified email recipients from CSV
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setMode('template')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    mode === 'template'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Template Mode</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('custom')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    mode === 'custom'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Custom HTML Mode</span>
                </button>
              </div>
            </div>

            {/* Campaign Name Field */}
            <div className="max-w-xl">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Campaign Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. November Product Launch"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* TEMPLATE MODE CONFIG */}
          {mode === 'template' && (
            <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Select Template</h4>
                  <p className="text-xs text-slate-500">
                    Choose an existing template and map recipient merge tags
                  </p>
                </div>
                {isLoadingTemplates && (
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                )}
              </div>

              {templates.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">No saved templates found on the server</h5>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                      You can instantly use our pre-built modern layouts in Custom Mode or design a template in the Template Studio.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('custom');
                        setCustomSubject(EMAIL_PRESETS[0].subject);
                        setCustomContent(EMAIL_PRESETS[0].htmlContent);
                        toastSuccess('Switched to Custom Mode with Modern Welcome Preset!', 'Preset Loaded');
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                    >
                      Use Modern Preset in Custom Mode
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Email Template
                    </label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full max-w-md px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      {templates.map((tmpl) => (
                        <option key={tmpl.template_id} value={tmpl.template_id}>
                          {tmpl.name} ({tmpl.template_id})
                        </option>
                      ))}
                    </select>

                    {/* Un-hosted images banner with 1-click Auto-Fix */}
                    {(() => {
                      const selectedTmpl = templates.find((t) => t.template_id === selectedTemplateId);
                      if (!selectedTmpl?.content) return null;
                      const imgValidation = validateEmailHtmlImages(selectedTmpl.content);
                      if (imgValidation.valid) return null;

                      return (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2.5 max-w-xl mt-2.5">
                          <div className="flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <h6 className="text-xs font-bold">Un-hosted Local Images in Selected Template</h6>
                              <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">
                                This template contains {imgValidation.invalidUrls.length} un-hosted Base64 image(s). Email clients (Gmail, Outlook) block Base64 and will display broken image icons.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-6">
                            <button
                              type="button"
                              onClick={handleAutoFixTemplateImages}
                              disabled={isFixingImages}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isFixingImages ? 'animate-spin' : ''}`} />
                              <span>{isFixingImages ? 'Uploading Images to Storage...' : 'Auto-Host Images & Fix Template'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Subject Line (Template default or override)
                    </label>
                    <input
                      type="text"
                      value={templateSubject}
                      onChange={(e) => setTemplateSubject(e.target.value)}
                      placeholder="e.g. Welcome {{customer_name}} to {{company_name}}"
                      className="w-full max-w-xl px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Dynamic Variables Mapping */}
                  {Object.keys(variableMappings).length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-blue-600" />
                          Template Variables & Personalization
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Map each template variable to a column in your imported CSV or enter a global fallback value.
                        </p>
                      </div>

                      <div className="space-y-2.5 pt-2">
                        {Object.entries(variableMappings).map(([varKey, mapping]) => (
                          <div
                            key={varKey}
                            className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <span className="font-mono font-bold text-blue-700">
                              {`{{${varKey}}}`}
                            </span>

                            <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
                              <select
                                value={mapping.type}
                                onChange={(e) =>
                                  setVariableMappings({
                                    ...variableMappings,
                                    [varKey]: {
                                      type: e.target.value as 'column' | 'static',
                                      value: '',
                                    },
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 bg-slate-50"
                              >
                                <option value="column">Map to CSV Column</option>
                                <option value="static">Fixed Global Value</option>
                              </select>

                              {mapping.type === 'column' ? (
                                <select
                                  value={mapping.value}
                                  onChange={(e) =>
                                    setVariableMappings({
                                      ...variableMappings,
                                      [varKey]: { ...mapping, value: e.target.value },
                                    })
                                  }
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800"
                                >
                                  <option value="">-- Choose Column --</option>
                                  {importResult?.headers.map((h) => (
                                    <option key={h} value={h}>
                                      {h}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={mapping.value}
                                  onChange={(e) =>
                                    setVariableMappings({
                                      ...variableMappings,
                                      [varKey]: { ...mapping, value: e.target.value },
                                    })
                                  }
                                  placeholder="Enter value (e.g. Acme Inc)"
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CUSTOM MODE CONFIG */}
          {mode === 'custom' && (
            <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Custom Email Message</h4>
                  <p className="text-xs text-slate-500">
                    Compose HTML content or load a modern pre-styled layout
                  </p>
                </div>

                {/* Quick preset selector */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500 whitespace-nowrap flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Load Preset:</span>
                  </label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const selected = EMAIL_PRESETS.find((p) => p.id === e.target.value);
                      if (selected) {
                        setCustomSubject(selected.subject);
                        setCustomContent(selected.htmlContent);
                        toastSuccess(`Loaded "${selected.name}" template.`, 'Preset Loaded');
                      }
                      e.target.value = '';
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                  >
                    <option value="" disabled>
                      -- Choose a modern layout --
                    </option>
                    {EMAIL_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.badge})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Subject Line <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="e.g. Special Offer for {{customer_name}}"
                  className="w-full max-w-xl px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* HTML Content */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    HTML Email Body <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Supports merge tags like {'{{customer_name}}'}
                  </span>
                </div>
                <textarea
                  rows={9}
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                  className="w-full p-4 rounded-xl border border-slate-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-y"
                  placeholder="<h2>Hello {{customer_name}}!</h2><p>...</p>"
                />
              </div>

              {/* Image Uploader */}
              <div className="pt-2">
                <ImageUploader
                  images={images}
                  onChange={setImages}
                  onInsertIntoContent={(url) => {
                    const safeUrl = normalizeImageUrl(url);
                    const tag = `<p><img src="${safeUrl}" alt="Campaign Image" width="600" border="0" style="max-width:100%; height:auto; display:block; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic;" /></p>`;
                    setCustomContent((prev) => prev + '\n' + tag);
                    toastSuccess('Image HTML inserted into email body.', 'Inserted');
                  }}
                />
              </div>

              {/* Attachments Section */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-indigo-600" />
                      Email Attachments
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Include hosted PDF, documents, or reports
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddAttachment(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Attachment</span>
                  </button>
                </div>

                {showAddAttachment && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <h5 className="text-xs font-bold text-slate-800">Add Remote Attachment</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Filename (e.g. document.pdf)"
                        value={newAttachment.filename}
                        onChange={(e) =>
                          setNewAttachment({ ...newAttachment, filename: e.target.value })
                        }
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      />
                      <input
                        type="url"
                        placeholder="File URL (https://...)"
                        value={newAttachment.url}
                        onChange={(e) =>
                          setNewAttachment({ ...newAttachment, url: e.target.value })
                        }
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Content-Type (application/pdf)"
                        value={newAttachment.contentType}
                        onChange={(e) =>
                          setNewAttachment({ ...newAttachment, contentType: e.target.value })
                        }
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddAttachment(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddAttachment}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{att.filename}</p>
                          <p className="text-[11px] font-mono text-slate-400 truncate">{att.url}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Navigation Bar */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Audience</span>
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleGeneratePreview}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Eye className="w-4 h-4 text-blue-600" />
                <span>Live Email Preview</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!campaignName.trim()) {
                    toastError('Please enter a campaign name.', 'Missing Name');
                    return;
                  }
                  if (mode === 'template' && !selectedTemplateId) {
                    toastError('Please select a template.', 'Missing Template');
                    return;
                  }
                  if (mode === 'custom' && (!customSubject.trim() || !customContent.trim())) {
                    toastError('Please enter subject and email content.', 'Incomplete Content');
                    return;
                  }
                  setStep(3);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20"
              >
                <span>Review & Launch</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & LAUNCH */}
      {step === 3 && (
        <div className="space-y-6">
          {createdResult ? (
            /* Success confirmation card */
            <div className="p-8 bg-white rounded-3xl border border-emerald-200 shadow-md text-center space-y-5 animate-in fade-in">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-2xl font-bold text-slate-900">Campaign Queued Successfully!</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {createdResult.message || `Campaign "${campaignName}" has been queued in BullMQ.`}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 max-w-md mx-auto text-xs grid grid-cols-2 gap-3 text-left">
                <div>
                  <span className="text-slate-400">Campaign ID:</span>
                  <p className="font-mono font-bold text-slate-800">
                    {createdResult.data?._id || createdResult.data?.id || 'Queued'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Total Recipients:</span>
                  <p className="font-bold text-emerald-600">
                    {createdResult.data?.total_recipients || importResult?.summary.validCount}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreatedResult(null);
                    setStep(1);
                    setImportResult(null);
                    setCampaignName('');
                  }}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Create Another Campaign
                </button>
                {onCampaignCreated && (
                  <button
                    type="button"
                    onClick={onCampaignCreated}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20"
                  >
                    View in Campaigns History
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Review Card */
            <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Campaign Summary & Final Review</h3>
                <p className="text-xs text-slate-500">
                  Please review the campaign parameters before queueing dispatch to the backend delivery worker.
                </p>
              </div>

              {/* Grid breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium">Campaign Name:</span>
                  <p className="text-sm font-bold text-slate-900 mt-1">{campaignName}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium">Mode:</span>
                  <p className="text-sm font-bold text-slate-900 mt-1 capitalize">{mode} Mode</p>
                  {mode === 'template' && (
                    <span className="text-[11px] font-mono text-blue-600">
                      ID: {selectedTemplateId}
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-emerald-700 font-medium">Verified Recipients:</span>
                  <p className="text-sm font-bold text-emerald-700 mt-1">
                    {importResult?.summary.validCount} contacts
                  </p>
                </div>
              </div>

              {/* Subject Review */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                <span className="text-slate-400 font-medium">Subject Line: </span>
                <span className="font-bold text-slate-900">
                  {mode === 'template' ? templateSubject : customSubject}
                </span>
              </div>

              {/* Sample Recipient Interpolation Preview */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-blue-900">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Sample Recipient Preview</span>
                </div>
                {importResult?.records.find((r) => r.status === 'valid') ? (
                  (() => {
                    const sample = importResult.records.find(
                      (r) => r.status === 'valid'
                    ) as EmailContactRecord;
                    return (
                      <div className="space-y-1 text-slate-600">
                        <p>
                          <strong>Email:</strong> <span className="font-mono">{sample.email}</span>
                        </p>
                        {sample.name && (
                          <p>
                            <strong>Name:</strong> {sample.name}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400">
                          Data parsed from CSV row #{sample.rowIndex}. All {importResult.summary.validCount} valid recipients will be queued for asynchronous delivery.
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-slate-500">No sample recipient available</p>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Compose</span>
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleGeneratePreview}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span>Inspect Email Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLaunchCampaign}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Queueing Campaign...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Queue & Send Campaign ({importResult?.summary.validCount})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Email Preview Modal */}
      <EmailPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        isLoading={previewLoading}
        previewData={previewData}
        error={previewError}
        onRefresh={handleGeneratePreview}
      />
    </div>
  );
}

