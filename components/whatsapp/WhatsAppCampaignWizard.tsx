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
  Code,
} from 'lucide-react';
import { CsvImportResult, WhatsAppContactRecord } from '@/types/campaign';
import {
  WhatsAppCampaignMode,
  WhatsAppMessageType,
  WhatsAppTemplate,
  WhatsAppRecipientObject,
  CreateWhatsAppCampaignRequest,
} from '@/types/whatsapp';
import {
  listWhatsAppTemplates,
  syncWhatsAppTemplates,
  createWhatsAppCampaign,
} from '@/lib/whatsapp-api';
import { WHATSAPP_PRESET_TEMPLATES } from '@/lib/whatsapp-presets';
import { useToast } from '@/components/ui/Toast';
import CsvImporter from '@/components/campaign/CsvImporter';
import ImageUploadArea from '@/components/common/ImageUploadArea';
import WhatsAppBubblePreview from './WhatsAppBubblePreview';

interface WhatsAppCampaignWizardProps {
  onCampaignCreated?: () => void;
}

export default function WhatsAppCampaignWizard({
  onCampaignCreated,
}: WhatsAppCampaignWizardProps) {
  const { error: toastError, success: toastSuccess } = useToast();

  // Step state: 1 = CSV & Mobile Column, 2 = Message Setup, 3 = Review & Dispatch
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Contacts
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);

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

  // Variables mapping: for each variable in template (e.g. '1', '2') -> { type: 'column' | 'static', value: string }
  const [variableMappings, setVariableMappings] = useState<
    Record<string, { type: 'column' | 'static'; value: string }>
  >({});

  // Custom Message Fields
  const [customText, setCustomText] = useState(
    'Hello *{{customer_name}}*,\nWe have an exciting announcement from our team! Check your dashboard for more details.'
  );
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<any>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    async function loadTemplates() {
      setIsLoadingTemplates(true);
      try {
        const res = await listWhatsAppTemplates();
        if (res.success && res.data && res.data.length > 0) {
          setTemplates(res.data);
          const approved = res.data.filter((t) => t.status === 'APPROVED');
          if (approved.length > 0) {
            setSelectedTemplateName(approved[0].name);
          } else {
            setSelectedTemplateName(res.data[0].name);
          }
        } else {
          // Fallback to presets if server has not synced templates yet
          setTemplates(WHATSAPP_PRESET_TEMPLATES);
          setSelectedTemplateName(WHATSAPP_PRESET_TEMPLATES[0].name);
        }
      } catch {
        setTemplates(WHATSAPP_PRESET_TEMPLATES);
        setSelectedTemplateName(WHATSAPP_PRESET_TEMPLATES[0].name);
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
      const res = await syncWhatsAppTemplates();
      if (res.success && res.data) {
        setTemplates(res.data);
        if (res.data.length > 0) {
          setSelectedTemplateName(res.data[0].name);
        }
        toastSuccess('Templates synced successfully from Meta.', 'Sync Complete');
      } else {
        toastError(res.error || 'Failed to sync templates.', 'Sync Error');
      }
    } catch {
      toastError('Could not sync with Meta API.', 'Error');
    } finally {
      setIsSyncing(false);
    }
  };

  // When selectedTemplateName changes, update variable mappings & language
  const selectedTemplate = templates.find((t) => t.name === selectedTemplateName);

  useEffect(() => {
    if (selectedTemplate) {
      if (selectedTemplate.language) {
        setLanguageCode(selectedTemplate.language);
      }

      const initialMap: Record<string, { type: 'column' | 'static'; value: string }> = {};

      if (selectedTemplate.variables && Array.isArray(selectedTemplate.variables)) {
        selectedTemplate.variables.forEach((v) => {
          // If CSV has a column matching name or v
          if (importResult) {
            const matchedHeader = importResult.headers.find(
              (h) => h.toLowerCase().includes('name')
            );
            if (matchedHeader && (v === '1' || v.toLowerCase().includes('name'))) {
              initialMap[v] = { type: 'column', value: matchedHeader };
              return;
            }
          }
          initialMap[v] = { type: 'static', value: '' };
        });
      }
      setVariableMappings(initialMap);
    }
  }, [selectedTemplateName, selectedTemplate, importResult]);

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
    if (!importResult) return [];

    const validRecords = importResult.records.filter(
      (r) => r.status === 'valid'
    ) as WhatsAppContactRecord[];

    return validRecords.map((rec) => {
      const recipientVars: Record<string, string> = {};

      if (mode === 'template') {
        Object.entries(variableMappings).forEach(([varKey, mapping]) => {
          if (mapping.type === 'column' && mapping.value) {
            const rowVal = rec.raw[mapping.value];
            if (rowVal !== undefined && rowVal !== null) {
              recipientVars[varKey] = String(rowVal);
            }
          }
        });
      }

      // Name column mapping or detection
      const nameVal =
        rec.name ||
        (importResult.selectedNameCol ? rec.raw[importResult.selectedNameCol] : undefined);

      if (nameVal && !recipientVars.customer_name && !recipientVars['1']) {
        recipientVars['1'] = String(nameVal);
      }

      // Preserve phone as string including leading zero and international format
      const rawPhone = rec.formattedPhone || rec.phone || '';
      const phoneToUse = String(rawPhone).trim();

      const item: WhatsAppRecipientObject = {
        phone: phoneToUse,
        whatsapp_number: phoneToUse,
      };

      if (nameVal) {
        item.name = String(nameVal);
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
    if (mode === 'custom') {
      const firstValid = importResult?.records.find((r) => r.status === 'valid') as
        | WhatsAppContactRecord
        | undefined;
      return customText.replace(/\{\{customer_name\}\}/g, firstValid?.name || 'Customer');
    }

    if (!selectedTemplate) return 'No template selected';
    const bodyComp = selectedTemplate.components?.find((c) => c.type === 'BODY');
    if (!bodyComp || !bodyComp.text) return '(Empty template body)';

    let text = bodyComp.text;
    const firstValid = importResult?.records.find((r) => r.status === 'valid') as
      | WhatsAppContactRecord
      | undefined;

    Object.entries(variableMappings).forEach(([varKey, mapping]) => {
      let sampleVal = `[${varKey}]`;
      if (mapping.type === 'column' && firstValid && mapping.value) {
        sampleVal = firstValid.raw[mapping.value] || `[${varKey}]`;
      } else if (mapping.type === 'static' && mapping.value) {
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

    if (!importResult || importResult.summary.validCount === 0) {
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

      // Check required template variables
      if (selectedTemplate.variables && selectedTemplate.variables.length > 0) {
        const missing = selectedTemplate.variables.filter((v) => {
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

        payload = {
          campaign_name: campaignName.trim(),
          mode: 'template',
          message_type: 'template',
          template_id: templateId,
          template_name: selectedTemplate!.name,
          language_code: languageCode.trim() || 'en',
          whatsapp_opt_in: true,
          variables: buildGlobalVariables(),
          recipients,
        };
      } else {
        payload = {
          campaign_name: campaignName.trim(),
          mode: 'custom',
          message_type: messageType,
          content: customText,
          media_url: mediaUrl || undefined,
          media_caption: mediaCaption || undefined,
          whatsapp_opt_in: true,
          recipients,
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
                Audience & Mobile Column
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
              if (importResult && campaignName) setStep(3);
            }}
            disabled={!importResult || !campaignName}
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

      {/* STEP 1: CSV IMPORT & MOBILE NUMBER COLUMN SELECTION */}
      {step === 1 && (
        <CsvImporter
          campaignType="whatsapp"
          onProceedToWorkflow={handleProceedFromContacts}
          hideHeaderNavigation={true}
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
                  Targeting {importResult?.summary.validCount} verified mobile contacts (E.164 formatted)
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
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Campaign Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={campaignName}
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

                {templates.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                    <p className="text-xs text-slate-500">
                      No WhatsApp templates found in your local database.
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
                  <div className="space-y-4">
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
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white text-slate-900 focus:outline-none focus:border-emerald-500"
                        >
                          {templates.map((tmpl) => (
                            <option key={tmpl.name} value={tmpl.name}>
                              {tmpl.name} ({tmpl.language} • {tmpl.status})
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

                    {/* Header Image Upload if Template has an Image Header */}
                    {selectedTemplate?.components?.find(
                      (c) => c.type === 'HEADER' && c.format === 'IMAGE'
                    ) && (
                      <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 space-y-2">
                        <ImageUploadArea
                          label="Template Header Promotional Photo"
                          value={mediaUrl}
                          description="Upload photo for this approved WhatsApp template (JPG, PNG, WEBP)"
                          onChange={(url) => setMediaUrl(url)}
                          onRemove={() => setMediaUrl('')}
                          previewHeight="h-36"
                        />
                      </div>
                    )}

                    {/* Dynamic Variable Mapping */}
                    {Object.keys(variableMappings).length > 0 && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <div>
                          <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-emerald-600" />
                            Template Variable Mapping
                          </h5>
                          <p className="text-[11px] text-slate-500">
                            Map each WhatsApp merge tag to a column from your CSV or enter a fixed value.
                          </p>
                        </div>

                        <div className="space-y-2.5 pt-2">
                          {Object.entries(variableMappings).map(([varKey, mapping]) => (
                            <div
                              key={varKey}
                              className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <span className="font-mono font-bold text-emerald-700">
                                {`{{${varKey}}}`}
                              </span>

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
                                  className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 bg-slate-50"
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
                                    className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs bg-white text-slate-800"
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
                                    placeholder="Enter value"
                                    className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs bg-white text-slate-800"
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
                    headerMediaType={
                      selectedTemplate?.components?.find((c) => c.type === 'HEADER')?.format ===
                      'IMAGE'
                        ? 'IMAGE'
                        : undefined
                    }
                    headerMediaUrl={mediaUrl}
                    bodyText={getSampleBodyPreview()}
                    footerText={selectedTemplate?.components?.find((c) => c.type === 'FOOTER')?.text}
                    buttons={selectedTemplate?.components?.find((c) => c.type === 'BUTTONS')?.buttons}
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
                    {importResult?.summary.validCount} recipients
                  </p>
                </div>
              </div>

              {/* Invalid contacts warning if any */}
              {importResult && importResult.summary.invalidCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Note: <strong>{importResult.summary.invalidCount} invalid row(s)</strong> found in CSV will be skipped. Only the {importResult.summary.validCount} valid contacts will receive messages.
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

                {importResult?.records.find((r) => r.status === 'valid') ? (
                  (() => {
                    const sample = importResult.records.find(
                      (r) => r.status === 'valid'
                    ) as WhatsAppContactRecord;

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
                  bodyText={getSampleBodyPreview()}
                  buttons={selectedTemplate?.components?.find((c) => c.type === 'BUTTONS')?.buttons}
                />
              </div>

              {/* Inspectable API Request Payload JSON */}
              <details className="p-4 rounded-2xl bg-slate-900 text-slate-100 text-xs font-mono group">
                <summary className="font-bold cursor-pointer select-none flex items-center justify-between text-emerald-400">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-emerald-400" />
                    <span>Inspect Outgoing API Request Payload (POST /api/whatsapp/campaigns)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 group-open:hidden">Click to inspect payload</span>
                </summary>
                <div className="mt-3 overflow-x-auto max-h-60 rounded-xl bg-slate-950 p-3 text-[11px] text-emerald-300">
                  <pre>
                    {JSON.stringify(
                      {
                        campaign_name: campaignName.trim(),
                        mode: mode,
                        message_type: mode === 'template' ? 'template' : messageType,
                        template_id:
                          selectedTemplate?.template_id ||
                          selectedTemplate?._id ||
                          selectedTemplate?.id ||
                          selectedTemplate?.name,
                        template_name: selectedTemplate?.name,
                        language_code: languageCode.trim() || 'en',
                        whatsapp_opt_in: whatsappOptIn,
                        variables: buildGlobalVariables(),
                        recipients: buildRecipientsPayload().slice(0, 3),
                        total_recipients: buildRecipientsPayload().length,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </details>

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
                      <span>Queue & Dispatch WhatsApp Campaign ({importResult?.summary.validCount})</span>
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

