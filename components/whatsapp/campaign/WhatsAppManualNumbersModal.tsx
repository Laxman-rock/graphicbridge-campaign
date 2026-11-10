'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  ChevronDown,
  Check,
  Users,
} from 'lucide-react';
import { UnifiedWhatsAppRecipient } from '@/types/whatsapp';
import { validateWhatsAppPhone, normalizePhoneNumber } from '@/lib/whatsapp-api';
import { useToast } from '@/components/ui/Toast';

export interface CountryConfig {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  minDigits: number;
  maxDigits: number;
  placeholder: string;
}

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
  {
    code: 'IN',
    name: 'India',
    dialCode: '+91',
    flag: '🇮🇳',
    minDigits: 10,
    maxDigits: 10,
    placeholder: 'Enter 10-digit mobile number',
  },
  {
    code: 'US',
    name: 'United States',
    dialCode: '+1',
    flag: '🇺🇸',
    minDigits: 10,
    maxDigits: 10,
    placeholder: 'Enter 10-digit phone number',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    dialCode: '+44',
    flag: '🇬🇧',
    minDigits: 10,
    maxDigits: 11,
    placeholder: 'Enter 10 or 11-digit number',
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    dialCode: '+971',
    flag: '🇦🇪',
    minDigits: 9,
    maxDigits: 9,
    placeholder: 'Enter 9-digit mobile number',
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    dialCode: '+966',
    flag: '🇸🇦',
    minDigits: 9,
    maxDigits: 9,
    placeholder: 'Enter 9-digit mobile number',
  },
  {
    code: 'SG',
    name: 'Singapore',
    dialCode: '+65',
    flag: '🇸🇬',
    minDigits: 8,
    maxDigits: 8,
    placeholder: 'Enter 8-digit phone number',
  },
  {
    code: 'AU',
    name: 'Australia',
    dialCode: '+61',
    flag: '🇦🇺',
    minDigits: 9,
    maxDigits: 9,
    placeholder: 'Enter 9-digit mobile number',
  },
  {
    code: 'DE',
    name: 'Germany',
    dialCode: '+49',
    flag: '🇩🇪',
    minDigits: 10,
    maxDigits: 11,
    placeholder: 'Enter 10 or 11-digit number',
  },
  {
    code: 'FR',
    name: 'France',
    dialCode: '+33',
    flag: '🇫🇷',
    minDigits: 9,
    maxDigits: 9,
    placeholder: 'Enter 9-digit mobile number',
  },
  {
    code: 'QA',
    name: 'Qatar',
    dialCode: '+974',
    flag: '🇶🇦',
    minDigits: 8,
    maxDigits: 8,
    placeholder: 'Enter 8-digit mobile number',
  },
  {
    code: 'KW',
    name: 'Kuwait',
    dialCode: '+965',
    flag: '🇰🇼',
    minDigits: 8,
    maxDigits: 8,
    placeholder: 'Enter 8-digit mobile number',
  },
  {
    code: 'OM',
    name: 'Oman',
    dialCode: '+968',
    flag: '🇴🇲',
    minDigits: 8,
    maxDigits: 8,
    placeholder: 'Enter 8-digit mobile number',
  },
  {
    code: 'BH',
    name: 'Bahrain',
    dialCode: '+973',
    flag: '🇧🇭',
    minDigits: 8,
    maxDigits: 8,
    placeholder: 'Enter 8-digit mobile number',
  },
  {
    code: 'MY',
    name: 'Malaysia',
    dialCode: '+60',
    flag: '🇲🇾',
    minDigits: 9,
    maxDigits: 10,
    placeholder: 'Enter 9 or 10-digit number',
  },
  {
    code: 'ZA',
    name: 'South Africa',
    dialCode: '+27',
    flag: '🇿🇦',
    minDigits: 9,
    maxDigits: 9,
    placeholder: 'Enter 9-digit mobile number',
  },
  {
    code: 'BR',
    name: 'Brazil',
    dialCode: '+55',
    flag: '🇧🇷',
    minDigits: 10,
    maxDigits: 11,
    placeholder: 'Enter 10 or 11-digit number',
  },
  {
    code: 'ID',
    name: 'Indonesia',
    dialCode: '+62',
    flag: '🇮🇩',
    minDigits: 9,
    maxDigits: 12,
    placeholder: 'Enter 9 to 12-digit number',
  },
  {
    code: 'PH',
    name: 'Philippines',
    dialCode: '+63',
    flag: '🇵🇭',
    minDigits: 10,
    maxDigits: 10,
    placeholder: 'Enter 10-digit mobile number',
  },
  {
    code: 'OTHER',
    name: 'Other International',
    dialCode: '+',
    flag: '🌐',
    minDigits: 7,
    maxDigits: 15,
    placeholder: 'Enter international phone number',
  },
];

interface WhatsAppManualNumbersModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPhones: Set<string>;
  manualRecipients: UnifiedWhatsAppRecipient[];
  totalAudienceCount?: number;
  onAddRecipient: (recipient: UnifiedWhatsAppRecipient) => void;
  onRemoveRecipient: (id: string) => void;
  onAddRecipients?: (recipients: UnifiedWhatsAppRecipient[]) => void;
}

interface ValidatedNumberData {
  normalized: string;
  country: CountryConfig;
}

/**
 * Helper to identify country flag from a phone number string
 */
function getCountryFlagForPhone(phone: string): { flag: string; label: string } {
  if (!phone) return { flag: '🌐', label: 'Intl' };
  const cleaned = phone.startsWith('+') ? phone : `+${phone}`;

  for (const c of SUPPORTED_COUNTRIES) {
    if (c.dialCode !== '+' && cleaned.startsWith(c.dialCode)) {
      return { flag: c.flag, label: c.dialCode };
    }
  }
  return { flag: '🌐', label: 'Intl' };
}

export default function WhatsAppManualNumbersModal({
  isOpen,
  onClose,
  existingPhones,
  manualRecipients,
  totalAudienceCount,
  onAddRecipient,
  onRemoveRecipient,
}: WhatsAppManualNumbersModalProps) {
  const { error: toastError, success: toastSuccess } = useToast();

  // State
  const [selectedCountry, setSelectedCountry] = useState<CountryConfig>(SUPPORTED_COUNTRIES[0]); // Default India
  const [inputNumber, setInputNumber] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validatedData, setValidatedData] = useState<ValidatedNumberData | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      // Reset input form state when modal closes
      setInputNumber('');
      setValidationSuccess(null);
      setValidationError(null);
      setValidatedData(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Validation checks for current country
  const isIndia = selectedCountry.code === 'IN';
  const digitCount = inputNumber.length;
  const isComplete =
    isIndia
      ? digitCount === 10
      : digitCount >= selectedCountry.minDigits && digitCount <= selectedCountry.maxDigits;

  // Handle country change
  const handleCountrySelect = (code: string) => {
    const found = SUPPORTED_COUNTRIES.find((c) => c.code === code) || SUPPORTED_COUNTRIES[0];
    setSelectedCountry(found);
    // Reset validation state when country changes
    setValidationSuccess(null);
    setValidationError(null);
    setValidatedData(null);

    // If input exceeds new max digits, truncate
    if (inputNumber.length > found.maxDigits) {
      setInputNumber(inputNumber.slice(0, found.maxDigits));
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Handle phone input changes with strict digit filtering
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Reject all non-digit characters
    let digitsOnly = raw.replace(/\D/g, '');

    // If pasting or typing with country code prefix when country is selected, smart strip
    if (isIndia) {
      if (digitsOnly.length > 10 && digitsOnly.startsWith('91')) {
        digitsOnly = digitsOnly.slice(2);
      }
      digitsOnly = digitsOnly.slice(0, 10);
    } else {
      digitsOnly = digitsOnly.slice(0, selectedCountry.maxDigits);
    }

    setInputNumber(digitsOnly);

    // Clear previous validation states on edit
    if (validationSuccess || validationError || validatedData) {
      setValidationSuccess(null);
      setValidationError(null);
      setValidatedData(null);
    }
  };

  // Handle paste with cleaning
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text') || '';
    let cleaned = pastedText.trim().replace(/\D/g, '');

    if (isIndia) {
      if (cleaned.length > 10 && cleaned.startsWith('91')) {
        cleaned = cleaned.slice(2);
      }
      cleaned = cleaned.slice(0, 10);
    } else {
      cleaned = cleaned.slice(0, selectedCountry.maxDigits);
    }

    setInputNumber(cleaned);
    setValidationSuccess(null);
    setValidationError(null);
    setValidatedData(null);
  };

  // Check duplicate against existing audience (CSV, Contacts, and Manual)
  const checkDuplicate = (normalizedPhone: string): boolean => {
    if (!normalizedPhone) return false;
    const target = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;
    const rawTarget = target.replace(/^\+/, '');

    return (
      existingPhones.has(target) ||
      existingPhones.has(rawTarget) ||
      manualRecipients.some((r) => r.phone === target || r.phone === rawTarget)
    );
  };

  // Validate number via backend API
  const handleValidateNumber = async () => {
    if (!isComplete || isValidating) return;

    // Check India 10-digit rule
    if (isIndia && digitCount !== 10) {
      setValidationError('Please enter exactly 10 digits for Indian mobile numbers.');
      return;
    }

    // Check other country length rules
    if (!isIndia && (digitCount < selectedCountry.minDigits || digitCount > selectedCountry.maxDigits)) {
      setValidationError(
        `Please enter between ${selectedCountry.minDigits} and ${selectedCountry.maxDigits} digits for ${selectedCountry.name}.`
      );
      return;
    }

    // Pre-check for duplicate before network call
    const candidateNormalized =
      selectedCountry.code === 'IN'
        ? `+91${inputNumber}`
        : selectedCountry.dialCode === '+'
        ? `+${inputNumber}`
        : `${selectedCountry.dialCode}${inputNumber}`;

    if (checkDuplicate(candidateNormalized)) {
      setValidationError('This number has already been added.');
      setValidationSuccess(null);
      setValidatedData(null);
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setValidationSuccess(null);
    setValidatedData(null);

    try {
      // Backend expects 10 digits for India or international phone format
      const phoneToSend = selectedCountry.code === 'IN' ? inputNumber : candidateNormalized;
      const res = await validateWhatsAppPhone(phoneToSend);

      if (!res.valid) {
        setValidationError(res.error || res.message || 'Phone number format is invalid.');
        setValidationSuccess(null);
        setValidatedData(null);
        return;
      }

      const finalNormalized = res.normalized || candidateNormalized;

      // Duplicate check on final backend-normalized number
      if (checkDuplicate(finalNormalized)) {
        setValidationError('This number has already been added.');
        setValidationSuccess(null);
        setValidatedData(null);
        return;
      }

      setValidationSuccess(res.message || 'Phone number verified successfully.');
      setValidatedData({
        normalized: finalNormalized,
        country: selectedCountry,
      });
    } catch (err: any) {
      const msg = err?.message || 'Failed to validate phone number. Please try again.';
      setValidationError(msg);
      toastError(msg, 'Validation Failed');
    } finally {
      setIsValidating(false);
    }
  };

  // Add validated recipient
  const handleAddRecipient = () => {
    if (!validatedData) return;

    // Final safety check against duplicates
    if (checkDuplicate(validatedData.normalized)) {
      setValidationError('This number has already been added.');
      return;
    }

    const newRecipient: UnifiedWhatsAppRecipient = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      phone: validatedData.normalized,
      formattedPhone: validatedData.normalized,
      source: 'manual',
      status: 'valid',
      whatsapp_opt_in: true,
      raw: {
        phone: validatedData.normalized,
        whatsapp_number: validatedData.normalized,
        country_code: validatedData.country.code,
        source: 'manual',
      },
    };

    // Invoke parent add handler
    onAddRecipient(newRecipient);
    toastSuccess(`Added ${validatedData.normalized} to audience.`, 'Recipient Added');

    // 1. Clear input
    setInputNumber('');
    // 2. Reset validation state
    setValidationSuccess(null);
    setValidationError(null);
    setValidatedData(null);
    // 3. Keep country code intact
    // 4. Automatically re-focus input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Keyboard shortcut: Enter triggers Validate or Add Recipient
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (validatedData) {
        handleAddRecipient();
      } else if (isComplete && !isValidating) {
        handleValidateNumber();
      }
    }
  };

  const totalAudience = totalAudienceCount ?? manualRecipients.length;

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
                Enter Mobile Numbers Manually
              </h3>
              <p className="text-xs text-slate-500">
                Validate and add WhatsApp recipients one by one
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Section: Compact Mobile Number Input & Validation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mobile Number
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {isIndia ? (
                  <>
                    <span className={digitCount === 10 ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                      {digitCount}/10
                    </span>{' '}
                    digits
                  </>
                ) : (
                  <span>
                    {selectedCountry.minDigits}-{selectedCountry.maxDigits} digits
                  </span>
                )}
              </span>
            </div>

            {/* Input Row: [ Flag + DialCode ] [ Number Input ] [ Validate Button ] */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Country Code Dropdown */}
              <div className="relative flex-shrink-0">
                <select
                  value={selectedCountry.code}
                  onChange={(e) => handleCountrySelect(e.target.value)}
                  className="appearance-none h-11 pl-3.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer transition-all w-full sm:w-auto"
                >
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.dialCode} ({c.name})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Number Input Field */}
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="tel"
                  inputMode="numeric"
                  value={inputNumber}
                  onChange={handleInputChange}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedCountry.placeholder}
                  maxLength={selectedCountry.maxDigits}
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all tracking-wide"
                />
              </div>

              {/* Validate Number Button */}
              <button
                type="button"
                onClick={handleValidateNumber}
                disabled={!isComplete || isValidating}
                className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 flex-shrink-0"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Validate Number</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {validationError && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span className="font-medium">{validationError}</span>
              </div>
            )}

            {/* Success Validation Card with "Add Recipient" action */}
            {validationSuccess && validatedData && (
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{validatedData.country.flag}</span>
                      <span className="text-xs font-mono font-bold text-emerald-950">
                        {validatedData.normalized}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-200/60 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                        Valid
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                      {validationSuccess}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddRecipient}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Recipient</span>
                </button>
              </div>
            )}
          </div>

          {/* Section: Recipients List */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Added Recipients
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                  {manualRecipients.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Total Audience:</span>
                <span className="font-bold text-slate-800">{totalAudience}</span>
              </div>
            </div>

            {manualRecipients.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  No manual recipients added yet.
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Enter a number above, validate it, and click Add Recipient.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
                {manualRecipients.map((rec) => {
                  const countryMeta = getCountryFlagForPhone(rec.phone);
                  return (
                    <div
                      key={rec.id}
                      className="p-2.5 px-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base flex-shrink-0" title={countryMeta.label}>
                          {countryMeta.flag}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-slate-800">
                              {rec.formattedPhone || rec.phone}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Valid
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveRecipient(rec.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex-shrink-0"
                        title="Remove recipient"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {manualRecipients.length > 0 ? (
              <span className="font-medium text-emerald-700">
                ✓ {manualRecipients.length} manual recipient(s) saved in campaign
              </span>
            ) : (
              'Enter numbers one by one'
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
