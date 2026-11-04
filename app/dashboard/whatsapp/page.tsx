'use client';

import React, { useState } from 'react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import Sidebar from '@/components/layout/Sidebar';
import SettingsModal from '@/components/layout/SettingsModal';
import WhatsAppCampaignWizard from '@/components/whatsapp/WhatsAppCampaignWizard';
import WhatsAppCampaignsList from '@/components/whatsapp/WhatsAppCampaignsList';
import WhatsAppTemplateManager from '@/components/whatsapp/WhatsAppTemplateManager';
import WhatsAppConfigModal from '@/components/whatsapp/WhatsAppConfigModal';
import { Send, History, MessageSquare, Settings } from 'lucide-react';

type WhatsAppTab = 'wizard' | 'history' | 'templates';

export default function WhatsAppCampaignPage() {
  const [activeTab, setActiveTab] = useState<WhatsAppTab>('wizard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

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
              onClick={() => setActiveTab('wizard')}
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
              onClick={() => setActiveTab('history')}
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
              onClick={() => setActiveTab('templates')}
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
          <WhatsAppCampaignWizard onCampaignCreated={() => setActiveTab('history')} />
        )}

        {activeTab === 'history' && <WhatsAppCampaignsList />}

        {activeTab === 'templates' && (
          <WhatsAppTemplateManager onOpenConfigModal={() => setIsConfigModalOpen(true)} />
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
    </div>
  );
}
