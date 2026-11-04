'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Monitor,
  Smartphone,
  Undo2,
  Redo2,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Image as ImageIcon,
  Type,
  Link2,
  MousePointerClick,
  Palette,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Move,
  Sliders,
  Layers,
  Eye,
  RefreshCw,
  FolderOpen,
  LayoutTemplate,
  BadgeAlert,
  CreditCard,
  Check,
} from 'lucide-react';
import {
  EmailTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  VisualElement,
  VisualElementType,
  EmailTemplateStyle,
} from '@/types/email';
import { createEmailTemplate, updateEmailTemplate, uploadEmailImage } from '@/lib/email-api';
import {
  isDataUrl,
  dataUrlToFile,
  normalizeImageUrl,
  isLocalOrDataUrl,
  isPublicHttpsUrl,
} from '@/lib/image-utils';
import { EMAIL_PRESETS, EmailPreset } from '@/lib/email-presets';
import { useToast } from '@/components/ui/Toast';
import ImageUploadArea from '@/components/common/ImageUploadArea';
import TemplateThumbnailPreview from './TemplateThumbnailPreview';

interface ModernTemplateEditorProps {
  initialTemplate?: EmailTemplate | null;
  isPreset?: boolean;
  onBack: () => void;
  onSaved: () => void;
}

