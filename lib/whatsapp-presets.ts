import { WhatsAppTemplate } from '@/types/whatsapp';

export const WHATSAPP_PRESET_TEMPLATES: WhatsAppTemplate[] = [
  {
    template_id: 'preset_welcome_onboarding',
    name: 'welcome_onboarding',
    category: 'MARKETING',
    language: 'en',
    status: 'APPROVED',
    is_active: true,
    last_synced_at: new Date().toISOString(),
    variables: ['1', '2'],
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Welcome to Our Community! 🎉',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nThank you for joining us! Your account (ID: {{2}}) is now active and ready. Explore our platform features or reply if you need any assistance.',
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to opt out of updates',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: 'Explore Dashboard',
          },
          {
            type: 'QUICK_REPLY',
            text: 'Chat with Support',
          },
        ],
      },
    ],
  },
  {
    template_id: 'preset_order_update_alert',
    name: 'order_update_alert',
    category: 'UTILITY',
    language: 'en',
    status: 'APPROVED',
    is_active: true,
    last_synced_at: new Date().toISOString(),
    variables: ['1', '2', '3', '4'],
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Order Status Update 📦',
      },
      {
        type: 'BODY',
        text: 'Hi {{1}},\n\nYour order #{{2}} for "{{3}}" has been processed and is out for delivery. Expected arrival: {{4}}.\n\nThank you for choosing us!',
      },
      {
        type: 'FOOTER',
        text: 'Customer Care & Shipping',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Track Order',
            url: 'https://example.com/track',
          },
        ],
      },
    ],
  },
  {
    template_id: 'preset_account_security_otp',
    name: 'account_security_otp',
    category: 'AUTHENTICATION',
    language: 'en',
    status: 'APPROVED',
    is_active: true,
    last_synced_at: new Date().toISOString(),
    variables: ['1'],
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Security Verification Code 🔐',
      },
      {
        type: 'BODY',
        text: 'Your one-time authentication code is *{{1}}*.\n\nThis verification code expires in 10 minutes. For your security, never share this code with anyone.',
      },
      {
        type: 'FOOTER',
        text: 'Automated Security Alert',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'COPY_CODE',
            text: 'Copy Verification Code',
            example: '849201',
          },
        ],
      },
    ],
  },
  {
    template_id: 'preset_special_discount_offer',
    name: 'special_discount_offer',
    category: 'MARKETING',
    language: 'en',
    status: 'APPROVED',
    is_active: true,
    last_synced_at: new Date().toISOString(),
    variables: ['1', '2', '3'],
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE',
      },
      {
        type: 'BODY',
        text: 'Exclusive VIP Offer for {{1}}! 🌟\n\nGet an instant *{{2}}% DISCOUNT* across our full catalog. Use promo code *{{3}}* at checkout.\n\nOffer valid this weekend only!',
      },
      {
        type: 'FOOTER',
        text: 'Terms & conditions apply',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Claim Discount',
            url: 'https://example.com/offers',
          },
          {
            type: 'PHONE_NUMBER',
            text: 'Call Us Now',
            phone_number: '+18005550199',
          },
        ],
      },
    ],
  },
];

