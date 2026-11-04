'use client';

import React from 'react';
import { Mail, Phone, MessageSquare, User, HelpCircle, Check, AlertCircle } from 'lucide-react';
import { CampaignType } from '@/types/campaign';

interface ColumnSelectorProps {
  headers: string[];
  rawRows?: Record<string, string>[];
  campaignType?: CampaignType;
  selectedEmailCol?: string | null;
  selectedTargetCol?: string | null;
  selectedNameCol: string | null;
  onEmailColChange?: (col: string | null) => void;
  onTargetColChange?: (col: string | null) => void;
  onNameColChange: (col: string | null) => void;
}

export default function ColumnSelector({
  headers,
  rawRows = [],
  campaignType = 'email',
  selectedEmailCol,
  selectedTargetCol,
  selectedNameCol,
  onEmailColChange,
  onTargetColChange,
  onNameColChange,
}: ColumnSelectorProps) {
  const isEmail = campaignType === 'email';
  const targetCol = selectedTargetCol !== undefined ? selectedTargetCol : selectedEmailCol || null;

  const handleColChange = (val: string | null) => {
    if (onTargetColChange) onTargetColChange(val);
    if (onEmailColChange) onEmailColChange(val);
  };

  // Extract 3 sample values for the selected target column
  const getSampleValues = (colName: string | null) => {
    if (!colName || rawRows.length === 0) return [];
    return rawRows
      .slice(0, 3)
      .map((r) => r[colName])
      .filter((v) => v !== undefined && v !== '');
  };

  const targetSamples = getSampleValues(targetCol);
  const nameSamples = getSampleValues(selectedNameCol);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isEmail ? 'bg-blue-600' : 'bg-emerald-600'
              }`}
            />
            CSV Column Mapping
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEmail
              ? 'Confirm which column in your CSV contains recipient email addresses.'
              : 'Confirm which column in your CSV contains recipient mobile / phone numbers.'}
          </p>
        </div>
        {!targetCol ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5" />
            Column Selection Required
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check className="w-3.5 h-3.5" />
            {isEmail ? 'Email' : 'Mobile Number'} Mapped
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Mobile / Email Column Selector (Required) */}
        <div className="space-y-2">
          <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              {isEmail ? (
                <Mail className="w-4 h-4 text-blue-600" />
              ) : (
                <Phone className="w-4 h-4 text-emerald-600" />
              )}
              {isEmail ? 'Email Column' : 'Mobile / Phone Number Column'}{' '}
              <span className="text-rose-500">*</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              {isEmail ? 'Required for delivery' : 'Normalized to E.164'}
            </span>
          </label>

          <select
            value={targetCol || ''}
            onChange={(e) => handleColChange(e.target.value ? e.target.value : null)}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-all focus:outline-none focus:ring-2 ${
              !targetCol
                ? 'border-amber-300 bg-amber-50/40 text-amber-900 focus:ring-amber-500/20'
                : isEmail
                ? 'border-slate-200 bg-white text-slate-900 focus:border-blue-500 focus:ring-blue-500/20'
                : 'border-slate-200 bg-white text-slate-900 focus:border-emerald-500 focus:ring-emerald-500/20'
            }`}
          >
            <option value="">
              {isEmail ? '-- Select Email Column --' : '-- Select Mobile / Phone Column --'}
            </option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          {/* Samples preview */}
          {targetSamples.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-[11px]">
              <span className="text-slate-400 font-medium">Sample data: </span>
              <span className="text-slate-700 font-mono">
                {targetSamples.join(', ')}
              </span>
            </div>
          )}

          {!targetCol && (
            <p className="text-[11px] text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {isEmail
                ? 'Please select the column that contains email addresses to validate rows.'
                : 'Please select the column that contains mobile phone numbers to validate rows.'}
            </p>
          )}
        </div>

        {/* Name Column Selector (Optional) */}
        <div className="space-y-2">
          <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-500" />
              Recipient Name Column <span className="text-slate-400 font-normal">(Optional)</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Personalization</span>
          </label>

          <select
            value={selectedNameCol || ''}
            onChange={(e) => onNameColChange(e.target.value ? e.target.value : null)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          >
            <option value="">-- None (No name column) --</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          {/* Name Samples preview */}
          {nameSamples.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-[11px]">
              <span className="text-slate-400 font-medium">Sample data: </span>
              <span className="text-slate-700 font-mono">
                {nameSamples.join(', ')}
              </span>
            </div>
          )}

          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            Used to personalize template variable {'{{1}}'} / {'{{customer_name}}'} or recipient contact name.
          </p>
        </div>
      </div>
    </div>
  );
}
