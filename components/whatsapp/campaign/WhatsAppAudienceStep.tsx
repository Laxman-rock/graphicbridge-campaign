'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Phone,
  Users,
  Trash2,
  RefreshCw,
  Download,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Copy,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileText,
  X,
  Plus,
} from 'lucide-react';
import { CsvImportResult, WhatsAppContactRecord } from '@/types/campaign';
import { UnifiedWhatsAppRecipient, WhatsAppRecipientSource } from '@/types/whatsapp';
import { parseAndValidateCsv, evaluateCsvRecords, formatFileSize } from '@/lib/csv-validation';
import { normalizePhoneNumber } from '@/lib/whatsapp-api';
import { useToast } from '@/components/ui/Toast';
import ColumnSelector from '@/components/email/ColumnSelector';
import WhatsAppManualNumbersModal from './WhatsAppManualNumbersModal';
import WhatsAppContactsPickerModal from './WhatsAppContactsPickerModal';

interface WhatsAppAudienceStepProps {
  unifiedRecipients: UnifiedWhatsAppRecipient[];
  onRecipientsChange: (recipients: UnifiedWhatsAppRecipient[]) => void;
  importResult: CsvImportResult | null;
  onImportResultChange: (res: CsvImportResult | null) => void;
  onProceed: () => void;
}

