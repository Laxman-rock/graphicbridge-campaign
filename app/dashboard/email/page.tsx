'use client';

import React, { useState, useEffect } from 'react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import Sidebar from '@/components/layout/Sidebar';
import SettingsModal from '@/components/layout/SettingsModal';
import EmailCampaignWizard from '@/components/email/EmailCampaignWizard';
import CampaignsList from '@/components/email/CampaignsList';
import TemplateManager from '@/components/email/TemplateManager';
import { EmailTemplate } from '@/types/email';
import { Send, History, FileText } from 'lucide-react';

type EmailTab = 'wizard' | 'history' | 'templates';

export default function EmailCampaignPage() {
  const [activeTab, setActiveTab] = useState<EmailTab>('wizard');
  const [preselectedTemplate, setPreselectedTemplate] = useState<EmailTemplate | null>(null);
  const [preselectedTemplateId, setPreselectedTemplateId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as EmailTab | null;
    const templateIdParam = params.get('templateId');

    if (templateIdParam) {
      setPreselectedTemplateId(templateIdParam);
      setActiveTab('wizard');
    } else if (tabParam && (tabParam === 'wizard' || tabParam === 'history' || tabParam === 'templates')) {
      setActiveTab(tabParam);
    }
  }, []);

  const updateUrlParams = (tab: EmailTab, templateId?: string | null) => {
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

  const handleUseTemplate = (template: EmailTemplate) => {
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
        title="Email Campaign Suite"
        subtitle={
          activeTab === 'wizard'
            ? 'Import contacts, configure email template & dispatch multi-recipient campaign'
            : activeTab === 'history'
            ? 'Inspect queued campaign progress, delivery logs and retry failed dispatches'
            : 'Manage dynamic HTML email templates and merge variables'
        }
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('wizard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                activeTab === 'wizard'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Create Campaign</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Campaigns History</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                activeTab === 'templates'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Templates</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'wizard' && (
          <EmailCampaignWizard
            preselectedTemplate={preselectedTemplate}
            preselectedTemplateId={preselectedTemplateId}
            onCampaignCreated={handleCampaignCreated}
          />
        )}

        {activeTab === 'history' && <CampaignsList />}

        {activeTab === 'templates' && (
          <TemplateManager onUseTemplate={handleUseTemplate} />
        )}
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
