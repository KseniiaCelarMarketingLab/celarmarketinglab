// api/stripe-webhook.js
// Vercel Serverless Function — receives Stripe webhook on checkout.session.completed
// Generates an access token, stores it in Vercel KV, sends email via Resend

import Stripe from 'stripe';
import { kv } from '@vercel/kv';
import { Resend } from 'resend';
import { createHmac, randomBytes } from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const email = session.customer_details?.email || session.customer_email;
  const productRef = session.client_reference_id; // 'smm' — set in buildStripeUrl

  if (!email || productRef !== 'smm') {
    return res.status(200).json({ received: true, skipped: true });
  }

  // Generate a unique access token
  const token = randomBytes(32).toString('hex');
  const accessUrl = `https://celarlab.com/course?token=${token}`;

  // Store token in Vercel KV (expires in 10 years — effectively permanent)
  await kv.set(`smm_token:${token}`, {
    email,
    createdAt: new Date().toISOString(),
    stripeSessionId: session.id,
  }, { ex: 60 * 60 * 24 * 365 * 10 });

  // Also index by email for support lookups
  await kv.set(`smm_email:${email}`, token, { ex: 60 * 60 * 24 * 365 * 10 });

  // Send access email via Resend
  await resend.emails.send({
    from: 'Celar Marketing Lab <noreply@celarlab.com>',
    to: email,
    subject: 'Your SMM Without Budget access link',
    html: buildEmailHTML(accessUrl, email),
  });

  console.log(`Access sent to ${email}, token: ${token.slice(0, 8)}...`);
  return res.status(200).json({ received: true, sent: true });
}

function buildEmailHTML(accessUrl, email) {
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
  .cta-wrap{margin:32px 0}
  .cta{display:inline-block;background:#00FFF0;color:#0B0F2B;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:16px 36px;text-decoration:none}
  .url-box{background:rgba(255,255,255,.04);border:.5px solid rgba(255,255,255,.1);padding:14px 16px;font-size:11px;color:rgba(220,220,220,.45);word-break:break-all;margin-top:16px;line-height:1.6}
  .url-box a{color:#00FFF0;text-decoration:none}
  .divider{height:.5px;background:rgba(255,255,255,.08);margin:32px 0}
  .footer{font-size:11px;color:rgba(220,220,220,.3);line-height:1.7}
  .footer a{color:rgba(0,255,240,.6);text-decoration:none}
  .warning{background:rgba(237,62,97,.08);border:.5px solid rgba(237,62,97,.3);padding:14px 16px;font-size:12px;color:rgba(220,220,220,.55);margin-top:20px;line-height:1.6}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Celar<span>.</span>lab</div>

  <div class="title">You're in orbit.<br>Challenge starts now.</div>

  <div class="body-text">
    Your access to <strong style="color:#F5F5F5">SMM Without Budget — 30-Day Challenge</strong> is ready.<br>
    Click the button below to open your personal challenge platform.
  </div>

  <div class="cta-wrap">
    <a class="cta" href="${accessUrl}">Open My Challenge →</a>
  </div>

  <div class="url-box">
    Or copy this link:<br>
    <a href="${accessUrl}">${accessUrl}</a>
  </div>

  <div class="warning">
    <strong style="color:#ED3E61">Important:</strong> This link is personal — it opens the challenge for your account. Don't share it publicly. Bookmark it so you can return to your progress anytime.
  </div>

  <div class="divider"></div>

  <div class="footer">
    Questions? Reply to this email or write to <a href="mailto:kseniia@celarlab.com">kseniia@celarlab.com</a><br>
    7-day money-back guarantee — no questions asked.<br><br>
    © Celar Marketing Lab · <a href="https://celarlab.com">celarlab.com</a>
  </div>
</div>
</body>
</html>`;
}
