'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  ExternalLink,
  Layers,
  Tag,
  Settings,
  Info,
  X,
  BookOpen,
  Plus,
  Smartphone,
  Image as ImageIcon,
  Send,
  Eye,
  BadgeCheck,
  ArrowLeft,
} from 'lucide-react';
import { WhatsAppTemplate } from '@/types/whatsapp';
import {
  listWhatsAppTemplates,
  createWhatsAppTemplate,
  syncWhatsAppTemplates,
  updateWhatsAppTemplateStatus,
  deleteWhatsAppTemplate,
  extractTemplateImageHeader,
} from '@/lib/whatsapp-api';
import { WHATSAPP_PRESET_TEMPLATES } from '@/lib/whatsapp-presets';
import { useToast } from '@/components/ui/Toast';
import ImageUploadArea from '@/components/common/ImageUploadArea';
import WhatsAppBubblePreview from './WhatsAppBubblePreview';

interface WhatsAppTemplateManagerProps {
  onOpenConfigModal?: () => void;
  onUseTemplate?: (template: WhatsAppTemplate) => void;
}

export default function WhatsAppTemplateManager({
  onOpenConfigModal,
  onUseTemplate,
}: WhatsAppTemplateManagerProps) {
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();

  const [syncedTemplates, setSyncedTemplates] = useState<WhatsAppTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<'synced' | 'presets'>('synced');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [pendingStatusToggle, setPendingStatusToggle] = useState<{
    tmpl: WhatsAppTemplate;
    nextActive: boolean;
  } | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState<WhatsAppTemplate | null>(null);

  // New Template Creator Modal State (Requirement 2 & 6)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTmplName, setNewTmplName] = useState('');
  const [newTmplCategory, setNewTmplCategory] = useState<
    'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  >('MARKETING');
  const [newTmplLanguage, setNewTmplLanguage] = useState('en_US');
  const [newTmplHeaderType, setNewTmplHeaderType] = useState<'NONE' | 'IMAGE' | 'TEXT'>(
    'IMAGE'
  );
  const [newTmplHeaderText, setNewTmplHeaderText] = useState('Special Offer for You! 🌟');
  const [newTmplHeaderImageUrl, setNewTmplHeaderImageUrl] = useState('');
  const [newTmplBody, setNewTmplBody] = useState(
    'Hello {{1}},\n\nWe have an exclusive offer for your account (ID: {{2}})! Use promo code *DISCOUNT30* today only.'
  );
  const [newTmplFooter, setNewTmplFooter] = useState('Reply STOP to unsubscribe');
  const [newTmplButtonType, setNewTmplButtonType] = useState<'NONE' | 'URL' | 'QUICK_REPLY'>(
    'URL'
  );
  const [newTmplButtonText, setNewTmplButtonText] = useState('Claim Offer Now');
  const [newTmplButtonUrl, setNewTmplButtonUrl] = useState('https://example.com/offers');

  const handleCreateTemplate = async () => {
    if (!newTmplName.trim()) {
      toastError('Please enter a template name.', 'Name Required');
      return;
    }

    if (!newTmplBody.trim()) {
      toastError('Please enter a message body.', 'Body Required');
      return;
    }

    const slugName = newTmplName
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!slugName || !/^[a-z0-9_]+$/.test(slugName)) {
      toastError(
        'Template name must contain lowercase letters, numbers, or underscores.',
        'Invalid Name'
      );
      return;
    }

    const components: Array<Record<string, any>> = [];

    if (newTmplHeaderType === 'IMAGE') {
      const headerComp: Record<string, any> = {
        type: 'HEADER',
        format: 'IMAGE',
      };
      if (newTmplHeaderImageUrl.trim()) {
        headerComp.example = {
          header_handle: [newTmplHeaderImageUrl.trim()],
        };
      }
      components.push(headerComp);
    } else if (newTmplHeaderType === 'TEXT' && newTmplHeaderText.trim()) {
      const headerText = newTmplHeaderText.trim();
      const headerVars = headerText.match(/\{\{([0-9a-zA-Z_]+)\}\}/g) || [];
      const headerComp: Record<string, any> = {
        type: 'HEADER',
        format: 'TEXT',
        text: headerText,
      };
      if (headerVars.length > 0) {
        headerComp.example = {
          header_text: headerVars.map((_, idx) => `Sample${idx + 1}`),
        };
      }
      components.push(headerComp);
    }

    const bodyText = newTmplBody.trim();
    const bodyVarMatches = bodyText.match(/\{\{([0-9a-zA-Z_]+)\}\}/g) || [];
    const bodyVars = Array.from(new Set(bodyVarMatches.map((m) => m.replace(/[{}]/g, ''))));
    const bodyComp: Record<string, any> = {
      type: 'BODY',
      text: bodyText,
    };
    if (bodyVars.length > 0) {
      bodyComp.example = {
        body_text: [bodyVars.map((_, idx) => `Sample${idx + 1}`)],
      };
    }
    components.push(bodyComp);

    if (newTmplFooter.trim()) {
      components.push({
        type: 'FOOTER',
        text: newTmplFooter.trim(),
      });
    }

    if (newTmplButtonType === 'URL' && newTmplButtonText.trim()) {
      const btnUrl = newTmplButtonUrl.trim() || 'https://example.com';
      const urlHasVar = /\{\{[0-9a-zA-Z_]+\}\}/.test(btnUrl);
      const urlBtn: Record<string, any> = {
        type: 'URL',
        text: newTmplButtonText.trim(),
        url: btnUrl,
      };
      if (urlHasVar) {
        urlBtn.example = [btnUrl.replace(/\{\{[0-9a-zA-Z_]+\}\}/g, 'SAMPLE')];
      }
      components.push({
        type: 'BUTTONS',
        buttons: [urlBtn],
      });
    } else if (newTmplButtonType === 'QUICK_REPLY' && newTmplButtonText.trim()) {
      components.push({
        type: 'BUTTONS',
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: newTmplButtonText.trim(),
          },
        ],
      });
    }

    setIsCreating(true);
    try {
      const res = await createWhatsAppTemplate({
        name: slugName,
        category: newTmplCategory,
        language: newTmplLanguage || 'en_US',
        allow_category_change: true,
        components,
      });

      if (res.success) {
        const saved = res.template || res.data;
        if (saved) {
          setSyncedTemplates((prev) => [
            saved,
            ...prev.filter((t) => t.name !== saved.name),
          ]);
        }
        setActiveTab('synced');
        setIsCreateModalOpen(false);
        setNewTmplName('');
        toastSuccess(
          res.message || `Template "${slugName}" submitted to Meta and saved!`,
          'Template Created'
        );
      } else {
        toastError(
          res.error || 'Failed to save WhatsApp template via API.',
          'Creation Failed'
        );
      }
    } catch {
      toastError('Failed to connect to WhatsApp templates API.', 'Connection Error');
    } finally {
      setIsCreating(false);
    }
  };

  const fetchTemplates = useCallback(
    async (isManualRefresh = false) => {
      setIsLoading(true);
      setApiNotice(null);
      try {
        const res = await listWhatsAppTemplates({ status: 'ALL' });
        if (res.success && res.data && res.data.length > 0) {
          setSyncedTemplates(res.data);
          setActiveTab('synced');
          if (isManualRefresh) {
            toastSuccess(`Successfully loaded ${res.data.length} templates.`, 'Templates Refreshed');
          }
        } else if (res.success && (!res.data || res.data.length === 0)) {
          setSyncedTemplates([]);
          if (isManualRefresh) {
            toastInfo(
              'No templates found in database. Click "Sync Templates from Meta" to import them.',
              'No Synced Templates'
            );
          }
        } else {
          // Non-blocking notice
          setApiNotice(
            res.error ||
              'WhatsApp templates could not be loaded. Please ensure Meta API credentials are configured and sync.'
          );
          if (isManualRefresh) {
            toastError(res.error || 'Failed to fetch WhatsApp templates.', 'Notice');
          }
        }
      } catch {
        setApiNotice('Could not connect to WhatsApp templates API endpoint.');
        if (isManualRefresh) {
          toastError('Could not connect to WhatsApp templates API.', 'Connection Error');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [toastError, toastSuccess, toastInfo]
  );

  // Initial load runs once on mount
  useEffect(() => {
    fetchTemplates(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSyncFromMeta = async () => {
    setIsSyncing(true);
    try {
      const res = await syncWhatsAppTemplates();
      if (res.success) {
        toastSuccess(
          res.message || `Successfully synced ${res.synced_count ?? 0} templates from Meta.`,
          'Sync Complete'
        );
        fetchTemplates(false);
      } else {
        toastError(
          res.error || 'Failed to sync templates from Meta. Check your Meta API credentials.',
          'Sync Failed'
        );
      }
    } catch {
      toastError('Meta Graph API sync request failed.', 'Error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleStatus = (tmpl: WhatsAppTemplate) => {
    const id = tmpl._id || tmpl.id || tmpl.template_id;
    if (!id) return;
    setPendingStatusToggle({ tmpl, nextActive: !tmpl.is_active });
  };

  const confirmToggleStatus = async () => {
    if (!pendingStatusToggle) return;
    const { tmpl, nextActive } = pendingStatusToggle;
    const id = tmpl._id || tmpl.id || tmpl.template_id;
    if (!id) {
      setPendingStatusToggle(null);
      return;
    }

    setIsTogglingStatus(true);
    try {
      const res = await updateWhatsAppTemplateStatus(id, nextActive);
      if (res.success) {
        toastSuccess(
          `Template "${tmpl.name}" is now ${nextActive ? 'active' : 'inactive'}.`,
          'Status Updated'
        );
        setSyncedTemplates((prev) =>
          prev.map((t) => (t === tmpl ? { ...t, is_active: nextActive } : t))
        );
        setPendingStatusToggle(null);
      } else {
        toastError(res.error || 'Failed to update status.', 'Error');
      }
    } catch {
      toastError('Status toggle failed.', 'Error');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleDelete = async (tmpl: WhatsAppTemplate) => {
    const id = tmpl._id || tmpl.id || tmpl.template_id;
    if (!id) return;
    if (!confirm(`Are you sure you want to delete template "${tmpl.name}"?`)) return;

    try {
      const res = await deleteWhatsAppTemplate(id);
      if (res.success) {
        toastSuccess(res.message || 'Template removed from local database.', 'Deleted');
        setSyncedTemplates((prev) => prev.filter((t) => t !== tmpl));
      } else {
        toastError(res.error || 'Failed to delete template.', 'Error');
      }
    } catch {
      toastError('Delete request failed.', 'Error');
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          APPROVED
        </span>
      );
    }
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          PENDING
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3 h-3 text-rose-600" />
          REJECTED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
        {status}
      </span>
    );
  };

  const categories = ['ALL', 'MARKETING', 'UTILITY', 'AUTHENTICATION'];

  // Current template list based on active tab
  const displaySource = activeTab === 'synced' ? syncedTemplates : WHATSAPP_PRESET_TEMPLATES;

  const filteredTemplates = displaySource.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      categoryFilter === 'ALL' ||
      (t.category && t.category.toUpperCase() === categoryFilter);

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Sync Control */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Meta Cloud API Sync</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
            WhatsApp Message Templates
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Manage pre-approved WhatsApp Business message templates. Sync latest approved templates
            directly from your Meta Business Manager.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-lg transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>Create Template</span>
          </button>

          <button
            type="button"
            onClick={handleSyncFromMeta}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing from Meta...' : 'Sync Templates from Meta'}</span>
          </button>
        </div>
      </div>

      {/* Non-blocking API notice banner if sync/fetch returned info */}
      {apiNotice && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">WhatsApp Sync Information: </span>
              <span>{apiNotice}</span>
              <p className="mt-1 text-[11px] text-amber-700">
                You can explore pre-approved starter templates below, or configure your Meta App
                credentials to sync live templates.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onOpenConfigModal && (
              <button
                type="button"
                onClick={onOpenConfigModal}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition-colors"
              >
                Configure Credentials
              </button>
            )}
            <button
              type="button"
              onClick={() => setApiNotice(null)}
              className="text-amber-500 hover:text-amber-700 p-1"
              aria-label="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Source Selector Tabs: Synced vs Starter Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('synced')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'synced'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Synced Meta Templates ({syncedTemplates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'presets'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Pre-Approved Starter Presets ({WHATSAPP_PRESET_TEMPLATES.length})</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  categoryFilter === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat === 'ALL' ? 'All' : cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates..."
              className="w-40 sm:w-52 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchTemplates(true)}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
            title="Refresh templates"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Templates Grid or Empty State */}
      {isLoading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-16 flex flex-col items-center justify-center text-slate-400 space-y-3 shadow-xs">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm font-medium text-slate-600">Loading WhatsApp templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-14 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <MessageSquare className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-800">
              {activeTab === 'synced'
                ? 'No Synced WhatsApp Templates Yet'
                : 'No Matching Presets Found'}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              {activeTab === 'synced'
                ? 'Click "Sync Templates from Meta" to import pre-approved templates from your Meta Business account, or browse starter presets to preview messaging formats.'
                : 'Try adjusting your search or category filters to view available WhatsApp presets.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {activeTab === 'synced' && (
              <>
                <button
                  type="button"
                  onClick={handleSyncFromMeta}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync from Meta Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('presets')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>View Starter Presets (4)</span>
                </button>

                {onOpenConfigModal && (
                  <button
                    type="button"
                    onClick={onOpenConfigModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    <span>Configure Meta API</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((tmpl) => {
            const headerInfo = extractTemplateImageHeader(tmpl);
            const bodyComp = tmpl.components?.find((c) => c.type === 'BODY');
            const footerComp = tmpl.components?.find((c) => c.type === 'FOOTER');
            const buttonsComp = tmpl.components?.find((c) => c.type === 'BUTTONS');
            const isPreset = activeTab === 'presets';

            return (
              <div
                key={tmpl._id || tmpl.id || tmpl.name}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
              >
                {/* Meta details & status */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-slate-900 text-sm leading-snug">
                          {tmpl.name}
                        </h4>
                        {isPreset && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                            PRESET
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Lang: {tmpl.language} • {tmpl.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingTemplate(tmpl)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 transition-colors"
                        title="Open user chat view"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                      {getStatusBadge(tmpl.status)}
                    </div>
                  </div>

                  {/* WhatsApp Chat Bubble Live Preview */}
                  <div className="pt-1">
                    <WhatsAppBubblePreview
                      headerText={headerInfo.headerFormat === 'TEXT' ? headerInfo.headerText : undefined}
                      headerMediaType={
                        headerInfo.headerFormat === 'IMAGE' ||
                        headerInfo.headerFormat === 'DOCUMENT' ||
                        headerInfo.headerFormat === 'VIDEO'
                          ? headerInfo.headerFormat
                          : undefined
                      }
                      headerMediaUrl={headerInfo.exampleMediaUrl}
                      mediaUnavailable={headerInfo.hasUnresolvedMediaHandle}
                      bodyText={bodyComp?.text || '(No body text)'}
                      footerText={footerComp?.text}
                      buttons={buttonsComp?.buttons}
                    />
                  </div>

                  {/* Variables Chips */}
                  {tmpl.variables && tmpl.variables.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-emerald-600" />
                        Dynamic Merge Tags:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {tmpl.variables.map((v) => (
                          <span
                            key={v}
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Controls: Active Toggle (Left), Use Template (Center), Delete (Right) */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {!isPreset ? (
                    (() => {
                      const isApproved = (tmpl.status || '').toUpperCase() === 'APPROVED';
                      const isUsable = isApproved && tmpl.is_active !== false;
                      const disabledReason = !isApproved
                        ? 'Only approved templates can be used in campaigns'
                        : 'Activate this template to use it in campaigns';

                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(tmpl)}
                            className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 rounded-lg px-1 py-0.5"
                          >
                            {tmpl.is_active ? (
                              <>
                                <ToggleRight className="w-5 h-5 text-emerald-600" />
                                <span className="text-emerald-700">Active</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-5 h-5 text-slate-400" />
                                <span className="text-slate-500">Inactive</span>
                              </>
                            )}
                          </button>

                          {onUseTemplate && (
                            <button
                              type="button"
                              disabled={!isUsable}
                              onClick={() => onUseTemplate(tmpl)}
                              title={isUsable ? 'Use this template in a new campaign' : disabledReason}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Use Template</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(tmpl)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-colors"
                            title="Remove template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Approved Meta Cloud Standard Format
                      </span>
                      {onUseTemplate &&
                        (tmpl.status || '').toUpperCase() === 'APPROVED' &&
                        tmpl.is_active !== false && (
                          <button
                            type="button"
                            onClick={() => onUseTemplate(tmpl)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-white text-xs font-semibold shadow-xs transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Use Template</span>
                          </button>
                        )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Visual WhatsApp Template Creator Modal (Requirement 2 & 6) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Create WhatsApp Message Template
                  </h3>
                  <p className="text-xs text-slate-500">
                    Design a message template with photo upload, formatted text, and CTA buttons
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Left Inputs + Right Mobile Preview */}
            <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Form & Image Upload */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Template Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newTmplName}
                      onChange={(e) => setNewTmplName(e.target.value)}
                      placeholder="e.g. order_ready_notice"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Category
                    </label>
                    <select
                      value={newTmplCategory}
                      onChange={(e) => setNewTmplCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="MARKETING">MARKETING</option>
                      <option value="UTILITY">UTILITY</option>
                      <option value="AUTHENTICATION">AUTHENTICATION</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Language
                    </label>
                    <select
                      value={newTmplLanguage}
                      onChange={(e) => setNewTmplLanguage(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="en_US">English (en_US)</option>
                      <option value="en">English (en)</option>
                      <option value="hi">Hindi (hi)</option>
                      <option value="ta">Tamil (ta)</option>
                    </select>
                  </div>
                </div>

                {/* Header Type */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Header Format
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(['IMAGE', 'TEXT', 'NONE'] as const).map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setNewTmplHeaderType(h)}
                        className={`py-2 rounded-xl border text-center font-semibold transition-all ${
                          newTmplHeaderType === h
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {h === 'IMAGE' ? '📷 Photo' : h === 'TEXT' ? '✏️ Text' : 'None'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Upload Area for Header */}
                {newTmplHeaderType === 'IMAGE' && (
                  <ImageUploadArea
                    label="Promotional Header Photo"
                    value={newTmplHeaderImageUrl}
                    description="Upload photo for your WhatsApp message (JPG, JPEG, PNG, WEBP)"
                    onChange={(url) => setNewTmplHeaderImageUrl(url)}
                    onRemove={() => setNewTmplHeaderImageUrl('')}
                    previewHeight="h-36"
                  />
                )}

                {/* Text Header Input */}
                {newTmplHeaderType === 'TEXT' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Header Text
                    </label>
                    <input
                      type="text"
                      value={newTmplHeaderText}
                      onChange={(e) => setNewTmplHeaderText(e.target.value)}
                      placeholder="Bold header title..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                {/* Message Body */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Message Body <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={newTmplBody}
                    onChange={(e) => setNewTmplBody(e.target.value)}
                    placeholder="Enter message text with *bold*, _italics_, and {{1}}..."
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-emerald-500 resize-y"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Supports formatting: <code>*bold*</code>, <code>_italics_</code>, and dynamic merge tags <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>
                  </p>
                </div>

                {/* Footer Text */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Optional Footer
                  </label>
                  <input
                    type="text"
                    value={newTmplFooter}
                    onChange={(e) => setNewTmplFooter(e.target.value)}
                    placeholder="e.g. Reply STOP to opt out"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600"
                  />
                </div>

                {/* Interactive Action Button */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Interactive Button
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(['NONE', 'URL', 'QUICK_REPLY'] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setNewTmplButtonType(b)}
                        className={`py-1.5 rounded-xl border text-center font-semibold transition-all ${
                          newTmplButtonType === b
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {b === 'URL' ? '🔗 Website URL' : b === 'QUICK_REPLY' ? '💬 Quick Reply' : 'No Button'}
                      </button>
                    ))}
                  </div>

                  {newTmplButtonType !== 'NONE' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <input
                        type="text"
                        value={newTmplButtonText}
                        onChange={(e) => setNewTmplButtonText(e.target.value)}
                        placeholder="Button label..."
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold"
                      />
                      {newTmplButtonType === 'URL' && (
                        <input
                          type="url"
                          value={newTmplButtonUrl}
                          onChange={(e) => setNewTmplButtonUrl(e.target.value)}
                          placeholder="https://..."
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Mobile WhatsApp Chat Preview (Requirement 6) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>Mobile WhatsApp Live Preview</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Real-time message preview as seen by recipients
                  </p>
                </div>

                <div className="py-2">
                  <WhatsAppBubblePreview
                    headerMediaType={newTmplHeaderType === 'IMAGE' ? 'IMAGE' : undefined}
                    headerMediaUrl={newTmplHeaderImageUrl || undefined}
                    headerText={newTmplHeaderType === 'TEXT' ? newTmplHeaderText : undefined}
                    bodyText={newTmplBody || '(Enter message body)'}
                    footerText={newTmplFooter || undefined}
                    buttons={
                      newTmplButtonType === 'URL' && newTmplButtonText
                        ? [
                            {
                              type: 'URL',
                              text: newTmplButtonText,
                              url: newTmplButtonUrl,
                            },
                          ]
                        : newTmplButtonType === 'QUICK_REPLY' && newTmplButtonText
                        ? [
                            {
                              type: 'QUICK_REPLY',
                              text: newTmplButtonText,
                            },
                          ]
                        : []
                    }
                  />
                </div>

                <p className="text-[10px] text-slate-400 text-center">
                  Formatted for Meta Business Cloud messaging
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isCreating}
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/70 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={handleCreateTemplate}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 disabled:opacity-60"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving to Meta...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save WhatsApp Template</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active / Inactive Confirmation Modal */}
      {pendingStatusToggle && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-bold text-slate-900">
                {pendingStatusToggle.nextActive ? 'Activate Template?' : 'Deactivate Template?'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to mark{' '}
                <span className="font-semibold text-slate-800">{pendingStatusToggle.tmpl.name}</span> as{' '}
                <span className="font-semibold text-slate-800">
                  {pendingStatusToggle.nextActive ? 'Active' : 'Inactive'}
                </span>
                ?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={isTogglingStatus}
                onClick={() => setPendingStatusToggle(null)}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                disabled={isTogglingStatus}
                onClick={confirmToggleStatus}
                className={`flex-1 px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all disabled:opacity-50 ${
                  pendingStatusToggle.nextActive
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                }`}
              >
                {isTogglingStatus ? 'Updating...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Chat Page View Modal */}
      {viewingTemplate && (() => {
        const headerInfo = extractTemplateImageHeader(viewingTemplate);
        const bodyComp = viewingTemplate.components?.find((c) => c.type === 'BODY');
        const footerComp = viewingTemplate.components?.find((c) => c.type === 'FOOTER');
        const buttonsComp = viewingTemplate.components?.find((c) => c.type === 'BUTTONS');
        const isApproved = (viewingTemplate.status || '').toUpperCase() === 'APPROVED';
        const isUsable = isApproved && viewingTemplate.is_active !== false;

        return (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setViewingTemplate(null)}
          >
            <div
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* WhatsApp Mobile Chat Top Header */}
              <div className="bg-[#075E54] text-white px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setViewingTemplate(null)}
                    className="p-1 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-sm text-white shadow-inner flex-shrink-0">
                    WA
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold truncate">Business Account</span>
                      <BadgeCheck className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                    </div>
                    <p className="text-[11px] text-emerald-100/90 truncate">
                      {viewingTemplate.name} • {viewingTemplate.category}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingTemplate(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Close chat view"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* WhatsApp Chat Screen Body */}
              <div className="flex-1 overflow-y-auto bg-[#EFEAE2] p-4 sm:p-5">
                <WhatsAppBubblePreview
                  headerText={headerInfo.headerFormat === 'TEXT' ? headerInfo.headerText : undefined}
                  headerMediaType={
                    headerInfo.headerFormat === 'IMAGE' ||
                    headerInfo.headerFormat === 'DOCUMENT' ||
                    headerInfo.headerFormat === 'VIDEO'
                      ? headerInfo.headerFormat
                      : undefined
                  }
                  headerMediaUrl={headerInfo.exampleMediaUrl}
                  mediaUnavailable={headerInfo.hasUnresolvedMediaHandle}
                  fullImage
                  bodyText={bodyComp?.text || '(No body text)'}
                  footerText={footerComp?.text}
                  buttons={buttonsComp?.buttons}
                />
              </div>

              {/* Simulated WhatsApp User Input Bar */}
              <div className="bg-[#F0F2F5] px-3 py-2.5 border-t border-slate-200/80 flex items-center gap-2">
                <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-slate-400 border border-slate-200/70">
                  Message (Read-only template preview)
                </div>
                <div className="w-8 h-8 rounded-full bg-[#00A884] text-white flex items-center justify-center flex-shrink-0 opacity-80">
                  <Send className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Template Action Footer */}
              <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">
                  Lang: <strong className="text-slate-700">{viewingTemplate.language}</strong> •{' '}
                  <strong className="text-slate-700">{viewingTemplate.status}</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingTemplate(null)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Close
                  </button>
                  {onUseTemplate && (
                    <button
                      type="button"
                      disabled={!isUsable}
                      onClick={() => {
                        const chosen = viewingTemplate;
                        setViewingTemplate(null);
                        onUseTemplate(chosen);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Use Template</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
