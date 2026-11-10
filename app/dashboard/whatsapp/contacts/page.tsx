'use client';

import React, { useState } from 'react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import Sidebar from '@/components/layout/Sidebar';
import SettingsModal from '@/components/layout/SettingsModal';
import WhatsAppContactsManager from '@/components/whatsapp/WhatsAppContactsManager';

export default function WhatsAppContactsPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
        title="WhatsApp Contacts"
        subtitle="Manage verified recipients, opt-in consent states, tags, and bulk CSV audience imports"
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10">
        <WhatsAppContactsManager />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

