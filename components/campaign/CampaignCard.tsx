import React from 'react';
import Link from 'next/link';
import { Mail, MessageSquare, ArrowRight, FileSpreadsheet, Check } from 'lucide-react';

interface CampaignCardProps {
  type: 'email' | 'whatsapp';
}

export default function CampaignCard({ type }: CampaignCardProps) {
  const isEmail = type === 'email';

  const config = isEmail
    ? {
        title: 'Email Campaign',
        description: 'Import contact lists and prepare email campaigns for your audience.',
        cta: 'Create Email Campaign',
        href: '/dashboard/email',
        icon: Mail,
        accentBg: 'bg-blue-50/70',
        accentBorder: 'border-blue-200/80',
        hoverBorder: 'hover:border-blue-400',
        badgeBg: 'bg-blue-100 text-blue-700',
        btnBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 shadow-blue-500/20',
        iconColor: 'text-blue-600',
        features: ['RFC-5322 format validation', 'Automatic duplicate deduplication', 'Error report export'],
      }
    : {
        title: 'WhatsApp Campaign',
        description: 'Import contacts and prepare WhatsApp campaigns for your audience.',
        cta: 'Create WhatsApp Campaign',
        href: '/dashboard/whatsapp',
        icon: MessageSquare,
        accentBg: 'bg-emerald-50/70',
        accentBorder: 'border-emerald-200/80',
        hoverBorder: 'hover:border-emerald-400',
        badgeBg: 'bg-emerald-100 text-emerald-800',
        btnBg: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 shadow-emerald-500/20',
        iconColor: 'text-emerald-600',
        features: ['E.164 phone number sanitation', 'Preserves international prefixes', 'Zero-data loss CSV preview'],
      };

  const Icon = config.icon;

  return (
    <div
      className={`group relative flex flex-col justify-between p-8 rounded-3xl bg-white border ${config.accentBorder} ${config.hoverBorder} shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden`}
    >
      {/* Decorative gradient glow */}
      <div
        className={`absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full ${
          isEmail ? 'bg-blue-400/10' : 'bg-emerald-400/10'
        } blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500`}
      />

      <div>
        {/* Top Header & Badges */}
        <div className="flex items-center justify-between mb-6">
          <div
            className={`w-14 h-14 rounded-2xl ${config.accentBg} flex items-center justify-center ${config.iconColor} shadow-inner`}
          >
            <Icon className="w-7 h-7" />
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${config.badgeBg}`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            CSV Import
          </span>
        </div>

        {/* Title & Description */}
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          {config.title}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          {config.description}
        </p>

        {/* Feature bullets */}
        <div className="space-y-2 mb-8 pt-4 border-t border-slate-100">
          {config.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  isEmail ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <Link
        href={config.href}
        className={`w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl text-white font-semibold text-sm shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.btnBg}`}
      >
        <span>{config.cta}</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}

