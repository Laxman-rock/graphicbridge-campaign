'use client';

import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  Download,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Mail,
  MessageSquare,
  FileText,
  Info,
} from 'lucide-react';
import { CampaignType, CsvImportResult } from '@/types/campaign';
import { parseAndValidateCsv, evaluateCsvRecords, formatFileSize } from '@/lib/csv-validation';
import { useToast } from '@/components/ui/Toast';
import ImportSummary from './ImportSummary';
import CsvPreviewTable from './CsvPreviewTable';
import ColumnSelector from '@/components/email/ColumnSelector';

interface CsvImporterProps {
  campaignType: CampaignType;
  onProceedToWorkflow?: (result: CsvImportResult) => void;
  hideHeaderNavigation?: boolean;
}

export default function CsvImporter({
  campaignType,
  onProceedToWorkflow,
  hideHeaderNavigation = false,
}: CsvImporterProps) {
  const isEmail = campaignType === 'email';
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Maximum allowed file size: 15MB
  const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

  const handleProcessFile = async (file: File) => {
    setGeneralError(null);

    // Validation 1: Extension & mime check
    const isCsvExtension = file.name.toLowerCase().endsWith('.csv');
    if (!isCsvExtension) {
      const err = 'Invalid file format. Please upload a standard comma-separated (.csv) file.';
      setGeneralError(err);
      toastError(err, 'Invalid File Type');
      return;
    }

    // Validation 2: File size
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
      const result = await parseAndValidateCsv(file, campaignType);

      if (result.summary.totalRows === 0) {
        setGeneralError('The uploaded CSV file contains no data rows.');
        toastError('No contact rows were found in this file.', 'Empty Dataset');
        setImportResult(null);
      } else if (!result.summary.columnDetected) {
        const requiredColMsg = isEmail
          ? 'Please select which column contains email addresses below to proceed.'
          : 'Please select which column contains phone numbers below to proceed.';
        toastInfo(requiredColMsg, 'Select Column');
        setImportResult(result);
      } else {
        setImportResult(result);
        toastSuccess(
          `Parsed ${result.summary.totalRows} contacts: ${result.summary.validCount} valid, ${result.summary.invalidCount} invalid, ${result.summary.duplicateCount} duplicates.`,
          'CSV Processed'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse CSV file.';
      setGeneralError(msg);
      toastError(msg, 'Parse Error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTargetColChange = (col: string | null) => {
    if (!importResult || !importResult.rawRows) return;
    const evaluated = evaluateCsvRecords(
      importResult.rawRows,
      importResult.headers,
      campaignType,
      col,
      importResult.selectedNameCol
    );
    setImportResult({
      ...importResult,
      selectedTargetCol: col,
      records: evaluated.records,
      summary: evaluated.summary,
      errorReportCsv: evaluated.errorReportCsv,
    });
    if (col) {
      toastSuccess(`Validated contacts using column "${col}".`, 'Column Selected');
      setGeneralError(null);
    }
  };

  const handleNameColChange = (col: string | null) => {
    if (!importResult || !importResult.rawRows) return;
    const evaluated = evaluateCsvRecords(
      importResult.rawRows,
      importResult.headers,
      campaignType,
      importResult.selectedTargetCol || null,
      col
    );
    setImportResult({
      ...importResult,
      selectedNameCol: col,
      records: evaluated.records,
      summary: evaluated.summary,
      errorReportCsv: evaluated.errorReportCsv,
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        handleProcessFile(file);
      }
    },
    [campaignType]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleProcessFile(file);
    }
  };

  const handleRemoveFile = () => {
    setImportResult(null);
    setGeneralError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toastInfo('Imported file removed.', 'File Cleared');
  };

  const handleDownloadErrorReport = () => {
    if (!importResult?.errorReportCsv) return;

    const blob = new Blob([importResult.errorReportCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${isEmail ? 'email' : 'whatsapp'}_validation_errors_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toastSuccess('Error report CSV downloaded.', 'Report Downloaded');
  };

  const handleDownloadSampleCsv = () => {
    let sampleContent = '';
    let filename = '';

    if (isEmail) {
      sampleContent =
        'name,email,company\nJohn Doe,john.doe@example.com,Acme Corp\nJane Smith,jane.smith@domain.org,Globex\nInvalid Guy,not-an-email,Test Co\nJohn Doe,john.doe@example.com,Acme Duplicate\nSarah Connor,sarah@resistance.ai,Cyberdyne';
      filename = 'sample_email_contacts.csv';
    } else {
      sampleContent =
        'name,phone_number,location\nAlice Johnson,+14155552671,San Francisco\nBob Kumar,+919876543210,Mumbai\nMalformed Number,abc12345,Nowhere\nAlice Johnson,+14155552671,San Francisco Duplicate\nCarlos Ramos,+34911234567,Madrid';
      filename = 'sample_whatsapp_contacts.csv';
    }

    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toastSuccess(`Sample ${isEmail ? 'Email' : 'WhatsApp'} CSV downloaded.`, 'Sample Ready');
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      {!hideHeaderNavigation && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isEmail ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {isEmail ? <Mail className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {isEmail ? 'Email Campaign — Import Contacts' : 'WhatsApp Campaign — Import Contacts'}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEmail
                    ? 'Import, sanitize, and validate your audience email contact list.'
                    : 'Import, verify E.164 formats, and prepare your WhatsApp audience list.'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick sample download helper */}
          <button
            onClick={handleDownloadSampleCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition-all self-start sm:self-auto"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            <span>Download Sample CSV</span>
          </button>
        </div>
      )}

      {/* Main Upload Card */}
      {!importResult ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative p-10 sm:p-14 rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center bg-white shadow-sm ${
            isDragging
              ? isEmail
                ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                : 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
              : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            onChange={handleFileInputChange}
            className="hidden"
            id="csv-file-input"
          />

          <div
            className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-sm ${
              isEmail ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {isProcessing ? (
              <RefreshCw className="w-10 h-10 animate-spin" />
            ) : (
              <UploadCloud className="w-10 h-10" />
            )}
          </div>

          <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
            {isEmail ? 'Import Your Email Contacts' : 'Import Your WhatsApp Contacts'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
            Drag and drop your CSV file here or browse files from your computer. Supports RFC-5322 email syntax and international E.164 phone numbers.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <label
              htmlFor="csv-file-input"
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm shadow-md cursor-pointer transition-all ${
                isEmail
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Browse CSV File</span>
            </label>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <span>• Supported format: .CSV</span>
            <span>• Max file size: 15MB</span>
            <span>• Auto header detection</span>
            <span>• Client-side privacy parsed</span>
          </div>

          {generalError && (
            <div className="mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 max-w-lg">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{generalError}</span>
            </div>
          )}
        </div>
      ) : (
        /* File Active / Parsed View */
        <div className="space-y-6">
          {/* File Meta Pill Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isEmail ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm truncate">
                    {importResult.fileName}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {formatFileSize(importResult.fileSizeBytes)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Headers detected: {importResult.headers.join(', ')}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={handleFileInputChange}
                className="hidden"
                id="csv-replace-input"
              />
              <label
                htmlFor="csv-replace-input"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Replace File</span>
              </label>

              <button
                onClick={handleRemoveFile}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Remove</span>
              </button>
            </div>
          </div>

          {generalError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Column Selection Mapping */}
          {importResult && (
            <ColumnSelector
              headers={importResult.headers}
              rawRows={importResult.rawRows}
              campaignType={campaignType}
              selectedTargetCol={importResult.selectedTargetCol || null}
              selectedNameCol={importResult.selectedNameCol || null}
              onTargetColChange={handleTargetColChange}
              onNameColChange={handleNameColChange}
            />
          )}

          {/* Import Summary Cards */}
          <ImportSummary summary={importResult.summary} campaignType={campaignType} />

          {/* Contacts Preview Table */}
          {importResult.records.length > 0 && (
            <CsvPreviewTable
              records={importResult.records}
              campaignType={campaignType}
              headers={importResult.headers}
            />
          )}

          {/* Bottom Action Bar */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleRemoveFile}
                className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-center"
              >
                Choose Another File
              </button>

              {/* Download Error Report button when errors exist */}
              {importResult.summary.hasErrors && importResult.errorReportCsv && (
                <button
                  onClick={handleDownloadErrorReport}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  <Download className="w-4 h-4 text-rose-600" />
                  <span>Download Error Report ({importResult.summary.invalidCount + importResult.summary.duplicateCount})</span>
                </button>
              )}
            </div>

            {/* Continue Button */}
            <button
              onClick={() => {
                if (onProceedToWorkflow) {
                  onProceedToWorkflow(importResult);
                } else {
                  setShowWorkflowModal(true);
                }
              }}
              disabled={importResult.summary.validCount === 0 || !importResult.summary.columnDetected}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                isEmail
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              }`}
            >
              <span>Continue Campaign Workflow</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Campaign Workflow Confirmation Modal */}
      {showWorkflowModal && importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 sm:p-8 space-y-5">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-inner ${
                  isEmail ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  Contacts Ready for Campaign
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {importResult.summary.validCount} valid {isEmail ? 'email' : 'WhatsApp'} contacts successfully prepared.
                </p>
              </div>

              {/* Status Note */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2 text-xs text-indigo-900">
                <div className="flex items-center gap-2 font-semibold text-indigo-800">
                  <Info className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span>Backend Integration Notice</span>
                </div>
                <p className="leading-relaxed text-slate-600">
                  Your contact list has been verified and sanitized locally. No contacts have been saved or uploaded to the server because a dedicated contact-save endpoint has not been published on the staging API.
                </p>
                <p className="leading-relaxed text-slate-600">
                  Actual email or WhatsApp message dispatch requires an authorized backend campaign delivery endpoint.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400">Campaign Channel:</span>
                  <p className="font-bold text-slate-800 capitalize">{campaignType}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400">Target Contacts:</span>
                  <p className="font-bold text-emerald-600">{importResult.summary.validCount} recipients</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowWorkflowModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Return to Preview
                </button>
                <button
                  onClick={() => {
                    setShowWorkflowModal(false);
                    toastSuccess(
                      `Campaign workflow initialized with ${importResult.summary.validCount} verified recipients. Ready for message template setup.`,
                      'Workflow Ready'
                    );
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl text-white text-xs font-semibold shadow-md transition-all ${
                    isEmail
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  }`}
                >
                  Confirm & Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

