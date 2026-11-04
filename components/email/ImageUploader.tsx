'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Check,
  Copy,
  Trash2,
  RefreshCw,
  Plus,
  FileImage,
} from 'lucide-react';
import { uploadEmailImage } from '@/lib/email-api';
import {
  optimizeImageForEmail,
  formatFileSize,
  normalizeImageUrl,
  isPublicHttpsUrl,
} from '@/lib/image-utils';
import { useToast } from '@/components/ui/Toast';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  onInsertIntoContent?: (url: string) => void;
  singleMode?: boolean;
}

export default function ImageUploader({
  images,
  onChange,
  onInsertIntoContent,
  singleMode = false,
}: ImageUploaderProps) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
  ];

  const handleFiles = async (fileList: File[]) => {
    if (fileList.length === 0) return;

    // Validate size and mime types
    for (const f of fileList) {
      const ext = `.${f.name.split('.').pop()?.toLowerCase()}`;
      const valid =
        ALLOWED_TYPES.includes(f.type) ||
        ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);

      if (!valid) {
        toastError(
          `Invalid image type. Only JPG, JPEG, PNG, and WEBP images are allowed.`,
          'Unsupported Format'
        );
        return;
      }
      if (f.size > MAX_IMAGE_SIZE) {
        toastError(
          `Image "${f.name}" exceeds maximum allowed size of 5MB (${formatFileSize(f.size)}).`,
          'File Too Large'
        );
        return;
      }
    }

    setIsUploading(true);

    try {
      // 1. Optimize all files before uploading to avoid large payloads that cause timeouts
      const optimizedResults = await Promise.all(
        fileList.map((file) => optimizeImageForEmail(file))
      );
      const optimizedFiles = optimizedResults.map((r) => r.file);

      // 2. Upload to backend
      const res = await uploadEmailImage(optimizedFiles);
      const newUrls: string[] = [];

      if (res.success && res.data) {
        if (res.data.urls && res.data.urls.length > 0) {
          newUrls.push(...res.data.urls.map((u) => normalizeImageUrl(u)));
        } else if (res.data.url) {
          newUrls.push(normalizeImageUrl(res.data.url));
        } else if (res.data.files && res.data.files.length > 0) {
          newUrls.push(...res.data.files.map((file) => normalizeImageUrl(file.url)));
        }
      }

      if (newUrls.length === 0) {
        toastError(
          res.error || 'Server failed to host uploaded images. Please retry.',
          'Upload Failed'
        );
        return;
      }

      if (singleMode) {
        onChange([newUrls[0]]);
      } else {
        const combined = Array.from(new Set([...images, ...newUrls]));
        onChange(combined);
      }

      toastSuccess(
        `Uploaded and hosted ${newUrls.length} image${newUrls.length > 1 ? 's' : ''} on public HTTPS.`,
        'Images Ready'
      );
    } catch (err) {
      toastError(
        'Network error during image upload. Please ensure your backend connection is active.',
        'Upload Error'
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };

  const handleRemoveImage = (urlToRemove: string) => {
    onChange(images.filter((u) => u !== urlToRemove));
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
    toastSuccess('Image URL copied to clipboard.', 'Copied');
  };

  return (
    <div className="space-y-4">
      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/70 scale-[1.01]'
            : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            {isUploading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <UploadCloud className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              <span className="text-indigo-600 hover:underline">Click to upload</span> or drag and drop
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              JPG, JPEG, PNG, WEBP (up to 5MB)
            </p>
          </div>
          <button
            type="button"
            disabled={isUploading}
            className="mt-1 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-indigo-600 shadow-xs transition-colors"
          >
            Browse Photos
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple={!singleMode}
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Uploaded Gallery Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {images.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3 group relative transition-all hover:border-indigo-300"
            >
              {/* Thumbnail */}
              <div className="w-14 h-14 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Uploaded ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Info & Actions */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {url.split('/').pop() || `Photo ${idx + 1}`}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(url)}
                    className="text-[11px] text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1 transition-colors"
                    title="Copy URL"
                  >
                    {copiedUrl === url ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>

                  {onInsertIntoContent && (
                    <>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => onInsertIntoContent(url)}
                        className="text-[11px] text-indigo-600 hover:underline font-semibold flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Insert</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => handleRemoveImage(url)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Remove image"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
