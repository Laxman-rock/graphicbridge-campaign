'use client';

import React from 'react';
import { EmailPreset } from '@/lib/email-presets';

interface TemplateThumbnailPreviewProps {
  preset: EmailPreset;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function TemplateThumbnailPreview({
  preset,
  size = 'md',
  className = '',
}: TemplateThumbnailPreviewProps) {
  const { designId, templateStyle } = preset;
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  // Find primary image for thumbnail if available
  const heroImage = preset.elements.find(
    (el) => (el.type === 'banner' || el.type === 'image') && el.imageUrl
  )?.imageUrl;

  return (
    <div
      className={`relative w-full overflow-hidden select-none transition-all ${
        isSm ? 'h-24' : isLg ? 'h-52' : 'h-44'
      } ${className}`}
      style={{ backgroundColor: templateStyle.outerBgColor }}
    >
      {/* Inner Mini Email Card */}
      <div
        className="w-[90%] mx-auto mt-2 h-full rounded-t-lg shadow-sm border overflow-hidden flex flex-col pointer-events-none"
        style={{
          backgroundColor: templateStyle.canvasBgColor,
          borderColor: templateStyle.cardBorder.includes('#')
            ? templateStyle.cardBorder.match(/#[0-9a-fA-F]{3,8}/)?.[0] || '#E2E8F0'
            : '#E2E8F0',
          fontFamily:
            templateStyle.fontFamily === 'serif'
              ? 'Georgia, serif'
              : 'system-ui, sans-serif',
        }}
      >
        {/* DESIGN-SPECIFIC MOCKUPS */}

        {/* 1. MINIMAL */}
        {designId === 'minimal' && (
          <div className="p-2 sm:p-3 space-y-1.5 flex-1 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 pb-1 border-b border-slate-200">
                <div className="w-2 h-2 rounded-full bg-slate-900" />
                <div className="w-10 h-1.5 bg-slate-800 rounded-full" />
              </div>
              <div className="w-3/4 h-2.5 bg-slate-900 rounded-xs mt-1" />
              <div className="w-1/2 h-1.5 bg-slate-400 rounded-xs" />
            </div>

            {heroImage && (
              <div className="w-full h-14 sm:h-20 rounded-xs overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt="Minimal Mockup"
                  className="w-full h-full object-cover grayscale opacity-90"
                />
              </div>
            )}

            <div className="space-y-1">
              <div className="w-full h-1 bg-slate-300 rounded-full" />
              <div className="w-4/5 h-1 bg-slate-300 rounded-full" />
            </div>

            <div className="pt-0.5">
              <div className="inline-block px-2.5 py-1 bg-slate-900 text-[8px] font-medium text-white rounded-xs">
                Read Essay
              </div>
            </div>
          </div>
        )}

        {/* 2. MODERN BUSINESS */}
        {designId === 'modern_business' && (
          <div className="p-2 sm:p-3 space-y-1.5 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="px-1.5 py-0.5 rounded-full text-[7px] font-bold bg-blue-50 text-blue-600 uppercase border border-blue-200">
                Enterprise
              </span>
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
            </div>

            <div className="space-y-0.5 text-center">
              <div className="w-3/4 h-2.5 bg-slate-900 rounded-xs mx-auto" />
              <div className="w-1/2 h-1 bg-slate-400 rounded-xs mx-auto" />
            </div>

            {heroImage && (
              <div className="w-full h-14 sm:h-20 rounded-md overflow-hidden border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt="Business Mockup"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="px-2 py-1 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-[7px] text-slate-700">
              <span className="font-semibold">✓ 99.99% SLA</span>
              <span className="font-semibold">✓ SOC2 Certified</span>
            </div>

            <div className="text-center">
              <div className="inline-block px-3 py-1 bg-blue-600 text-[8px] font-bold text-white rounded-md shadow-xs">
                Launch Workspace →
              </div>
            </div>
          </div>
        )}

        {/* 3. PROMOTIONAL BANNER */}
        {designId === 'promotional_banner' && (
          <div className="flex-1 flex flex-col justify-between">
            {heroImage && (
              <div className="w-full h-16 sm:h-24 overflow-hidden relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt="Promo Banner Mockup"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-[7px] font-bold text-white uppercase tracking-wider shadow-xs">
                  40% Off
                </div>
              </div>
            )}

            <div className="p-2 sm:p-2.5 space-y-1 text-center">
              <div className="w-4/5 h-2.5 bg-indigo-950 rounded-xs mx-auto" />
              <div className="w-3/5 h-1 bg-indigo-400 rounded-xs mx-auto" />

              <div className="pt-1">
                <div className="inline-block px-3.5 py-1 bg-indigo-600 text-[8px] font-extrabold text-white rounded-full shadow-xs">
                  Claim Discount Now
                </div>
              </div>
              <div className="w-1/3 h-1 bg-slate-300 rounded-xs mx-auto mt-0.5" />
            </div>
          </div>
        )}

        {/* 4. PRODUCT SHOWCASE */}
        {designId === 'product_showcase' && (
          <div className="p-2 sm:p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-center">
              <span className="px-1.5 py-0.5 rounded-full text-[7px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✦ Spotlight Release
              </span>
            </div>

            <div className="w-2/3 h-2 bg-emerald-950 rounded-xs mx-auto" />

            {heroImage && (
              <div className="w-24 sm:w-32 h-14 sm:h-20 mx-auto rounded-lg overflow-hidden border border-emerald-100 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt="Product Showcase Mockup"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-center text-[7px] font-bold text-slate-800">
              Only $199 <span className="line-through text-slate-400">$299</span>
            </div>

            <div className="text-center">
              <div className="inline-block px-3 py-1 bg-emerald-600 text-[8px] font-bold text-white rounded-md shadow-xs">
                Order Product Now
              </div>
            </div>
          </div>
        )}

        {/* 5. E-COMMERCE FLASH SALE */}
        {designId === 'ecommerce_sale' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="bg-rose-600 text-white text-[7px] font-extrabold py-0.5 text-center uppercase tracking-wider">
              🔥 24-Hour Flash Sale - 50% Off
            </div>

            {heroImage && (
              <div className="w-full h-14 sm:h-20 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt="Flash Sale Mockup"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-2 text-center space-y-1">
              <div className="w-4/5 h-2.5 bg-rose-900 rounded-xs mx-auto" />
              <div className="w-1/2 h-1 bg-rose-400 rounded-xs mx-auto" />

              <div className="px-2 py-0.5 rounded border border-dashed border-rose-300 bg-rose-50 text-[7px] font-mono font-bold text-rose-700">
                Code: FLASH50
              </div>

              <div className="pt-0.5">
                <div className="inline-block px-3 py-1 bg-rose-600 text-[8px] font-extrabold text-white rounded-full shadow-xs">
                  Shop 50% Off Sale →
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. ELEGANT / LUXURY */}
        {designId === 'elegant' && (
          <div
            className="p-2 sm:p-3 space-y-1.5 flex-1 flex flex-col justify-between"
            style={{ backgroundColor: '#FAF7F2' }}
          >
            <div className="text-center space-y-0.5">
              <div className="w-3 h-3 rounded-full border border-amber-800/40 mx-auto flex items-center justify-center text-[6px] font-serif text-amber-900">
                ✦
              </div>
              <span className="text-[6px] uppercase tracking-widest text-amber-900/70 font-semibold block">
                Private Preview
              </span>
              <div className="w-3/4 h-2 bg-amber-950/80 rounded-xs mx-auto" />
            </div>

            {heroImage && (
              <div className="w-full h-14 sm:h-20 overflow-hidden border border-amber-900/20 p-0.5 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt="Elegant Mockup"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="text-center space-y-0.5">
              <div className="w-4/5 h-1 bg-amber-900/30 rounded-full mx-auto" />
              <div className="w-3/5 h-1 bg-amber-900/20 rounded-full mx-auto" />
            </div>

            <div className="text-center pt-0.5">
              <div className="inline-block px-3 py-1 bg-amber-900 text-[7px] font-medium tracking-wider text-amber-50 uppercase rounded-xs">
                Explore Atelier
              </div>
            </div>
          </div>
        )}

        {/* 7. NEWSLETTER / EDITORIAL */}
        {designId === 'newsletter' && (
          <div className="p-2 sm:p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
            <div className="bg-slate-900 text-white text-[6.5px] font-bold py-1 px-2 rounded flex items-center justify-between tracking-wide">
              <span>THE WEEKLY DISPATCH</span>
              <span className="text-slate-400">#48</span>
            </div>

            <div className="w-4/5 h-2 bg-slate-900 rounded-xs" />

            {heroImage && (
              <div className="w-full h-14 sm:h-18 rounded overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt="Editorial Mockup"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-0.5">
              <div className="w-full h-1 bg-slate-300 rounded-full" />
              <div className="w-5/6 h-1 bg-slate-300 rounded-full" />
            </div>

            <div>
              <div className="inline-block px-2.5 py-1 bg-slate-900 text-[7.5px] font-bold text-white rounded">
                Read Deep Dive →
              </div>
            </div>
          </div>
        )}

        {/* 8. BOLD MARKETING */}
        {designId === 'bold_marketing' && (
          <div
            className="p-2 sm:p-2.5 space-y-1.5 flex-1 flex flex-col justify-between"
            style={{ backgroundColor: '#0B0F19' }}
          >
            <div className="flex items-center justify-between">
              <span className="px-1.5 py-0.5 rounded-full text-[6.5px] font-bold bg-violet-950/80 text-violet-300 border border-violet-800">
                ⚡ NEW RELEASE
              </span>
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            </div>

            <div className="w-4/5 h-2.5 bg-slate-100 rounded-xs mx-auto" />

            {heroImage && (
              <div className="w-full h-14 sm:h-20 rounded-md overflow-hidden border border-slate-800 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt="Bold Tech Mockup"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-center text-[6.5px] font-mono text-slate-300">
              ⚡ 10x Speed • 99.999% SLA
            </div>

            <div className="text-center">
              <div className="inline-block px-3 py-1 bg-violet-600 text-[8px] font-extrabold text-white rounded-full shadow-md shadow-violet-600/30">
                Get Instant Access →
              </div>
            </div>
          </div>
        )}

        {/* 9. PRINTRICK (Red & White Brand Theme) */}
        {designId === 'printrick' && (
          <div className="p-2 sm:p-2.5 space-y-1.5 flex-1 flex flex-col justify-between bg-white">
            <div className="flex items-center justify-between">
              <span className="px-1.5 py-0.5 rounded-full text-[6.5px] font-bold bg-red-50 text-red-600 border border-red-200 uppercase tracking-wide">
                PRINTRICK LAB
              </span>
              <div className="w-2 h-2 rounded-xs bg-red-600" />
            </div>

            <div className="space-y-0.5 text-center">
              <div className="w-4/5 h-2 bg-red-900 rounded-xs mx-auto" />
              <div className="w-1/2 h-1 bg-slate-400 rounded-xs mx-auto" />
            </div>

            {heroImage && (
              <div className="w-full h-14 sm:h-20 rounded-md overflow-hidden border border-red-100 shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt="Printrick Mockup"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="px-2 py-0.5 rounded bg-red-50/60 border border-red-200 text-center text-[6.5px] font-medium text-red-800">
              ✓ 1200 DPI Quality • Eco Inks • Fast Dispatch
            </div>

            <div className="text-center">
              <div className="inline-block px-3 py-1 bg-red-600 text-[8px] font-bold text-white rounded-md shadow-xs">
                Start Print Order →
              </div>
            </div>
          </div>
        )}

        {/* 10. GRAPHICBRIDGE (Purple & White Brand Theme) */}
        {designId === 'graphicbridge' && (
          <div className="p-2 sm:p-2.5 space-y-1.5 flex-1 flex flex-col justify-between bg-white">
            <div className="flex items-center justify-between">
              <span className="px-1.5 py-0.5 rounded-full text-[6.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wide">
                GRAPHICBRIDGE
              </span>
              <div className="w-2 h-2 rounded-full bg-purple-600" />
            </div>

            <div className="space-y-0.5 text-center">
              <div className="w-4/5 h-2 bg-purple-900 rounded-xs mx-auto" />
              <div className="w-3/5 h-1 bg-purple-400/60 rounded-xs mx-auto" />
            </div>

            {heroImage && (
              <div className="w-full h-14 sm:h-20 rounded-lg overflow-hidden border border-purple-100 shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt="GraphicBridge Mockup"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="px-2 py-0.5 rounded bg-purple-50/70 border border-purple-200 text-center text-[6.5px] font-medium text-purple-800">
              ✦ Brand Identities • UI/UX Systems • 3D Assets
            </div>

            <div className="text-center">
              <div className="inline-block px-3 py-1 bg-purple-600 text-[8px] font-bold text-white rounded-full shadow-sm shadow-purple-600/25">
                Explore Portfolio →
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

