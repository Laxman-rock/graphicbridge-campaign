'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Phone,
  Tag,
  Folder,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Hash,
  ShieldCheck,
} from 'lucide-react';
import {
  WhatsAppContactItem,
  CreateWhatsAppContactRequest,
  UpdateWhatsAppContactRequest,
  WhatsAppOptInMethod,
} from '@/types/whatsapp';
import {
  createWhatsAppContact,
  updateWhatsAppContact,
  validateWhatsAppPhone,
  normalizePhoneNumber,
} from '@/lib/whatsapp-api';
import { useToast } from '@/components/ui/Toast';

interface WhatsAppContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: WhatsAppContactItem | null; // If provided, Edit mode; otherwise, Add mode
  onSuccess: () => void;
}

export default function WhatsAppContactModal({
  isOpen,
  onClose,
  contact,
  onSuccess,
}: WhatsAppContactModalProps) {
  const isEdit = !!contact;
  const { success: toastSuccess, error: toastError } = useToast();

  const [contactId, setContactId] = useState<string>('');
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [optInMethod, setOptInMethod] = useState<WhatsAppOptInMethod>('manual');
  const [isActive, setIsActive] = useState<boolean>(true);

  // Tags & Groups
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [groups, setGroups] = useState<string[]>([]);
  const [groupInput, setGroupInput] = useState<string>('');

  // Custom Variables (key-value pairs)
  const [customVars, setCustomVars] = useState<Array<{ key: string; value: string }>>([]);

  // Phone Validation State
  const [phoneValidation, setPhoneValidation] = useState<{
    isValidating: boolean;
    valid: boolean | null;
    normalized?: string;
    error?: string;
  }>({
    isValidating: false,
    valid: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Populate form if in edit mode
  useEffect(() => {
    if (contact) {
      setContactId(String(contact.contact_id ?? ''));
      setWhatsappNumber(contact.whatsapp_number ?? '');
      setOptInMethod((contact.opt_in_method as WhatsAppOptInMethod) || 'manual');
      setIsActive(contact.is_active ?? contact.active ?? true);
      setTags(Array.isArray(contact.tags) ? [...contact.tags] : []);
      setGroups(Array.isArray(contact.groups) ? [...contact.groups] : []);

      if (contact.custom_variables && typeof contact.custom_variables === 'object') {
        const pairs = Object.entries(contact.custom_variables).map(([key, val]) => ({
          key,
          value: typeof val === 'object' ? JSON.stringify(val) : String(val ?? ''),
        }));
        setCustomVars(pairs);
      } else {
        setCustomVars([]);
      }

      setPhoneValidation({
        isValidating: false,
        valid: true,
        normalized: contact.whatsapp_number,
      });
    } else {
      setContactId('');
      setWhatsappNumber('');
      setOptInMethod('manual');
      setIsActive(true);
      setTags([]);
      setTagInput('');
      setGroups([]);
      setGroupInput('');
      setCustomVars([]);
      setPhoneValidation({ isValidating: false, valid: null });
    }
    setSubmitError(null);
  }, [contact, isOpen]);

  // Debounced phone number validation
  const validatePhoneAsync = useCallback(async (num: string) => {
    const trimmed = num.trim();
    if (!trimmed) {
      setPhoneValidation({ isValidating: false, valid: null });
      return;
    }

    setPhoneValidation((prev) => ({ ...prev, isValidating: true }));
    try {
      const res = await validateWhatsAppPhone(trimmed);
      if (res.valid) {
        setPhoneValidation({
          isValidating: false,
          valid: true,
          normalized: res.normalized || normalizePhoneNumber(trimmed),
        });
      } else {
        setPhoneValidation({
          isValidating: false,
          valid: false,
          normalized: res.normalized,
          error: res.error || 'Invalid phone number format. Use E.164 (e.g. +919876543210)',
        });
      }
    } catch {
      // Graceful fallback
      const norm = normalizePhoneNumber(trimmed);
      const isOk = /^\+[1-9]\d{7,14}$/.test(norm);
      setPhoneValidation({
        isValidating: false,
        valid: isOk,
        normalized: norm,
        error: isOk ? undefined : 'Phone number must be between 8 and 15 digits',
      });
    }
  }, []);

  const handlePhoneBlur = () => {
    if (whatsappNumber.trim()) {
      // Auto normalize 10-digit Indian numbers immediately on blur
      const normalized = normalizePhoneNumber(whatsappNumber.trim());
      if (normalized !== whatsappNumber) {
        setWhatsappNumber(normalized);
      }
      validatePhoneAsync(normalized);
    }
  };

  // Tag helpers
  const handleAddTag = () => {
    const val = tagInput.trim().toLowerCase();
    if (val && !tags.includes(val)) {
      setTags([...tags, val]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Group helpers
  const handleAddGroup = () => {
    const val = groupInput.trim().toLowerCase();
    if (val && !groups.includes(val)) {
      setGroups([...groups, val]);
      setGroupInput('');
    }
  };

  const handleRemoveGroup = (groupToRemove: string) => {
    setGroups(groups.filter((g) => g !== groupToRemove));
  };

  // Custom variable helpers
  const handleAddCustomVar = () => {
    setCustomVars([...customVars, { key: '', value: '' }]);
  };

  const handleCustomVarChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customVars];
    updated[index][field] = value;
    setCustomVars(updated);
  };

  const handleRemoveCustomVar = (index: number) => {
    setCustomVars(customVars.filter((_, i) => i !== index));
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validation
    if (!contactId.trim()) {
      setSubmitError('Master Contact ID is required.');
      return;
    }

    if (!whatsappNumber.trim()) {
      setSubmitError('WhatsApp Number is required.');
      return;
    }

    const normalizedPhone = normalizePhoneNumber(whatsappNumber.trim());
    if (!/^\+[1-9]\d{6,14}$/.test(normalizedPhone)) {
      setSubmitError(
        'WhatsApp Number must be a valid international phone number in E.164 format (e.g. +919876543210).'
      );
      return;
    }

    // Convert custom vars array to dictionary
    const customVarsObj: Record<string, string> = {};
    for (const item of customVars) {
      const k = item.key.trim();
      if (k) {
        customVarsObj[k] = item.value;
      }
    }

    setIsSubmitting(true);
    try {
      const parsedContactId = /^\d+$/.test(contactId.trim())
        ? parseInt(contactId.trim(), 10)
        : contactId.trim();

      if (isEdit && contact) {
        const payload: UpdateWhatsAppContactRequest = {
          contact_id: parsedContactId,
          whatsapp_number: normalizedPhone,
          tags,
          groups,
          custom_variables: customVarsObj,
          is_active: isActive,
        };

        const res = await updateWhatsAppContact(contact.id ?? contact._id ?? contact.contact_id, payload);
        if (res.success) {
          toastSuccess(res.message || 'WhatsApp contact updated successfully!', 'Contact Updated');
          onSuccess();
          onClose();
        } else {
          setSubmitError(res.error || 'Failed to update contact. Please verify the input.');
          toastError(res.error || 'Update failed.', 'Error');
        }
      } else {
        const payload: CreateWhatsAppContactRequest = {
          contact_id: parsedContactId,
          whatsapp_number: normalizedPhone,
          opt_in_method: optInMethod,
          tags,
          groups,
          custom_variables: customVarsObj,
        };

        const res = await createWhatsAppContact(payload);
        if (res.success) {
          toastSuccess(res.message || 'WhatsApp contact created successfully!', 'Contact Created');
          onSuccess();
          onClose();
        } else {
          setSubmitError(res.error || 'Failed to create contact. Please verify the input.');
          toastError(res.error || 'Creation failed.', 'Error');
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'An unexpected error occurred while saving the contact.';
      setSubmitError(msg);
      toastError(msg, 'Submission Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEdit ? 'Edit WhatsApp Contact' : 'Add WhatsApp Contact'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEdit
                  ? 'Update contact details, attributes, and tags'
                  : 'Enroll a recipient into your WhatsApp messaging audience'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {submitError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{submitError}</div>
            </div>
          )}

          {/* Master Contact ID */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Master Contact ID <span className="text-rose-500">*</span>
            </label>
            <div className="relative rounded-2xl shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Hash className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                placeholder="e.g. 105"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              The primary identifier referencing the master contact record.
            </p>
          </div>

          {/* WhatsApp Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              WhatsApp Phone Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative rounded-2xl shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={whatsappNumber}
                onChange={(e) => {
                  setWhatsappNumber(e.target.value);
                  setPhoneValidation({ isValidating: false, valid: null });
                }}
                onBlur={handlePhoneBlur}
                placeholder="e.g. 9876543210 or +919876543210"
                className={`w-full pl-10 pr-24 py-2.5 bg-slate-50 border rounded-2xl text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                  phoneValidation.valid === true
                    ? 'border-emerald-300 focus:ring-emerald-500/20 focus:border-emerald-500'
                    : phoneValidation.valid === false
                    ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
                    : 'border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500'
                }`}
              />

              {/* Validation Status Indicator */}
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
                {phoneValidation.isValidating ? (
                  <span className="flex items-center text-[10px] text-slate-400 gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    Checking
                  </span>
                ) : phoneValidation.valid === true ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Valid
                  </span>
                ) : phoneValidation.valid === false ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    Invalid
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePhoneBlur()}
                    className="text-[10px] font-semibold text-slate-500 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    Validate
                  </button>
                )}
              </div>
            </div>

            {/* Validation Message */}
            {phoneValidation.valid === true && phoneValidation.normalized && (
              <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3 h-3" />
                Normalized: {phoneValidation.normalized}
              </p>
            )}
            {phoneValidation.valid === false && phoneValidation.error && (
              <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {phoneValidation.error}
              </p>
            )}
            {!phoneValidation.valid && phoneValidation.valid !== false && (
              <p className="text-[11px] text-slate-500 mt-1">
                10-digit Indian numbers are automatically formatted with +91.
              </p>
            )}
          </div>

          {/* Opt-In Method */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Opt-In Method
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'manual', label: 'Manual' },
                  { id: 'api', label: 'API' },
                  { id: 'bulk_import', label: 'Bulk Import' },
                  { id: 'web_form', label: 'Web Form' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setOptInMethod(item.id as WhatsAppOptInMethod)}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all text-center ${
                      optInMethod === item.id
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-700 font-semibold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                How user consent was originally captured for WhatsApp messages.
              </p>
            </div>
          )}

          {/* Active Status (Edit Mode) */}
          {isEdit && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Active Contact Status</p>
                <p className="text-[11px] text-slate-500">
                  Inactive contacts are excluded from live campaign dispatches.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          )}

          {/* Tags Section */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tags
            </label>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="e.g. vip, retail, lead"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-emerald-500 hover:text-emerald-800 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Groups Section */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Groups
            </label>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Folder className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={groupInput}
                  onChange={(e) => setGroupInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGroup();
                    }
                  }}
                  placeholder="e.g. marketing, wholesale, south-zone"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={handleAddGroup}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            {groups.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => (
                  <span
                    key={g}
                    className="inline-flex items-center gap-1 text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200"
                  >
                    {g}
                    <button
                      type="button"
                      onClick={() => handleRemoveGroup(g)}
                      className="text-indigo-500 hover:text-indigo-800 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Custom Variables Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Custom Variables (Template Placeholders)
              </label>
              <button
                type="button"
                onClick={handleAddCustomVar}
                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Key-Value
              </button>
            </div>

            {customVars.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">
                No custom variables added yet. Variables like &ldquo;name&rdquo;, &ldquo;city&rdquo;, or &ldquo;balance&rdquo; can map to WhatsApp template placeholders.
              </p>
            ) : (
              <div className="space-y-2">
                {customVars.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Key (e.g. first_name)"
                      value={item.key}
                      onChange={(e) => handleCustomVarChange(idx, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. Arun)"
                      value={item.value}
                      onChange={(e) => handleCustomVarChange(idx, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomVar(idx)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove variable"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Contact...</span>
              </>
            ) : (
              <span>{isEdit ? 'Update Contact' : 'Save WhatsApp Contact'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

