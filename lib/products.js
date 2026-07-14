// ═══════════════════════════════════════════════════════════
// CENTRAL PRODUCT REGISTRY
// One place to register every paid product. Add a new product
// here — you do NOT need new API files or a new Stripe webhook.
//
// IMPORTANT: this file lives in /lib, not /api — Vercel only
// counts files under /api as Serverless Functions. Keeping
// shared code in /lib is what makes the 12-function Hobby
// limit a non-issue no matter how many products you add.
// ═══════════════════════════════════════════════════════════

const BASE = 'https://celarmarketinglab.com';

const PRODUCTS = {
  // key = the value of `id` used in celar_products.html / client_reference_id
  smm: {
    name: 'SMM Without Budget',
    productUrl: `${BASE}/smm-challenge-cml.html`,
    buyFallback: `${BASE}/celar_products.html`
  },
  'brand-voice': {
    name: 'Brand Voice Cheatsheet',
    productUrl: `${BASE}/brand-voice-cheatsheet.html`,
    buyFallback: `${BASE}/celar_products.html`
  },
  'icp-workbook': {
    name: 'ICP Workbook',
    productUrl: `${BASE}/icp-workbook-cml.html`,
    buyFallback: `${BASE}/celar_products.html`
  },
  'content-audit': {
    name: 'Content Audit Template',
    productUrl: `${BASE}/content-audit-template.html`,
    buyFallback: `${BASE}/celar_products.html`
  },
  'eu-checklist': {
    name: 'EU Market Entry Checklist',
    productUrl: `${BASE}/eu-market-entry-checklist.html`,
    buyFallback: `${BASE}/celar_products.html`
  }
  // Express Brand Check ('brand-check') is deliberately NOT here —
  // it's a document-delivery product, not token-gated. Don't add it
  // to this registry or the webhook will try to mint it a token.
  //
  // Add the next gated product here — three lines, no new function needed.
};

module.exports = { PRODUCTS };
