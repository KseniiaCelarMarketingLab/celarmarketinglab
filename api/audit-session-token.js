// api/audit-session-token.js
// Called the instant a buyer lands back on content-audit-template.html with
// ?session_id=... from Stripe's success_url. Verifies the session directly
// against Stripe (not waiting for the async checkout.session.completed
// webhook) so access unlocks immediately instead of after an email round-trip.
//
// Idempotent with audit-webhook.js — both call the same getOrCreateToken
// logic keyed by email, so whichever fires first "wins" and the buyer only
// ever gets one token.

import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import { randomBytes } from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function getOrCreateToken(email, stripeSessionId) {
  const existing = await redis.get('audit_email:' + email);
  if (existing) return existing;

  const token = randomBytes(32).toString('hex');
  const ttl = 60 * 60 * 24 * 365 * 10;
  await redis.set('audit_token:' + token, JSON.stringify({
    email,
    createdAt: new Date().toISOString(),
    stripeSessionId,
  }), { ex: ttl });
  await redis.set('audit_email:' + email, token, { ex: ttl });
  return token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://celarmarketinglab.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method !== 'GET') return res.status(405).end();

  const { session_id } = req.query;
  if (!session_id || typeof session_id !== 'string') {
    return res.status(200).json({ ok: false, reason: 'missing_session_id' });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['line_items'] });
  } catch (err) {
    console.error('audit-session-token: could not retrieve session:', err.message);
    return res.status(200).json({ ok: false, reason: 'stripe_error' });
  }

  if (session.payment_status !== 'paid') {
    return res.status(200).json({ ok: false, reason: 'not_paid' });
  }

  // Same product guard as audit-webhook.js — confirm this session was
  // actually for the Content Audit Template before handing out access.
  const expectedPriceId = process.env.STRIPE_AUDIT_PRICE_ID;
  if (expectedPriceId) {
    const matches = (session.line_items?.data || []).some((li) => li.price?.id === expectedPriceId);
    if (!matches) return res.status(200).json({ ok: false, reason: 'wrong_product' });
  } else if (session.client_reference_id && session.client_reference_id !== 'audit') {
    return res.status(200).json({ ok: false, reason: 'wrong_product' });
  }

  const email = session.customer_details?.email || session.customer_email;
  if (!email) return res.status(200).json({ ok: false, reason: 'no_email' });

  const token = await getOrCreateToken(email, session.id);
  return res.status(200).json({ ok: true, token, email });
}
