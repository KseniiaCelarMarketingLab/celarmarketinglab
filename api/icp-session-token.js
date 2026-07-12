// api/icp-session-token.js
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import { randomBytes } from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

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
    console.error('icp-session-token: could not retrieve session:', err.message);
    return res.status(200).json({ ok: false, reason: 'stripe_error' });
  }

  if (session.payment_status !== 'paid') {
    return res.status(200).json({ ok: false, reason: 'not_paid' });
  }

  // Same product guard as icp-webhook.js — make sure this session was
  // actually for the ICP Workbook before handing out access.
  const expectedPriceId = process.env.STRIPE_ICP_PRICE_ID;
  if (expectedPriceId) {
    const matches = (session.line_items?.data || []).some(li => li.price?.id === expectedPriceId);
    if (!matches) return res.status(200).json({ ok: false, reason: 'wrong_product' });
  } else if (session.client_reference_id && session.client_reference_id !== 'icp-workbook') {
    return res.status(200).json({ ok: false, reason: 'wrong_product' });
  }

  const email = session.customer_details?.email || session.customer_email;
  if (!email) return res.status(200).json({ ok: false, reason: 'no_email' });

  // Reuse an existing token for this email if the webhook already created
  // one (or if this page gets hit twice) — keeps one token per buyer.
  let token = await redis.get('icp_email:' + email);

  if (!token) {
    token = randomBytes(32).toString('hex');
    const ttl = 60 * 60 * 24 * 365 * 10;
    await redis.set('icp_token:' + token, JSON.stringify({
      email,
      createdAt: new Date().toISOString(),
      stripeSessionId: session.id,
    }), { ex: ttl });
    await redis.set('icp_email:' + email, token, { ex: ttl });
  }

  return res.status(200).json({ ok: true, token, email });
}
