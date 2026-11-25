'use client';

import React, { useState, useEffect } from 'react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import Sidebar from '@/components/layout/Sidebar';
import SettingsModal from '@/components/layout/SettingsModal';
import WhatsAppCampaignWizard from '@/components/whatsapp/WhatsAppCampaignWizard';
import WhatsAppCampaignsList from '@/components/whatsapp/WhatsAppCampaignsList';
import WhatsAppTemplateManager from '@/components/whatsapp/WhatsAppTemplateManager';
import WhatsAppConfigModal from '@/components/whatsapp/WhatsAppConfigModal';
import { WhatsAppTemplate } from '@/types/whatsapp';
import { Send, History, MessageSquare, Settings, AlertTriangle } from 'lucide-react';

type WhatsAppTab = 'wizard' | 'history' | 'templates';

const TAB_LABELS: Record<WhatsAppTab, string> = {
  wizard: 'Create Campaign',
  history: 'Campaigns History',
  templates: 'WhatsApp Templates',
};

export default function WhatsAppCampaignPage() {
  const [activeTab, setActiveTab] = useState<WhatsAppTab>('wizard');
  const [pendingTab, setPendingTab] = useState<WhatsAppTab | null>(null);
  const [preselectedTemplate, setPreselectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [preselectedTemplateId, setPreselectedTemplateId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Restore tab & preselected templateId from URL query parameters on mount / refresh
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as WhatsAppTab | null;
    const templateIdParam = params.get('templateId');

    if (templateIdParam) {
      setPreselectedTemplateId(templateIdParam);
      setActiveTab('wizard');
    } else if (tabParam && (tabParam === 'wizard' || tabParam === 'history' || tabParam === 'templates')) {
      setActiveTab(tabParam);
    }
  }, []);

  const updateUrlParams = (tab: WhatsAppTab, templateId?: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    if (templateId) {
      url.searchParams.set('templateId', templateId);
    } else {
      url.searchParams.delete('templateId');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const handleTabClick = (tab: WhatsAppTab) => {
    if (tab === activeTab) return;
    setPendingTab(tab);
  };

  const confirmTabSwitch = () => {
    if (!pendingTab) return;
    setActiveTab(pendingTab);
    updateUrlParams(pendingTab, pendingTab === 'wizard' ? preselectedTemplateId : null);
    setPendingTab(null);
  };

  const handleUseTemplate = (template: WhatsAppTemplate) => {
    const stableId = String(
      template.template_id || template._id || template.id || template.name
    );
    setPreselectedTemplate(template);
    setPreselectedTemplateId(stableId);
    setActiveTab('wizard');
    updateUrlParams('wizard', stableId);
  };

  const handleCampaignCreated = () => {
    setPreselectedTemplate(null);
    setPreselectedTemplateId(null);
    setActiveTab('history');
    updateUrlParams('history', null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Mobile Drawer */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Header */}
      <DashboardHeader
        title="WhatsApp Campaign Suite"
        subtitle={
          activeTab === 'wizard'
            ? 'Import contacts, pick mobile column, configure template & dispatch campaign via Meta Cloud API'
            : activeTab === 'history'
            ? 'Monitor BullMQ message queue, delivery logs and retry failed dispatches'
            : 'Manage and sync approved Meta WhatsApp Business templates'
        }
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl text-xs font-semibold overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => handleTabClick('wizard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'wizard'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Create Campaign</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabClick('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Campaigns History</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabClick('templates')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'templates'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp Templates</span>
            </button>
          </div>

          {/* Cloud API Configuration Button */}
          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Settings className="w-4 h-4 text-emerald-600" />
            <span>Meta API Settings</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'wizard' && (
          <WhatsAppCampaignWizard
            preselectedTemplate={preselectedTemplate}
            preselectedTemplateId={preselectedTemplateId}
            onCampaignCreated={handleCampaignCreated}
          />
        )}

        {activeTab === 'history' && <WhatsAppCampaignsList />}

        {activeTab === 'templates' && (
          <WhatsAppTemplateManager
            onOpenConfigModal={() => setIsConfigModalOpen(true)}
            onUseTemplate={handleUseTemplate}
          />
        )}
      </div>

      {/* Meta WhatsApp Cloud Credentials Config Modal */}
      <WhatsAppConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Tab Navigation Confirmation Modal */}
      {pendingTab && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-bold text-slate-900">Confirm Navigation</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Do you want to switch to{' '}
                <span className="font-semibold text-slate-800">{TAB_LABELS[pendingTab]}</span>? Any unsaved progress in the current tab may be lost.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingTab(null)}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmTabSwitch}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition-all"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
