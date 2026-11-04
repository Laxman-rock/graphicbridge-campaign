'use client';

import React, { useState } from 'react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import CampaignCard from '@/components/campaign/CampaignCard';
import Sidebar from '@/components/layout/Sidebar';
import SettingsModal from '@/components/layout/SettingsModal';
import { Sparkles } from 'lucide-react';

export default function DashboardPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Mobile Sidebar */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Header */}
      <DashboardHeader
        title="Campaign Dashboard"
        subtitle="Overview of your marketing campaign workspace"
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* Main Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Welcome Section */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Multi-Channel Campaigns</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Reach Your Audience. Grow Your Business.
          </h2>
          <p className="mt-2 text-base text-slate-500 max-w-2xl leading-relaxed">
            Manage your email and WhatsApp campaigns from one simple workspace.
          </p>
        </div>

        {/* Campaign Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          <CampaignCard type="email" />
          <CampaignCard type="whatsapp" />
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

