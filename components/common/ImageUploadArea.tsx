'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileImage,
  CheckCircle2,
} from 'lucide-react';
import { uploadEmailImage } from '@/lib/email-api';
import {
  optimizeImageForEmail,
  formatFileSize,
  isLocalOrDataUrl,
  isPublicHttpsUrl,
  normalizeImageUrl,
  dataUrlToFile,
} from '@/lib/image-utils';
import { useToast } from '@/components/ui/Toast';

interface ImageUploadAreaProps {
  value?: string;
  filename?: string;
  onChange: (url: string, filename?: string) => void;
  onRemove?: () => void;
  label?: string;
  description?: string;
  aspectRatioHint?: string;
  className?: string;
  previewHeight?: string;
  maxSizeMB?: number;
}

export default function ImageUploadArea({
  value,
  filename: initialFilename,
  onChange,
  onRemove,
  label = 'Upload Image',
  description = 'Supports JPG, JPEG, PNG, and WEBP (up to 5MB)',
  aspectRatioHint,
  className = '',
  previewHeight = 'h-48',
  maxSizeMB = 5,
}: ImageUploadAreaProps) {
  const { error: toastError, success: toastSuccess } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>(
    initialFilename || (value ? value.split('/').pop() || 'uploaded-image.png' : '')
  );
  const [fileSizeStr, setFileSizeStr] = useState<string | null>(null);

  const MAX_SIZE_BYTES = maxSizeMB * 1024 * 1024;
  const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  const validateFile = (file: File): string | null => {
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const isValidType =
      ALLOWED_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(extension);

    if (!isValidType) {
      return `Unsupported format "${file.type || extension}". Please upload a JPG, JPEG, PNG, or WEBP image.`;
    }

    if (file.size > MAX_SIZE_BYTES) {
      return `File size (${formatFileSize(file.size)}) exceeds the maximum allowed ${maxSizeMB}MB.`;
    }

    return null;
  };

  const processAndUploadFile = async (file: File) => {
    setErrorMessage(null);

    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      toastError(validationError, 'Validation Error');
      return;
    }

    setIsUploading(true);
    setCurrentFilename(file.name);
    setFileSizeStr(formatFileSize(file.size));

    try {
      // 1. Optimize image proportionally for standard email clients & show immediate preview
      const { file: optimizedFile, dataUrl: optimizedDataUrl } = await optimizeImageForEmail(file);
      setLocalPreview(optimizedDataUrl);

      // 2. Upload to backend API to obtain a stable, public HTTPS URL
      const res = await uploadEmailImage(optimizedFile);
      const candidateUrl = res.data?.url || (res.data?.urls && res.data.urls[0]);

      if (res.success && candidateUrl) {
        const publicUrl = normalizeImageUrl(candidateUrl);
        setLocalPreview(null);
        onChange(publicUrl, file.name);
        setErrorMessage(null);
        toastSuccess(`Image "${file.name}" uploaded and hosted successfully on public HTTPS.`, 'Upload Complete');
        return;
      }

      // If backend upload failed, display actionable error and let user retry hosting
      const failureReason = res.error || 'Server did not return a valid hosted image URL.';
      setErrorMessage(failureReason);
      toastError(
        `Failed to host image on server: ${failureReason}. Email clients cannot display local images. Click "Host on Server" to retry hosting before saving.`,
        'Hosting Failed'
      );
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Upload connection failed';
      setErrorMessage(errText);
      toastError(
        `Failed to upload image: ${errText}. Please check network connection and retry.`,
        'Upload Error'
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Re-attempt uploading a local or un-hosted image
  const handleRetryUpload = async () => {
    const rawData = localPreview || value;
    if (!rawData || !isLocalOrDataUrl(rawData)) return;

    setIsUploading(true);
    setErrorMessage(null);
    try {
      const file = dataUrlToFile(rawData, currentFilename || 'image.jpg');
      if (!file) {
        toastError('Unable to convert local image data for upload. Please select the file again.', 'Retry Error');
        setIsUploading(false);
        return;
      }

      const res = await uploadEmailImage(file);
      const candidateUrl = res.data?.url || (res.data?.urls && res.data.urls[0]);
      if (res.success && candidateUrl) {
        const publicUrl = normalizeImageUrl(candidateUrl);
        setLocalPreview(null);
        onChange(publicUrl, currentFilename);
        toastSuccess('Image hosted successfully on public HTTPS!', 'Upload Succeeded');
      } else {
        const msg = res.error || 'Failed to host image on server.';
        setErrorMessage(msg);
        toastError(msg, 'Upload Failed');
      }
    } catch {
      toastError('Network error while retrying image upload.', 'Upload Error');
    } finally {
      setIsUploading(false);
    }
  };

  // Drag-and-drop handlers
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

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processAndUploadFile(files[0]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processAndUploadFile(files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalPreview(null);
    setCurrentFilename('');
    setFileSizeStr(null);
    setErrorMessage(null);
    if (onRemove) {
      onRemove();
    } else {
      onChange('', '');
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const displayValue = localPreview || value;
  const isLocal = isLocalOrDataUrl(displayValue);
  const isHosted = isPublicHttpsUrl(displayValue);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label and Info */}
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
            <span>{label}</span>
          </label>
          {aspectRatioHint && (
            <span className="text-[10px] text-slate-400 font-medium">
              {aspectRatioHint}
            </span>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Box / Image Preview */}
      {displayValue ? (
        /* Image Preview State */
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs space-y-3 transition-all hover:border-indigo-300">
          <div
            className={`w-full ${previewHeight} rounded-xl bg-slate-50 border border-slate-100 overflow-hidden relative group flex items-center justify-center`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayValue}
              alt={currentFilename || 'Campaign Banner'}
              className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />

            {/* Hover Actions Overlay */}
            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleBrowseClick}
                disabled={isUploading}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-800 text-xs font-semibold shadow-md hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUploading ? 'animate-spin' : ''}`} />
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold shadow-md hover:bg-rose-700 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>

          {/* Hosting Status Indicator */}
          {isLocal && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="truncate">
                  Un-hosted local image. Must be hosted on server to show in received emails.
                </span>
              </div>
              <button
                type="button"
                onClick={handleRetryUpload}
                disabled={isUploading}
                className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors flex-shrink-0 text-[11px] flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isUploading ? 'animate-spin' : ''}`} />
                <span>{isUploading ? 'Hosting...' : 'Host on Server'}</span>
              </button>
            </div>
          )}

          {isHosted && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold px-1">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Public HTTPS URL • Ready for email recipients</span>
            </div>
          )}

          {/* Image Details Bar */}
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <FileImage className={`w-4 h-4 ${isHosted ? 'text-emerald-600' : 'text-amber-600'} flex-shrink-0`} />
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate text-[11px]">
                  {currentFilename || 'image.jpg'}
                </p>
                {fileSizeStr && (
                  <p className="text-[10px] text-slate-400 font-mono">{fileSizeStr}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={handleBrowseClick}
                disabled={isUploading}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors"
              >
                {isUploading ? 'Uploading...' : 'Replace'}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Remove Image"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty Upload / Dropzone Area */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
            isDragging
              ? 'border-indigo-600 bg-indigo-50/70 scale-[1.01]'
              : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
              {isUploading ? (
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              ) : (
                <UploadCloud className="w-6 h-6 text-indigo-600" />
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-slate-800">
                {isUploading ? (
                  'Uploading and hosting image...'
                ) : (
                  <>
                    <span className="text-indigo-600 hover:underline">Click to browse</span> or drag and drop
                  </>
                )}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
            </div>

            <button
              type="button"
              disabled={isUploading}
              className="mt-1 px-4 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:border-indigo-300 shadow-xs transition-colors"
            >
              Browse Files
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
