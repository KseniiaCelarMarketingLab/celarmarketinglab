// api/audit-api.js
// Combines four endpoints into one serverless function — Vercel's Hobby plan
// caps a deployment at 12 functions total, and splitting every action into
// its own file was pushing past that. This file replaces:
//   audit-session-token.js  → GET  ?session_id=...
//   audit-validate-token.js → GET  ?token=...              (default action)
//   audit-load-progress.js  → GET  ?token=...&action=load
//   audit-save-progress.js  → POST { token, progress }
// audit-webhook.js stays a separate file — it needs raw-body parsing
// (bodyParser: false) which doesn't mix cleanly with the JSON body used here.

import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import { randomBytes } from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TOKEN_RE = /^[a-f0-9]{64}$/;
const TTL = 60 * 60 * 24 * 365 * 10; // 10 years

async function getOrCreateToken(email, stripeSessionId) {
  const existing = await redis.get('audit_email:' + email);
  if (existing) return existing;

  const token = randomBytes(32).toString('hex');
  await redis.set('audit_token:' + token, JSON.stringify({
    email,
    createdAt: new Date().toISOString(),
    stripeSessionId,
  }), { ex: TTL });
  await redis.set('audit_email:' + email, token, { ex: TTL });
  return token;
}

// ── GET ?session_id=...  (instant token after Stripe checkout) ──
async function handleSessionToken(req, res) {
  const { session_id } = req.query;
  if (!session_id || typeof session_id !== 'string') {
    return res.status(200).json({ ok: false, reason: 'missing_session_id' });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['line_items'] });
  } catch (err) {
    console.error('audit-api/session-token: could not retrieve session:', err.message);
    return res.status(200).json({ ok: false, reason: 'stripe_error' });
  }

  if (session.payment_status !== 'paid') {
    return res.status(200).json({ ok: false, reason: 'not_paid' });
  }

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

// ── GET ?token=...  (validate) ──
async function handleValidateToken(req, res) {
  const { token } = req.query;
  if (!token || !TOKEN_RE.test(token)) return res.status(200).json({ valid: false });
  try {
    const data = await redis.get('audit_token:' + token);
    return res.status(200).json({ valid: !!data });
  } catch (err) {
    console.error('audit-api/validate: error:', err.message);
    return res.status(200).json({ valid: true }); // fail open
  }
}

// ── GET ?token=...&action=load  (cross-device progress load) ──
async function handleLoadProgress(req, res) {
  const { token } = req.query;
  if (!token || !TOKEN_RE.test(token)) return res.status(200).json({ progress: null });
  try {
    const tokenData = await redis.get('audit_token:' + token);
    if (!tokenData) return res.status(200).json({ progress: null });
    let raw = await redis.get('audit_progress:' + token);
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) { raw = null; }
    }
    return res.status(200).json({ progress: raw || null });
  } catch (err) {
    console.error('audit-api/load: error:', err.message);
    return res.status(200).json({ progress: null });
  }
}

// ── POST { token, progress }  (cross-device progress save) ──
async function handleSaveProgress(req, res) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { token, progress } = body || {};
  if (!token || !TOKEN_RE.test(token)) return res.status(200).json({ ok: false, reason: 'invalid_token' });

  try {
    const tokenData = await redis.get('audit_token:' + token);
    if (!tokenData) return res.status(200).json({ ok: false, reason: 'unknown_token' });
    await redis.set(
      'audit_progress:' + token,
      JSON.stringify(Object.assign({}, progress, { ts: Date.now() })),
      { ex: TTL }
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('audit-api/save: error:', err.message);
    return res.status(200).json({ ok: false, reason: 'server_error' });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://celarmarketinglab.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  if (req.method === 'GET') {
    if (req.query.session_id) return handleSessionToken(req, res);
    if (req.query.action === 'load') return handleLoadProgress(req, res);
    if (req.query.token) return handleValidateToken(req, res);
    return res.status(200).json({ ok: false, reason: 'missing_params' });
  }

  if (req.method === 'POST') {
    return handleSaveProgress(req, res);
  }

  return res.status(405).end();
}