export default function ModernTemplateEditor({
  initialTemplate,
  isPreset = false,
  onBack,
  onSaved,
}: ModernTemplateEditorProps) {
  const { error: toastError, success: toastSuccess } = useToast();

  const isExistingServerUpdate = Boolean(initialTemplate?._id) && !isPreset;

  // Header Details
  const [templateName, setTemplateName] = useState(
    initialTemplate?.name || 'Promotional Campaign Template'
  );
  const [subject, setSubject] = useState(
    initialTemplate?.subject || 'Special update for you, {{customer_name}}!'
  );
  const [category, setCategory] = useState(initialTemplate?.category || 'marketing');

  // Preview Mode: Desktop (~600px) vs Mobile (~375px)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Selected Element for Right Sidebar editing
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Left Sidebar active tab
  const [activeLeftTab, setActiveLeftTab] = useState<
    'presets' | 'add' | 'photos' | 'style'
  >('presets');

  // Saving state
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatusText, setSaveStatusText] = useState('Save Template');

  // Initialize Template Style
  const [templateStyle, setTemplateStyle] = useState<EmailTemplateStyle>(() => {
    if (initialTemplate?.content) {
      const match = initialTemplate.content.match(/<!-- CAMPAIGN_STUDIO_DATA: (.*?) -->/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.templateStyle) return parsed.templateStyle;
        } catch {}
      }
    }

    const matchedPreset = EMAIL_PRESETS.find(
      (p) => p.id === initialTemplate?.template_id || p.designId === initialTemplate?.template_id
    );
    if (matchedPreset) return matchedPreset.templateStyle;

    const defaultPromo = EMAIL_PRESETS.find((p) => p.designId === 'promotional_banner');
    return (
      defaultPromo?.templateStyle || {
        canvasBgColor: '#FFFFFF',
        outerBgColor: '#EEF2FF',
        fontFamily: 'sans',
        cardBorderRadius: '2xl',
        cardBorder: '1px solid #C7D2FE',
        primaryColor: '#4F46E5',
        designId: 'promotional_banner',
      }
    );
  });

  // Initialize Elements from initialTemplate or fallback to matched preset
  const parseInitialElements = (): VisualElement[] => {
    if (initialTemplate?.content) {
      const match = initialTemplate.content.match(/<!-- CAMPAIGN_STUDIO_DATA: (.*?) -->/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed.elements) && parsed.elements.length > 0) {
            // Restore any __SAME_AS_IMG_SRC__ placeholder images directly from HTML <img> tags
            const imgMatches = Array.from(
              initialTemplate.content.matchAll(/<img[^>]+src=["']([^"']+)["']/g)
            ).map((m) => m[1]);

            let imgIdx = 0;
            return parsed.elements.map((el: VisualElement) => {
              let resolvedUrl = el.imageUrl;
              if (el.imageUrl === '__SAME_AS_IMG_SRC__' && imgMatches[imgIdx]) {
                resolvedUrl = imgMatches[imgIdx];
                imgIdx++;
              } else if (el.type === 'logo' || el.type === 'banner' || el.type === 'image') {
                imgIdx++;
              }
              return {
                ...el,
                imageUrl: resolvedUrl ? normalizeImageUrl(resolvedUrl) : '',
              };
            });
          }
        } catch {}
      }
    }

    const matchedPreset = EMAIL_PRESETS.find(
      (p) => p.id === initialTemplate?.template_id || p.designId === initialTemplate?.template_id
    );
    if (matchedPreset) {
      return matchedPreset.elements;
    }

    const defaultPromo = EMAIL_PRESETS.find((p) => p.designId === 'promotional_banner');
    return defaultPromo ? defaultPromo.elements : [];
  };

  const [elements, setElements] = useState<VisualElement[]>(parseInitialElements);

  // Set default selected element after mount
  useEffect(() => {
    if (!selectedId && elements.length > 0) {
      const hero = elements.find((el) => el.type === 'banner' || el.type === 'image');
      setSelectedId(hero ? hero.id : elements[0].id);
    }
  }, [elements, selectedId]);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<VisualElement[][]>([elements]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = (newElements: VisualElement[]) => {
    const updated = history.slice(0, historyIndex + 1);
    updated.push(newElements);
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
  };

  const updateElementsWithHistory = (
    updater: (prev: VisualElement[]) => VisualElement[]
  ) => {
    setElements((prev) => {
      const next = updater(prev);
      pushHistory(next);
      return next;
    });
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  };

  // Switch Design Layout Preset (Preserving user-uploaded images and customizations!)
  const handleApplyDesign = (preset: EmailPreset) => {
    // Preserve any existing user-uploaded hero or logo image
    const existingHero = elements.find(
      (el) => (el.type === 'banner' || el.type === 'image') && el.imageUrl
    );
    const existingLogo = elements.find(
      (el) => el.type === 'logo' && el.imageUrl
    );

    const newElements = preset.elements.map((el) => {
      if ((el.type === 'banner' || el.type === 'image') && existingHero?.imageUrl) {
        return {
          ...el,
          imageUrl: existingHero.imageUrl,
          imageFilename: existingHero.imageFilename,
        };
      }
      if (el.type === 'logo' && existingLogo?.imageUrl) {
        return {
          ...el,
          imageUrl: existingLogo.imageUrl,
          imageFilename: existingLogo.imageFilename,
        };
      }
      return el;
    });

    setTemplateStyle(preset.templateStyle);
    setElements(newElements);
    pushHistory(newElements);
    toastSuccess(
      `Switched to "${preset.name}" design! Custom photos preserved.`,
      'Layout Applied'
    );
  };

  // Photo Upload Handler: Preserves the template's overall layout, typography, colors, and CTA styles
  const handlePhotoUpload = (url: string, filename?: string) => {
    const safeFilename = filename || 'uploaded-photo.jpg';
    // 1. If currently selected element is image/banner/logo, update that specific element
    if (
      selectedElement &&
      (selectedElement.type === 'banner' ||
        selectedElement.type === 'image' ||
        selectedElement.type === 'logo')
    ) {
      updateSelectedElement({ imageUrl: url, imageFilename: safeFilename });
      const updated = elements.map((el) =>
        el.id === selectedElement.id
          ? { ...el, imageUrl: url, imageFilename: safeFilename }
          : el
      );
      setElements(updated);
      pushHistory(updated);
      toastSuccess(`Updated ${selectedElement.type} with uploaded photo!`, 'Photo Updated');
      return;
    }

    // 2. Otherwise find the main hero banner/image in the current template elements
    const heroIdx = elements.findIndex(
      (el) => el.type === 'banner' || el.type === 'image'
    );

    if (heroIdx !== -1) {
      const heroEl = elements[heroIdx];
      const updated = elements.map((el, idx) =>
        idx === heroIdx ? { ...el, imageUrl: url, imageFilename: safeFilename } : el
      );
      setElements(updated);
      pushHistory(updated);
      setSelectedId(heroEl.id);
      toastSuccess(
        'Photo uploaded! Template design, colors, and layout preserved intact.',
        'Photo Inserted'
      );
    } else {
      // 3. Add an image without altering the rest of the template
      const newId = `img-${Date.now().toString(36)}`;
      const newEl: VisualElement = {
        id: newId,
        type: 'image',
        imageUrl: url,
        imageFilename: safeFilename,
        altText: safeFilename || 'Campaign Image',
        textAlign: 'center',
        paddingY: 16,
      };
      const updated = [newEl, ...elements];
      setElements(updated);
      pushHistory(updated);
      setSelectedId(newId);
      toastSuccess('Photo inserted into template!', 'Photo Added');
    }
  };

  // Auto-host un-hosted Base64/local images to public HTTPS storage
  const unhostedElements = elements.filter(
    (el) => el.imageUrl && isLocalOrDataUrl(el.imageUrl)
  );
  const unhostedCount = unhostedElements.length;
  const [isAutoHosting, setIsAutoHosting] = useState(false);

  const handleAutoHostImages = async () => {
    setIsAutoHosting(true);
    try {
      let hostedCount = 0;
      let lastErr = '';
      const updated = await Promise.all(
        elements.map(async (el) => {
          if (el.imageUrl && isLocalOrDataUrl(el.imageUrl)) {
            const file = isDataUrl(el.imageUrl)
              ? dataUrlToFile(el.imageUrl, el.imageFilename || `${el.type}.jpg`)
              : null;
            if (file) {
              const res = await uploadEmailImage(file);
              if (res.success && res.data?.url) {
                hostedCount++;
                return {
                  ...el,
                  imageUrl: normalizeImageUrl(res.data.url),
                };
              } else {
                lastErr = res.error || 'Server storage upload failed';
              }
            }
          }
          return el;
        })
      );

      setElements(updated);
      pushHistory(updated);

      if (hostedCount > 0) {
        toastSuccess(
          `Hosted ${hostedCount} image(s) to public HTTPS storage successfully!`,
          'Images Hosted'
        );
      } else if (lastErr) {
        toastError(`Failed to host images: ${lastErr}`, 'Hosting Error');
      }
    } catch (e) {
      toastError(
        e instanceof Error ? e.message : 'Error uploading images to storage',
        'Upload Error'
      );
    } finally {
      setIsAutoHosting(false);
    }
  };

  // Reorder Elements (Move Up / Down)
  const moveElement = (id: string, direction: 'up' | 'down') => {
    updateElementsWithHistory((prev) => {
      const index = prev.findIndex((el) => el.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    });
  };

  // Delete Element
  const deleteElement = (id: string) => {
    updateElementsWithHistory((prev) => prev.filter((el) => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Duplicate Element
  const duplicateElement = (id: string) => {
    updateElementsWithHistory((prev) => {
      const index = prev.findIndex((el) => el.id === id);
      if (index === -1) return prev;
      const original = prev[index];
      const copy: VisualElement = {
        ...original,
        id: `${original.type}-${Date.now().toString(36)}`,
      };
      const updated = [...prev];
      updated.splice(index + 1, 0, copy);
      setSelectedId(copy.id);
      return updated;
    });
  };

  // Add a new element to canvas
  const addElement = (type: VisualElementType) => {
    const id = `${type}-${Date.now().toString(36)}`;
    let newEl: VisualElement;

    switch (type) {
      case 'heading':
        newEl = {
          id,
          type: 'heading',
          content: 'New Section Heading',
          fontSize: 'xl',
          fontWeight: 'bold',
          textAlign: 'center',
          textColor: templateStyle.canvasBgColor === '#0B0F19' ? '#F8FAFC' : '#0F172A',
          paddingY: 12,
        };
        break;
      case 'subheading':
        newEl = {
          id,
          type: 'subheading',
          content: 'Secondary Subtitle or Highlight',
          fontSize: 'lg',
          fontWeight: 'semibold',
          textAlign: 'center',
          textColor: templateStyle.canvasBgColor === '#0B0F19' ? '#94A3B8' : '#334155',
          paddingY: 8,
        };
        break;
      case 'text':
        newEl = {
          id,
          type: 'text',
          content:
            'Add your promotional details, benefits, or custom announcement message here.',
          fontSize: 'md',
          fontWeight: 'normal',
          textAlign: 'center',
          textColor: templateStyle.canvasBgColor === '#0B0F19' ? '#94A3B8' : '#475569',
          paddingY: 8,
        };
        break;
      case 'badge':
        newEl = {
          id,
          type: 'badge',
          content: 'Special Announcement',
          bgColor: '#EFF6FF',
          textColor: '#2563EB',
          textAlign: 'center',
          paddingY: 10,
        };
        break;
      case 'card':
        newEl = {
          id,
          type: 'card',
          content: '✓ Feature Highlight  •  Guaranteed Quality  •  Free Delivery',
          bgColor: templateStyle.canvasBgColor === '#0B0F19' ? 'rgba(30,41,59,0.6)' : '#F8FAFC',
          borderColor: templateStyle.canvasBgColor === '#0B0F19' ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
          textColor: templateStyle.canvasBgColor === '#0B0F19' ? '#F8FAFC' : '#1E293B',
          textAlign: 'center',
          paddingY: 10,
        };
        break;
      case 'banner':
      case 'image':
        newEl = {
          id,
          type,
          imageUrl: '',
          imageFilename: '',
          altText: 'Campaign Image',
          textAlign: 'center',
          paddingY: 14,
        };
        break;
      case 'logo':
        newEl = {
          id,
          type: 'logo',
          imageUrl: '',
          imageFilename: '',
          altText: 'Brand Logo',
          textAlign: 'center',
          paddingY: 10,
        };
        break;
      case 'button':
        newEl = {
          id,
          type: 'button',
          content: 'Click Here to Learn More',
          url: 'https://example.com',
          buttonColor: templateStyle.primaryColor || '#4F46E5',
          buttonTextColor: '#FFFFFF',
          borderRadius: templateStyle.cardBorderRadius === '2xl' ? 'full' : 'md',
          textAlign: 'center',
          paddingY: 16,
        };
        break;
      case 'link':
        newEl = {
          id,
          type: 'link',
          content: 'www.yourwebsite.com',
          url: 'https://yourwebsite.com',
          textAlign: 'center',
          textColor: templateStyle.primaryColor || '#4F46E5',
          paddingY: 8,
        };
        break;
      case 'divider':
        newEl = {
          id,
          type: 'divider',
          paddingY: 12,
        };
        break;
      case 'footer':
        newEl = {
          id,
          type: 'footer',
          content:
            '© 2026 Company Name • 123 Business Way • Reply STOP to unsubscribe',
          fontSize: 'sm',
          textAlign: 'center',
          textColor: '#94A3B8',
          paddingY: 16,
        };
        break;
      default:
        return;
    }

    updateElementsWithHistory((prev) => [...prev, newEl]);
    setSelectedId(id);
  };

  // Modify currently selected element
  const updateSelectedElement = (fields: Partial<VisualElement>) => {
    if (!selectedId) return;
    setElements((prev) =>
      prev.map((el) => (el.id === selectedId ? { ...el, ...fields } : el))
    );
  };

  const selectedElement = elements.find((el) => el.id === selectedId) || null;

  // Generate 100% Responsive Email-Client Compatible HTML
  const generateEmailHtml = (elementsToRender: VisualElement[] = elements): string => {
    const isSerif = templateStyle.fontFamily === 'serif';
    const fontStack = isSerif
      ? "Georgia, 'Times New Roman', Garamond, serif"
      : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    const renderedBlocks = elementsToRender
      .map((el) => {
        const align = el.textAlign || 'center';
        const pY = el.paddingY ?? 12;

        switch (el.type) {
          case 'logo':
            if (!el.imageUrl) return '';
            const safeLogoUrl = normalizeImageUrl(el.imageUrl);
            return `
            <tr>
              <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align};">
                <img src="${safeLogoUrl}" alt="${el.altText || 'Logo'}" border="0" style="max-height: 48px; width: auto; max-width: 180px; display: inline-block; border: none; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
              </td>
            </tr>`;

          case 'banner':
            if (!el.imageUrl) return '';
            const safeBannerUrl = normalizeImageUrl(el.imageUrl);
            const bannerRadius =
              templateStyle.cardBorderRadius === 'none' ? '0px' : '10px';
            return `
            <tr>
              <td align="center" style="padding: ${pY}px 0; text-align: center;">
                ${
                  el.url
                    ? `<a href="${el.url}" target="_blank" style="text-decoration:none; display:block;">`
                    : ''
                }
                <img src="${safeBannerUrl}" alt="${el.altText || 'Banner'}" border="0" style="width: 100%; max-width: 100%; height: auto; display: block; border: none; border-radius: ${bannerRadius}; margin: 0 auto; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
                ${el.url ? `</a>` : ''}
              </td>
            </tr>`;

          case 'image':
            if (!el.imageUrl) return '';
            const safeImgUrl = normalizeImageUrl(el.imageUrl);
            const imgRadius =
              templateStyle.cardBorderRadius === 'none' ? '0px' : '8px';
            return `
            <tr>
              <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align};">
                ${
                  el.url
                    ? `<a href="${el.url}" target="_blank" style="text-decoration:none;">`
                    : ''
                }
                <img src="${safeImgUrl}" alt="${el.altText || 'Image'}" border="0" style="max-width: 100%; height: auto; display: inline-block; border: none; border-radius: ${imgRadius}; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
                ${el.url ? `</a>` : ''}
              </td>
            </tr>`;

          case 'badge':
            return `
            <tr>
              <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align};">
                <span style="display: inline-block; padding: 5px 14px; border-radius: 9999px; font-family: ${fontStack}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: ${el.bgColor || '#EFF6FF'}; color: ${el.textColor || '#2563EB'};">
                  ${el.content}
                </span>
              </td>
            </tr>`;

          case 'heading':
            return `
            <tr>
              <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align};">
                <h1 style="margin: 0; font-family: ${fontStack}; font-size: ${
                  el.fontSize === '2xl'
                    ? '26px'
                    : el.fontSize === 'xl'
                    ? '22px'
                    : '18px'
                }; font-weight: ${
                  el.fontWeight === 'extrabold'
                    ? '800'
                    : el.fontWeight === 'bold'
                    ? '700'
                    : '600'
                }; color: ${el.textColor || (templateStyle.canvasBgColor === '#0B0F19' ? '#F8FAFC' : '#0F172A')}; line-height: 1.3;">
                  ${el.content || ''}
                </h1>
              </td>
            </tr>`;

          case 'subheading':
            return `
            <tr>
              <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align};">
                <h2 style="margin: 0; font-family: ${fontStack}; font-size: 17px; font-weight: 600; color: ${
                  el.textColor || (templateStyle.canvasBgColor === '#0B0F19' ? '#94A3B8' : '#475569')
                }; line-height: 1.4;">
                  ${el.content || ''}
                </h2>
              </td>
            </tr>`;

          case 'text':
            return `
            <tr>
              <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align};">
                <p style="margin: 0; font-family: ${fontStack}; font-size: 15px; font-weight: normal; color: ${
                  el.textColor || (templateStyle.canvasBgColor === '#0B0F19' ? '#94A3B8' : '#475569')
                }; line-height: 1.6;">
                  ${(el.content || '').replace(/\n/g, '<br />')}
                </p>
              </td>
            </tr>`;

          case 'card':
            return `
            <tr>
              <td style="padding: ${pY}px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${el.bgColor || '#F8FAFC'}; border: 1px solid ${el.borderColor || '#E2E8F0'}; border-radius: 12px; padding: 14px 18px;">
                  <tr>
                    <td align="${align}" style="font-family: ${fontStack}; font-size: 13px; font-weight: 600; color: ${el.textColor || '#334155'}; text-align: ${align}; line-height: 1.5;">
                      ${el.content || ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;

          case 'button':
            const btnRadius =
              el.borderRadius === 'full'
                ? '9999px'
                : el.borderRadius === 'none'
                ? '0px'
                : el.borderRadius === 'sm'
                ? '4px'
                : el.borderRadius === 'lg'
                ? '12px'
                : '8px';
            return `
            <tr>
              <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align};">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; display: inline-block;">
                  <tr>
                    <td align="center" style="border-radius: ${btnRadius}; background-color: ${
                      el.buttonColor || templateStyle.primaryColor || '#4F46E5'
                    };">
                      <a href="${
                        el.url || 'https://example.com'
                      }" target="_blank" style="display: inline-block; padding: 13px 28px; font-family: ${fontStack}; font-size: 14px; font-weight: 700; color: ${
                        el.buttonTextColor || '#FFFFFF'
                      }; text-decoration: none; border-radius: ${btnRadius}; letter-spacing: 0.3px;">
                        ${el.content || 'Take Action'}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;

          case 'link':
            return `
            <tr>
              <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align};">
                <a href="${
                  el.url || 'https://example.com'
                }" target="_blank" style="font-family: ${fontStack}; font-size: 13px; font-weight: 600; color: ${
                  el.textColor || templateStyle.primaryColor || '#4F46E5'
                }; text-decoration: underline;">
                  ${el.content || el.url || 'Visit Link'}
                </a>
              </td>
            </tr>`;

          case 'divider':
            return `
            <tr>
              <td style="padding: ${pY}px 24px;">
                <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 0;" />
              </td>
            </tr>`;

          case 'footer':
            return `
            <tr>
              <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align}; border-top: 1px solid rgba(0,0,0,0.06);">
                <p style="margin: 0; font-family: ${fontStack}; font-size: 12px; color: ${
                  el.textColor || '#94A3B8'
                }; line-height: 1.5;">
                  ${(el.content || '').replace(/\n/g, '<br />')}
                </p>
              </td>
            </tr>`;

          default:
            return '';
        }
      })
      .join('\n');

    // Avoid duplicating multi-megabyte base64 strings in the JSON comment
    const sanitizedElementsForMeta = elementsToRender.map((el) => {
      if (el.imageUrl && isDataUrl(el.imageUrl) && el.imageUrl.length > 50000) {
        return { ...el, imageUrl: '__SAME_AS_IMG_SRC__' };
      }
      return el;
    });

    // Embed metadata for instant reload intact
    const studioMetaComment = `<!-- CAMPAIGN_STUDIO_DATA: ${JSON.stringify({
      designId: templateStyle.designId,
      templateStyle,
      elements: sanitizedElementsForMeta,
    })} -->`;

    const containerRadius =
      templateStyle.cardBorderRadius === '2xl'
        ? '20px'
        : templateStyle.cardBorderRadius === 'xl'
        ? '16px'
        : templateStyle.cardBorderRadius === 'none'
        ? '0px'
        : '8px';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${templateName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${templateStyle.outerBgColor}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  ${studioMetaComment}
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${templateStyle.outerBgColor}; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container: 600px max width -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: ${templateStyle.canvasBgColor}; border-radius: ${containerRadius}; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05); border: ${templateStyle.cardBorder};">
          ${renderedBlocks}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  // Save Template Action
  const handleSaveTemplate = async () => {
    // 1. Prevent duplicate submissions while a request is in progress
    if (isSavingRef.current || isSaving) {
      return;
    }

    if (!templateName.trim()) {
      toastError('Please enter a name for your template.', 'Name Required');
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatusText('Preparing...');

    try {
      // 2. Automatically host any inline base64 or blob images to get stable public HTTPS URLs
      let currentElements = [...elements];
      const hasBase64Images = currentElements.some(
        (el) => el.imageUrl && isDataUrl(el.imageUrl)
      );

      if (hasBase64Images) {
        setSaveStatusText('Hosting images on server...');
        let uploadFailedError: string | null = null;

        const updatedElements = await Promise.all(
          currentElements.map(async (el) => {
            if (el.imageUrl && isDataUrl(el.imageUrl)) {
              try {
                const file = dataUrlToFile(
                  el.imageUrl,
                  el.imageFilename || `${el.type || 'image'}.jpg`
                );
                if (file) {
                  const res = await uploadEmailImage(file);
                  if (res.success && res.data?.url) {
                    const hostedUrl = normalizeImageUrl(res.data.url);
                    return { ...el, imageUrl: hostedUrl };
                  } else {
                    uploadFailedError =
                      res.error || `Failed to host ${el.altText || el.type} image on server`;
                  }
                }
              } catch (e) {
                uploadFailedError =
                  e instanceof Error ? e.message : 'Network error during image upload';
              }
            }
            return el;
          })
        );

        if (uploadFailedError) {
          isSavingRef.current = false;
          setIsSaving(false);
          setSaveStatusText('');
          toastError(
            `Could not host template image on server: ${uploadFailedError}. Images must be hosted on public HTTPS so recipients do not see broken images. Please check your connection and try saving again.`,
            'Image Hosting Failed'
          );
          return;
        }

        currentElements = updatedElements;
        setElements(updatedElements);
      }

      // Auto-normalize all image paths to absolute public HTTPS URLs
      currentElements = currentElements.map((el) => {
        if (el.imageUrl) {
          return { ...el, imageUrl: normalizeImageUrl(el.imageUrl) };
        }
        return el;
      });
      setElements(currentElements);

      // Verify that NO images remain un-hosted or local
      const stillUnhosted = currentElements.filter(
        (el) => el.imageUrl && isLocalOrDataUrl(el.imageUrl)
      );
      if (stillUnhosted.length > 0) {
        isSavingRef.current = false;
        setIsSaving(false);
        setSaveStatusText('');
        toastError(
          `Template contains un-hosted image(s) (${stillUnhosted.map((u) => u.altText || u.type).join(', ')}). Email recipients will see broken image icons. Please replace or upload them before saving.`,
          'Un-hosted Images Detected'
        );
        return;
      }

      setSaveStatusText('Saving...');

      // 3. Generate HTML with current elements
      const generatedHtml = generateEmailHtml(currentElements);

      // Extract dynamic variables like {{customer_name}}
      const varMatches = generatedHtml.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
      const extractedVariables = Array.from(
        new Set(varMatches.map((m) => m.replace(/[{}]/g, '')))
      );

      const baseSlug =
        templateName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') || `template_${Date.now()}`;

      const slugId =
        initialTemplate?.template_id && !isPreset
          ? initialTemplate.template_id
          : baseSlug;

      const savePayload: CreateTemplateRequest = {
        template_id: slugId,
        name: templateName.trim(),
        subject: subject.trim(),
        category,
        variables: extractedVariables,
        content: generatedHtml,
        status: true,
      };

      // 4. Distinguish clearly between EDITING an existing template vs CREATING a new template
      const isExistingServerUpdate = Boolean(
        initialTemplate &&
        !isPreset &&
        (initialTemplate._id || initialTemplate.template_id || initialTemplate.id)
      );

      let res: { success: boolean; error?: string; message?: string };

      if (isExistingServerUpdate) {
        // Updating an existing template: call updateEmailTemplate directly
        const targetId =
          initialTemplate?._id ||
          initialTemplate?.id ||
          initialTemplate?.template_id ||
          slugId;
        res = await updateEmailTemplate(targetId, savePayload);
      } else {
        // Creating a new template (or saving preset as custom)
        res = await createEmailTemplate(savePayload);

        // If duplicate conflict on create (e.g. template_id already exists):
        if (
          !res.success &&
          res.error &&
          (res.error.toLowerCase().includes('duplicate') ||
            res.error.toLowerCase().includes('already exists') ||
            res.error.includes('409'))
        ) {
          // Update the existing template with this slug instead of creating duplicate records
          const updateRes = await updateEmailTemplate(slugId, savePayload);
          if (updateRes.success) {
            res = updateRes;
          }
        }
      }

      // 5. Handle response: show success ONLY after receiving confirmed successful response
      if (res.success) {
        toastSuccess(
          `Template "${templateName}" ${isExistingServerUpdate ? 'updated' : 'saved'} successfully!`,
          'Template Saved'
        );
        onSaved();
      } else {
        // CRITICAL: Preserve the editor content when saving fails so user does NOT lose work!
        toastError(res.error || 'Failed to save template to server.', 'Save Error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save template to server.';
      toastError(msg, 'Save Error');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      setSaveStatusText('Save Template');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden select-none">
      {/* 1. TOP TOOLBAR */}
      <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-4 z-20 shadow-2xs flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Back to Templates"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <div>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="text-sm font-bold text-slate-900 bg-transparent hover:bg-slate-100/80 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-lg px-2 py-1 -ml-2 transition-all w-48 sm:w-64 truncate"
              placeholder="Template Name..."
            />
            <p className="text-[10px] text-slate-400 font-mono -mt-0.5 px-0.5">
              Design: <span className="font-semibold text-indigo-600 capitalize">{(templateStyle.designId || 'promotional_banner').replace('_', ' ')}</span>
            </p>
          </div>
        </div>

        {/* Center: Undo / Redo & Desktop/Mobile Preview */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shadow-2xs">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Desktop / Mobile Toggle (Requirement 5) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shadow-2xs">
            <button
              type="button"
              onClick={() => setPreviewMode('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                previewMode === 'desktop'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                previewMode === 'mobile'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Mobile</span>
            </button>
          </div>
        </div>

        {/* Right: Category + Save Button */}
        <div className="flex items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="hidden sm:block text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs focus:outline-none focus:border-indigo-500"
          >
            <option value="marketing">Marketing</option>
            <option value="onboarding">Onboarding</option>
            <option value="promotions">Promotions</option>
            <option value="newsletter">Newsletter</option>
            <option value="transactional">Transactional</option>
          </select>

          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-500/25 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? saveStatusText : 'Save Template'}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: Presets, Elements, Photos, Style */}
        <aside className="w-80 bg-white border-r border-slate-200/80 flex flex-col z-10 flex-shrink-0 shadow-2xs">
          {/* Navigation Tabs */}
          <div className="flex items-center p-2 border-b border-slate-100 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveLeftTab('presets')}
              className={`flex-1 py-1.5 rounded-lg text-center font-semibold transition-all ${
                activeLeftTab === 'presets'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Designs
            </button>
            <button
              type="button"
              onClick={() => setActiveLeftTab('add')}
              className={`flex-1 py-1.5 rounded-lg text-center font-semibold transition-all ${
                activeLeftTab === 'add'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Elements
            </button>
            <button
              type="button"
              onClick={() => setActiveLeftTab('photos')}
              className={`flex-1 py-1.5 rounded-lg text-center font-semibold transition-all ${
                activeLeftTab === 'photos'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Photos
            </button>
            <button
              type="button"
              onClick={() => setActiveLeftTab('style')}
              className={`flex-1 py-1.5 rounded-lg text-center font-semibold transition-all ${
                activeLeftTab === 'style'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Style
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* TAB: CURATED MODERN DESIGNS WITH THUMBNAILS */}
            {activeLeftTab === 'presets' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {EMAIL_PRESETS.length} Distinct Modern Layouts
                  </h4>
                  <span className="text-[10px] text-slate-400">Preserves photos</span>
                </div>

                <div className="space-y-3">
                  {EMAIL_PRESETS.map((preset) => {
                    const isCurrent = templateStyle.designId === preset.designId;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleApplyDesign(preset)}
                        className={`group relative rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                          isCurrent
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md bg-white'
                            : 'border-slate-200/90 hover:border-indigo-400 bg-white hover:shadow-sm'
                        }`}
                      >
                        {/* Live Visual Thumbnail Preview */}
                        <TemplateThumbnailPreview preset={preset} size="sm" />

                        {/* Preset Info */}
                        <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-white">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                {preset.name}
                              </p>
                              {isCurrent && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700">
                                  <Check className="w-2.5 h-2.5" />
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {preset.description}
                            </p>
                          </div>

                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                            {preset.badge}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB: ADD ELEMENTS */}
            {activeLeftTab === 'add' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Text Elements
                  </h4>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => addElement('heading')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-600 flex items-center justify-center font-bold text-sm">
                        H1
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Heading</p>
                        <p className="text-[10px] text-slate-400">Large campaign title</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => addElement('subheading')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-600 flex items-center justify-center font-bold text-xs">
                        H2
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Subheading</p>
                        <p className="text-[10px] text-slate-400">Section title or highlight</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => addElement('text')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-600 flex items-center justify-center">
                        <Type className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Body Paragraph</p>
                        <p className="text-[10px] text-slate-400">Promotional descriptions</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Highlights & Badges
                  </h4>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => addElement('badge')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                        🏷️
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Pill Badge</p>
                        <p className="text-[10px] text-slate-400">Promotion / sale label</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => addElement('card')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-600 flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Feature Highlight Box</p>
                        <p className="text-[10px] text-slate-400">Coupon or specs card</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Media & Photos
                  </h4>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => addElement('banner')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Promotional Banner</p>
                        <p className="text-[10px] text-slate-400">Large hero image</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => addElement('image')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-600 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Product / Photo</p>
                        <p className="text-[10px] text-slate-400">Framed image block</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => addElement('logo')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-600 flex items-center justify-center font-bold text-xs">
                        ✦
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Brand Logo</p>
                        <p className="text-[10px] text-slate-400">Header logo image</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Action & Links
                  </h4>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => addElement('button')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <MousePointerClick className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">CTA Button</p>
                        <p className="text-[10px] text-slate-400">Call-to-action button</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => addElement('link')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-600 flex items-center justify-center">
                        <Link2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Website URL Link</p>
                        <p className="text-[10px] text-slate-400">Clickable link</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => addElement('footer')}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-600 flex items-center justify-center font-bold text-xs">
                        ©
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Footer Note</p>
                        <p className="text-[10px] text-slate-400">Unsubscribe & company</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: UPLOAD PHOTO (Preserving template's overall layout, typography, colors, and CTA style!) */}
            {activeLeftTab === 'photos' && (
              <div className="space-y-4">
                <ImageUploadArea
                  label="Upload Promo Image"
                  description="Upload a photo into this template. Design layout, colors, and button styles are preserved."
                  onChange={handlePhotoUpload}
                />
                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Layout Protection Active</span>
                  </p>
                  <p className="text-indigo-700">
                    Uploading your photo updates the template image slot without altering the unique design layout, typography, colors, or CTA button styles.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: STYLE & SUBJECT */}
            {activeLeftTab === 'style' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                    placeholder="Subject for recipient..."
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Use merge tags like <code>{'{{customer_name}}'}</code>
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Typography Font Family
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateStyle((prev) => ({ ...prev, fontFamily: 'sans' }))
                      }
                      className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                        templateStyle.fontFamily === 'sans'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-sans font-bold block text-sm">Inter Sans</span>
                      <span className="text-[10px] text-slate-400">Clean & Modern</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTemplateStyle((prev) => ({ ...prev, fontFamily: 'serif' }))
                      }
                      className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                        templateStyle.fontFamily === 'serif'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-serif font-bold block text-sm">Georgia Serif</span>
                      <span className="text-[10px] text-slate-400">Editorial & Luxury</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Card Background Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={templateStyle.canvasBgColor.startsWith('#') ? templateStyle.canvasBgColor : '#FFFFFF'}
                      onChange={(e) =>
                        setTemplateStyle((prev) => ({
                          ...prev,
                          canvasBgColor: e.target.value,
                        }))
                      }
                      className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={templateStyle.canvasBgColor}
                      onChange={(e) =>
                        setTemplateStyle((prev) => ({
                          ...prev,
                          canvasBgColor: e.target.value,
                        }))
                      }
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Outer Email Background
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={templateStyle.outerBgColor.startsWith('#') ? templateStyle.outerBgColor : '#F8FAFC'}
                      onChange={(e) =>
                        setTemplateStyle((prev) => ({
                          ...prev,
                          outerBgColor: e.target.value,
                        }))
                      }
                      className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={templateStyle.outerBgColor}
                      onChange={(e) =>
                        setTemplateStyle((prev) => ({
                          ...prev,
                          outerBgColor: e.target.value,
                        }))
                      }
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER: VISUAL DIRECT CANVAS */}
        <main
          className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center items-start transition-colors"
          style={{ backgroundColor: templateStyle.outerBgColor }}
        >
          <div
            className={`w-full transition-all duration-300 ${
              previewMode === 'mobile' ? 'max-w-[375px]' : 'max-w-[600px]'
            }`}
          >
            {/* Un-hosted Images Warning & 1-Click Host Banner */}
            {unhostedCount > 0 && (
              <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <BadgeAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-900">
                      {unhostedCount} Un-hosted Base64 Image{unhostedCount > 1 ? 's' : ''} Detected
                    </p>
                    <p className="text-[11px] text-amber-700">
                      Gmail and Outlook block Base64 images and display broken icons. Host them to public HTTPS storage now.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isAutoHosting}
                  onClick={handleAutoHostImages}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAutoHosting ? 'animate-spin' : ''}`} />
                  <span>{isAutoHosting ? 'Uploading Images...' : 'Host on Server Now'}</span>
                </button>
              </div>
            )}

            {/* Visual Canvas Card */}
            <div
              style={{
                backgroundColor: templateStyle.canvasBgColor,
                borderColor: templateStyle.cardBorder.includes('#')
                  ? templateStyle.cardBorder.match(/#[0-9a-fA-F]{3,8}/)?.[0] || '#E2E8F0'
                  : '#E2E8F0',
                borderRadius:
                  templateStyle.cardBorderRadius === '2xl'
                    ? '24px'
                    : templateStyle.cardBorderRadius === 'xl'
                    ? '16px'
                    : templateStyle.cardBorderRadius === 'sm'
                    ? '4px'
                    : templateStyle.cardBorderRadius === 'none'
                    ? '0px'
                    : '12px',
              }}
              className={`w-full shadow-lg border overflow-hidden transition-all ${
                templateStyle.fontFamily === 'serif' ? 'font-serif' : 'font-sans'
              }`}
            >
              {elements.length === 0 ? (
                <div className="py-20 text-center text-slate-400 space-y-3">
                  <LayoutTemplate className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">Canvas is empty</p>
                  <p className="text-xs text-slate-400">
                    Pick a design from the left panel or click Elements to add content.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100/30">
                  {elements.map((el, index) => {
                    const isSelected = el.id === selectedId;

                    return (
                      <div
                        key={el.id}
                        onClick={() => setSelectedId(el.id)}
                        className={`relative group transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-indigo-500/80 ring-offset-2 z-10'
                            : 'hover:outline-1 hover:outline-dashed hover:outline-indigo-300'
                        }`}
                      >
                        {/* Hover / Active Controls Bar */}
                        {isSelected && (
                          <div className="absolute -top-3.5 right-3 z-30 flex items-center bg-indigo-600 text-white rounded-lg shadow-md px-1.5 py-0.5 text-[10px] font-semibold gap-1">
                            <span className="capitalize">{el.type}</span>
                            <div className="h-2.5 w-px bg-white/40 mx-0.5" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveElement(el.id, 'up');
                              }}
                              disabled={index === 0}
                              className="p-0.5 hover:bg-white/20 rounded disabled:opacity-30"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveElement(el.id, 'down');
                              }}
                              disabled={index === elements.length - 1}
                              className="p-0.5 hover:bg-white/20 rounded disabled:opacity-30"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateElement(el.id);
                              }}
                              className="p-0.5 hover:bg-white/20 rounded"
                              title="Duplicate"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteElement(el.id);
                              }}
                              className="p-0.5 hover:bg-rose-500 rounded text-white"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Element Visual Renderers */}
                        <div style={{ padding: `${el.paddingY ?? 12}px 24px` }}>
                          {/* 1. BRAND LOGO */}
                          {el.type === 'logo' && (
                            <div
                              style={{ textAlign: el.textAlign || 'center' }}
                              className="w-full"
                            >
                              {el.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={el.imageUrl}
                                  alt={el.altText || 'Brand Logo'}
                                  className="max-h-12 max-w-[180px] inline-block object-contain"
                                />
                              ) : (
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 border border-dashed border-slate-300 text-xs text-slate-500 font-semibold">
                                  <ImageIcon className="w-4 h-4 text-slate-400" />
                                  <span>Click to upload Logo</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 2. LARGE PROMOTIONAL BANNER */}
                          {el.type === 'banner' && (
                            <div className="w-full text-center">
                              {el.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={el.imageUrl}
                                  alt={el.altText || 'Promotional Banner'}
                                  style={{
                                    borderRadius:
                                      templateStyle.cardBorderRadius === 'none'
                                        ? '0px'
                                        : '12px',
                                  }}
                                  className="w-full h-auto object-cover shadow-xs"
                                />
                              ) : (
                                <div className="w-full h-44 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 space-y-1">
                                  <ImageIcon className="w-8 h-8 text-slate-300" />
                                  <span className="text-xs font-bold text-slate-600">
                                    Upload Promotional Banner
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    Click here or use the photo upload panel
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 3. GENERAL IMAGE / PRODUCT PHOTO */}
                          {el.type === 'image' && (
                            <div style={{ textAlign: el.textAlign || 'center' }}>
                              {el.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={el.imageUrl}
                                  alt={el.altText || 'Image'}
                                  style={{
                                    borderRadius:
                                      templateStyle.cardBorderRadius === 'none'
                                        ? '0px'
                                        : '10px',
                                  }}
                                  className="max-w-full h-auto inline-block shadow-xs"
                                />
                              ) : (
                                <div className="w-full h-36 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                                  Upload photo in settings
                                </div>
                              )}
                            </div>
                          )}

                          {/* 4. PILL BADGE */}
                          {el.type === 'badge' && (
                            <div style={{ textAlign: el.textAlign || 'center' }}>
                              <span
                                style={{
                                  backgroundColor: el.bgColor || '#EFF6FF',
                                  color: el.textColor || '#2563EB',
                                }}
                                className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-2xs"
                              >
                                {el.content || 'Special Announcement'}
                              </span>
                            </div>
                          )}

                          {/* 5. HEADING */}
                          {el.type === 'heading' && (
                            <h1
                              style={{
                                textAlign: el.textAlign || 'center',
                                color:
                                  el.textColor ||
                                  (templateStyle.canvasBgColor === '#0B0F19'
                                    ? '#F8FAFC'
                                    : '#0F172A'),
                              }}
                              className={`leading-tight ${
                                el.fontWeight === 'extrabold'
                                  ? 'font-extrabold'
                                  : el.fontWeight === 'bold'
                                  ? 'font-bold'
                                  : 'font-semibold'
                              } ${
                                el.fontSize === '2xl'
                                  ? 'text-2xl'
                                  : el.fontSize === 'xl'
                                  ? 'text-xl'
                                  : 'text-lg'
                              }`}
                            >
                              {el.content || 'Heading Title'}
                            </h1>
                          )}

                          {/* 6. SUBHEADING */}
                          {el.type === 'subheading' && (
                            <h2
                              style={{
                                textAlign: el.textAlign || 'center',
                                color:
                                  el.textColor ||
                                  (templateStyle.canvasBgColor === '#0B0F19'
                                    ? '#94A3B8'
                                    : '#334155'),
                              }}
                              className="text-base sm:text-lg font-semibold leading-snug"
                            >
                              {el.content || 'Subheading text'}
                            </h2>
                          )}

                          {/* 7. BODY TEXT */}
                          {el.type === 'text' && (
                            <p
                              style={{
                                textAlign: el.textAlign || 'center',
                                color:
                                  el.textColor ||
                                  (templateStyle.canvasBgColor === '#0B0F19'
                                    ? '#94A3B8'
                                    : '#475569'),
                              }}
                              className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap"
                            >
                              {el.content || 'Add your text here...'}
                            </p>
                          )}

                          {/* 8. FEATURE / COUPON CARD */}
                          {el.type === 'card' && (
                            <div
                              style={{
                                backgroundColor: el.bgColor || '#F8FAFC',
                                borderColor: el.borderColor || '#E2E8F0',
                                color: el.textColor || '#1E293B',
                                textAlign: el.textAlign || 'center',
                              }}
                              className="w-full p-3.5 rounded-xl border text-xs sm:text-sm font-semibold leading-relaxed shadow-2xs"
                            >
                              {el.content || 'Card Highlight'}
                            </div>
                          )}

                          {/* 9. CTA BUTTON */}
                          {el.type === 'button' && (
                            <div style={{ textAlign: el.textAlign || 'center' }}>
                              <span
                                style={{
                                  backgroundColor:
                                    el.buttonColor ||
                                    templateStyle.primaryColor ||
                                    '#4F46E5',
                                  color: el.buttonTextColor || '#FFFFFF',
                                  borderRadius:
                                    el.borderRadius === 'full'
                                      ? '9999px'
                                      : el.borderRadius === 'lg'
                                      ? '12px'
                                      : el.borderRadius === 'sm'
                                      ? '4px'
                                      : el.borderRadius === 'none'
                                      ? '0px'
                                      : '8px',
                                }}
                                className="inline-block px-6 py-3 text-xs sm:text-sm font-bold shadow-sm transition-transform active:scale-95"
                              >
                                {el.content || 'Call to Action'}
                              </span>
                            </div>
                          )}

                          {/* 10. WEBSITE LINK */}
                          {el.type === 'link' && (
                            <div style={{ textAlign: el.textAlign || 'center' }}>
                              <span
                                style={{
                                  color:
                                    el.textColor ||
                                    templateStyle.primaryColor ||
                                    '#4F46E5',
                                }}
                                className="text-xs font-semibold underline inline-flex items-center gap-1"
                              >
                                <span>{el.content || 'www.yourwebsite.com'}</span>
                                <ExternalLink className="w-3 h-3 inline" />
                              </span>
                            </div>
                          )}

                          {/* 11. DIVIDER */}
                          {el.type === 'divider' && (
                            <div className="w-full border-t border-slate-200 my-1" />
                          )}

                          {/* 12. FOOTER */}
                          {el.type === 'footer' && (
                            <div
                              style={{
                                textAlign: el.textAlign || 'center',
                                color: el.textColor || '#94A3B8',
                              }}
                              className="text-[11px] leading-relaxed pt-2 border-t border-slate-100"
                            >
                              {el.content}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR: Settings for Currently Selected Element Only */}
        <aside className="w-80 bg-white border-l border-slate-200/80 flex flex-col z-10 flex-shrink-0 shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800">Element Properties</h3>
            </div>
            {selectedElement && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase font-bold">
                {selectedElement.type}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {!selectedElement ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Move className="w-6 h-6 mx-auto text-slate-300" />
                <p className="text-xs font-medium">Select an element on the canvas to customize its settings.</p>
              </div>
            ) : (
              <>
                {/* 1. PHOTO / IMAGE SETTINGS */}
                {(selectedElement.type === 'banner' ||
                  selectedElement.type === 'logo' ||
                  selectedElement.type === 'image') && (
                  <div className="space-y-4">
                    <ImageUploadArea
                      label={
                        selectedElement.type === 'logo'
                          ? 'Replace Brand Logo'
                          : 'Promotional Photo'
                      }
                      value={selectedElement.imageUrl}
                      filename={selectedElement.imageFilename}
                      description="Supported formats: JPG, JPEG, PNG, WEBP"
                      onChange={(url, filename) => {
                        updateSelectedElement({ imageUrl: url, imageFilename: filename });
                        const updated = elements.map((el) =>
                          el.id === selectedElement.id
                            ? { ...el, imageUrl: url, imageFilename: filename }
                            : el
                        );
                        setElements(updated);
                        pushHistory(updated);
                      }}
                      onRemove={() => {
                        updateSelectedElement({ imageUrl: '', imageFilename: '' });
                        const updated = elements.map((el) =>
                          el.id === selectedElement.id
                            ? { ...el, imageUrl: '', imageFilename: '' }
                            : el
                        );
                        setElements(updated);
                        pushHistory(updated);
                      }}
                    />

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Alt Text (Accessibility)
                      </label>
                      <input
                        type="text"
                        value={selectedElement.altText || ''}
                        onChange={(e) => updateSelectedElement({ altText: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium"
                        placeholder="Image description..."
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Optional Destination URL
                      </label>
                      <input
                        type="url"
                        value={selectedElement.url || ''}
                        onChange={(e) => updateSelectedElement({ url: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="https://yourwebsite.com/promo"
                      />
                    </div>
                  </div>
                )}

                {/* 2. TEXT CONTENT & STYLING */}
                {(selectedElement.type === 'heading' ||
                  selectedElement.type === 'subheading' ||
                  selectedElement.type === 'text' ||
                  selectedElement.type === 'footer' ||
                  selectedElement.type === 'link') && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Text Content
                      </label>
                      <textarea
                        rows={4}
                        value={selectedElement.content || ''}
                        onChange={(e) => updateSelectedElement({ content: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                        placeholder="Type message here..."
                      />
                    </div>

                    {/* Font Size & Weight */}
                    {selectedElement.type !== 'link' && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                            Size
                          </label>
                          <select
                            value={selectedElement.fontSize || 'md'}
                            onChange={(e) =>
                              updateSelectedElement({
                                fontSize: e.target.value as any,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                          >
                            <option value="sm">Small</option>
                            <option value="md">Regular</option>
                            <option value="lg">Large</option>
                            <option value="xl">Extra Large</option>
                            <option value="2xl">2X Large</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                            Weight
                          </label>
                          <select
                            value={selectedElement.fontWeight || 'normal'}
                            onChange={(e) =>
                              updateSelectedElement({
                                fontWeight: e.target.value as any,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                          >
                            <option value="normal">Normal</option>
                            <option value="semibold">Semi Bold</option>
                            <option value="bold">Bold</option>
                            <option value="extrabold">Extra Bold</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Text Color */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                        Text Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedElement.textColor || '#0F172A'}
                          onChange={(e) =>
                            updateSelectedElement({ textColor: e.target.value })
                          }
                          className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={selectedElement.textColor || '#0F172A'}
                          onChange={(e) =>
                            updateSelectedElement({ textColor: e.target.value })
                          }
                          className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Destination URL for Links */}
                    {selectedElement.type === 'link' && (
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Destination URL
                        </label>
                        <input
                          type="url"
                          value={selectedElement.url || ''}
                          onChange={(e) => updateSelectedElement({ url: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono"
                          placeholder="https://example.com"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 3. BADGE SETTINGS */}
                {selectedElement.type === 'badge' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Badge Label
                      </label>
                      <input
                        type="text"
                        value={selectedElement.content || ''}
                        onChange={(e) => updateSelectedElement({ content: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold"
                        placeholder="Announcement tag..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Background
                        </label>
                        <input
                          type="color"
                          value={selectedElement.bgColor || '#EFF6FF'}
                          onChange={(e) => updateSelectedElement({ bgColor: e.target.value })}
                          className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Text Color
                        </label>
                        <input
                          type="color"
                          value={selectedElement.textColor || '#2563EB'}
                          onChange={(e) => updateSelectedElement({ textColor: e.target.value })}
                          className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. CARD SETTINGS */}
                {selectedElement.type === 'card' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Card Content
                      </label>
                      <textarea
                        rows={3}
                        value={selectedElement.content || ''}
                        onChange={(e) => updateSelectedElement({ content: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium leading-relaxed resize-y"
                        placeholder="Feature highlight..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Background
                        </label>
                        <input
                          type="color"
                          value={selectedElement.bgColor || '#F8FAFC'}
                          onChange={(e) => updateSelectedElement({ bgColor: e.target.value })}
                          className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Text Color
                        </label>
                        <input
                          type="color"
                          value={selectedElement.textColor || '#1E293B'}
                          onChange={(e) => updateSelectedElement({ textColor: e.target.value })}
                          className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. BUTTON SETTINGS */}
                {selectedElement.type === 'button' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Button Label
                      </label>
                      <input
                        type="text"
                        value={selectedElement.content || ''}
                        onChange={(e) => updateSelectedElement({ content: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold"
                        placeholder="Call to action..."
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Destination URL
                      </label>
                      <input
                        type="url"
                        value={selectedElement.url || ''}
                        onChange={(e) => updateSelectedElement({ url: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="https://yourwebsite.com/checkout"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Button Color
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedElement.buttonColor || templateStyle.primaryColor || '#4F46E5'}
                            onChange={(e) =>
                              updateSelectedElement({ buttonColor: e.target.value })
                            }
                            className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                          />
                          <span className="font-mono text-[10px] text-slate-600 truncate">
                            {selectedElement.buttonColor || templateStyle.primaryColor || '#4F46E5'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Text Color
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedElement.buttonTextColor || '#FFFFFF'}
                            onChange={(e) =>
                              updateSelectedElement({ buttonTextColor: e.target.value })
                            }
                            className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                          />
                          <span className="font-mono text-[10px] text-slate-600 truncate">
                            {selectedElement.buttonTextColor || '#FFFFFF'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                        Corner Radius
                      </label>
                      <div className="grid grid-cols-5 gap-1 text-xs">
                        {(['none', 'sm', 'md', 'lg', 'full'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => updateSelectedElement({ borderRadius: r })}
                            className={`py-1 rounded-lg border text-center capitalize transition-all ${
                              (selectedElement.borderRadius || 'md') === r
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-bold'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. ALIGNMENT (SHARED) */}
                {selectedElement.type !== 'divider' && selectedElement.type !== 'banner' && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                      Alignment
                    </label>
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => updateSelectedElement({ textAlign: 'left' })}
                        className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all ${
                          selectedElement.textAlign === 'left'
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedElement({ textAlign: 'center' })}
                        className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all ${
                          (selectedElement.textAlign || 'center') === 'center'
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedElement({ textAlign: 'right' })}
                        className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all ${
                          selectedElement.textAlign === 'right'
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 7. VERTICAL SPACING PADDING */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-500">
                      Vertical Spacing
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      {selectedElement.paddingY ?? 12}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="2"
                    value={selectedElement.paddingY ?? 12}
                    onChange={(e) =>
                      updateSelectedElement({ paddingY: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* 8. DELETE ACTION */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => deleteElement(selectedElement.id)}
                    className="w-full py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete This Element</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