export default function WhatsAppAudienceStep({
  unifiedRecipients,
  onRecipientsChange,
  importResult,
  onImportResultChange,
  onProceed,
}: WhatsAppAudienceStepProps) {
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop & Processing state
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Modals state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Audience table search & filter & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Maximum allowed file size: 15MB
  const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

  // Set of all normalized phone numbers currently in audience
  const existingPhones = useMemo(() => {
    const set = new Set<string>();
    unifiedRecipients.forEach((r) => {
      if (r.phone) {
        set.add(r.phone);
        set.add(r.phone.replace(/^\+/, ''));
        const norm = normalizePhoneNumber(r.phone);
        if (norm) {
          set.add(norm);
          set.add(norm.replace(/^\+/, ''));
        }
      }
      if (r.formattedPhone) {
        set.add(r.formattedPhone);
        set.add(r.formattedPhone.replace(/^\+/, ''));
      }
    });
    return set;
  }, [unifiedRecipients]);

  // Breakdown counts by source
  const sourceStats = useMemo(() => {
    const csvCount = unifiedRecipients.filter((r) => r.source === 'csv').length;
    const manualCount = unifiedRecipients.filter((r) => r.source === 'manual').length;
    const contactsCount = unifiedRecipients.filter((r) => r.source === 'whatsapp_contacts').length;
    return { csvCount, manualCount, contactsCount };
  }, [unifiedRecipients]);

  // Manual recipients list
  const manualRecipients = useMemo(() => {
    return unifiedRecipients.filter((r) => r.source === 'manual');
  }, [unifiedRecipients]);

  // Handle CSV file upload
  const handleProcessCsvFile = async (file: File) => {
    setGeneralError(null);

    const isCsvExtension = file.name.toLowerCase().endsWith('.csv');
    if (!isCsvExtension) {
      const err = 'Invalid file format. Please upload a standard comma-separated (.csv) file.';
      setGeneralError(err);
      toastError(err, 'Invalid File Type');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const err = `File size (${formatFileSize(file.size)}) exceeds the maximum allowed limit of 15MB.`;
      setGeneralError(err);
      toastError(err, 'File Too Large');
      return;
    }

    if (file.size === 0) {
      const err = 'The uploaded CSV file is empty. Please select a file with contact data.';
      setGeneralError(err);
      toastError(err, 'Empty File');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await parseAndValidateCsv(file, 'whatsapp', undefined, null);

      if (result.summary.totalRows === 0) {
        setGeneralError('The uploaded CSV file contains no data rows.');
        toastError('No contact rows were found in this file.', 'Empty Dataset');
        return;
      }

      onImportResultChange(result);

      // Convert valid CSV records into UnifiedWhatsAppRecipient objects
      const validRecords = result.records.filter((r) => r.status === 'valid') as WhatsAppContactRecord[];
      const newRecipients: UnifiedWhatsAppRecipient[] = [];
      let duplicateSkipCount = 0;

      const seen = new Set(existingPhones);

      validRecords.forEach((rec) => {
        const normalized = normalizePhoneNumber(rec.formattedPhone || rec.phone);
        if (seen.has(normalized)) {
          duplicateSkipCount++;
          return;
        }
        seen.add(normalized);

        newRecipients.push({
          id: `csv_${rec.rowIndex}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          phone: normalized,
          formattedPhone: rec.formattedPhone || rec.phone,
          name: rec.name,
          source: 'csv',
          status: 'valid',
          whatsapp_opt_in: true,
          raw: rec.raw,
        });
      });

      const updated = [...unifiedRecipients, ...newRecipients];
      onRecipientsChange(updated);

      toastSuccess(
        `Loaded ${result.fileName}: Added ${newRecipients.length} valid contacts.${
          duplicateSkipCount > 0 ? ` (${duplicateSkipCount} duplicates omitted)` : ''
        }`,
        'CSV Processed'
      );
    } catch {
      const err = 'An unexpected error occurred while parsing the CSV file.';
      setGeneralError(err);
      toastError(err, 'Parsing Failed');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessCsvFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessCsvFile(e.target.files[0]);
    }
  };

  // Add single recipient from Manual entry
  const handleAddManualRecipient = (newRecipient: UnifiedWhatsAppRecipient) => {
    const updated = [...unifiedRecipients, newRecipient];
    onRecipientsChange(updated);
  };

  // Add recipients from Manual entry (batch)
  const handleAddManualRecipients = (newRecipients: UnifiedWhatsAppRecipient[]) => {
    const updated = [...unifiedRecipients, ...newRecipients];
    onRecipientsChange(updated);
  };

  // Add recipients from WhatsApp Contacts picker
  const handleAddContactsRecipients = (newRecipients: UnifiedWhatsAppRecipient[]) => {
    const updated = [...unifiedRecipients, ...newRecipients];
    onRecipientsChange(updated);
  };

  // Remove single recipient
  const handleRemoveRecipient = (id: string) => {
    const updated = unifiedRecipients.filter((r) => r.id !== id);
    onRecipientsChange(updated);
    toastInfo('Recipient removed from audience.', 'Recipient Removed');
  };

  // Clear all audience
  const handleClearAll = () => {
    onRecipientsChange([]);
    onImportResultChange(null);
    setShowClearConfirm(false);
    toastInfo('Audience list has been cleared.', 'Audience Cleared');
  };

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const sampleContent =
      'name,phone_number,location\n' +
      'Alice Johnson,+14155552671,San Francisco\n' +
      'Bob Kumar,+919876543210,Mumbai\n' +
      'Carlos Ramos,+34911234567,Madrid\n';

    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_whatsapp_contacts.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toastSuccess('Sample WhatsApp CSV downloaded.', 'Sample Ready');
  };

  // Filtered recipients
  const filteredRecipients = useMemo(() => {
    return unifiedRecipients.filter((rec) => {
      if (sourceFilter !== 'all' && rec.source !== sourceFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPhone = rec.phone.toLowerCase().includes(q);
        const matchesName = rec.name?.toLowerCase().includes(q) ?? false;
        return matchesPhone || matchesName;
      }
      return true;
    });
  }, [unifiedRecipients, sourceFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRecipients.length / pageSize));
  const paginatedRecipients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecipients.slice(start, start + pageSize);
  }, [filteredRecipients, currentPage, pageSize]);

  // Handle Target & Name Column Change from CSV
  const handleTargetColChange = (targetCol: string | null) => {
    if (!importResult) return;
    const evaluated = evaluateCsvRecords(
      importResult.rawRows || [],
      importResult.headers,
      'whatsapp',
      targetCol,
      importResult.selectedNameCol || null
    );
    const updatedImport: CsvImportResult = {
      ...importResult,
      selectedTargetCol: targetCol || undefined,
      records: evaluated.records,
      summary: evaluated.summary,
      errorReportCsv: evaluated.errorReportCsv,
    };
    onImportResultChange(updatedImport);

    // Re-sync CSV records into unified list
    const nonCsvRecipients = unifiedRecipients.filter((r) => r.source !== 'csv');
    const validRecords = evaluated.records.filter((r) => r.status === 'valid') as WhatsAppContactRecord[];
    const newCsvRecipients: UnifiedWhatsAppRecipient[] = validRecords.map((rec) => ({
      id: `csv_${rec.rowIndex}_${Date.now()}`,
      phone: normalizePhoneNumber(rec.formattedPhone || rec.phone),
      formattedPhone: rec.formattedPhone || rec.phone,
      name: rec.name,
      source: 'csv',
      status: 'valid',
      whatsapp_opt_in: true,
      raw: rec.raw,
    }));

    onRecipientsChange([...nonCsvRecipients, ...newCsvRecipients]);
  };

  const handleNameColChange = (nameCol: string | null) => {
    if (!importResult) return;
    const evaluated = evaluateCsvRecords(
      importResult.rawRows || [],
      importResult.headers,
      'whatsapp',
      importResult.selectedTargetCol || null,
      nameCol
    );
    const updatedImport: CsvImportResult = {
      ...importResult,
      selectedNameCol: nameCol || undefined,
      records: evaluated.records,
      summary: evaluated.summary,
      errorReportCsv: evaluated.errorReportCsv,
    };
    onImportResultChange(updatedImport);

    // Re-sync CSV records into unified list
    const nonCsvRecipients = unifiedRecipients.filter((r) => r.source !== 'csv');
    const validRecords = evaluated.records.filter((r) => r.status === 'valid') as WhatsAppContactRecord[];
    const newCsvRecipients: UnifiedWhatsAppRecipient[] = validRecords.map((rec) => ({
      id: `csv_${rec.rowIndex}_${Date.now()}`,
      phone: normalizePhoneNumber(rec.formattedPhone || rec.phone),
      formattedPhone: rec.formattedPhone || rec.phone,
      name: rec.name,
      source: 'csv',
      status: 'valid',
      whatsapp_opt_in: true,
      raw: rec.raw,
    }));

    onRecipientsChange([...nonCsvRecipients, ...newCsvRecipients]);
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,application/vnd.ms-excel"
        onChange={handleFileInputChange}
        className="hidden"
        id="whatsapp-csv-file-input"
      />

      {generalError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{generalError}</div>
        </div>
      )}

      {/* If No Recipients Yet: Show Drag-and-Drop Area */}
      {unifiedRecipients.length === 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-10 sm:p-14 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center bg-white shadow-sm ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
              : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
            {isProcessing ? (
              <RefreshCw className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>
          <h4 className="text-base font-bold text-slate-900 tracking-tight mb-1">
            No Recipients Selected Yet
          </h4>
          <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
            Drag and drop your contact CSV file above, click <strong>Browse CSV File</strong>, enter mobile numbers manually, or pick from your saved WhatsApp Contacts directory.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Browse CSV File</span>
            </button>
            <button
              type="button"
              onClick={() => setIsManualModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs transition-all flex items-center gap-2"
            >
              <Phone className="w-4 h-4 text-slate-500" />
              <span>Enter Mobile Numbers</span>
            </button>
            <button
              type="button"
              onClick={() => setIsContactsModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs transition-all flex items-center gap-2"
            >
              <Users className="w-4 h-4 text-slate-500" />
              <span>Import WhatsApp Contacts</span>
            </button>
          </div>
        </div>
      )}

      {/* If Recipients Exist: Show Audience Dashboard */}
      {unifiedRecipients.length > 0 && (
        <div className="space-y-6">
          {/* Audience Overview Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl font-bold text-slate-900 tracking-tight">
                    {unifiedRecipients.length}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">
                    Total Unique WhatsApp Recipients
                  </span>
                </div>

                {/* Source chips */}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {sourceStats.csvCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      <FileSpreadsheet className="w-3 h-3" />
                      {sourceStats.csvCount} from CSV
                    </span>
                  )}
                  {sourceStats.manualCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                      <Phone className="w-3 h-3" />
                      {sourceStats.manualCount} Manual
                    </span>
                  )}
                  {sourceStats.contactsCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                      <Users className="w-3 h-3" />
                      {sourceStats.contactsCount} from Contacts
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear All</span>
              </button>

              <button
                type="button"
                onClick={onProceed}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
              >
                <span>Continue to Step 2</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* If CSV was imported, display Column Selector */}
          {importResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-800">{importResult.fileName}</span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-slate-500 font-mono">
                    {formatFileSize(importResult.fileSizeBytes)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Replace CSV File
                </button>
              </div>

              <ColumnSelector
                headers={importResult.headers}
                rawRows={importResult.rawRows}
                campaignType="whatsapp"
                selectedTargetCol={importResult.selectedTargetCol || null}
                selectedNameCol={importResult.selectedNameCol || null}
                onTargetColChange={handleTargetColChange}
                onNameColChange={handleNameColChange}
                fileName={importResult.fileName}
                totalRows={importResult.summary.totalRows}
                detectedCol={importResult.summary.columnDetected}
              />
            </div>
          )}

          {/* Unified Recipients Table */}
          <div className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden space-y-3">
            {/* Table Filter Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search audience by phone or name..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="all">All Sources</option>
                  <option value="csv">CSV Only</option>
                  <option value="manual">Manual Only</option>
                  <option value="whatsapp_contacts">WhatsApp Contacts Only</option>
                </select>
              </div>

              <span className="text-xs text-slate-500 self-end sm:self-auto">
                Showing {filteredRecipients.length} of {unifiedRecipients.length} recipients
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">WhatsApp Number</th>
                    <th className="py-2.5 px-4">Recipient Name</th>
                    <th className="py-2.5 px-4">Source</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {paginatedRecipients.map((rec, idx) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 text-slate-400">{rowNumber}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {rec.phone}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-slate-700">
                          {rec.name || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-sans">
                          {rec.source === 'csv' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200">
                              <FileSpreadsheet className="w-3 h-3" />
                              CSV
                            </span>
                          )}
                          {rec.source === 'manual' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                              <Phone className="w-3 h-3" />
                              Manual
                            </span>
                          )}
                          {rec.source === 'whatsapp_contacts' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                              <Users className="w-3 h-3" />
                              Contacts
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-sans">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" />
                            Valid
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(rec.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Remove recipient"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50/50">
                <span className="text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              <strong className="text-slate-900">{unifiedRecipients.length} verified recipient(s)</strong> ready for campaign messaging.
            </div>

            <button
              type="button"
              onClick={onProceed}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
            >
              <span>Continue to Message Setup</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Manual Numbers Modal */}
      <WhatsAppManualNumbersModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        existingPhones={existingPhones}
        manualRecipients={manualRecipients}
        totalAudienceCount={unifiedRecipients.length}
        onAddRecipient={handleAddManualRecipient}
        onRemoveRecipient={handleRemoveRecipient}
        onAddRecipients={handleAddManualRecipients}
      />

      {/* WhatsApp Contacts Picker Modal */}
      <WhatsAppContactsPickerModal
        isOpen={isContactsModalOpen}
        onClose={() => setIsContactsModalOpen(false)}
        existingPhones={existingPhones}
        onImportSelected={handleAddContactsRecipients}
      />

      {/* Clear All Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">Clear Campaign Audience</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to remove all {unifiedRecipients.length} recipients from this campaign audience?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
