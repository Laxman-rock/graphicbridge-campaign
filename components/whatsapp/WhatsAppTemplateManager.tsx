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
} from 'lucide-react';
import { WhatsAppTemplate } from '@/types/whatsapp';
import {
  listWhatsAppTemplates,
  syncWhatsAppTemplates,
  updateWhatsAppTemplateStatus,
  deleteWhatsAppTemplate,
} from '@/lib/whatsapp-api';
import { WHATSAPP_PRESET_TEMPLATES } from '@/lib/whatsapp-presets';
import { useToast } from '@/components/ui/Toast';
import ImageUploadArea from '@/components/common/ImageUploadArea';
import WhatsAppBubblePreview from './WhatsAppBubblePreview';

interface WhatsAppTemplateManagerProps {
  onOpenConfigModal?: () => void;
}

export default function WhatsAppTemplateManager({
  onOpenConfigModal,
}: WhatsAppTemplateManagerProps) {
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();

  const [syncedTemplates, setSyncedTemplates] = useState<WhatsAppTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<'synced' | 'presets'>('synced');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [apiNotice, setApiNotice] = useState<string | null>(null);

  // New Template Creator Modal State (Requirement 2 & 6)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTmplName, setNewTmplName] = useState('');
  const [newTmplCategory, setNewTmplCategory] = useState<
    'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  >('MARKETING');
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

  const handleCreateTemplate = () => {
    if (!newTmplName.trim()) {
      toastError('Please enter a template name.', 'Name Required');
      return;
    }

    const slugName = newTmplName
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const components: any[] = [];

    if (newTmplHeaderType === 'IMAGE') {
      components.push({
        type: 'HEADER',
        format: 'IMAGE',
      });
    } else if (newTmplHeaderType === 'TEXT' && newTmplHeaderText.trim()) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: newTmplHeaderText.trim(),
      });
    }

    components.push({
      type: 'BODY',
      text: newTmplBody.trim(),
    });

    if (newTmplFooter.trim()) {
      components.push({
        type: 'FOOTER',
        text: newTmplFooter.trim(),
      });
    }

    if (newTmplButtonType === 'URL' && newTmplButtonText.trim()) {
      components.push({
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: newTmplButtonText.trim(),
            url: newTmplButtonUrl.trim() || 'https://example.com',
          },
        ],
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

    const varMatches = newTmplBody.match(/\{\{([0-9a-zA-Z_]+)\}\}/g) || [];
    const vars = Array.from(new Set(varMatches.map((m) => m.replace(/[{}]/g, ''))));

    const newTemplate: WhatsAppTemplate = {
      id: `custom_${Date.now()}`,
      template_id: `custom_${Date.now()}`,
      name: slugName,
      category: newTmplCategory,
      language: 'en',
      status: 'APPROVED',
      is_active: true,
      last_synced_at: new Date().toISOString(),
      variables: vars,
      components,
    };

    setSyncedTemplates((prev) => [newTemplate, ...prev]);
    setActiveTab('synced');
    setIsCreateModalOpen(false);
    setNewTmplName('');
    toastSuccess(`Template "${slugName}" created and ready to use!`, 'Template Saved');
  };

  const fetchTemplates = useCallback(
    async (isManualRefresh = false) => {
      setIsLoading(true);
      setApiNotice(null);
      try {
        const res = await listWhatsAppTemplates();
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

  const handleToggleStatus = async (tmpl: WhatsAppTemplate) => {
    const id = tmpl._id || tmpl.id || tmpl.template_id;
    if (!id) return;
    const newStatus = !tmpl.is_active;

    try {
      const res = await updateWhatsAppTemplateStatus(id, newStatus);
      if (res.success) {
        toastSuccess(
          `Template "${tmpl.name}" is now ${newStatus ? 'enabled' : 'disabled'}.`,
          'Status Updated'
        );
        setSyncedTemplates((prev) =>
          prev.map((t) => (t === tmpl ? { ...t, is_active: newStatus } : t))
        );
      } else {
        toastError(res.error || 'Failed to update status.', 'Error');
      }
    } catch {
      toastError('Status toggle failed.', 'Error');
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
          {onOpenConfigModal && (
            <button
              type="button"
              onClick={onOpenConfigModal}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs transition-all backdrop-blur-sm"
            >
              <Settings className="w-4 h-4 text-emerald-300" />
              <span>Meta API Settings</span>
            </button>
          )}

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
            const headerComp = tmpl.components?.find((c) => c.type === 'HEADER');
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
                    {getStatusBadge(tmpl.status)}
                  </div>

                  {/* WhatsApp Chat Bubble Live Preview */}
                  <div className="pt-1">
                    <WhatsAppBubblePreview
                      headerText={headerComp?.format === 'TEXT' ? headerComp.text : undefined}
                      headerMediaType={
                        headerComp?.format === 'IMAGE' || headerComp?.format === 'DOCUMENT'
                          ? headerComp.format
                          : undefined
                      }
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

                {/* Footer Controls: Active Toggle & Delete */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  {!isPreset ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(tmpl)}
                        className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-emerald-700"
                      >
                        {tmpl.is_active ? (
                          <>
                            <ToggleRight className="w-5 h-5 text-emerald-600" />
                            <span className="text-emerald-700">Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                            <span className="text-slate-400">Disabled</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(tmpl)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Approved Meta Cloud Standard Format
                    </span>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Template Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newTmplName}
                      onChange={(e) => setNewTmplName(e.target.value)}
                      placeholder="e.g. promo_announcement"
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
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/70 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTemplate}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save WhatsApp Template</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
