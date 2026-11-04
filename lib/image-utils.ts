/**
 * Image Utilities for Campaign Studio
 * Handles client-side downscaling, base64 conversions, payload optimization,
 * URL normalization, and email compatibility verification.
 */

import { API_BASE_URL } from './api';

export function isDataUrl(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('data:image/');
}

export function isBlobUrl(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('blob:');
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file as data URL.'));
    reader.readAsDataURL(file);
  });
}

export function dataUrlToFile(dataUrl: string, filename = 'template-image.jpg'): File | null {
  try {
    const arr = dataUrl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch {
    return null;
  }
}

/**
 * Optimizes an image file for email rendering before upload/storage.
 * Standard emails are max 600px wide; 1200px provides crisp 2x retina display.
 * Compresses 5-10MB camera photos down to ~100-250KB, reducing payload size by ~97%.
 */
export async function optimizeImageForEmail(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82
): Promise<{ file: File; dataUrl: string }> {
  // If not a raster image (or if animated GIF / SVG), don't draw on canvas
  if (
    typeof window === 'undefined' ||
    !file.type.startsWith('image/') ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif'
  ) {
    const dataUrl = await fileToDataUrl(file);
    return { file, dataUrl };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Downscale proportionally if larger than maximum bounds
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        fileToDataUrl(file).then((dataUrl) => resolve({ file, dataUrl }));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, quality);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const optimizedFile = new File([blob], file.name, {
              type: mimeType,
              lastModified: Date.now(),
            });
            resolve({ file: optimizedFile, dataUrl });
          } else {
            resolve({ file, dataUrl });
          }
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      fileToDataUrl(file).then((dataUrl) => resolve({ file, dataUrl }));
    };

    img.src = url;
  });
}

/**
 * Normalizes any image URL to ensure it is a public, absolute HTTPS URL
 * suitable for email clients (Gmail, Outlook, Apple Mail).
 *
 * Rules:
 * 1. Relative paths (/uploads/photo.jpg) -> prepended with API_BASE_URL.
 * 2. Localhost/127.0.0.1 URLs -> origin replaced with API_BASE_URL.
 * 3. Insecure http:// URLs -> upgraded to https://.
 * 4. Data/blob/file URLs are retained so validation can flag them as un-hosted.
 */
