'use client';

import React from 'react';
import {
  X,
  FileSpreadsheet,
  Check,
  Mail,
  Phone,
  AlertCircle,
  Info,
} from 'lucide-react';
import { CampaignType } from '@/types/campaign';

interface CsvFilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  totalRows?: number;
  headers: string[];
  rawRows?: Record<string, string>[];
  campaignType?: CampaignType;
  selectedTargetCol?: string | null;
  detectedCol?: string | null;
  onSelectTargetCol?: (col: string) => void;
}

export default function CsvFilePreviewModal({
  isOpen,
  onClose,
  fileName = 'Uploaded Contacts File',
  totalRows = 0,
  headers = [],
  rawRows = [],
  campaignType = 'email',
  selectedTargetCol,
  detectedCol,
  onSelectTargetCol,
}: CsvFilePreviewModalProps) {
  if (!isOpen) return null;

  const isEmail = campaignType === 'email';
  const previewRows = rawRows.slice(0, 20);
  const rowCount = totalRows || rawRows.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isEmail ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  Uploaded CSV Preview
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                  {headers.length} columns
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                <span className="font-semibold text-slate-700">{fileName}</span>
                {rowCount > 0 && ` • ${rowCount.toLocaleString()} total data rows`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors shrink-0 ml-3"
            title="Close Preview"
            aria-label="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guidance / Column Identification Helper Banner */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Info className={`w-4 h-4 shrink-0 ${isEmail ? 'text-blue-600' : 'text-emerald-600'}`} />
            <span>
              {isEmail
                ? 'Review your original CSV columns below to locate recipient email addresses.'
                : 'Review your original CSV columns below to locate recipient phone numbers.'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {detectedCol && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                {isEmail ? <Mail className="w-3 h-3 text-blue-600" /> : <Phone className="w-3 h-3 text-emerald-600" />}
                <span>Auto-detected: <strong>&quot;{detectedCol}&quot;</strong></span>
              </span>
            )}

            {selectedTargetCol && selectedTargetCol !== detectedCol && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>Currently mapped: <strong>&quot;{selectedTargetCol}&quot;</strong></span>
              </span>
            )}
          </div>
        </div>

        {/* Modal Table Content */}
        <div className="flex-1 overflow-auto bg-white min-h-[250px] max-h-[58vh]">
          {headers.length === 0 || previewRows.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Data Rows to Preview</h4>
              <p className="text-xs text-slate-500 max-w-md">
                The uploaded CSV file contains no readable data records. Please ensure your file has valid rows of contact data.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 shadow-2xs">
                    {/* Row index column header */}
                    <th className="py-3 px-3 w-12 text-center text-[10px] font-mono font-bold text-slate-400 bg-slate-100/95 uppercase tracking-wider border-r border-slate-200 shrink-0">
                      #
                    </th>

                    {/* Original CSV Column Headers */}
                    {headers.map((header) => {
                      const isSelected = selectedTargetCol === header;
                      const isAutoDetected = detectedCol === header;

                      return (
                        <th
                          key={header}
                          className={`py-3 px-4 font-semibold text-xs whitespace-nowrap transition-colors ${
                            isSelected
                              ? 'bg-blue-100/80 text-blue-900 border-x border-blue-200'
                              : isAutoDetected
                              ? 'bg-amber-100/70 text-amber-900 border-x border-amber-200'
                              : 'text-slate-700 bg-slate-100/95 border-r border-slate-200/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-bold tracking-tight">{header}</span>
                            <div className="flex items-center gap-1.5">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white shadow-2xs">
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Mapped</span>
                                </span>
                              ) : isAutoDetected ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white shadow-2xs">
                                  <span>Detected</span>
                                </span>
                              ) : onSelectTargetCol ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectTargetCol(header)}
                                  className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline px-1 py-0.5 rounded bg-white/80 border border-slate-200"
                                  title={`Map "${header}" as ${isEmail ? 'Email' : 'Phone'} Column`}
                                >
                                  Map
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Row Number */}
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400 bg-slate-50/50 border-r border-slate-200/60 select-none">
                        {rowIdx + 1}
                      </td>

                      {/* Row Cells */}
                      {headers.map((header) => {
                        const cellVal = row[header];
                        const isSelected = selectedTargetCol === header;
                        const isAutoDetected = detectedCol === header;
                        const isEmpty = cellVal === undefined || cellVal === null || String(cellVal).trim() === '';

                        return (
                          <td
                            key={header}
                            className={`py-2.5 px-4 whitespace-nowrap max-w-xs truncate ${
                              isSelected
                                ? 'bg-blue-50/40 font-mono font-medium text-blue-950 border-x border-blue-100'
                                : isAutoDetected
                                ? 'bg-amber-50/30 text-amber-950 border-x border-amber-100'
                                : 'text-slate-800 border-r border-slate-100/60'
                            }`}
                            title={String(cellVal ?? '')}
                          >
                            {isEmpty ? (
                              <span className="text-slate-300 italic select-none">—</span>
                            ) : (
                              String(cellVal)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            Showing first <strong className="text-slate-800">{previewRows.length}</strong> of{' '}
            <strong className="text-slate-800">{rowCount.toLocaleString()}</strong> rows from your uploaded file.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

