'use client';

import React from 'react';
import { X, Server, Shield, Database, Info } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const user = getStoredUser();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Campaign Environment Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-sm">
          {/* Active User Session */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Active Authentication Session</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-slate-400">User ID:</span>
                <p className="font-semibold text-slate-800">{user?.user_id || 'Not signed in'}</p>
              </div>
              <div>
                <span className="text-slate-400">Auth Token:</span>
                <p className="font-mono text-slate-800 truncate">Bearer (Encrypted/Active)</p>
              </div>
            </div>
          </div>

          {/* Staging API Endpoint */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <Database className="w-4 h-4 text-indigo-600" />
              <span>Backend API Server</span>
            </div>
            <p className="text-xs text-slate-600 font-mono break-all bg-white p-2 rounded border border-slate-200">
              {API_BASE_URL}
            </p>
            <div className="text-[11px] text-slate-500">
              Connected endpoints:
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-600">
                <li><code className="font-mono text-[10px]">POST /api/users/login</code> (Verified login route)</li>
                <li><code className="font-mono text-[10px]">POST /users/login</code> (Fallback reference)</li>
              </ul>
            </div>
          </div>

          {/* CSV Limits */}
          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900">
            <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>CSV Contact Validation:</strong> Parsed client-side using RFC-5322 and ITU-T E.164 specifications. No data is dispatched without explicit user initiation.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

