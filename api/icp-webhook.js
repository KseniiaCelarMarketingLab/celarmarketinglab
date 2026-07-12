// api/icp-webhook.js
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
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    // ICP Workbook uses its own signing secret so it only reacts to its own
    // webhook endpoint in the Stripe dashboard (Developers → Webhooks →
    // https://celarmarketinglab.com/api/icp-webhook).
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_ICP_WEBHOOK_SECRET);
  } catch (err) {
    console.error('ICP webhook signature failed:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;

  // ── Guard: make sure this checkout was actually for the ICP Workbook ──
  // Stripe fires checkout.session.completed for every purchase on the
  // account to every endpoint subscribed to that event, regardless of which
  // product was bought. If STRIPE_ICP_PRICE_ID is set, verify the line item
  // matches before doing anything. If it isn't set yet, we fall back to
  // trusting client_reference_id, and finally to processing everything
  // (same behaviour as the original SMM webhook) so this still works before
  // the price ID is configured.
  const expectedPriceId = process.env.STRIPE_ICP_PRICE_ID;
  if (expectedPriceId) {
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
      const matches = lineItems.data.some(li => li.price?.id === expectedPriceId);
      if (!matches) {
        return res.status(200).json({ received: true, skipped: 'not_icp_product' });
      }
    } catch (err) {
      console.error('Could not verify line items:', err.message);
      // fail open on Stripe API errors — don't block a legitimate buyer
    }
  } else if (session.client_reference_id && session.client_reference_id !== 'icp') {
    return res.status(200).json({ received: true, skipped: 'not_icp_reference' });
  }

  const email = session.customer_details?.email || session.customer_email;

  if (!email) {
    console.error('No email in session:', session.id);
    return res.status(200).json({ received: true, skipped: 'no_email' });
  }

  const token = await getOrCreateToken(email, session.id);
  const accessUrl = 'https://celarmarketinglab.com/icp-workbook-cml.html?token=' + token;

  await resend.emails.send({
    from: 'Celar Marketing Lab <noreply@celarmarketinglab.com>',
    to: email,
    subject: 'Your ICP Workbook is ready',
    html: buildEmailHTML(accessUrl),
  });

  console.log('ICP Workbook access sent to ' + email);
  return res.status(200).json({ received: true, sent: true });
}

async function getOrCreateToken(email, stripeSessionId) {
  // Reuse a token that /api/icp-session-token might already have issued for
  // this email (instant-redirect path), so the buyer ends up with one token
  // regardless of which path ran first.
  const existing = await redis.get('icp_email:' + email);
  if (existing) return existing;

  const token = randomBytes(32).toString('hex');
  const ttl = 60 * 60 * 24 * 365 * 10;
  await redis.set('icp_token:' + token, JSON.stringify({
    email,
    createdAt: new Date().toISOString(),
    stripeSessionId,
  }), { ex: ttl });
  await redis.set('icp_email:' + email, token, { ex: ttl });
  return token;
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
.body-text{font-size:14px;line-height:1.8;color:rgba(220,220,220,.65);margin-bottom:28px}
.cta{display:inline-block;background:#00FFF0;color:#0B0F2B;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:16px 36px;text-decoration:none;margin:8px 0 24px}
.url-box{background:rgba(255,255,255,.04);border:.5px solid rgba(255,255,255,.1);padding:14px 16px;font-size:11px;color:rgba(220,220,220,.45);word-break:break-all;line-height:1.6}
.url-box a{color:#00FFF0;text-decoration:none}
.warning{background:rgba(237,62,97,.08);border:.5px solid rgba(237,62,97,.3);padding:14px 16px;font-size:12px;color:rgba(220,220,220,.55);margin-top:20px;line-height:1.6}
.divider{height:.5px;background:rgba(255,255,255,.08);margin:32px 0}
.footer{font-size:11px;color:rgba(220,220,220,.3);line-height:1.7}
.footer a{color:rgba(0,255,240,.6);text-decoration:none}
</style></head>
<body><div class="wrap">
  <div class="logo">Celar<span>.</span>lab</div>
  <div class="title">Your ICP Workbook<br>is ready.</div>
  <div class="body-text">Your access to the <strong style="color:#F5F5F5">ICP Workbook</strong> is ready. Click below to open it and start building your one-page ideal customer brief.</div>
  <a class="cta" href="${accessUrl}">Open My Workbook →</a>
  <div class="url-box">Or copy this link:<br><a href="${accessUrl}">${accessUrl}</a></div>
  <div class="warning"><strong style="color:#ED3E61">Important:</strong> This link is personal — bookmark it, your answers autosave in your browser as you go.</div>
  <div class="divider"></div>
  <div class="footer">
    Questions? Write to <a href="mailto:kseniia@celarlab.com">kseniia@celarlab.com</a><br><br>
    © Celar Marketing Lab · <a href="https://celarmarketinglab.com">celarmarketinglab.com</a>
  </div>
</div></body></html>`;
}
