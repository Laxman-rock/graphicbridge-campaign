'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  ShieldCheck,
  Save,
  Key,
} from 'lucide-react';
import { WhatsAppConfig, WhatsAppConfigStatusResponse } from '@/types/whatsapp';
import {
  getWhatsAppConfigStatus,
  getWhatsAppConfig,
  saveWhatsAppConfig,
  validateWhatsAppToken,
  verifyWhatsAppPhone,
} from '@/lib/whatsapp-api';
import { useToast } from '@/components/ui/Toast';

interface WhatsAppConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsAppConfigModal({
  isOpen,
  onClose,
}: WhatsAppConfigModalProps) {
  const { error: toastError, success: toastSuccess } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);

  const [statusData, setStatusData] = useState<WhatsAppConfigStatusResponse['data'] | null>(null);
  const [configForm, setConfigForm] = useState<WhatsAppConfig>({
    whatsapp_meta_app_id: '',
    whatsapp_meta_app_secret: '',
    whatsapp_business_account_id: '',
    whatsapp_phone_number_id: '',
    whatsapp_access_token: '',
    whatsapp_api_version: 'v19.0',
  });

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const [statusRes, configRes] = await Promise.all([
        getWhatsAppConfigStatus(),
        getWhatsAppConfig(),
      ]);

      if (statusRes.success && statusRes.data) {
        setStatusData(statusRes.data);
      }
      if (configRes.success && configRes.data) {
        setConfigForm((prev) => ({
          ...prev,
          ...configRes.data,
        }));
      }
    } catch {
      toastError('Failed to load WhatsApp configuration.', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await saveWhatsAppConfig(configForm);
      if (res.success) {
        toastSuccess('WhatsApp Business Cloud credentials saved.', 'Settings Saved');
        loadConfig();
      } else {
        toastError(res.error || 'Failed to save configuration.', 'Save Error');
      }
    } catch {
      toastError('Save request failed.', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidateToken = async () => {
    setIsValidating(true);
    try {
      const res = await validateWhatsAppToken();
      if (res.success) {
        toastSuccess(res.message || 'Access token verified with Meta API.', 'Valid Token');
        loadConfig();
      } else {
        toastError(res.error || 'Invalid or expired Meta access token.', 'Token Invalid');
      }
    } catch {
      toastError('Validation check failed.', 'Error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleVerifyPhone = async () => {
    setIsVerifyingPhone(true);
    try {
      const res = await verifyWhatsAppPhone();
      if (res.success) {
        toastSuccess('Phone number verified successfully on Meta Cloud.', 'Phone Verified');
        loadConfig();
      } else {
        toastError(res.error || 'Phone verification failed.', 'Verification Error');
      }
    } catch {
      toastError('Phone verification check failed.', 'Error');
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                WhatsApp Business Cloud API Configuration
              </h3>
              <p className="text-xs text-slate-500">
                Manage Meta App credentials, phone number ID, and access tokens
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm font-medium">Checking Meta Cloud status...</p>
            </div>
          ) : (
            <>
              {/* Status Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Connection Status:
                  </span>
                  {statusData?.isConfigured ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      CONNECTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      PENDING CREDENTIALS
                    </span>
                  )}
                </div>

                {/* Phone details pill if available */}
                {statusData?.phoneInfo && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-400">Display Phone:</span>
                      <p className="font-bold font-mono text-slate-800">
                        {statusData.phoneInfo.display_phone_number || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-400">Verified Name:</span>
                      <p className="font-bold text-slate-800 truncate">
                        {statusData.phoneInfo.verified_name || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-400">Quality Rating:</span>
                      <p className="font-bold text-emerald-600 uppercase">
                        {statusData.phoneInfo.quality_rating || 'GREEN'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Quick verification buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={handleValidateToken}
                    disabled={isValidating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-50"
                  >
                    <Key className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
                    <span>Validate Token</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleVerifyPhone}
                    disabled={isVerifyingPhone}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-50"
                  >
                    <Phone className={`w-3.5 h-3.5 ${isVerifyingPhone ? 'animate-spin' : ''}`} />
                    <span>Verify Phone Number</span>
                  </button>
                </div>
              </div>

              {/* Credentials Form */}
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Meta App ID
                    </label>
                    <input
                      type="text"
                      value={configForm.whatsapp_meta_app_id || ''}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, whatsapp_meta_app_id: e.target.value })
                      }
                      placeholder="e.g. 1092837465..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Meta App Secret
                    </label>
                    <input
                      type="password"
                      value={configForm.whatsapp_meta_app_secret || ''}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, whatsapp_meta_app_secret: e.target.value })
                      }
                      placeholder="••••••••••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      WhatsApp Business Account ID
                    </label>
                    <input
                      type="text"
                      value={configForm.whatsapp_business_account_id || ''}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          whatsapp_business_account_id: e.target.value,
                        })
                      }
                      placeholder="e.g. 192837465019..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      WhatsApp Phone Number ID
                    </label>
                    <input
                      type="text"
                      value={configForm.whatsapp_phone_number_id || ''}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          whatsapp_phone_number_id: e.target.value,
                        })
                      }
                      placeholder="e.g. 1029384756..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Meta Cloud API Permanent Access Token
                  </label>
                  <input
                    type="password"
                    value={configForm.whatsapp_access_token || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, whatsapp_access_token: e.target.value })
                    }
                    placeholder="EAAB..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    System user token generated from your Meta Business Manager with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code> permissions.
                  </p>
                </div>

                <div className="max-w-xs">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Graph API Version
                  </label>
                  <input
                    type="text"
                    value={configForm.whatsapp_api_version || 'v19.0'}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, whatsapp_api_version: e.target.value })
                    }
                    placeholder="v19.0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

