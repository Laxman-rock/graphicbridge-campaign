'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Layers,
  Tag,
  Phone,
  Image as ImageIcon,
  FileText,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { CsvImportResult, WhatsAppContactRecord } from '@/types/campaign';
import {
  WhatsAppCampaignMode,
  WhatsAppMessageType,
  WhatsAppTemplate,
  WhatsAppRecipientObject,
  CreateWhatsAppCampaignRequest,
  UnifiedWhatsAppRecipient,
} from '@/types/whatsapp';
import {
  listWhatsAppTemplates,
  listMetaWhatsAppTemplates,
  syncWhatsAppTemplates,
  createWhatsAppCampaign,
  extractTemplateImageHeader,
  extractTemplateBodyVariables,
} from '@/lib/whatsapp-api';
import { WHATSAPP_PRESET_TEMPLATES } from '@/lib/whatsapp-presets';
import { useToast } from '@/components/ui/Toast';
import WhatsAppAudienceStep from './campaign/WhatsAppAudienceStep';
import ImageUploadArea from '@/components/common/ImageUploadArea';
import WhatsAppBubblePreview from './WhatsAppBubblePreview';


// Helper to render body message with highlighted variable chips
function renderHighlightedTemplateBody(text: string) {
  if (!text) return <span className="text-slate-400 italic">(Empty body message)</span>;
  const parts = text.split(/(\{\{[0-9a-zA-Z_]+\}\})/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (/^\{\{[0-9a-zA-Z_]+\}\}$/.test(part)) {
          return (
            <span
              key={i}
              className="inline-block px-1.5 py-0.5 mx-0.5 rounded font-mono font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

interface WhatsAppCampaignWizardProps {
  onCampaignCreated?: () => void;
}

export default function WhatsAppCampaignWizard({
  onCampaignCreated,
}: WhatsAppCampaignWizardProps) {
  const { error: toastError, success: toastSuccess } = useToast();

  // Step state: 1 = CSV & Mobile Column, 2 = Message Setup, 3 = Review & Dispatch
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Contacts & Unified Audience
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);
  const [unifiedRecipients, setUnifiedRecipients] = useState<UnifiedWhatsAppRecipient[]>([]);

  // Collect all available column/variable headers across CSV and recipients
  const audienceHeaders = React.useMemo(() => {
    const headerSet = new Set<string>(importResult?.headers || []);
    headerSet.add('name');
    headerSet.add('phone');
    unifiedRecipients.forEach((r) => {
      if (r.raw) {
        Object.keys(r.raw).forEach((k) => headerSet.add(k));
      }
    });
    return Array.from(headerSet);
  }, [importResult, unifiedRecipients]);

  // Step 2: Campaign Configuration
  const [campaignName, setCampaignName] = useState('');
  const [mode, setMode] = useState<WhatsAppCampaignMode>('template');
  const [messageType, setMessageType] = useState<WhatsAppMessageType>('template');
  const [languageCode, setLanguageCode] = useState('en');
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('');
  const [headerImgError, setHeaderImgError] = useState(false);

  // Variables mapping: for each variable in template body (e.g. '1', '2') -> { type: 'column' | 'static', value: string }
  const [variableMappings, setVariableMappings] = useState<
    Record<string, { type: 'column' | 'static'; value: string }>
  >({});

  // Media state (for template header image or custom media)
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');

  // Custom Message Fields
  const [customText, setCustomText] = useState(
    'Hello *{{customer_name}}*,\nWe have an exciting announcement from our team! Check your dashboard for more details.'
  );

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<any>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load approved templates on mount: Prefer live Meta WhatsApp templates (GET /whatsapp/templates/meta)
  useEffect(() => {
    async function loadTemplates() {
      setIsLoadingTemplates(true);
      try {
        // Requirement 1: Fetch actual Meta WhatsApp template objects using GET /whatsapp/templates/meta
        let res = await listMetaWhatsAppTemplates();
        let loaded: WhatsAppTemplate[] | null = null;

        if (res.success && res.data && res.data.length > 0) {
          loaded = res.data;
        } else {
          // Fallback to local synced templates if Meta endpoint returns empty
          const localRes = await listWhatsAppTemplates();
          if (localRes.success && localRes.data && localRes.data.length > 0) {
            loaded = localRes.data;
          }
        }

        // Display ONLY templates with status: "APPROVED"
        const approved = loaded
          ? loaded.filter((t) => (t.status || '').toUpperCase() === 'APPROVED')
          : [];

        if (approved.length > 0) {
          setTemplates(approved);
          setSelectedTemplateName(approved[0].name);
        } else {
          // Fallback to approved starter presets if no approved templates found in Meta account
          const approvedPresets = WHATSAPP_PRESET_TEMPLATES.filter(
            (t) => (t.status || '').toUpperCase() === 'APPROVED'
          );
          setTemplates(approvedPresets);
          if (approvedPresets.length > 0) {
            setSelectedTemplateName(approvedPresets[0].name);
          }
        }
      } catch {
        const approvedPresets = WHATSAPP_PRESET_TEMPLATES.filter(
          (t) => (t.status || '').toUpperCase() === 'APPROVED'
        );
        setTemplates(approvedPresets);
        if (approvedPresets.length > 0) {
          setSelectedTemplateName(approvedPresets[0].name);
        }
      } finally {
        setIsLoadingTemplates(false);
      }
    }
    loadTemplates();
  }, []);

  // Quick sync from Meta inside wizard
  const handleQuickSync = async () => {
    setIsSyncing(true);
    try {
      const syncRes = await syncWhatsAppTemplates();
      // Re-fetch live Meta templates
      const metaRes = await listMetaWhatsAppTemplates();
      const loaded =
        metaRes.success && metaRes.data && metaRes.data.length > 0
          ? metaRes.data
          : syncRes.data;

      const approved = loaded
        ? loaded.filter((t) => (t.status || '').toUpperCase() === 'APPROVED')
        : [];

      if (approved.length > 0) {
        setTemplates(approved);
        setSelectedTemplateName(approved[0].name);
        toastSuccess(
          `Successfully loaded ${approved.length} approved template(s) from Meta.`,
          'Sync Complete'
        );
      } else {
        toastError(
          syncRes.error || metaRes.error || 'No approved templates found in Meta account.',
          'Sync Notice'
        );
      }
    } catch {
      toastError('Could not sync with Meta API.', 'Error');
    } finally {
      setIsSyncing(false);
    }
  };

  // When selectedTemplateName changes, update variable mappings & language
  const selectedTemplate = templates.find((t) => t.name === selectedTemplateName);

  // Extract template details
  const headerInfo = extractTemplateImageHeader(selectedTemplate);
  const hasImageHeader = headerInfo.hasImageHeader;
  const headerFormat = headerInfo.headerFormat;
  const exampleImageUrl = headerInfo.exampleImageUrl;

  // Active header image: user uploaded custom image takes precedence, then example image from template
  const activeHeaderImageUrl = mediaUrl || exampleImageUrl || '';

  // Body component & text
  const bodyComp = selectedTemplate?.components?.find((c) => c.type === 'BODY');
  const bodyText = bodyComp?.text || '';

  // Footer text
  const footerComp = selectedTemplate?.components?.find((c) => c.type === 'FOOTER');
  const footerText = footerComp?.text || '';

  // Buttons
  const buttonsComp = selectedTemplate?.components?.find((c) => c.type === 'BUTTONS');
  const buttons = buttonsComp?.buttons || [];

  // Quality score
  const qualityScore =
    typeof selectedTemplate?.quality_score === 'string'
      ? selectedTemplate.quality_score
      : (selectedTemplate?.quality_score as any)?.score || undefined;

  // Extract variables strictly from body text (no header handles or URLs)
  const bodyVariables = extractTemplateBodyVariables(bodyText);

  // Extract example body text from Meta template
  const bodyExamples: Record<string, string> = {};
  if (bodyComp?.example && Array.isArray((bodyComp.example as any).body_text)) {
    const exArray = (bodyComp.example as any).body_text[0];
    if (Array.isArray(exArray)) {
      exArray.forEach((val: any, idx: number) => {
        const varKey = String(idx + 1);
        if (val) bodyExamples[varKey] = String(val);
      });
    }
  }

  useEffect(() => {
    if (selectedTemplate) {
      if (selectedTemplate.language) {
        setLanguageCode(selectedTemplate.language);
      }

      // Reset image error state
      setHeaderImgError(false);

      // Reset custom uploaded mediaUrl if template does not have an image header
      const tmplHeader = extractTemplateImageHeader(selectedTemplate);
      if (!tmplHeader.hasImageHeader) {
        setMediaUrl('');
      }

      const initialMap: Record<string, { type: 'column' | 'static'; value: string }> = {};
      const vars = extractTemplateBodyVariables(
        selectedTemplate.components?.find((c) => c.type === 'BODY')?.text
      );

      vars.forEach((v) => {
        // Search audienceHeaders (or importResult headers)
        const headersToSearch = audienceHeaders.length > 0 ? audienceHeaders : (importResult?.headers || []);
        const matchedHeader = headersToSearch.find((h) => {
          const hLower = h.toLowerCase().replace(/[\s\-_]+/g, '');
          const vLower = v.toLowerCase().replace(/[\s\-_]+/g, '');
          return (
            hLower === vLower ||
            (v === '1' && (hLower.includes('name') || hLower.includes('customer') || hLower.includes('client'))) ||
            (v === '2' && (hLower.includes('invoice') || hLower.includes('order') || hLower.includes('bill'))) ||
            (v === '3' && (hLower.includes('amount') || hLower.includes('price') || hLower.includes('total') || hLower.includes('balance')))
          );
        });

        if (matchedHeader) {
          initialMap[v] = { type: 'column', value: matchedHeader };
          return;
        }
        initialMap[v] = { type: 'static', value: '' };
      });

      setVariableMappings(initialMap);
    }
  }, [selectedTemplateName, selectedTemplate, importResult, audienceHeaders]);

  // Handle continuing from Step 1
  const handleProceedFromContacts = (result: CsvImportResult) => {
    setImportResult(result);
    if (!campaignName) {
      const baseName = result.fileName.replace(/\.csv$/i, '');
      setCampaignName(`${baseName} WhatsApp Campaign`);
    }
    setStep(2);
  };

  // Helper: Build recipients payload with preserved phone strings, names and row variables
  const buildRecipientsPayload = (): WhatsAppRecipientObject[] => {
    if (unifiedRecipients.length === 0) return [];

    const validRecords = unifiedRecipients.filter(
      (r) => r.status === 'valid'
    );

    // Exclude recipients who have explicitly opted out
    const eligibleRecords = validRecords.filter((rec) => {
      if (rec.opt_in_status === 'opted_out') return false;
      const raw = rec.raw || {};
      const optInVal =
        raw['whatsapp_opt_in'] ??
        raw['opt_in'] ??
        raw['optin'] ??
        raw['opted_in'] ??
        raw['subscribed'];

      if (optInVal !== undefined && optInVal !== null) {
        const str = String(optInVal).trim().toLowerCase();
        if (str === 'false' || str === '0' || str === 'no' || str === 'opted_out') {
          return false;
        }
      }

      const optOutVal =
        raw['opt_out'] ??
        raw['optout'] ??
        raw['opted_out'] ??
        raw['unsubscribed'];

      if (optOutVal !== undefined && optOutVal !== null) {
        const str = String(optOutVal).trim().toLowerCase();
        if (str === 'true' || str === '1' || str === 'yes') {
          return false;
        }
      }

      return true;
    });

    return eligibleRecords.map((rec) => {
      const recipientVars: Record<string, string> = {};

      if (mode === 'template') {
        bodyVariables.forEach((varKey) => {
          const mapping = variableMappings[varKey];
          if (!mapping) return;
          if (mapping.type === 'column' && mapping.value) {
            const rowVal = rec.raw[mapping.value];
            if (rowVal !== undefined && rowVal !== null) {
              recipientVars[varKey] = String(rowVal);
            }
          } else if (mapping.type === 'static' && mapping.value) {
            recipientVars[varKey] = String(mapping.value);
          }
        });
      }

      // Name column mapping or detection
      const nameVal =
        rec.name ||
        (importResult?.selectedNameCol ? rec.raw[importResult.selectedNameCol] : undefined) ||
        rec.raw['name'] ||
        rec.raw['customer_name'] ||
        rec.raw['first_name'];

      if (nameVal && !recipientVars.customer_name && !recipientVars['1']) {
        recipientVars['1'] = String(nameVal).trim();
      }

      // Preserve phone as string including leading zero and international format
      const rawPhone = rec.formattedPhone || rec.phone || '';
      const phoneToUse = String(rawPhone).trim();

      const item: WhatsAppRecipientObject = {
        whatsapp_number: phoneToUse,
        phone: phoneToUse,
        whatsapp_opt_in: true,
      };

      if (nameVal) {
        item.name = String(nameVal).trim();
      }

      if (Object.keys(recipientVars).length > 0) {
        item.variables = recipientVars;
      }

      return item;
    });
  };

  // Helper: Build global variables (static values) keyed by parameter numbers
  const buildGlobalVariables = (): Record<string, string> => {
    const globals: Record<string, string> = {};
    if (mode === 'template') {
      Object.entries(variableMappings).forEach(([varKey, mapping]) => {
        if (mapping.type === 'static' && mapping.value !== undefined && mapping.value !== '') {
          globals[varKey] = String(mapping.value);
        }
      });
    }
    return globals;
  };

  // Get sample interpolated body text for preview
  const getSampleBodyPreview = () => {
    const firstValid = unifiedRecipients.find((r) => r.status === 'valid');

    if (mode === 'custom') {
      return customText.replace(/\{\{customer_name\}\}/g, firstValid?.name || 'Customer');
    }

    if (!selectedTemplate) return 'No template selected';
    if (!bodyText) return '(Empty template body)';

    let text = bodyText;

    bodyVariables.forEach((varKey) => {
      const mapping = variableMappings[varKey];
      let sampleVal = bodyExamples[varKey] || `[${varKey}]`;
      if (mapping?.type === 'column' && firstValid && mapping.value) {
        sampleVal = firstValid.raw[mapping.value] || sampleVal;
      } else if (mapping?.type === 'static' && mapping.value) {
        sampleVal = mapping.value;
      }
      const regex = new RegExp(`\\{\\{${varKey}\\}\\}`, 'g');
      text = text.replace(regex, sampleVal);
    });

    return text;
  };

  // Submit Campaign to Backend API
  const handleLaunchCampaign = async () => {
    if (!campaignName.trim()) {
      toastError('Campaign name is required.', 'Missing Campaign Name');
      return;
    }

    if (campaignName.trim().length > 200) {
      toastError('Campaign name cannot exceed 200 characters.', 'Name Too Long');
      return;
    }

    if (unifiedRecipients.length === 0) {
      toastError('No valid contacts found for WhatsApp dispatch.', 'No Recipients');
      return;
    }

    if (!whatsappOptIn) {
      toastError(
        'WhatsApp recipient opt-in confirmation is required. Please check the consent confirmation box.',
        'Opt-In Consent Required'
      );
      return;
    }

    const recipients = buildRecipientsPayload();
    if (recipients.length === 0) {
      toastError('No valid contacts found for WhatsApp dispatch.', 'No Recipients');
      return;
    }

    if (mode === 'template') {
      if (!selectedTemplate) {
        toastError('Please select a WhatsApp template.', 'Missing Template');
        return;
      }

      if (!languageCode.trim()) {
        toastError('Please provide a language code for the template (e.g. en).', 'Missing Language');
        return;
      }

      // Check required template variables from body text only
      if (bodyVariables.length > 0) {
        const missing = bodyVariables.filter((v) => {
          const m = variableMappings[v];
          if (!m) return true;
          if (m.type === 'column' && !m.value) return true;
          if (m.type === 'static' && (!m.value || !m.value.trim())) return true;
          return false;
        });

        if (missing.length > 0) {
          toastError(
            `Please configure all template variables. Missing: ${missing.map((v) => `{{${v}}}`).join(', ')}`,
            'Missing Variables'
          );
          return;
        }
      }

      // If template requires an image header, ensure an image URL is present
      if (hasImageHeader && !activeHeaderImageUrl) {
        toastError(
          'This approved template requires a header image. Please upload a header photo before dispatching.',
          'Header Image Required'
        );
        return;
      }
    } else {
      if (!customText.trim()) {
        toastError('Message text is required for custom WhatsApp campaign.', 'Missing Text');
        return;
      }
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      let payload: CreateWhatsAppCampaignRequest;

      if (mode === 'template') {
        const templateId = String(
          selectedTemplate!.template_id ||
          selectedTemplate!._id ||
          selectedTemplate!.id ||
          selectedTemplate!.name
        );

        const finalHeaderUrl = activeHeaderImageUrl || undefined;

        payload = {
          campaign_name: campaignName.trim().slice(0, 200),
          template_name: selectedTemplate!.name,
          language_code: languageCode.trim() || 'en',
          default_opt_in: true,
          whatsapp_opt_in: true,
          mode: 'template',
          message_type: 'template',
          template_id: templateId,
          variables: buildGlobalVariables(),
          recipients,
          ...(finalHeaderUrl ? { media_url: finalHeaderUrl, header_image_url: finalHeaderUrl } : {}),
        };
      } else {
        payload = {
          campaign_name: campaignName.trim().slice(0, 200),
          template_name: 'custom_message',
          language_code: languageCode.trim() || 'en',
          default_opt_in: true,
          whatsapp_opt_in: true,
          mode: 'custom',
          message_type: messageType,
          content: customText,
          recipients,
          ...(mediaUrl ? { media_url: mediaUrl, header_image_url: mediaUrl } : {}),
          ...(mediaCaption ? { media_caption: mediaCaption } : {}),
        };
      }

      const res = await createWhatsAppCampaign(payload);
      if (res.success) {
        setCreatedResult(res);
        setSubmitError(null);
        toastSuccess(
          res.message || `WhatsApp campaign "${campaignName}" queued successfully!`,
          'Campaign Queued'
        );
      } else {
        const errorMsg =
          res.error ||
          res.message ||
          'Failed to dispatch WhatsApp campaign. Please verify your Meta WhatsApp Cloud API credentials in Settings.';
        setSubmitError(errorMsg);
        toastError(errorMsg, 'Creation Error');
      }
    } catch (err) {
      const errorMsg =
        (err as any)?.message ||
        'An unexpected server error occurred while dispatching the campaign.';
      setSubmitError(errorMsg);
      toastError(errorMsg, 'Creation Error');
    } finally {
      setIsSubmitting(false);
    }
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
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : unifiedRecipients.length > 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {unifiedRecipients.length > 0 && step > 1 ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                '1'
              )}
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
                Audience & Mobile Column
              </span>
            </div>
          </button>

          <div className="w-12 sm:w-20 h-0.5 bg-slate-200" />

          {/* Step 2 */}
          <button
            type="button"
            onClick={() => {
              if (unifiedRecipients.length > 0) setStep(2);
            }}
            disabled={unifiedRecipients.length === 0}
            className="flex items-center gap-3 group focus:outline-none disabled:opacity-40"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                step === 2
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
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
                Message & Templates
              </span>
            </div>
          </button>

          <div className="w-12 sm:w-20 h-0.5 bg-slate-200" />

          {/* Step 3 */}
          <button
            type="button"
            onClick={() => {
              if (unifiedRecipients.length > 0 && campaignName) setStep(3);
            }}
            disabled={unifiedRecipients.length === 0 || !campaignName}
            className="flex items-center gap-3 group focus:outline-none disabled:opacity-40"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                step === 3
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
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

      {/* STEP 1: AUDIENCE SELECTION (CSV, MANUAL, CONTACTS) */}
      {step === 1 && (
        <WhatsAppAudienceStep
          unifiedRecipients={unifiedRecipients}
          onRecipientsChange={setUnifiedRecipients}
          importResult={importResult}
          onImportResultChange={(res) => {
            setImportResult(res);
            if (res && !campaignName) {
              const baseName = res.fileName.replace(/\.csv$/i, '');
              setCampaignName(`${baseName} WhatsApp Campaign`);
            }
          }}
          onProceed={() => {
            if (!campaignName) {
              setCampaignName(`WhatsApp Campaign ${new Date().toLocaleDateString()}`);
            }
            setStep(2);
          }}
        />
      )}

      {/* STEP 2: MESSAGE & SETUP */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Campaign Overview Card */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">WhatsApp Campaign Setup</h3>
                <p className="text-xs text-slate-500">
                  Targeting {unifiedRecipients.length} verified mobile contacts (E.164 formatted)
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setMode('template')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    mode === 'template'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Meta Template Mode</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('custom')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    mode === 'custom'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Custom Direct Message</span>
                </button>
              </div>
            </div>

            {/* Campaign Name Field */}
            <div className="max-w-xl">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Campaign Name <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {campaignName.length}/200
                </span>
              </div>
              <input
                type="text"
                value={campaignName}
                maxLength={200}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Diwali Festival Promo 2026"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* TEMPLATE MODE CONFIG */}
          {mode === 'template' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Config Panel */}
              <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Select Meta Template</h4>
                    <p className="text-xs text-slate-500">
                      Choose an approved template and map dynamic merge tags
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickSync}
                    disabled={isSyncing}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-emerald-600 text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Sync latest templates from Meta"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                </div>

                {isLoadingTemplates ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                    <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">
                      Fetching approved WhatsApp templates from Meta...
                    </p>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                    <p className="text-xs text-slate-500">
                      No approved WhatsApp templates found in your Meta account or local cache.
                    </p>
                    <button
                      type="button"
                      onClick={handleQuickSync}
                      disabled={isSyncing}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-xs"
                    >
                      {isSyncing ? 'Syncing...' : 'Sync from Meta Cloud API'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Template Selection & Language Code */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Approved Template <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={selectedTemplateName}
                          onChange={(e) => {
                            setSelectedTemplateName(e.target.value);
                            const found = templates.find((t) => t.name === e.target.value);
                            if (found?.language) setLanguageCode(found.language);
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-900 focus:outline-none focus:border-emerald-500"
                        >
                          {templates.map((tmpl) => (
                            <option key={`${tmpl.name}_${tmpl.language}`} value={tmpl.name}>
                              {tmpl.name} ({tmpl.category || 'TEMPLATE'} • {tmpl.language})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Template Language Code <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={languageCode}
                          onChange={(e) => setLanguageCode(e.target.value)}
                          placeholder="e.g. en, en_US, hi"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-white text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          BCP 47 code registered with Meta (e.g. <code>en</code>, <code>en_US</code>)
                        </p>
                      </div>
                    </div>

                    {/* Selected Template Details Card */}
                    {selectedTemplate && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Selected Meta Template
                            </span>
                            <h5 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <span>{selectedTemplate.name}</span>
                            </h5>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {selectedTemplate.status || 'APPROVED'}
                            </span>
                            {selectedTemplate.category && (
                              <span className="px-2 py-0.5 rounded-md font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {selectedTemplate.category}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {selectedTemplate.language}
                            </span>
                            {qualityScore && (
                              <span className="px-2 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Quality: {qualityScore}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              {hasImageHeader ? 'IMAGE Header' : (headerFormat ? `${headerFormat} Header` : 'No Header')}
                            </span>
                          </div>
                        </div>

                        {/* Body Preview with Highlighted Placeholders */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-semibold text-slate-600 block">
                            Template Message Body:
                          </span>
                          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-normal">
                            {renderHighlightedTemplateBody(bodyText)}
                          </div>
                        </div>

                        {/* Footer text if available */}
                        {footerText && (
                          <div className="text-[11px] text-slate-500 italic flex items-center gap-1.5 px-1">
                            <span className="font-semibold not-italic text-slate-600">Footer:</span>
                            <span>{footerText}</span>
                          </div>
                        )}

                        {/* Buttons if available */}
                        {buttons.length > 0 && (
                          <div className="pt-1 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-600">Action Buttons:</span>
                            {buttons.map((btn: any, idx: number) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-2xs"
                              >
                                {btn.text || btn.url || `Button ${idx + 1}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Header Image Section (Only if template has IMAGE Header) */}
                    {hasImageHeader && (
                      <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/90 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h5 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                              <ImageIcon className="w-4 h-4 text-emerald-600" />
                              <span>Template Header Image</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-200 text-emerald-900 font-bold">
                                Meta Template Header
                              </span>
                            </h5>
                            <p className="text-[11px] text-emerald-800 mt-0.5">
                              This approved WhatsApp template includes a promotional header photo registered with Meta.
                            </p>
                          </div>
                        </div>

                        {/* Default template image preview */}
                        {exampleImageUrl && (
                          <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 flex items-center gap-3">
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                              {!headerImgError ? (
                                <img
                                  src={exampleImageUrl}
                                  alt="Template Header Preview"
                                  className="w-full h-full object-cover"
                                  onError={() => setHeaderImgError(true)}
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-slate-100 text-slate-400">
                                  <ImageIcon className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="text-xs min-w-0">
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                {!headerImgError ? (
                                  <>
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                    <span>Template Default Image Active</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                                    <span className="text-amber-800">Meta Temporary Handle Expired</span>
                                  </>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                The pre-approved image registered with Meta for this template will be delivered to recipients.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dynamic Template Variable Mapping */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Template Variable Mapping</span>
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          {bodyVariables.length > 0
                            ? 'Map numbered message body placeholders to recipient CSV columns or static text.'
                            : 'This approved template has no dynamic message body variables.'}
                        </p>
                      </div>

                      {bodyVariables.length === 0 ? (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>No merge variables required. The exact approved template message will be delivered to each recipient.</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5 pt-1">
                          {bodyVariables.map((varKey) => {
                            const mapping = variableMappings[varKey] || { type: 'column', value: '' };
                            const sampleHint = bodyExamples[varKey];

                            return (
                              <div
                                key={varKey}
                                className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    {`{{${varKey}}}`}
                                  </span>
                                  {sampleHint && (
                                    <span className="text-[11px] text-slate-400 italic">
                                      (e.g. &quot;{sampleHint}&quot;)
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-1 max-w-xs justify-end">
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
                                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 bg-slate-50"
                                  >
                                    <option value="column">CSV Column</option>
                                    <option value="static">Fixed Text</option>
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
                                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:border-emerald-500"
                                    >
                                      <option value="">-- Choose Column --</option>
                                      {audienceHeaders.map((h) => (
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
                                      placeholder={`Enter value for {{${varKey}}}`}
                                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:border-emerald-500"
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Live WhatsApp Chat Bubble Simulator */}
              <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Live WhatsApp Chat Simulator</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rendered with recipient contact variables
                  </p>
                </div>

                <div className="py-4">
                  <WhatsAppBubblePreview
                    headerMediaType={hasImageHeader ? 'IMAGE' : undefined}
                    headerMediaUrl={hasImageHeader ? (activeHeaderImageUrl || undefined) : undefined}
                    headerText={!hasImageHeader && headerInfo.headerText ? headerInfo.headerText : undefined}
                    bodyText={getSampleBodyPreview()}
                    footerText={footerText || undefined}
                    buttons={buttons}
                  />
                </div>

                <p className="text-[11px] text-slate-400 text-center">
                  Pre-approved Meta Cloud message template layout
                </p>
              </div>
            </div>
          )}

          {/* CUSTOM DIRECT MODE CONFIG */}
          {mode === 'custom' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Direct WhatsApp Message</h4>
                  <p className="text-xs text-slate-500">
                    Send custom text or media to customers within the 24-hour service window
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Message Type
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(['text', 'image', 'document'] as WhatsAppMessageType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMessageType(t)}
                        className={`py-2 px-3 rounded-xl border text-center font-semibold capitalize transition-all ${
                          messageType === t
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {messageType === 'image' && (
                  <ImageUploadArea
                    label="Promotional Photo / Banner"
                    value={mediaUrl}
                    description="Upload an image to send to recipients (JPG, PNG, WEBP up to 5MB)"
                    onChange={(url) => setMediaUrl(url)}
                    onRemove={() => setMediaUrl('')}
                    previewHeight="h-44"
                  />
                )}

                {messageType === 'document' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Document URL (https://...)
                    </label>
                    <input
                      type="url"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="https://example.com/invoice.pdf"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Message Text <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={6}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Type message here. Use *bold*, _italics_, and {{customer_name}}..."
                    className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-emerald-500 resize-y"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Supports formatting: <code>*bold*</code>, <code>_italics_</code>, and <code>{'{{customer_name}}'}</code>
                  </p>
                </div>
              </div>

              {/* Right Live WhatsApp Chat Preview */}
              <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Custom Message Live Preview</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time chat preview with recipient variable interpolation
                  </p>
                </div>

                <div className="py-4">
                  <WhatsAppBubblePreview
                    headerMediaType={messageType === 'image' ? 'IMAGE' : messageType === 'document' ? 'DOCUMENT' : undefined}
                    headerMediaUrl={mediaUrl}
                    bodyText={getSampleBodyPreview()}
                  />
                </div>

                <p className="text-[11px] text-slate-400 text-center">
                  Direct message delivery via Meta Graph API
                </p>
              </div>
            </div>
          )}

          {/* Action Navigation Bar */}
          {/* Invalid Contacts Warning Banner */}
          {importResult && importResult.summary.invalidCount > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{importResult.summary.invalidCount} contact(s)</strong> had invalid phone numbers in CSV and will be omitted from the queue. Only <strong>{importResult.summary.validCount} valid contact(s)</strong> will be dispatched.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-amber-800 underline font-semibold hover:text-amber-950 whitespace-nowrap text-[11px]"
              >
                Review Contacts
              </button>
            </div>
          )}

          {/* WhatsApp Opt-In Consent Confirmation in Step 2 */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              whatsappOptIn
                ? 'bg-emerald-50/70 border-emerald-300'
                : 'bg-amber-50/70 border-amber-300'
            }`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
              />
              <div className="text-xs space-y-1">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  WhatsApp Recipient Opt-In Confirmation <span className="text-rose-500">*</span>
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  I confirm that all recipients have provided prior verifiable opt-in consent to receive messages via the WhatsApp Business Cloud API in compliance with Meta's messaging policies.
                </p>
              </div>
            </label>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Audience</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!campaignName.trim()) {
                  toastError('Please enter a campaign name.', 'Missing Name');
                  return;
                }
                if (mode === 'template' && !selectedTemplate) {
                  toastError('Please select a WhatsApp template.', 'Missing Template');
                  return;
                }
                if (!languageCode.trim()) {
                  toastError('Please enter a template language code (e.g. en).', 'Missing Language');
                  return;
                }
                setStep(3);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/20"
            >
              <span>Review & Launch</span>
              <ArrowRight className="w-4 h-4" />
            </button>
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
                <h3 className="text-2xl font-bold text-slate-900">
                  WhatsApp Campaign Queued Successfully!
                </h3>
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
                  <span className="text-slate-400">Total Contacts:</span>
                  <p className="font-bold text-emerald-600">
                    {createdResult.data?.total_recipients || unifiedRecipients.length}
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
                    setUnifiedRecipients([]);
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
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-500/20"
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
                <h3 className="text-lg font-bold text-slate-900">
                  WhatsApp Campaign Summary & Final Review
                </h3>
                <p className="text-xs text-slate-500">
                  Review parameters before queueing dispatch to the WhatsApp Business BullMQ worker.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium">Campaign Name:</span>
                  <p className="text-sm font-bold text-slate-900 mt-1 truncate">{campaignName}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium">Mode / Template:</span>
                  <p className="text-sm font-bold text-slate-900 mt-1 capitalize truncate">
                    {mode} {mode === 'template' ? `(${selectedTemplate?.name})` : ''}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium">Language Code:</span>
                  <p className="text-sm font-mono font-bold text-slate-900 mt-1 uppercase">
                    {languageCode || 'en'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-emerald-700 font-medium">Verified Contacts:</span>
                  <p className="text-sm font-bold text-emerald-700 mt-1">
                    {unifiedRecipients.length} recipients
                  </p>
                </div>
              </div>

              {/* Invalid contacts warning if any */}
              {importResult && importResult.summary.invalidCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Note: <strong>{importResult.summary.invalidCount} invalid row(s)</strong> found in CSV were skipped. The {unifiedRecipients.length} valid contacts will receive messages.
                  </span>
                </div>
              )}

              {/* Sample Recipient Details & Variables Preview */}
              <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-emerald-900">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>Sample Recipient & Dynamic Variables Preview</span>
                  </div>
                  <span className="text-[11px] text-slate-400">First validated contact</span>
                </div>

                {unifiedRecipients.find((r) => r.status === 'valid') ? (
                  (() => {
                    const sample = unifiedRecipients.find(
                      (r) => r.status === 'valid'
                    )!;

                    // Compute sample recipient vars
                    const sampleRecVars: Record<string, string> = {};
                    if (mode === 'template') {
                      Object.entries(variableMappings).forEach(([k, m]) => {
                        if (m.type === 'column' && m.value) {
                          sampleRecVars[k] = sample.raw[m.value] || '';
                        }
                      });
                    }
                    if (sample.name && !sampleRecVars['1']) {
                      sampleRecVars['1'] = sample.name;
                    }

                    const globalVars = buildGlobalVariables();

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="p-3 rounded-xl bg-white border border-emerald-100 space-y-1 text-slate-700">
                          <p className="font-semibold text-emerald-950 text-xs">Recipient Record</p>
                          <p>
                            <span className="text-slate-400">Phone:</span>{' '}
                            <span className="font-mono text-emerald-800 font-bold">
                              {sample.formattedPhone || sample.phone}
                            </span>
                          </p>
                          {sample.name && (
                            <p>
                              <span className="text-slate-400">Name:</span>{' '}
                              <span className="font-semibold text-slate-800">{sample.name}</span>
                            </p>
                          )}
                          {Object.keys(sampleRecVars).length > 0 && (
                            <div className="pt-1">
                              <span className="text-slate-400 block text-[11px]">Recipient Variables:</span>
                              <pre className="font-mono text-[10px] bg-slate-50 p-1.5 rounded text-slate-700 mt-0.5">
                                {JSON.stringify(sampleRecVars, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>

                        <div className="p-3 rounded-xl bg-white border border-emerald-100 space-y-1 text-slate-700">
                          <p className="font-semibold text-emerald-950 text-xs">Campaign Shared Variables</p>
                          {Object.keys(globalVars).length > 0 ? (
                            <div>
                              <span className="text-slate-400 block text-[11px]">Static Shared Variables:</span>
                              <pre className="font-mono text-[10px] bg-slate-50 p-1.5 rounded text-emerald-800 font-semibold mt-0.5">
                                {JSON.stringify(globalVars, null, 2)}
                              </pre>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">
                              No static shared variables configured
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-slate-500">No contacts available</p>
                )}
              </div>

              {/* Preview bubble */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center">
                <span className="text-xs font-semibold text-slate-400 mb-2">Message Preview:</span>
                <WhatsAppBubblePreview
                  headerMediaType={
                    mode === 'template'
                      ? (hasImageHeader ? 'IMAGE' : undefined)
                      : (messageType === 'image' ? 'IMAGE' : (messageType === 'document' ? 'DOCUMENT' : undefined))
                  }
                  headerMediaUrl={
                    mode === 'template'
                      ? (hasImageHeader ? (activeHeaderImageUrl || undefined) : undefined)
                      : (mediaUrl || undefined)
                  }
                  headerText={
                    mode === 'template' && !hasImageHeader && headerInfo.headerText
                      ? headerInfo.headerText
                      : undefined
                  }
                  bodyText={getSampleBodyPreview()}
                  footerText={mode === 'template' ? (footerText || undefined) : undefined}
                  buttons={mode === 'template' ? buttons : undefined}
                />
              </div>

              {/* Opt-In Confirmation Checkbox in Step 3 */}
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  whatsappOptIn
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-amber-50/70 border-amber-300'
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whatsappOptIn}
                    onChange={(e) => setWhatsappOptIn(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                  />
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      WhatsApp Recipient Opt-In Confirmation <span className="text-rose-500">*</span>
                    </span>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      I confirm that all recipient contacts have given explicit prior opt-in consent to receive messages via the WhatsApp Business Cloud API in compliance with Meta's messaging policies.
                    </p>
                  </div>
                </label>
              </div>

              {/* Server Submit Error Banner */}
              {submitError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/90 text-rose-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-950">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>WhatsApp Campaign Dispatch Failed</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-rose-200 font-mono text-[11px] text-rose-800 break-words">
                    {submitError}
                  </div>
                  <p className="text-[11px] text-rose-700">
                    <strong>Tip:</strong> If the error indicates a missing template or Meta authorization error, ensure your WhatsApp Business credentials (Access Token & Phone Number ID) are configured and that the selected template is approved in Meta Business Manager.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Message</span>
                </button>

                <button
                  type="button"
                  onClick={handleLaunchCampaign}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Queueing Campaign...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Queue & Dispatch WhatsApp Campaign ({unifiedRecipients.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

