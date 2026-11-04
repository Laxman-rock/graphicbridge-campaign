'use client';

import React from 'react';
import { Menu, User as UserIcon } from 'lucide-react';
import { getStoredUser } from '@/lib/auth';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  onOpenMobileMenu: () => void;
}

export default function DashboardHeader({
  title = 'Campaign Dashboard',
  subtitle,
  onOpenMobileMenu,
}: DashboardHeaderProps) {
  const user = getStoredUser();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-none">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1 hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      {/* User profile / avatar */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-semibold text-slate-800">
            {user?.name || user?.user_id || 'User'}
          </div>
          <div className="text-[10px] text-slate-400">Marketing Lead</div>
        </div>

        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center font-semibold text-xs shadow-sm ring-2 ring-indigo-100">
          {user?.user_id ? user.user_id.slice(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
        </div>
      </div>
    </header>
  );
}

