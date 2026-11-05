'use client';

import React from 'react';
import {
  CheckCheck,
  ExternalLink,
  PhoneCall,
  CornerDownLeft,
  Copy,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { WhatsAppTemplateComponent } from '@/types/whatsapp';

interface WhatsAppBubblePreviewProps {
  headerText?: string;
  headerMediaUrl?: string;
  headerMediaType?: 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  bodyText: string;
  footerText?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP' | string;
    text: string;
    url?: string;
    phone_number?: string;
    example?: string;
  }>;
  timestamp?: string;
}

export default function WhatsAppBubblePreview({
  headerText,
  headerMediaUrl,
  headerMediaType,
  bodyText,
  footerText,
  buttons = [],
  timestamp = '12:45 PM',
}: WhatsAppBubblePreviewProps) {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [headerMediaUrl]);

  // Format basic whatsapp bold/italics
  const formatWhatsAppText = (text: string) => {
    return text
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/~([^~]+)~/g, '<del>$1</del>');
  };

  return (
    <div className="w-full max-w-[340px] sm:max-w-[380px] mx-auto rounded-3xl p-4 sm:p-5 bg-[#EFEAE2] shadow-inner relative overflow-hidden select-none border border-slate-300/80">
      {/* Background subtle doodle pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
          backgroundSize: '16px 16px',
        }}
      />

      {/* Date badge */}
      <div className="text-center mb-3">
        <span className="bg-white/80 backdrop-blur-xs text-[10px] font-semibold text-slate-500 px-3 py-1 rounded-lg shadow-2xs">
          TODAY
        </span>
      </div>

      {/* WhatsApp Message Bubble */}
      <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm p-3.5 space-y-2.5 relative border border-slate-200/60">
        {/* Header Component */}
        {headerMediaType === 'IMAGE' && (
          <div className="rounded-xl overflow-hidden bg-slate-100 h-36 flex items-center justify-center border border-slate-200">
            {headerMediaUrl && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={headerMediaUrl}
                alt="Header Media"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex flex-col items-center text-slate-400 text-xs px-2 text-center">
                <ImageIcon className="w-6 h-6 mb-1 text-slate-400" />
                <span className="text-[11px] font-medium text-slate-500">
                  {imgError ? 'Header Photo (Preview expired)' : 'Header Photo'}
                </span>
              </div>
            )}
          </div>
        )}

        {headerMediaType === 'DOCUMENT' && (
          <div className="rounded-xl p-3 bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">Document Attachment</p>
              <p className="text-[10px] text-slate-400">PDF • Attachment</p>
            </div>
          </div>
        )}

        {headerText && (
          <h4 className="font-bold text-slate-900 text-xs leading-snug tracking-tight">
            {headerText}
          </h4>
        )}

        {/* Body Text */}
        <div
          className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap break-words"
          dangerouslySetInnerHTML={{ __html: formatWhatsAppText(bodyText) }}
        />

        {/* Footer & Meta Time */}
        <div className="flex items-end justify-between pt-1 gap-2">
          {footerText ? (
            <p className="text-[10px] text-slate-400 font-normal leading-tight">{footerText}</p>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1 flex-shrink-0 text-[10px] text-slate-400">
            <span>{timestamp}</span>
            <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Buttons Component (Displayed beneath bubble in modern WhatsApp style) */}
      {buttons.length > 0 && (
        <div className="mt-1 space-y-1">
          {buttons.map((btn, idx) => (
            <div
              key={idx}
              className="w-full bg-white/95 backdrop-blur-xs rounded-xl shadow-xs py-2 px-3 text-center text-xs font-semibold text-blue-600 flex items-center justify-center gap-1.5 border border-slate-200/70"
            >
              {btn.type === 'URL' && <ExternalLink className="w-3 h-3 text-blue-500" />}
              {btn.type === 'PHONE_NUMBER' && <PhoneCall className="w-3 h-3 text-blue-500" />}
              {btn.type === 'QUICK_REPLY' && <CornerDownLeft className="w-3 h-3 text-blue-500" />}
              {(btn.type === 'COPY_CODE' || btn.type === 'OTP') && <Copy className="w-3 h-3 text-blue-500" />}
              <span>{btn.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

