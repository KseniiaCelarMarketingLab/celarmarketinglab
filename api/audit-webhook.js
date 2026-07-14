// api/audit-webhook.js
// Stripe webhook for the Content Audit Template (€24).
// Separate endpoint + separate signing secret from every other product's
// webhook — independent Redis namespace ("audit_") so nothing here can
// collide with smm_/icp_/bvc_ tokens.
//
// This is the ASYNC BACKUP path. The primary path is the instant redirect
// handled by audit-session-token.js — Stripe returns the buyer straight to
// content-audit-template.html?session_id=... and that endpoint verifies the
// session directly and unlocks access immediately. This webhook exists so
// access still arrives by email even if the buyer closes the tab before the
// redirect finishes, or if JS fails to run. Both paths are idempotent (see
// getOrCreateToken below) so whichever runs first "wins" and the other just
// reuses the same token.
//
// Vercel env vars required (Settings → General → Environment Variables):
//   STRIPE_AUDIT_WEBHOOK_SECRET  — signing secret for THIS endpoint only
//   STRIPE_SECRET_KEY            — shared with every other product's webhook
//   STRIPE_AUDIT_PRICE_ID        — optional but recommended; Price ID for the
//                                  €24 Content Audit Template. Without it,
//                                  the webhook falls back to checking
//                                  client_reference_id === 'audit'.
//   UPSTASH_REDIS_REST_URL       — shared Upstash instance
//   UPSTASH_REDIS_REST_TOKEN     — shared Upstash instance
//   RESEND_API_KEY               — shared Resend key (celarmarketinglab.com
//                                  is already verified, no extra setup)

import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const resend = new Resend(process.env.RESEND_API_KEY);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Reuse a token already issued for this email (e.g. by the instant-redirect
// path in audit-session-token.js) instead of always minting a new one, so a
// single buyer always ends up with exactly one token regardless of which
// path ran first.
async function getOrCreateToken(email, stripeSessionId) {
  const existing = await redis.get('audit_email:' + email);
  if (existing) return existing;

  const token = randomBytes(32).toString('hex');
  const ttl = 60 * 60 * 24 * 365 * 10; // 10 years
  await redis.set('audit_token:' + token, JSON.stringify({
    email,
    createdAt: new Date().toISOString(),
    stripeSessionId,
  }), { ex: ttl });
  await redis.set('audit_email:' + email, token, { ex: ttl });
  return token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_AUDIT_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Audit webhook signature verification failed:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;

  // ── Guard: make sure this checkout was actually for the Content Audit
  // Template. Stripe fires checkout.session.completed for every purchase on
  // the account to every subscribed endpoint, regardless of product — this
  // is the bug flagged in the original shared stripe-webhook.js. If
  // STRIPE_AUDIT_PRICE_ID is set, verify the line item matches. Otherwise
  // fall back to client_reference_id, and finally process everything (fail
  // open) so this still works before the price ID is configured.
  const expectedPriceId = process.env.STRIPE_AUDIT_PRICE_ID;
  if (expectedPriceId) {
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
      const matches = lineItems.data.some((li) => li.price?.id === expectedPriceId);
      if (!matches) {
        return res.status(200).json({ received: true, skipped: 'not_audit_product' });
      }
    } catch (err) {
      console.error('Audit webhook: could not verify line items:', err.message);
      // fail open on Stripe API errors — don't block a legitimate buyer
    }
  } else if (session.client_reference_id && session.client_reference_id !== 'audit') {
    return res.status(200).json({ received: true, skipped: 'not_audit_reference' });
  }

  const email = session.customer_details?.email || session.customer_email;
  if (!email) {
    console.error('Audit webhook: no email on session', session.id);
    return res.status(200).json({ received: true, skipped: 'no_email' });
  }

  const token = await getOrCreateToken(email, session.id);
  const accessUrl = 'https://celarmarketinglab.com/content-audit-template.html?token=' + token;

  try {
    await resend.emails.send({
      from: 'Celar Marketing Lab <noreply@celarmarketinglab.com>',
      to: email,
      subject: 'Your Content Audit Template is ready',
      html: buildEmailHTML(accessUrl),
    });
  } catch (err) {
    // Token already exists either way — email failure shouldn't fail the webhook
    console.error('Audit webhook: Resend send failed:', err.message);
  }

  console.log('Content Audit Template access sent to ' + email);
  return res.status(200).json({ received: true, sent: true });
}

function buildEmailHTML(accessUrl) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{margin:0;padding:0;background:#0B0F2B;font-family:'Helvetica Neue',Arial,sans-serif;color:#DCDCDC}
.wrap{max-width:560px;margin:0 auto;padding:48px 32px}
.logo{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(220,220,220,.4);margin-bottom:40px}
.logo span{color:#00FFF0}
.title{font-size:28px;font-weight:700;color:#F5F5F5;line-height:1.1;margin-bottom:16px}
.body-text{font-size:14px;line-height:1.7;color:#DCDCDC;margin-bottom:28px}
.btn{display:inline-block;background:rgba(0,255,240,.08);border:1.5px solid #00FFF0;color:#00FFF0;text-decoration:none;padding:14px 26px;font-size:13px;font-weight:600;border-radius:2px}
.foot{margin-top:40px;font-size:11px;color:rgba(220,220,220,.35);line-height:1.7}
.foot a{color:rgba(220,220,220,.5)}
</style></head>
<body>
<div class="wrap">
  <div class="logo">CELAR <span>MARKETING LAB</span></div>
  <div class="title">Your Content Audit Template is ready.</div>
  <div class="body-text">
    Score what you've already published, find your recurring gaps, and walk away with a prioritised fix list — not just a diagnosis. Takes about 15–20 minutes.
  </div>
  <a class="btn" href="${accessUrl}">Open your audit →</a>
  <div class="foot">
    This link is yours — bookmark it, your progress saves automatically as you go.<br>
    Questions? Just reply to this email.<br><br>
    <a href="https://celarmarketinglab.com">celarmarketinglab.com</a>
  </div>
</div>
</body>
</html>`;
}
