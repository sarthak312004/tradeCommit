/**
 * Public contact details for the legal and support pages.
 * The value is included in the frontend build; never put secrets here.
 */
const supportEmail = (() => {
  const value = import.meta.env?.VITE_SUPPORT_EMAIL
  const confirmed = typeof value === 'string' && value.trim().length > 0

  return {
    value: confirmed ? value.trim() : '[SET A SUPPORT EMAIL BEFORE LAUNCH]',
    confirmed,
    placeholderLabel: 'Support email',
  }
})()

export const LEGAL_CONFIG = {
  productName: 'TradeCommit',
  lastUpdated: 'November 7, 2026',
  supportEmail,
}

export const LEGAL_PAGES = [
  {
    path: '/terms',
    shortLabel: 'Terms',
    title: 'Terms & Conditions',
    category: 'Legal',
    summary: 'Basic terms for using TradeCommit and purchasing a subscription.',
  },
  {
    path: '/privacy',
    shortLabel: 'Privacy',
    title: 'Privacy Policy',
    category: 'Privacy',
    summary: 'A short overview of how TradeCommit uses account and workspace information.',
  },
  {
    path: '/refund-policy',
    shortLabel: 'Refund Policy',
    title: 'Refund Policy',
    category: 'Billing Policies',
    summary: 'How to contact TradeCommit about a payment or refund.',
  },
  {
    path: '/cancellation-policy',
    shortLabel: 'Cancellation Policy',
    title: 'Cancellation Policy',
    category: 'Billing Policies',
    summary: 'How to stop a subscription and what happens to your account.',
  },
  {
    path: '/contact',
    shortLabel: 'Contact',
    title: 'Contact & Support',
    category: 'Support',
    summary: 'Contact TradeCommit about the app, a payment, or your account.',
  },
]