export function normalizeImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Data URLs, blob URLs, or file URLs cannot be normalized to public URLs automatically
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('file:') ||
    trimmed === '__SAME_AS_IMG_SRC__'
  ) {
    return trimmed;
  }

  // Handle localhost or 127.0.0.1
  if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
    const path = trimmed.replace(/^https?:\/\/[^/]+/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${cleanPath}`;
  }

  // If already absolute HTTPS
  if (trimmed.startsWith('https://')) {
    return trimmed;
  }

  // If insecure HTTP, upgrade to HTTPS
  if (trimmed.startsWith('http://')) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  // If relative path (e.g. /uploads/image.png or uploads/image.png or api/email/uploads/...)
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Checks if a given image URL is a valid, publicly accessible HTTPS URL.
 * Email clients strictly require absolute public HTTPS URLs.
 */
export function isPublicHttpsUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) return false;
  if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1') || trimmed.includes('[::1]')) {
    return false;
  }
  return true;
}

/**
 * Checks if a given image URL is local, a data URL, a blob URL, or relative.
 */
export function isLocalOrDataUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('file:') ||
    trimmed.includes('localhost') ||
    trimmed.includes('127.0.0.1')
  ) {
    return true;
  }
  // If it's a relative path, it's local unless normalized
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return true;
  }
  return false;
}

/**
 * Extracts a hosted image URL from various backend response shapes:
 * - { data: { url: "..." } }
 * - { url: "..." }
 * - { data: { urls: ["..."] } }
 * - { urls: ["..."] }
 * - { data: { files: [{ url: "..." }] } }
 * - { files: [{ url: "..." }] }
 * - { fileUrl: "..." } / { secure_url: "..." } / { path: "..." } / { Location: "..." }
 * - string response
 */
export function extractHostedImageUrl(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('http') || trimmed.startsWith('/')) {
      return normalizeImageUrl(trimmed);
    }
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const data = (obj.data && typeof obj.data === 'object' ? obj.data : null) as Record<
    string,
    unknown
  > | null;

  // Potential fields in order of priority
  const candidates: unknown[] = [
    data?.url,
    obj.url,
    Array.isArray(data?.urls) ? data?.urls[0] : null,
    Array.isArray(obj.urls) ? (obj.urls as unknown[])[0] : null,
    Array.isArray(data?.files) ? (data?.files[0] as Record<string, unknown>)?.url : null,
    Array.isArray(obj.files) ? (obj.files as Record<string, unknown>[])[0]?.url : null,
    data?.secure_url,
    obj.secure_url,
    data?.fileUrl,
    obj.fileUrl,
    data?.imageUrl,
    obj.imageUrl,
    data?.Location,
    obj.Location,
    data?.location,
    obj.location,
    data?.path,
    obj.path,
    typeof obj.data === 'string' ? obj.data : null,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return normalizeImageUrl(c.trim());
    }
  }

  return null;
}

/**
 * Sanitizes all <img> elements inside email HTML:
 * 1. Converts relative paths to absolute HTTPS URLs via API_BASE_URL.
 * 2. Upgrades http:// to https:// and replaces localhost.
 * 3. Ensures email-compatible attributes: border="0", width="...", and inline style="max-width:100%;height:auto;".
 */
export function sanitizeEmailHtmlImageUrls(html: string): string {
  if (!html || typeof html !== 'string') return '';

  return html.replace(/<img([^>]+)>/gi, (fullImg, attrs) => {
    // Extract src
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (!srcMatch || !srcMatch[1]) return fullImg;

    const originalSrc = srcMatch[1];
    const normalizedSrc = normalizeImageUrl(originalSrc);

    // Replace src in attributes
    let newAttrs = attrs.replace(/src=["'][^"']+["']/i, `src="${normalizedSrc}"`);

    // Ensure border="0"
    if (!/border=["'][^"']*["']/i.test(newAttrs)) {
      newAttrs = `border="0" ${newAttrs}`;
    }

    // Determine appropriate width attribute if missing (crucial for Outlook/Word rendering engine)
    const isLogo = /logo/i.test(newAttrs) || /max-height:\s*48px/i.test(newAttrs);
    const hasWidth = /\bwidth=["'][^"']+["']/i.test(newAttrs);
    if (!hasWidth) {
      newAttrs = `${newAttrs} width="${isLogo ? '180' : '600'}"`;
    }

    // Ensure style has max-width: 100% and height: auto
    const styleMatch = newAttrs.match(/style=["']([^"']+)["']/i);
    if (styleMatch) {
      let existingStyle = styleMatch[1].trim();
      if (!/max-width/i.test(existingStyle)) {
        existingStyle += '; max-width: 100%';
      }
      if (!/height/i.test(existingStyle)) {
        existingStyle += '; height: auto';
      }
      if (!/-ms-interpolation-mode/i.test(existingStyle)) {
        existingStyle += '; -ms-interpolation-mode: bicubic';
      }
      newAttrs = newAttrs.replace(/style=["'][^"']+["']/i, `style="${existingStyle}"`);
    } else {
      newAttrs = `${newAttrs} style="max-width: 100%; height: auto; -ms-interpolation-mode: bicubic;"`;
    }

    return `<img ${newAttrs.replace(/\s+/g, ' ').trim()}>`;
  });
}

/**
 * Extracts all <img> src URLs from an HTML document or snippet.
 * Returns unique, normalized URLs.
 */
export function extractImageUrlsFromHtml(html?: string | null): string[] {
  if (!html || typeof html !== 'string') return [];
  const matches = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi));
  const urls: string[] = [];
  for (const m of matches) {
    const raw = m[1]?.trim();
    if (raw) {
      urls.push(normalizeImageUrl(raw));
    }
  }
  return Array.from(new Set(urls));
}

/**
 * Validates email HTML images before sending:
 * Checks whether any <img> tags use un-hosted data:, blob:, file:, localhost, or relative URLs.
 * Returns detailed diagnostic information for each invalid image.
 */
export function validateEmailHtmlImages(html: string): {
  valid: boolean;
  invalidUrls: string[];
  detailedErrors: { url: string; reason: string; label?: string }[];
  totalImages: number;
  validUrls: string[];
} {
  if (!html || typeof html !== 'string') {
    return { valid: true, invalidUrls: [], detailedErrors: [], totalImages: 0, validUrls: [] };
  }

  const imgMatches = Array.from(html.matchAll(/<img([^>]+)>/gi));
  const invalidUrls: string[] = [];
  const detailedErrors: { url: string; reason: string; label?: string }[] = [];
  const validUrls: string[] = [];

  for (const match of imgMatches) {
    const attrs = match[1] || '';
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    const altMatch = attrs.match(/alt=["']([^"']+)["']/i);
    const label = altMatch ? altMatch[1] : (attrs.includes('logo') ? 'Logo' : 'Image');

    const src = srcMatch ? srcMatch[1].trim() : '';
    if (!src) {
      detailedErrors.push({
        url: '(empty src)',
        reason: 'Image tag has missing or empty src attribute',
        label,
      });
      invalidUrls.push('(empty src)');
      continue;
    }

    if (src.startsWith('data:')) {
      const displayUrl = src.length > 50 ? `${src.slice(0, 50)}...` : src;
      invalidUrls.push(displayUrl);
      detailedErrors.push({
        url: displayUrl,
        reason: 'Base64 data URL is blocked by email clients (Gmail, Outlook). Must be uploaded to persistent storage.',
        label,
      });
    } else if (src.startsWith('blob:')) {
      invalidUrls.push(src);
      detailedErrors.push({
        url: src,
        reason: 'Temporary blob URL is only visible in your local browser session and cannot be opened by email recipients.',
        label,
      });
    } else if (src.startsWith('file:')) {
      invalidUrls.push(src);
      detailedErrors.push({
        url: src,
        reason: 'Local file URL is not accessible over the internet.',
        label,
      });
    } else if (src.includes('localhost') || src.includes('127.0.0.1')) {
      invalidUrls.push(src);
      detailedErrors.push({
        url: src,
        reason: 'Localhost URL cannot be loaded by external email recipients.',
        label,
      });
    } else if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('cid:')) {
      invalidUrls.push(src);
      detailedErrors.push({
        url: src,
        reason: 'Relative image URL cannot be resolved by external email clients.',
        label,
      });
    } else {
      validUrls.push(src);
    }
  }

  return {
    valid: invalidUrls.length === 0,
    invalidUrls,
    detailedErrors,
    totalImages: imgMatches.length,
    validUrls,
  };
}

/**
 * Checks whether a given image URL is accessible without authentication in a browser context.
 */
export async function verifyImageUrlAccessible(url: string, timeoutMs = 8000): Promise<{
  accessible: boolean;
  statusText?: string;
  isImage?: boolean;
}> {
  if (typeof window === 'undefined' || !url) {
    return { accessible: true };
  }

  // Pre-filter invalid formats
  if (isLocalOrDataUrl(url)) {
    return {
      accessible: false,
      statusText: 'Image is a local or un-hosted URL (Base64/blob/localhost).',
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const img = new Image();

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({
          accessible: false,
          statusText: 'Request timed out loading image.',
        });
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ accessible: true, isImage: true });
      }
    };

    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          accessible: false,
          statusText: 'Image failed to load (HTTP error, CORS block, or invalid format).',
        });
      }
    };

    img.src = url;
  });
}
