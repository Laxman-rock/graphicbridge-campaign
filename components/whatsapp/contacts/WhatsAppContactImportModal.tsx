'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Download,
  ArrowRight,
  ArrowLeft,
  Check,
  RefreshCw,
} from 'lucide-react';
import { BulkImportContactItem, BulkImportContactsResponse } from '@/types/whatsapp';
import { bulkImportWhatsAppContacts, normalizePhoneNumber } from '@/lib/whatsapp-api';
import { useToast } from '@/components/ui/Toast';

interface WhatsAppContactImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'importing' | 'results';

// Lightweight fast CSV parser that supports quotes, commas, and newlines
function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuote = false;

  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !insideQuote) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows = lines.slice(1);
  return { headers, rows };
}

export default function WhatsAppContactImportModal({
  isOpen,
  onClose,
  onSuccess,
}: WhatsAppContactImportModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);

  // Column mappings
  const [contactIdCol, setContactIdCol] = useState<string>('');
  const [phoneCol, setPhoneCol] = useState<string>('');
  const [tagsCol, setTagsCol] = useState<string>('');
  const [groupsCol, setGroupsCol] = useState<string>('');

  // Results state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResults, setImportResults] = useState<BulkImportContactsResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Reset state when closing/opening
  const resetState = () => {
    setStep('upload');
    setFile(null);
    setHeaders([]);
    setRows([]);
    setContactIdCol('');
    setPhoneCol('');
    setTagsCol('');
    setGroupsCol('');
    setImportResults(null);
    setImportError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith('.csv')) {
      toastError('Please select a valid .csv file.', 'Invalid File');
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseCsvText(content);
        if (parsed.headers.length === 0 || parsed.rows.length === 0) {
          toastError('The selected CSV file appears to be empty.', 'Empty CSV');
          return;
        }

        setHeaders(parsed.headers);
        setRows(parsed.rows);

        // Auto-detect columns
        autoDetectColumns(parsed.headers);
        setStep('mapping');
      }
    };
    reader.onerror = () => {
      toastError('Failed to read CSV file.', 'Read Error');
    };
    reader.readAsText(selected);
  };

  const autoDetectColumns = (cols: string[]) => {
    // Detect contact ID column
    const idMatch = cols.find((c) => {
      const low = c.toLowerCase();
      return (
        low === 'contact_id' ||
        low === 'contact id' ||
        low === 'id' ||
        low === 'master_id' ||
        low === 'customer_id'
      );
    });
    if (idMatch) setContactIdCol(idMatch);
    else if (cols.length > 0) setContactIdCol(cols[0]);

    // Detect phone column
    const phoneMatch = cols.find((c) => {
      const low = c.toLowerCase();
      return (
        low.includes('phone') ||
        low.includes('whatsapp') ||
        low.includes('mobile') ||
        low.includes('number') ||
        low.includes('contact_no')
      );
    });
    if (phoneMatch) setPhoneCol(phoneMatch);
    else if (cols.length > 1) setPhoneCol(cols[1]);

    // Detect tags column
    const tagMatch = cols.find((c) => c.toLowerCase().includes('tag'));
    if (tagMatch) setTagsCol(tagMatch);

    // Detect groups column
    const groupMatch = cols.find((c) => c.toLowerCase().includes('group'));
    if (groupMatch) setGroupsCol(groupMatch);
  };

  // Download Sample CSV
  const handleDownloadSample = () => {
    const csvContent =
      'contact_id,whatsapp_number,tags,groups,first_name,city\n' +
      '101,9876543210,"vip,retail",marketing,Arun,Chennai\n' +
      '102,+919876543211,wholesale,"dealers,tier1",Kavita,Bangalore\n' +
      '103,8778157250,lead,sales,Rahul,Mumbai\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'whatsapp_contacts_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Compute parsed records based on mappings
  const { validRecords, invalidCount } = useMemo(() => {
    if (!contactIdCol || !phoneCol || rows.length === 0) {
      return { validRecords: [], invalidCount: 0 };
    }

    const idIdx = headers.indexOf(contactIdCol);
    const phoneIdx = headers.indexOf(phoneCol);
    const tagsIdx = tagsCol ? headers.indexOf(tagsCol) : -1;
    const groupsIdx = groupsCol ? headers.indexOf(groupsCol) : -1;

    const valid: BulkImportContactItem[] = [];
    let invalid = 0;

    rows.forEach((row) => {
      const rawId = row[idIdx]?.trim();
      const rawPhone = row[phoneIdx]?.trim();

      if (!rawId || !rawPhone) {
        invalid++;
        return;
      }

      const normalizedPhone = normalizePhoneNumber(rawPhone);
      // Ensure E.164-like phone format
      if (!/^\+[1-9]\d{6,14}$/.test(normalizedPhone)) {
        invalid++;
        return;
      }

      // Tags parsing
      let parsedTags: string[] = [];
      if (tagsIdx !== -1 && row[tagsIdx]) {
        parsedTags = row[tagsIdx]
          .split(/[,;|]/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
      }

      // Groups parsing
      let parsedGroups: string[] = [];
      if (groupsIdx !== -1 && row[groupsIdx]) {
        parsedGroups = row[groupsIdx]
          .split(/[,;|]/)
          .map((g) => tTrim(g).toLowerCase())
          .filter(Boolean);
      }

      // Extra unmapped columns go into custom_variables
      const customVars: Record<string, string> = {};
      headers.forEach((h, colIdx) => {
        if (
          colIdx !== idIdx &&
          colIdx !== phoneIdx &&
          colIdx !== tagsIdx &&
          colIdx !== groupsIdx &&
          row[colIdx]?.trim()
        ) {
          const cleanKey = h.toLowerCase().replace(/[^a-z0-9_]/g, '_');
          customVars[cleanKey] = row[colIdx].trim();
        }
      });

      const parsedId = /^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId;

      valid.push({
        contact_id: parsedId,
        whatsapp_number: normalizedPhone,
        ...(parsedTags.length > 0 ? { tags: parsedTags } : {}),
        ...(parsedGroups.length > 0 ? { groups: parsedGroups } : {}),
        ...(Object.keys(customVars).length > 0 ? { custom_variables: customVars } : {}),
      });
    });

    return { validRecords: valid, invalidCount: invalid };
  }, [contactIdCol, phoneCol, tagsCol, groupsCol, headers, rows]);

  function tTrim(str: string): string {
    return str.trim();
  }

  // Handle Import Submit
  const handleStartImport = async () => {
    if (validRecords.length === 0) {
      toastError('No valid contacts to import. Please check your column mappings.', 'No Valid Contacts');
      return;
    }

    setIsSubmitting(true);
    setStep('importing');
    setImportError(null);

    try {
      const res = await bulkImportWhatsAppContacts(validRecords);
      setImportResults(res);
      setStep('results');

      if (res.success) {
        toastSuccess(
          res.message || `Successfully processed ${validRecords.length} contacts!`,
          'Import Complete'
        );
        onSuccess();
      } else {
        setImportError(res.error || 'Failed to complete bulk import.');
      }
    } catch (err: any) {
      setImportError(err?.message || 'An unexpected error occurred during import.');
      setStep('results');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Bulk Import WhatsApp Contacts
              </h3>
              <p className="text-xs text-slate-500">
                Upload CSV, map contact ID and phone numbers, and import contacts to the backend
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/30 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  Click to select CSV file, or drag and drop
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Must be formatted as a standard comma-separated (.csv) file containing contact ID and WhatsApp numbers.
                </p>
                <span className="mt-4 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs group-hover:border-emerald-300">
                  Browse Files
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Sample Download CTA */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Need a format template?</p>
                    <p className="text-[11px] text-slate-500">
                      Download our sample CSV with pre-configured headers (ID, phone, tags, custom vars).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
                >
                  Download Sample CSV
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: MAPPING & PREVIEW */}
          {step === 'mapping' && (
            <div className="space-y-6">
              {/* File Info Bar */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-800">{file?.name}</span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-slate-500">{rows.length} total rows parsed</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="text-xs text-indigo-600 hover:underline font-semibold"
                >
                  Choose another file
                </button>
              </div>

              {/* Column Mapping Selectors */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Map CSV Columns to Contact Attributes
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Master Contact ID */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Master Contact ID Column <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={contactIdCol}
                      onChange={(e) => setContactIdCol(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* WhatsApp Number */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      WhatsApp Number Column <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={phoneCol}
                      onChange={(e) => setPhoneCol(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tags Column (Optional)
                    </label>
                    <select
                      value={tagsCol}
                      onChange={(e) => setTagsCol(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- None (Don&apos;t map tags) --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Groups */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Groups Column (Optional)
                    </label>
                    <select
                      value={groupsCol}
                      onChange={(e) => setGroupsCol(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- None (Don&apos;t map groups) --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  Remaining unmapped columns will be stored as dynamic custom variables for template placeholders.
                </p>
              </div>

              {/* Validation Summary Bar */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{validRecords.length} Ready to Import</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>{invalidCount} Skipped (Missing ID/Phone)</span>
                  </div>
                )}
              </div>

              {/* Preview Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Preview (First 5 Rows)
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Contact ID</th>
                          <th className="py-2.5 px-3">WhatsApp Number</th>
                          <th className="py-2.5 px-3">Tags</th>
                          <th className="py-2.5 px-3">Groups</th>
                          <th className="py-2.5 px-3">Custom Variables</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {validRecords.slice(0, 5).map((rec, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                            <td className="py-2 px-3 font-bold text-slate-800">
                              {rec.contact_id}
                            </td>
                            <td className="py-2 px-3 text-emerald-700">
                              {rec.whatsapp_number}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {rec.tags?.join(', ') || '—'}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {rec.groups?.join(', ') || '—'}
                            </td>
                            <td className="py-2 px-3 text-slate-500 truncate max-w-xs">
                              {rec.custom_variables ? JSON.stringify(rec.custom_variables) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: IMPORTING */}
          {step === 'importing' && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Submitting {validRecords.length} Contacts to Backend...
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Validating phone numbers, checking existing records, and bulk inserting.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: RESULTS */}
          {step === 'results' && (
            <div className="space-y-6">
              {importError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold">Import Error Encountered</h5>
                    <p className="mt-0.5 leading-relaxed">{importError}</p>
                  </div>
                </div>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                  <span className="text-xl font-bold text-slate-800 mt-1 block">
                    {validRecords.length}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Imported</span>
                  <span className="text-xl font-bold text-emerald-800 mt-1 block">
                    {importResults?.imported ??
                      importResults?.data?.imported ??
                      importResults?.data?.successful ??
                      importResults?.data?.success_count ??
                      (importResults?.success ? validRecords.length : 0)}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-amber-600 block">Duplicates</span>
                  <span className="text-xl font-bold text-amber-800 mt-1 block">
                    {Array.isArray(importResults?.duplicates)
                      ? importResults.duplicates.length
                      : importResults?.data?.duplicates ?? importResults?.data?.duplicate_count ?? 0}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-rose-600 block">Errors / Failed</span>
                  <span className="text-xl font-bold text-rose-800 mt-1 block">
                    {Array.isArray(importResults?.errors)
                      ? importResults.errors.length
                      : importResults?.data?.errors?.length ??
                        importResults?.data?.failed ??
                        importResults?.data?.failed_count ??
                        0}
                  </span>
                </div>
              </div>

              {/* Detailed Error breakdown if provided */}
              {Array.isArray(importResults?.data?.errors) && importResults.data.errors.length > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-white p-4 space-y-2">
                  <h5 className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                    Row-Level Failure Report
                  </h5>
                  <div className="overflow-x-auto max-h-40">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-rose-50 text-rose-800 text-[10px]">
                        <tr>
                          <th className="p-2">Row</th>
                          <th className="p-2">Contact ID</th>
                          <th className="p-2">Phone</th>
                          <th className="p-2">Failure Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 text-[11px]">
                        {importResults.data.errors.map((errItem, idx) => (
                          <tr key={idx}>
                            <td className="p-2 text-slate-500">{errItem.row ?? idx + 1}</td>
                            <td className="p-2 font-bold">{errItem.contact_id ?? '—'}</td>
                            <td className="p-2">{errItem.phone ?? errItem.whatsapp_number ?? '—'}</td>
                            <td className="p-2 text-rose-700">{errItem.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
          <div>
            {step === 'mapping' && (
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step !== 'results' ? (
              <>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                {step === 'mapping' && (
                  <button
                    type="button"
                    disabled={validRecords.length === 0 || isSubmitting}
                    onClick={handleStartImport}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
                  >
                    <span>Import {validRecords.length} Contacts</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Finish &amp; View Contacts
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

