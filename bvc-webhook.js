// /api/bvc-webhook.js
// Stripe webhook for the Brand Voice Cheatsheet (€12).
// Separate endpoint from the SMM Challenge webhook — independent Redis key
// namespace ("bvc:") so nothing here can collide with or break the existing
// SMM Challenge tokens.
//
// Vercel env vars required (Settings → General → Environment Variables):
//   STRIPE_BVC_WEBHOOK_SECRET   — signing secret for THIS endpoint (Stripe gives
//                                 you a distinct secret per webhook endpoint)
//   STRIPE_SECRET_KEY           — your normal Stripe secret key (can be shared
//                                 with the SMM webhook)
//   UPSTASH_REDIS_REST_URL      — same Upstash instance already in use
//   UPSTASH_REDIS_REST_TOKEN    — same Upstash instance already in use
//   RESEND_API_KEY              — same Resend key already in use

import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (c) => chunks.push(c));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  let event;
  try {
    const rawBody = await buffer(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_BVC_WEBHOOK_SECRET);
  } catch (err) {
    console.error('BVC webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email || session.customer_email;

    if (!email) {
      console.error('BVC webhook: no email on session', session.id);
      return res.status(200).json({ received: true, warning: 'no email' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    try {
      await redis.set(`bvc:token:${token}`, JSON.stringify({
        email,
        purchasedAt: new Date().toISOString(),
        sessionId: session.id,
      }));
      // convenience index so a lost-link request can look a token up by email
      await redis.set(`bvc:email:${email.toLowerCase()}`, token);
    } catch (err) {
      console.error('BVC webhook: Redis write failed:', err);
      return res.status(500).json({ error: 'storage failure' });
    }

    const accessUrl = `https://celarmarketinglab.com/brand-voice-cheatsheet.html?token=${token}`;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Celar Marketing Lab <hello@celarmarketinglab.com>',
          to: email,
          subject: 'Your Brand Voice Cheatsheet is ready',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">
              <h2 style="margin-bottom:8px">Your Brand Voice Cheatsheet is ready</h2>
              <p style="line-height:1.6">Thanks for grabbing it. Click below to open the tool — it takes about 10 minutes and ends with a one-page reference doc you can export as a PDF.</p>
              <p style="margin:28px 0">
                <a href="${accessUrl}" style="background:#0B0F2B;color:#00FFF0;padding:14px 28px;text-decoration:none;font-weight:bold;display:inline-block">Open the Cheatsheet →</a>
              </p>
              <p style="font-size:13px;color:#666;line-height:1.6">This link is unique to you — bookmark it, you can return anytime. If it stops working, just reply to this email.</p>
              <p style="font-size:12px;color:#999;margin-top:32px">Celar Marketing Lab · celarmarketinglab.com</p>
            </div>
          `,
        }),
      });
    } catch (err) {
      // Don't fail the webhook over an email hiccup — the token already exists.
      console.error('BVC webhook: Resend send failed:', err);
    }
  }

  return res.status(200).json({ received: true });
}
