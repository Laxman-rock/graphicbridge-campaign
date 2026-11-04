import React from 'react';
import { ValidationSummary, CampaignType } from '@/types/campaign';
import { Users, CheckCircle2, AlertTriangle, Copy, Columns } from 'lucide-react';

interface ImportSummaryProps {
  summary: ValidationSummary;
  campaignType: CampaignType;
}

export default function ImportSummary({ summary, campaignType }: ImportSummaryProps) {
  const { totalRows, validCount, invalidCount, duplicateCount, columnDetected } = summary;

  const validPct = totalRows > 0 ? Math.round((validCount / totalRows) * 100) : 0;
  const invalidPct = totalRows > 0 ? Math.round((invalidCount / totalRows) * 100) : 0;
  const duplicatePct = totalRows > 0 ? Math.round((duplicateCount / totalRows) * 100) : 0;

  const fieldLabel = campaignType === 'email' ? 'Email Address' : 'Phone Number';

  return (
    <div className="space-y-6">
      {/* Target Column Info Banner */}
      {columnDetected && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs">
          <div className="flex items-center gap-2 text-indigo-900 font-medium">
            <Columns className="w-4 h-4 text-indigo-600" />
            <span>Target Column Detected:</span>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-bold">
              {columnDetected}
            </span>
            <span className="text-slate-400">mapped to</span>
            <span className="font-semibold text-indigo-800">{fieldLabel}</span>
          </div>
          <span className="text-indigo-600 font-medium">
            {validPct}% Readiness Score
          </span>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Rows */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Rows
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalRows.toLocaleString()}</div>
          <span className="text-[11px] text-slate-400 mt-1">Processed from CSV</span>
        </div>

        {/* Valid Contacts */}
        <div className="p-5 rounded-2xl bg-white border border-emerald-200/80 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Valid Contacts
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{validCount.toLocaleString()}</div>
          <span className="text-[11px] text-emerald-600/90 font-medium mt-1">
            {validPct}% of total contacts
          </span>
        </div>

        {/* Invalid Contacts */}
        <div className="p-5 rounded-2xl bg-white border border-rose-200/80 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white to-rose-50/30">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
              Invalid Format
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{invalidCount.toLocaleString()}</div>
          <span className="text-[11px] text-rose-600/90 font-medium mt-1">
            {invalidPct}% failed validation
          </span>
        </div>

        {/* Duplicate Contacts */}
        <div className="p-5 rounded-2xl bg-white border border-amber-200/80 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Duplicates
            </span>
            <Copy className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{duplicateCount.toLocaleString()}</div>
          <span className="text-[11px] text-amber-600/90 font-medium mt-1">
            {duplicatePct}% skipped duplicates
          </span>
        </div>
      </div>

      {/* Visual Composition Bar */}
      {totalRows > 0 && (
        <div className="space-y-1.5">
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${validPct}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`Valid: ${validCount}`}
            />
            <div
              style={{ width: `${duplicatePct}%` }}
              className="bg-amber-400 transition-all duration-500"
              title={`Duplicates: ${duplicateCount}`}
            />
            <div
              style={{ width: `${invalidPct}%` }}
              className="bg-rose-500 transition-all duration-500"
              title={`Invalid: ${invalidCount}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

