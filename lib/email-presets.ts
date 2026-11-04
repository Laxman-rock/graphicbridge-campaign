import { VisualElement, EmailTemplateStyle } from '@/types/email';

export interface EmailPreset {
  id: string;
  designId: string;
  name: string;
  description: string;
  category: 'onboarding' | 'marketing' | 'transactional' | 'newsletter' | 'promotions';
  badge: string;
  subject: string;
  variables: string[];
  gradient: string;
  templateStyle: EmailTemplateStyle;
  elements: VisualElement[];
  htmlContent: string;
}

// Helper to compile preset HTML with lossless studio metadata
function buildPresetHtml(
  name: string,
  style: EmailTemplateStyle,
  elements: VisualElement[]
): string {
  const isSerif = style.fontFamily === 'serif';
  const fontStack = isSerif
    ? "Georgia, 'Times New Roman', Garamond, serif"
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const renderedBlocks = elements
    .map((el) => {
      const align = el.textAlign || 'center';
      const pY = el.paddingY ?? 12;

      switch (el.type) {
        case 'logo':
          if (!el.imageUrl) return '';
          return `
          <tr>
            <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align};">
              <img src="${el.imageUrl}" alt="${el.altText || 'Logo'}" width="180" border="0" style="max-height: 48px; width: auto; max-width: 180px; display: inline-block; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
            </td>
          </tr>`;

        case 'banner':
          if (!el.imageUrl) return '';
          const bannerRadius = style.cardBorderRadius === 'none' ? '0px' : '10px';
          return `
          <tr>
            <td align="center" style="padding: ${pY}px 0; text-align: center;">
              ${
                el.url
                  ? `<a href="${el.url}" target="_blank" style="text-decoration:none; display:block;">`
                  : ''
              }
              <img src="${el.imageUrl}" alt="${el.altText || 'Banner'}" width="600" border="0" style="width: 100%; max-width: 100%; height: auto; display: block; border: 0; border-radius: ${bannerRadius}; margin: 0 auto; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
              ${el.url ? `</a>` : ''}
            </td>
          </tr>`;

        case 'image':
          if (!el.imageUrl) return '';
          const imgRadius = style.cardBorderRadius === 'none' ? '0px' : '8px';
          return `
          <tr>
            <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align};">
              ${
                el.url
                  ? `<a href="${el.url}" target="_blank" style="text-decoration:none;">`
                  : ''
              }
              <img src="${el.imageUrl}" alt="${el.altText || 'Image'}" width="600" border="0" style="width: 100%; max-width: 100%; height: auto; display: inline-block; border: 0; border-radius: ${imgRadius}; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
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
              }; color: ${el.textColor || '#0F172A'}; line-height: 1.3;">
                ${el.content || ''}
              </h1>
            </td>
          </tr>`;

        case 'subheading':
          return `
          <tr>
            <td align="${align}" style="padding: ${pY}px 24px; text-align: ${align};">
              <h2 style="margin: 0; font-family: ${fontStack}; font-size: 17px; font-weight: 600; color: ${
                el.textColor || '#475569'
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
                el.textColor || '#475569'
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
                    el.buttonColor || '#4F46E5'
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
                el.textColor || '#4F46E5'
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

  const studioMeta = `<!-- CAMPAIGN_STUDIO_DATA: ${JSON.stringify({
    designId: style.designId,
    templateStyle: style,
    elements,
  })} -->`;

  const containerRadius =
    style.cardBorderRadius === '2xl'
      ? '20px'
      : style.cardBorderRadius === 'xl'
      ? '16px'
      : style.cardBorderRadius === 'none'
      ? '0px'
      : '8px';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${style.outerBgColor}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  ${studioMeta}
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${style.outerBgColor}; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: ${style.canvasBgColor}; border-radius: ${containerRadius}; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05); border: ${style.cardBorder};">
          ${renderedBlocks}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// 1. MINIMAL
const MINIMAL_ELEMENTS: VisualElement[] = [
  {
    id: 'min-logo',
    type: 'logo',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=240&q=80',
    altText: 'Minimal Studio Logo',
    textAlign: 'left',
    paddingY: 16,
  },
  {
    id: 'min-divider-1',
    type: 'divider',
    paddingY: 8,
  },
  {
    id: 'min-heading',
    type: 'heading',
    content: 'Clear thoughts for {{customer_name}}.',
    fontSize: 'xl',
    fontWeight: 'medium',
    textAlign: 'left',
    textColor: '#0F172A',
    paddingY: 12,
  },
  {
    id: 'min-image',
    type: 'image',
    imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1000&q=80',
    imageFilename: 'minimal-workspace.jpg',
    altText: 'Minimal Workspace Photo',
    textAlign: 'left',
    paddingY: 16,
  },
  {
    id: 'min-text',
    type: 'text',
    content:
      'We believe the highest quality communications respect your time and attention. Focus on what moves your vision forward without clutter or noise.',
    fontSize: 'md',
    fontWeight: 'normal',
    textAlign: 'left',
    textColor: '#475569',
    paddingY: 10,
  },
  {
    id: 'min-btn',
    type: 'button',
    content: 'Read Essay Online',
    url: 'https://example.com/essay',
    buttonColor: '#0F172A',
    buttonTextColor: '#FFFFFF',
    borderRadius: 'sm',
    textAlign: 'left',
    paddingY: 16,
  },
  {
    id: 'min-footer',
    type: 'footer',
    content: '© 2026 {{company_name}} • Built with minimal craft • Unsubscribe anytime',
    textAlign: 'left',
    textColor: '#94A3B8',
    paddingY: 24,
  },
];

const MINIMAL_STYLE: EmailTemplateStyle = {
  canvasBgColor: '#FFFFFF',
  outerBgColor: '#F8FAFC',
  fontFamily: 'sans',
  cardBorderRadius: 'sm',
  cardBorder: '1px solid #E2E8F0',
  primaryColor: '#0F172A',
  designId: 'minimal',
};

// 2. MODERN BUSINESS
const MODERN_BUSINESS_ELEMENTS: VisualElement[] = [
  {
    id: 'biz-badge',
    type: 'badge',
    content: 'Enterprise Workflow Engine',
    bgColor: '#EFF6FF',
    textColor: '#2563EB',
    textAlign: 'center',
    paddingY: 12,
  },
  {
    id: 'biz-heading',
    type: 'heading',
    content: 'Scale with {{company_name}} Faster 💼',
    fontSize: '2xl',
    fontWeight: 'extrabold',
    textAlign: 'center',
    textColor: '#0F172A',
    paddingY: 8,
  },
  {
    id: 'biz-text-1',
    type: 'text',
    content:
      'Hi {{customer_name}}, your corporate workspace is activated. Coordinate multi-channel campaigns with automated delivery pipelines, live metrics, and real-time contact validation.',
    fontSize: 'md',
    fontWeight: 'normal',
    textAlign: 'center',
    textColor: '#475569',
    paddingY: 8,
  },
  {
    id: 'biz-banner',
    type: 'banner',
    imageUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80',
    imageFilename: 'saas-analytics-dashboard.jpg',
    altText: 'Corporate Analytics Workspace',
    paddingY: 16,
  },
  {
    id: 'biz-card',
    type: 'card',
    content: '✓ SOC2 Type II Certified  •  99.99% Guaranteed Delivery  •  24/7 Dedicated Account Manager',
    bgColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    textColor: '#1E293B',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'biz-btn',
    type: 'button',
    content: 'Open Business Workspace →',
    url: 'https://example.com/workspace',
    buttonColor: '#2563EB',
    buttonTextColor: '#FFFFFF',
    borderRadius: 'md',
    textAlign: 'center',
    paddingY: 18,
  },
  {
    id: 'biz-link',
    type: 'link',
    content: 'Schedule private technical consultation',
    url: 'https://example.com/demo',
    textColor: '#2563EB',
    textAlign: 'center',
    paddingY: 8,
  },
  {
    id: 'biz-footer',
    type: 'footer',
    content: '© 2026 {{company_name}} Inc. 100 Enterprise Way, Suite 500. Confidential & Secure.',
    textAlign: 'center',
    textColor: '#94A3B8',
    paddingY: 20,
  },
];

const MODERN_BUSINESS_STYLE: EmailTemplateStyle = {
  canvasBgColor: '#FFFFFF',
  outerBgColor: '#F1F5F9',
  fontFamily: 'sans',
  cardBorderRadius: 'xl',
  cardBorder: '1px solid #CBD5E1',
  primaryColor: '#2563EB',
  designId: 'modern_business',
};

// 3. PROMOTIONAL BANNER
const PROMO_BANNER_ELEMENTS: VisualElement[] = [
  {
    id: 'promo-logo',
    type: 'logo',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=240&q=80',
    altText: 'Promotional Brand Logo',
    textAlign: 'center',
    paddingY: 12,
  },
  {
    id: 'promo-banner',
    type: 'banner',
    imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
    imageFilename: 'seasonal-promotions.jpg',
    altText: 'Vibrant Seasonal Promo Banner',
    paddingY: 14,
  },
  {
    id: 'promo-heading',
    type: 'heading',
    content: 'Unlock 40% Off Your Entire Order 🎉',
    fontSize: '2xl',
    fontWeight: 'extrabold',
    textAlign: 'center',
    textColor: '#1E1B4B',
    paddingY: 12,
  },
  {
    id: 'promo-text-1',
    type: 'text',
    content:
      'For the next 48 hours only, {{customer_name}}, treat yourself to our highest discounts of the season with code SAVE40.',
    fontSize: 'md',
    fontWeight: 'normal',
    textAlign: 'center',
    textColor: '#4338CA',
    paddingY: 8,
  },
  {
    id: 'promo-btn',
    type: 'button',
    content: 'Claim Your 40% Discount Now',
    url: 'https://example.com/promo',
    buttonColor: '#4F46E5',
    buttonTextColor: '#FFFFFF',
    borderRadius: 'full',
    textAlign: 'center',
    paddingY: 16,
  },
  {
    id: 'promo-text-2',
    type: 'text',
    content: '⏳ Offer expires Sunday midnight. Free worldwide express shipping on orders over $60.',
    fontSize: 'sm',
    fontWeight: 'normal',
    textAlign: 'center',
    textColor: '#6B7280',
    paddingY: 6,
  },
  {
    id: 'promo-link',
    type: 'link',
    content: 'Visit our promotion showroom: www.example.com',
    url: 'https://example.com',
    textColor: '#4F46E5',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'promo-footer',
    type: 'footer',
    content: '© 2026 {{company_name}}. You received this exclusive offer as a valued VIP customer.',
    textAlign: 'center',
    textColor: '#94A3B8',
    paddingY: 20,
  },
];

const PROMO_BANNER_STYLE: EmailTemplateStyle = {
  canvasBgColor: '#FFFFFF',
  outerBgColor: '#EEF2FF',
  fontFamily: 'sans',
  cardBorderRadius: '2xl',
  cardBorder: '1px solid #C7D2FE',
  primaryColor: '#4F46E5',
  designId: 'promotional_banner',
};

// 4. PRODUCT SHOWCASE
const PRODUCT_SHOWCASE_ELEMENTS: VisualElement[] = [
  {
    id: 'prod-badge',
    type: 'badge',
    content: '✦ Featured Hardware Release',
    bgColor: '#DCFCE7',
    textColor: '#15803D',
    textAlign: 'center',
    paddingY: 12,
  },
  {
    id: 'prod-heading',
    type: 'heading',
    content: 'Acoustic Precision Pro 2026',
    fontSize: '2xl',
    fontWeight: 'bold',
    textAlign: 'center',
    textColor: '#064E3B',
    paddingY: 8,
  },
  {
    id: 'prod-image',
    type: 'image',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80',
    imageFilename: 'flagship-headphones.jpg',
    altText: 'Flagship Acoustic Pro Headphones',
    textAlign: 'center',
    paddingY: 14,
  },
  {
    id: 'prod-text',
    type: 'text',
    content:
      'Engineered with custom aerospace beryllium drivers, 45-hour ultra battery endurance, and zero-distortion active noise cancellation.',
    fontSize: 'md',
    fontWeight: 'normal',
    textAlign: 'center',
    textColor: '#374151',
    paddingY: 8,
  },
  {
    id: 'prod-card',
    type: 'card',
    content: 'Launch Price: $199  (MSRP $299)  •  30-Day Risk-Free Audition  •  Free Shipping',
    bgColor: '#F8FAFC',
    borderColor: '#E5E7EB',
    textColor: '#1F2937',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'prod-btn',
    type: 'button',
    content: 'Order Acoustic Pro Today',
    url: 'https://example.com/product/acoustic-pro',
    buttonColor: '#059669',
    buttonTextColor: '#FFFFFF',
    borderRadius: 'md',
    textAlign: 'center',
    paddingY: 16,
  },
  {
    id: 'prod-link',
    type: 'link',
    content: 'Compare detailed tech specs & frequency response →',
    url: 'https://example.com/compare',
    textColor: '#059669',
    textAlign: 'center',
    paddingY: 8,
  },
  {
    id: 'prod-footer',
    type: 'footer',
    content: '© 2026 {{company_name}} Innovations. Official 2-year manufacturer warranty included.',
    textAlign: 'center',
    textColor: '#94A3B8',
    paddingY: 20,
  },
];

const PRODUCT_SHOWCASE_STYLE: EmailTemplateStyle = {
  canvasBgColor: '#FFFFFF',
  outerBgColor: '#F0FDF4',
  fontFamily: 'sans',
  cardBorderRadius: 'xl',
  cardBorder: '1px solid #D1FAE5',
  primaryColor: '#059669',
  designId: 'product_showcase',
};

// 5. E-COMMERCE SALE
const ECOMMERCE_SALE_ELEMENTS: VisualElement[] = [
  {
    id: 'sale-badge',
    type: 'badge',
    content: '🔥 24-HOUR FLASH SALE - 50% OFF',
    bgColor: '#FFE4E6',
    textColor: '#BE123C',
    textAlign: 'center',
    paddingY: 12,
  },
  {
    id: 'sale-banner',
    type: 'banner',
    imageUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80',
    imageFilename: 'store-sale-banner.jpg',
    altText: 'Storewide Flash Sale Banner',
    paddingY: 12,
  },
  {
    id: 'sale-heading',
    type: 'heading',
    content: 'MASSIVE STOREWIDE CLEARANCE',
    fontSize: '2xl',
    fontWeight: 'extrabold',
    textAlign: 'center',
    textColor: '#9F1239',
    paddingY: 10,
  },
  {
    id: 'sale-text-1',
    type: 'text',
    content:
      'Over 500+ premium catalog items marked down half price for {{customer_name}}. Once current warehouse stock is gone, these prices will never return!',
    fontSize: 'md',
    fontWeight: 'normal',
    textAlign: 'center',
    textColor: '#4C0519',
    paddingY: 8,
  },
  {
    id: 'sale-card',
    type: 'card',
    content: '🎟️ Use Coupon Code: FLASH50  (Applied instantly at checkout)',
    bgColor: '#FFF1F2',
    borderColor: '#FDA4AF',
    textColor: '#9F1239',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'sale-btn',
    type: 'button',
    content: 'Shop the 50% Off Sale Now →',
    url: 'https://example.com/sale',
    buttonColor: '#E11D48',
    buttonTextColor: '#FFFFFF',
    borderRadius: 'full',
    textAlign: 'center',
    paddingY: 18,
  },
  {
    id: 'sale-text-2',
    type: 'text',
    content: '⚡ Free expedited shipping on all clearance items over $40.',
    fontSize: 'sm',
    fontWeight: 'normal',
    textAlign: 'center',
    textColor: '#881337',
    paddingY: 6,
  },
  {
    id: 'sale-footer',
    type: 'footer',
    content: '© 2026 {{company_name}} Retail Stores. All rights reserved.',
    textAlign: 'center',
    textColor: '#FDA4AF',
    paddingY: 20,
  },
];

const ECOMMERCE_SALE_STYLE: EmailTemplateStyle = {
  canvasBgColor: '#FFFFFF',
  outerBgColor: '#FFF1F2',
  fontFamily: 'sans',
  cardBorderRadius: '2xl',
  cardBorder: '2px solid #FECDD3',
  primaryColor: '#E11D48',
  designId: 'ecommerce_sale',
};

// 6. ELEGANT / LUXURY
const ELEGANT_ELEMENTS: VisualElement[] = [
  {
    id: 'elg-logo',
    type: 'logo',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=240&q=80',
    altText: 'Atelier Monogram',
    textAlign: 'center',
    paddingY: 16,
  },
  {
    id: 'elg-badge',
    type: 'badge',
    content: 'Private Membership Preview',
    bgColor: 'rgba(180, 83, 9, 0.1)',
    textColor: '#92400E',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'elg-heading',
    type: 'heading',
    content: 'The Atelier Autumn Collection',
    fontSize: '2xl',
    fontWeight: 'medium',
    textAlign: 'center',
    textColor: '#1C1917',
    paddingY: 12,
  },
  {
    id: 'elg-banner',
    type: 'banner',
    imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
    imageFilename: 'luxury-couture-editorial.jpg',
    altText: 'Luxury Couture Editorial',
    paddingY: 16,
  },
  {
    id: 'elg-text-1',
    type: 'text',
    content:
      'Handcrafted with timeless devotion. Discover exquisite Italian cashmere and tailored wool silhouettes designed to transcend passing seasons with effortless grace.',
    fontSize: 'md',
    fontWeight: 'normal',
    textAlign: 'center',
    textColor: '#44403C',
    paddingY: 12,
  },
  {
    id: 'elg-btn',
    type: 'button',
    content: 'Explore the Atelier Collection',
    url: 'https://example.com/atelier',
    buttonColor: '#78350F',
    buttonTextColor: '#FDFBF7',
    borderRadius: 'sm',
    textAlign: 'center',
    paddingY: 18,
  },
  {
    id: 'elg-link',
    type: 'link',
    content: 'Request personal boutique concierge service',
    url: 'https://example.com/concierge',
    textColor: '#92400E',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'elg-footer',
    type: 'footer',
    content: 'Maison {{company_name}} • Via Condotti 48, Roma • Unsubscribe',
    textAlign: 'center',
    textColor: '#78716C',
    paddingY: 24,
  },
];

const ELEGANT_STYLE: EmailTemplateStyle = {
  canvasBgColor: '#FAF7F2',
  outerBgColor: '#F4EFEA',
  fontFamily: 'serif',
  cardBorderRadius: 'sm',
  cardBorder: '1px solid #E7DEC8',
  primaryColor: '#78350F',
  designId: 'elegant',
};

// 7. NEWSLETTER / EDITORIAL
const NEWSLETTER_ELEMENTS: VisualElement[] = [
  {
    id: 'news-masthead',
    type: 'card',
    content: 'THE WEEKLY DISPATCH • ISSUE #48 • 5 MIN READ',
    bgColor: '#0F172A',
    borderColor: '#0F172A',
    textColor: '#F8FAFC',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'news-heading',
    type: 'heading',
    content: 'Why Simplicity Is Winning in 2026',
    fontSize: '2xl',
    fontWeight: 'bold',
    textAlign: 'left',
    textColor: '#0F172A',
    paddingY: 12,
  },
  {
    id: 'news-image',
    type: 'image',
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80',
    imageFilename: 'editorial-architecture.jpg',
    altText: 'Editorial Architecture Photo',
    textAlign: 'center',
    paddingY: 14,
  },
  {
    id: 'news-text-1',
    type: 'text',
    content:
      'In this week\'s essay, we analyze how leading engineering teams stripped 60% of accidental complexity by adopting unified declarative systems over disjointed toolchains.',
    fontSize: 'md',
    fontWeight: 'normal',
    textAlign: 'left',
    textColor: '#334155',
    paddingY: 10,
  },
  {
    id: 'news-card',
    type: 'card',
    content: 'Key Takeaways: 1. Native autonomy beats brittle scripts • 2. Colocation of logic and UI • 3. Sub-second feedback loops',
    bgColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    textColor: '#1E293B',
    textAlign: 'left',
    paddingY: 10,
  },
  {
    id: 'news-btn',
    type: 'button',
    content: 'Read Full 10-Minute Deep Dive →',
    url: 'https://example.com/dispatch/48',
    buttonColor: '#0F172A',
    buttonTextColor: '#FFFFFF',
    borderRadius: 'md',
    textAlign: 'left',
    paddingY: 16,
  },
  {
    id: 'news-link',
    type: 'link',
    content: 'Browse previous issue archives and discussions',
    url: 'https://example.com/archives',
    textColor: '#2563EB',
    textAlign: 'left',
    paddingY: 8,
  },
  {
    id: 'news-footer',
    type: 'footer',
    content: 'Curated with passion by {{company_name}} editors. Forward to a friend or colleague.',
    textAlign: 'left',
    textColor: '#94A3B8',
    paddingY: 20,
  },
];

const NEWSLETTER_STYLE: EmailTemplateStyle = {
  canvasBgColor: '#FFFFFF',
  outerBgColor: '#F8FAFC',
  fontFamily: 'sans',
  cardBorderRadius: 'xl',
  cardBorder: '1px solid #E2E8F0',
  primaryColor: '#0F172A',
  designId: 'newsletter',
};

// 8. BOLD MARKETING
const BOLD_MARKETING_ELEMENTS: VisualElement[] = [
  {
    id: 'bold-badge',
    type: 'badge',
    content: '⚡ NEXT GEN PROTOCOL',
    bgColor: 'rgba(139, 92, 246, 0.2)',
    textColor: '#A78BFA',
    textAlign: 'center',
    paddingY: 14,
  },
  {
    id: 'bold-heading',
    type: 'heading',
    content: 'Built for the Next Era of Builders',
    fontSize: '2xl',
    fontWeight: 'extrabold',
    textAlign: 'center',
    textColor: '#F8FAFC',
    paddingY: 10,
  },
  {
    id: 'bold-banner',
    type: 'banner',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    imageFilename: 'cyber-matrix-grid.jpg',
    altText: 'Next Gen Cyber Matrix',
    paddingY: 14,
  },
  {
    id: 'bold-text',
    type: 'text',
    content:
      'Zero cold starts. Autonomous background tasks. Limitless compute. Deploy enterprise AI infrastructure in a fraction of the time.',
    fontSize: 'md',
    fontWeight: 'normal',
    textAlign: 'center',
    textColor: '#94A3B8',
    paddingY: 8,
  },
  {
    id: 'bold-card',
    type: 'card',
    content: '⚡ 10x Faster Dispatches  •  99.999% Fault Tolerance  •  Global Edge Distribution',
    bgColor: 'rgba(30, 41, 59, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    textColor: '#E2E8F0',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'bold-btn',
    type: 'button',
    content: 'Get Instant Protocol Access →',
    url: 'https://example.com/protocol',
    buttonColor: '#7C3AED',
    buttonTextColor: '#FFFFFF',
    borderRadius: 'full',
    textAlign: 'center',
    paddingY: 18,
  },
  {
    id: 'bold-link',
    type: 'link',
    content: 'Join 45,000+ developers in the Discord Community',
    url: 'https://discord.gg/example',
    textColor: '#A78BFA',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'bold-footer',
    type: 'footer',
    content: '// {{company_name}} Autonomous Network Inc. Systems Nominal.',
    textAlign: 'center',
    textColor: '#64748B',
    paddingY: 20,
  },
];

const BOLD_MARKETING_STYLE: EmailTemplateStyle = {
  canvasBgColor: '#0B0F19',
  outerBgColor: '#030712',
  fontFamily: 'sans',
  cardBorderRadius: '2xl',
  cardBorder: '1px solid rgba(255, 255, 255, 0.12)',
  primaryColor: '#7C3AED',
  designId: 'bold_marketing',
};

// 9. PRINTRICK (Red & White Brand Theme - Professional Printing & E-commerce)
const PRINTRICK_ELEMENTS: VisualElement[] = [
  {
    id: 'prt-logo',
    type: 'logo',
    imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=240&q=80',
    altText: 'Printrick Official Logo',
    textAlign: 'center',
    paddingY: 14,
  },
  {
    id: 'prt-badge',
    type: 'badge',
    content: 'PRINTRICK CUSTOM PRINT LAB',
    bgColor: '#FEF2F2',
    textColor: '#DC2626',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'prt-banner',
    type: 'banner',
    imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    imageFilename: 'printrick-promo-banner.jpg',
    altText: 'Printrick Promotional Print Banner',
    paddingY: 14,
  },
  {
    id: 'prt-heading',
    type: 'heading',
    content: 'Precision Custom Prints for Your Brand',
    fontSize: '2xl',
    fontWeight: 'extrabold',
    textAlign: 'center',
    textColor: '#991B1B',
    paddingY: 10,
  },
  {
    id: 'prt-desc',
    type: 'text',
    content:
      'From vibrant custom packaging and marketing collateral to high-volume promotional merchandise, Printrick delivers crisp detail, premium paper stocks, and rapid turnaround for {{customer_name}}.',
    fontSize: 'md',
    fontWeight: 'normal',
    textAlign: 'center',
    textColor: '#4B5563',
    paddingY: 8,
  },
  {
    id: 'prt-card',
    type: 'card',
    content: '✓ 1200 DPI High-Definition Print  •  Matte & Gloss Finishes  •  Fast Commercial Dispatch',
    bgColor: '#FFF5F5',
    borderColor: '#FCA5A5',
    textColor: '#B91C1C',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'prt-btn',
    type: 'button',
    content: 'Start Your Custom Print Order →',
    url: 'https://printrick.com/order',
    buttonColor: '#DC2626',
    buttonTextColor: '#FFFFFF',
    borderRadius: 'md',
    textAlign: 'center',
    paddingY: 18,
  },
  {
    id: 'prt-link',
    type: 'link',
    content: 'Explore full product catalog: www.printrick.com',
    url: 'https://printrick.com',
    textColor: '#DC2626',
    textAlign: 'center',
    paddingY: 8,
  },
  {
    id: 'prt-footer',
    type: 'footer',
    content: '© 2026 Printrick Merchandising & Printing Inc. 500 Industrial Pkwy. Reply STOP to unsubscribe.',
    textAlign: 'center',
    textColor: '#9CA3AF',
    paddingY: 20,
  },
];

const PRINTRICK_STYLE: EmailTemplateStyle = {
  canvasBgColor: '#FFFFFF',
  outerBgColor: '#FEF2F2',
  fontFamily: 'sans',
  cardBorderRadius: 'xl',
  cardBorder: '1px solid #FEE2E2',
  primaryColor: '#DC2626',
  designId: 'printrick',
};

// 10. GRAPHICBRIDGE (Purple & White Brand Theme - Creative Digital Design Agency)
const GRAPHICBRIDGE_ELEMENTS: VisualElement[] = [
  {
    id: 'gb-logo',
    type: 'logo',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=240&q=80',
    altText: 'GraphicBridge Creative Studio',
    textAlign: 'center',
    paddingY: 14,
  },
  {
    id: 'gb-badge',
    type: 'badge',
    content: 'GRAPHICBRIDGE CREATIVE STUDIO',
    bgColor: '#F3E8FF',
    textColor: '#9333EA',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'gb-banner',
    type: 'banner',
    imageUrl: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1200&q=80',
    imageFilename: 'graphicbridge-creative-banner.jpg',
    altText: 'GraphicBridge Design Showcase Banner',
    paddingY: 14,
  },
  {
    id: 'gb-heading',
    type: 'heading',
    content: 'Distinctive Design Systems for Bold Brands',
    fontSize: '2xl',
    fontWeight: 'extrabold',
    textAlign: 'center',
    textColor: '#581C87',
    paddingY: 10,
  },
  {
    id: 'gb-desc',
    type: 'text',
    content:
      'GraphicBridge partners with ambitious brands to craft award-winning UI/UX interfaces, identity systems, and high-impact digital campaigns that captivate audiences and drive conversions for {{customer_name}}.',
    fontSize: 'md',
    fontWeight: 'normal',
    textAlign: 'center',
    textColor: '#4B5563',
    paddingY: 8,
  },
  {
    id: 'gb-card',
    type: 'card',
    content: '✦ Bespoke Brand Identities  •  Design Systems & Prototypes  •  High-Impact Digital Assets',
    bgColor: '#FAF5FF',
    borderColor: '#D8B4FE',
    textColor: '#6B21A8',
    textAlign: 'center',
    paddingY: 10,
  },
  {
    id: 'gb-btn',
    type: 'button',
    content: 'Explore Creative Showcase →',
    url: 'https://graphicbridge.com/portfolio',
    buttonColor: '#9333EA',
    buttonTextColor: '#FFFFFF',
    borderRadius: 'full',
    textAlign: 'center',
    paddingY: 18,
  },
  {
    id: 'gb-link',
    type: 'link',
    content: 'View agency case studies: www.graphicbridge.com',
    url: 'https://graphicbridge.com',
    textColor: '#9333EA',
    textAlign: 'center',
    paddingY: 8,
  },
  {
    id: 'gb-footer',
    type: 'footer',
    content: '© 2026 GraphicBridge Design Studio. Elevating digital craft worldwide. Unsubscribe anytime.',
    textAlign: 'center',
    textColor: '#9CA3AF',
    paddingY: 20,
  },
];

const GRAPHICBRIDGE_STYLE: EmailTemplateStyle = {
  canvasBgColor: '#FFFFFF',
  outerBgColor: '#FAF5FF',
  fontFamily: 'sans',
  cardBorderRadius: '2xl',
  cardBorder: '1px solid #E9D5FF',
  primaryColor: '#9333EA',
  designId: 'graphicbridge',
};

// Curated Presets
export const EMAIL_PRESETS: EmailPreset[] = [
  {
    id: 'minimal_clean',
    designId: 'minimal',
    name: 'Minimal Clean',
    description: 'Clean whitespace, understated typography, and sharp monochrome accents.',
    category: 'newsletter',
    badge: 'Ultra Clean',
    subject: 'A quiet update from {{company_name}}',
    variables: ['customer_name', 'company_name'],
    gradient: 'from-slate-700 to-slate-900',
    templateStyle: MINIMAL_STYLE,
    elements: MINIMAL_ELEMENTS,
    htmlContent: buildPresetHtml('Minimal Clean', MINIMAL_STYLE, MINIMAL_ELEMENTS),
  },
  {
    id: 'welcome_modern_saas',
    designId: 'modern_business',
    name: 'Modern Business SaaS',
    description: 'Corporate tech aesthetic with structured cards, feature bullets, and enterprise CTA.',
    category: 'onboarding',
    badge: 'Enterprise',
    subject: 'Welcome to {{company_name}}, {{customer_name}}! 💼',
    variables: ['customer_name', 'company_name', 'dashboard_url'],
    gradient: 'from-blue-600 to-indigo-700',
    templateStyle: MODERN_BUSINESS_STYLE,
    elements: MODERN_BUSINESS_ELEMENTS,
    htmlContent: buildPresetHtml('Modern Business SaaS', MODERN_BUSINESS_STYLE, MODERN_BUSINESS_ELEMENTS),
  },
  {
    id: 'promotional_banner',
    designId: 'promotional_banner',
    name: 'Promotional Banner Blast',
    description: 'High-impact announcement with edge-to-edge marketing photo and discount badge.',
    category: 'promotions',
    badge: 'High Impact',
    subject: '⚡ Exclusive 40% discount unlocked for {{customer_name}}!',
    variables: ['customer_name', 'company_name'],
    gradient: 'from-indigo-600 to-violet-700',
    templateStyle: PROMO_BANNER_STYLE,
    elements: PROMO_BANNER_ELEMENTS,
    htmlContent: buildPresetHtml('Promotional Banner Blast', PROMO_BANNER_STYLE, PROMO_BANNER_ELEMENTS),
  },
  {
    id: 'product_showcase',
    designId: 'product_showcase',
    name: 'Product Showcase & Spotlight',
    description: 'E-commerce single product feature with high-resolution photo, specs, and price card.',
    category: 'marketing',
    badge: 'Spotlight',
    subject: 'Meet the new {{company_name}} flagship series ✦',
    variables: ['customer_name', 'company_name'],
    gradient: 'from-emerald-600 to-teal-700',
    templateStyle: PRODUCT_SHOWCASE_STYLE,
    elements: PRODUCT_SHOWCASE_ELEMENTS,
    htmlContent: buildPresetHtml('Product Showcase & Spotlight', PRODUCT_SHOWCASE_STYLE, PRODUCT_SHOWCASE_ELEMENTS),
  },
  {
    id: 'flash_sale_promo',
    designId: 'ecommerce_sale',
    name: 'E-commerce Flash Sale',
    description: 'High-urgency retail clearance with bold red accents, discount banners, and coupon box.',
    category: 'promotions',
    badge: '50% OFF',
    subject: '🔥 FLASH SALE: 50% Off Everything ends tonight!',
    variables: ['customer_name', 'company_name'],
    gradient: 'from-rose-600 to-red-700',
    templateStyle: ECOMMERCE_SALE_STYLE,
    elements: ECOMMERCE_SALE_ELEMENTS,
    htmlContent: buildPresetHtml('E-commerce Flash Sale', ECOMMERCE_SALE_STYLE, ECOMMERCE_SALE_ELEMENTS),
  },
  {
    id: 'elegant_luxury',
    designId: 'elegant',
    name: 'Elegant & Luxury Boutique',
    description: 'Warm ivory parchment, serif typography, framed imagery, and refined bronze accents.',
    category: 'marketing',
    badge: 'Artisanal Serif',
    subject: 'An exclusive invitation from {{company_name}}',
    variables: ['customer_name', 'company_name'],
    gradient: 'from-amber-700 to-yellow-900',
    templateStyle: ELEGANT_STYLE,
    elements: ELEGANT_ELEMENTS,
    htmlContent: buildPresetHtml('Elegant & Luxury Boutique', ELEGANT_STYLE, ELEGANT_ELEMENTS),
  },
  {
    id: 'newsletter_editorial',
    designId: 'newsletter',
    name: 'Weekly Editorial Newsletter',
    description: 'Publication digest layout with dark masthead header, 16:9 story photo, and takeaways.',
    category: 'newsletter',
    badge: 'Content Digest',
    subject: 'The Dispatch #48: Architecture and simplicity 📰',
    variables: ['customer_name', 'company_name'],
    gradient: 'from-slate-800 to-slate-950',
    templateStyle: NEWSLETTER_STYLE,
    elements: NEWSLETTER_ELEMENTS,
    htmlContent: buildPresetHtml('Weekly Editorial Newsletter', NEWSLETTER_STYLE, NEWSLETTER_ELEMENTS),
  },
  {
    id: 'bold_marketing',
    designId: 'bold_marketing',
    name: 'Bold Dark Mode Marketing',
    description: 'High-contrast obsidian theme with electric violet gradients and futuristic tech cards.',
    category: 'marketing',
    badge: 'Dark Tech',
    subject: '⚡ Experience the future with {{company_name}}',
    variables: ['customer_name', 'company_name'],
    gradient: 'from-violet-900 via-indigo-950 to-slate-950',
    templateStyle: BOLD_MARKETING_STYLE,
    elements: BOLD_MARKETING_ELEMENTS,
    htmlContent: buildPresetHtml('Bold Dark Mode Marketing', BOLD_MARKETING_STYLE, BOLD_MARKETING_ELEMENTS),
  },
  {
    id: 'printrick_custom_print',
    designId: 'printrick',
    name: 'Printrick Custom Printing',
    description: 'Professional printing & merchandising layout with bold red accents and clean typography.',
    category: 'promotions',
    badge: 'Printrick Red',
    subject: 'Special Custom Print Discounts for {{customer_name}} | Printrick 🖨️',
    variables: ['customer_name', 'company_name'],
    gradient: 'from-red-600 via-rose-600 to-red-700',
    templateStyle: PRINTRICK_STYLE,
    elements: PRINTRICK_ELEMENTS,
    htmlContent: buildPresetHtml('Printrick Custom Printing', PRINTRICK_STYLE, PRINTRICK_ELEMENTS),
  },
  {
    id: 'graphicbridge_design_agency',
    designId: 'graphicbridge',
    name: 'GraphicBridge Design Studio',
    description: 'Modern, creative digital design agency template with vibrant purple & white styling.',
    category: 'marketing',
    badge: 'GraphicBridge Purple',
    subject: 'Transform your brand visual identity with GraphicBridge ✦',
    variables: ['customer_name', 'company_name'],
    gradient: 'from-purple-600 via-violet-600 to-indigo-700',
    templateStyle: GRAPHICBRIDGE_STYLE,
    elements: GRAPHICBRIDGE_ELEMENTS,
    htmlContent: buildPresetHtml('GraphicBridge Design Studio', GRAPHICBRIDGE_STYLE, GRAPHICBRIDGE_ELEMENTS),
  },
];
