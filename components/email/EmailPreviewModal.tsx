'use client';

import React, { useState } from 'react';
import { X, Eye, FileText, Code, CheckCircle, AlertCircle, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { EmailPreviewResponse } from '@/types/email';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  previewData: EmailPreviewResponse['data'] | null;
  error?: string | null;
  onRefresh?: () => void;
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  isLoading,
  previewData,
  error,
  onRefresh,
}: EmailPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'html' | 'text'>('html');
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? 'p-0' : 'p-4'} bg-slate-900/50 backdrop-blur-sm animate-in fade-in`}>
      <div className={`bg-white ${isFullscreen ? 'rounded-none w-screen h-screen max-w-none' : 'rounded-3xl max-w-5xl w-full h-[88vh]'} shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Email Live Preview</h3>
              <p className="text-xs text-slate-500">
                Rendered via server preview API with interpolated recipient variables
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors disabled:opacity-50"
                title="Refresh preview"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-blue-600" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Subject & Metadata bar */}
        {previewData && (
          <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 max-w-xl">
              <span className="font-semibold text-slate-400">Subject:</span>
              <span className="font-bold text-slate-800 truncate">{previewData.subject || '(No Subject)'}</span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('html')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                  activeTab === 'html'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Rendered HTML</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                  activeTab === 'text'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Plain Text</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 bg-slate-100/60 p-4 overflow-auto">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Generating email preview...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">Failed to Load Preview</h4>
              <p className="text-xs text-rose-600 max-w-md">{error}</p>
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  Try Again
                </button>
              )}
            </div>
          ) : previewData ? (
            <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
              {activeTab === 'html' ? (
                <iframe
                  title="Email Preview"
                  srcDoc={previewData.html || '<p class="text-slate-400 p-4">No HTML body provided.</p>'}
                  className="w-full h-full border-none bg-white"
                  sandbox="allow-same-origin"
                />
              ) : (
                <pre className="p-6 text-xs font-mono text-slate-800 whitespace-pre-wrap overflow-auto h-full">
                  {previewData.text || '(No plain text generated)'}
                </pre>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No preview data available.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="text-slate-400">
            {previewData?.attachments && previewData.attachments.length > 0 && (
              <span>Attachments: {previewData.attachments.length} attached</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

