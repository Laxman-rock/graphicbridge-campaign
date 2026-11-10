'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Mail,
  MessageSquare,
  Settings,
  LogOut,
  Send,
  X,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { clearAuthSession, getStoredUser } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export default function Sidebar({ isOpen, onClose, onOpenSettings }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { info: toastInfo } = useToast();
  const user = getStoredUser();

  const handleLogout = () => {
    clearAuthSession();
    toastInfo('You have been signed out successfully.', 'Signed Out');
    router.replace('/login');
  };

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      active: pathname === '/dashboard',
    },
    {
      label: 'Email Campaign',
      href: '/dashboard/email',
      icon: Mail,
      active: pathname.startsWith('/dashboard/email'),
      accent: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'WhatsApp Campaign',
      href: '/dashboard/whatsapp',
      icon: MessageSquare,
      active: pathname === '/dashboard/whatsapp',
      accent: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'WhatsApp Contacts',
      href: '/dashboard/whatsapp/contacts',
      icon: Users,
      active: pathname.startsWith('/dashboard/whatsapp/contacts'),
      accent: 'text-emerald-600 bg-emerald-50',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Logo Header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Send className="w-4 h-4 transform -rotate-12" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-slate-900 tracking-tight leading-none">
                  Campaign
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold tracking-wider uppercase mt-1">
                  Marketing Suite
                </span>
              </div>
            </Link>

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="p-4 space-y-1">
            <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Campaigns
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    item.active
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      item.active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer Area: Settings, User Profile & Logout */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          {/* Settings Trigger */}
          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <Settings className="w-5 h-5 text-slate-400" />
            <span>Settings</span>
          </button>

          {/* User profile card */}
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
              {user?.user_id?.charAt(0) || <UserIcon className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {user?.name || user?.user_id || 'Marketing Manager'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                ID: {user?.user_id || 'Active User'}
              </p>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-5 h-5 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

