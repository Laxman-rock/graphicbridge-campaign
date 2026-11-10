'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  User,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Tag,
  Folder,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Send,
  MessageSquare,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  WhatsAppContactItem,
  RecipientEligibilityResponse,
  ConversationWindowResponse,
} from '@/types/whatsapp';
import {
  getWhatsAppContact,
  optInWhatsAppContact,
  optOutWhatsAppContact,
  validateWhatsAppRecipient,
  checkWhatsAppConversationWindow,
} from '@/lib/whatsapp-api';
import { hasPermission } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';

interface WhatsAppContactDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string | number | null;
  initialContact?: WhatsAppContactItem | null;
  onStatusChanged: () => void;
}

export default function WhatsAppContactDetailsModal({
  isOpen,
  onClose,
  contactId,
  initialContact,
  onStatusChanged,
}: WhatsAppContactDetailsModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();

  const [contact, setContact] = useState<WhatsAppContactItem | null>(initialContact || null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Opt-in / Opt-out action states
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);

  // Eligibility & 24h Window Check states
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<RecipientEligibilityResponse | null>(null);
  const [windowResult, setWindowResult] = useState<ConversationWindowResponse | null>(null);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  const canEdit = hasPermission('whatsapp.contacts.edit');
  const canCheckEligibility = hasPermission('whatsapp.messages.send');

  // Load fresh contact details whenever modal opens
  useEffect(() => {
    if (isOpen && contactId) {
      setIsLoading(true);
      setLoadError(null);
      setEligibilityResult(null);
      setWindowResult(null);
      setEligibilityError(null);
      setShowOptOutConfirm(false);

      getWhatsAppContact(contactId)
        .then((res) => {
          if (res.success && res.data) {
            setContact(res.data);
          } else if (initialContact) {
            setContact(initialContact);
          } else {
            setLoadError(res.error || 'Failed to load contact details.');
          }
        })
        .catch((err) => {
          if (initialContact) {
            setContact(initialContact);
          } else {
            setLoadError(err?.message || 'Failed to load contact details.');
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setContact(initialContact || null);
      setEligibilityResult(null);
      setWindowResult(null);
      setShowOptOutConfirm(false);
    }
  }, [isOpen, contactId, initialContact]);

  // Handle Opt-in
  const handleOptIn = async () => {
    if (!contact) return;
    setIsUpdatingConsent(true);
    try {
      const res = await optInWhatsAppContact(contact.id ?? contact._id ?? contact.contact_id, 'manual');
      if (res.success) {
        toastSuccess(res.message || 'Contact consent successfully updated to Opted In.', 'Consent Updated');
        setContact((prev) => (prev ? { ...prev, opt_in_status: 'opted_in', opt_in_at: new Date().toISOString() } : null));
        onStatusChanged();
      } else {
        toastError(res.error || 'Failed to opt in contact.', 'Error');
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to opt in contact.', 'Error');
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  // Handle Opt-out
  const handleOptOut = async () => {
    if (!contact) return;
    setIsUpdatingConsent(true);
    try {
      const res = await optOutWhatsAppContact(contact.id ?? contact._id ?? contact.contact_id);
      if (res.success) {
        toastSuccess(res.message || 'Contact has been successfully opted out.', 'Consent Updated');
        setContact((prev) => (prev ? { ...prev, opt_in_status: 'opted_out', opt_out_at: new Date().toISOString() } : null));
        setShowOptOutConfirm(false);
        onStatusChanged();
      } else {
        toastError(res.error || 'Failed to opt out contact.', 'Error');
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to opt out contact.', 'Error');
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  // Run eligibility and 24h window check
  const handleCheckEligibility = async () => {
    if (!contact?.whatsapp_number) return;
    setIsCheckingEligibility(true);
    setEligibilityError(null);
    setEligibilityResult(null);
    setWindowResult(null);

    try {
      const [elRes, winRes] = await Promise.all([
        validateWhatsAppRecipient(contact.whatsapp_number),
        checkWhatsAppConversationWindow(contact.whatsapp_number),
      ]);

      setEligibilityResult(elRes);
      setWindowResult(winRes);

      if (!elRes.success && !winRes.success) {
        setEligibilityError(elRes.error || winRes.error || 'Eligibility check encountered an error.');
      }
    } catch (err: any) {
      setEligibilityError(err?.message || 'Failed to perform eligibility check.');
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  if (!isOpen) return null;

  const currentOptIn = contact?.opt_in_status?.toLowerCase();
  const isOptedIn = currentOptIn === 'opted_in' || currentOptIn === 'opt-in' || currentOptIn === 'yes' || currentOptIn === 'true';
  const isOptedOut = currentOptIn === 'opted_out' || currentOptIn === 'opt-out' || currentOptIn === 'no' || currentOptIn === 'false';
  const isPending = !isOptedIn && !isOptedOut;

  const contactDetails = contact?.contact_details || {};
  const masterName =
    contactDetails.name ||
    contactDetails.contact_name ||
    (contactDetails.first_name ? `${contactDetails.first_name} ${contactDetails.last_name || ''}`.trim() : null) ||
    contact?.custom_variables?.name ||
    contact?.custom_variables?.first_name ||
    'Contact';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-base flex-shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {masterName}
                </h3>
                {/* Active badge */}
                {(contact?.is_active ?? contact?.active ?? true) ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                    Inactive
                  </span>
                )}
                {/* Opt-in badge */}
                {isOptedIn ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Opted In
                  </span>
                ) : isOptedOut ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                    Opted Out
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Pending Opt-In
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                {contact?.whatsapp_number || 'Loading...'} &bull; Master ID: {contact?.contact_id ?? '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && !contact ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-medium text-slate-500">Loading contact details from server...</p>
            </div>
          ) : loadError && !contact ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{loadError}</div>
            </div>
          ) : (
            <>
              {/* Consent Management Banner */}
              <div
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isOptedIn
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : isOptedOut
                    ? 'bg-rose-50/70 border-rose-200'
                    : 'bg-amber-50/70 border-amber-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {isOptedIn ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : isOptedOut ? (
                    <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      WhatsApp Consent:{' '}
                      <span
                        className={
                          isOptedIn
                            ? 'text-emerald-700'
                            : isOptedOut
                            ? 'text-rose-700'
                            : 'text-amber-700'
                        }
                      >
                        {isOptedIn ? 'Opted In' : isOptedOut ? 'Opted Out' : 'Pending Consent'}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {isOptedIn
                        ? `Recipient opted in via ${contact?.opt_in_method || 'manual'}${
                            contact?.opt_in_at ? ` on ${new Date(contact.opt_in_at).toLocaleDateString()}` : ''
                          }. Eligible for campaigns.`
                        : isOptedOut
                        ? `Contact opted out${
                            contact?.opt_out_at ? ` on ${new Date(contact.opt_out_at).toLocaleDateString()}` : ''
                          }. Ineligible for messaging.`
                        : 'Consent status pending verification or user confirmation.'}
                    </p>
                  </div>
                </div>

                {/* Consent action button */}
                <div className="self-end sm:self-auto flex items-center gap-2">
                  {isOptedIn ? (
                    <button
                      type="button"
                      disabled={isUpdatingConsent || !canEdit}
                      onClick={() => setShowOptOutConfirm(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                      title={!canEdit ? 'Permission required: whatsapp.contacts.edit' : undefined}
                    >
                      {isUpdatingConsent ? 'Updating...' : 'Opt-Out Contact'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isUpdatingConsent || !canEdit}
                      onClick={handleOptIn}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      title={!canEdit ? 'Permission required: whatsapp.contacts.edit' : undefined}
                    >
                      {isUpdatingConsent ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Opt-In Contact</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Opt-Out Confirmation Dialog */}
              {showOptOutConfirm && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold">Confirm Opt-Out Consent Revocation</p>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        Are you sure you want to opt out <strong>{contact?.whatsapp_number}</strong>?
                        Once opted out, WhatsApp messaging guidelines prohibit dispatching any marketing or notification messages to this number.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowOptOutConfirm(false)}
                      className="px-3 py-1.5 rounded-xl bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingConsent}
                      onClick={handleOptOut}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs"
                    >
                      {isUpdatingConsent ? 'Confirming...' : 'Yes, Confirm Opt-Out'}
                    </button>
                  </div>
                </div>
              )}

              {/* Master Contact Details Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Master Contact Information
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    ID: {contact?.contact_id ?? '—'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Full Name</span>
                    <span className="font-semibold text-slate-800">
                      {contactDetails.name || contactDetails.contact_name || masterName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Email Address</span>
                    <span className="font-mono text-slate-800">
                      {contactDetails.email || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Company / Organization</span>
                    <span className="text-slate-800">
                      {contactDetails.company || contactDetails.organization || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Primary Phone</span>
                    <span className="font-mono text-slate-800">
                      {contactDetails.phone || contact?.whatsapp_number || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tags & Groups Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tags */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Tags
                    </h4>
                  </div>
                  {Array.isArray(contact?.tags) && contact.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {contact.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic pt-1">No tags assigned</p>
                  )}
                </div>

                {/* Groups */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Folder className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Groups
                    </h4>
                  </div>
                  {Array.isArray(contact?.groups) && contact.groups.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {contact.groups.map((g) => (
                        <span
                          key={g}
                          className="text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic pt-1">No groups assigned</p>
                  )}
                </div>
              </div>

              {/* Custom Variables */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Custom Variables (Placeholders)
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Used to populate template variables
                  </span>
                </div>
                {contact?.custom_variables && Object.keys(contact.custom_variables).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {Object.entries(contact.custom_variables).map(([k, v]) => (
                      <div
                        key={k}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-150 text-xs"
                      >
                        <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block truncate">
                          {`{{${k}}}`}
                        </span>
                        <span className="font-semibold text-slate-800 break-words">
                          {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic pt-1">No custom variables defined</p>
                )}
              </div>

              {/* Recipient Eligibility & 24-Hour Window Section */}
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Recipient Eligibility & 24-Hour Window Check
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Check real-time messaging eligibility and customer care window via backend without sending any message.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isCheckingEligibility || !canCheckEligibility}
                    onClick={handleCheckEligibility}
                    className="self-start sm:self-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                    title={!canCheckEligibility ? 'Permission required: whatsapp.messages.send' : undefined}
                  >
                    {isCheckingEligibility ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Check Status</span>
                      </>
                    )}
                  </button>
                </div>

                {eligibilityError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">{eligibilityError}</span>
                  </div>
                )}

                {(eligibilityResult || windowResult) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                    {/* Eligibility result card */}
                    <div
                      className={`p-3.5 rounded-xl border ${
                        eligibilityResult?.is_eligible || eligibilityResult?.eligible
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50/80 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {eligibilityResult?.is_eligible || eligibilityResult?.eligible ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                        )}
                        <span className="font-bold">
                          {eligibilityResult?.is_eligible || eligibilityResult?.eligible
                            ? 'Recipient Eligible'
                            : 'Recipient Ineligible'}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90 leading-relaxed">
                        {eligibilityResult?.reason ||
                          eligibilityResult?.message ||
                          (eligibilityResult?.is_eligible
                            ? 'Phone number is active on WhatsApp and has valid consent.'
                            : 'Recipient cannot receive messages at this time.')}
                      </p>
                    </div>

                    {/* 24-hour window card */}
                    <div
                      className={`p-3.5 rounded-xl border ${
                        windowResult?.is_window_open || windowResult?.window_open
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50/80 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {windowResult?.is_window_open || windowResult?.window_open ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-amber-600" />
                        )}
                        <span className="font-bold">
                          {windowResult?.is_window_open || windowResult?.window_open
                            ? '24-Hour Window Open'
                            : '24-Hour Window Closed'}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90 leading-relaxed">
                        {windowResult?.is_window_open || windowResult?.window_open
                          ? `Customer care session is open${
                              windowResult.window_expires_at
                                ? ` until ${new Date(windowResult.window_expires_at).toLocaleTimeString()}`
                                : ''
                            }. Free-form text and custom messages allowed.`
                          : 'Window is closed. Meta WhatsApp Cloud API requires an approved Business Template message to initiate contact.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

