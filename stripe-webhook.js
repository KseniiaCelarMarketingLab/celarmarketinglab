// api/stripe-webhook.js
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
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const email = session.customer_details?.email || session.customer_email;
  const productRef = session.client_reference_id; // 'smm'

  if (!email || productRef !== 'smm') {
    return res.status(200).json({ received: true, skipped: true });
  }

  // Generate unique access token
  const token = randomBytes(32).toString('hex');
  const accessUrl = `https://celarlab.com/course?token=${token}`;

  // Store in Upstash Redis (10 years TTL)
  const ttl = 60 * 60 * 24 * 365 * 10;
  await redis.set(`smm_token:${token}`, JSON.stringify({
    email,
    createdAt: new Date().toISOString(),
    stripeSessionId: session.id,
  }), { ex: ttl });

  // Index by email for support lookups
  await redis.set(`smm_email:${email}`, token, { ex: ttl });

  // Send access email via Resend
  await resend.emails.send({
    from: 'Celar Marketing Lab <noreply@celarlab.com>',
    to: email,
    subject: 'Your SMM Without Budget access link',
    html: buildEmailHTML(accessUrl),
  });

  console.log(`Access sent to ${email}`);
  return res.status(200).json({ received: true, sent: true });
}

function buildEmailHTML(accessUrl) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
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
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Celar<span>.</span>lab</div>
  <div class="title">You're in orbit.<br>Challenge starts now.</div>
  <div class="body-text">
    Your access to <strong style="color:#F5F5F5">SMM Without Budget — 30-Day Challenge</strong> is ready.
    Click the button below to open your personal challenge platform.
  </div>
  <a class="cta" href="${accessUrl}">Open My Challenge →</a>
  <div class="url-box">
    Or copy this link:<br>
    <a href="${accessUrl}">${accessUrl}</a>
  </div>
  <div class="warning">
    <strong style="color:#ED3E61">Important:</strong> This link is personal — bookmark it to return to your progress anytime. Don't share it publicly.
  </div>
  <div class="divider"></div>
  <div class="footer">
    Questions? Write to <a href="mailto:kseniia@celarlab.com">kseniia@celarlab.com</a><br>
    7-day money-back guarantee — no questions asked.<br><br>
    © Celar Marketing Lab · <a href="https://celarlab.com">celarlab.com</a>
  </div>
</div>
</body>
</html>`;
}
