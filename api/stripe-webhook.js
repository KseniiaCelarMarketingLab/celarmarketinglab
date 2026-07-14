// ═══════════════════════════════════════════════════════════
// ONE Stripe webhook for ALL products.
// In Stripe Dashboard: set this as the ONLY webhook endpoint,
// listening for `checkout.session.completed`, and use ONE
// signing secret (STRIPE_WEBHOOK_SECRET). You no longer need a
// separate endpoint or secret per product.
// ═══════════════════════════════════════════════════════════

const Stripe = require('stripe');
const { redis } = require('../lib/redis');
const { getOrCreateToken } = require('../lib/tokens');
const { PRODUCTS } = require('../lib/products');
const { sendAccessEmail } = require('../lib/resend');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe needs the RAW request body to verify the signature —
// this disables Vercel's default JSON body parsing for this function.
module.exports.config = { api: { bodyParser: false } };

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  let event;
  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    // Acknowledge anything we don't act on so Stripe doesn't retry it.
    return res.status(200).json({ received: true, skipped: event.type });
  }

  const session = event.data.object;

  try {
    // ── Idempotency: Stripe may deliver the same event more than once.
    const dedupeKey = `processed_session:${session.id}`;
    const already = await redis.get(dedupeKey);
    if (already) return res.status(200).json({ received: true, deduped: true });

    const product = session.client_reference_id || (session.metadata && session.metadata.product);
    const email = session.customer_details && session.customer_details.email;

    if (!product || !PRODUCTS[product]) {
      console.error('Webhook: unknown or missing product', { sessionId: session.id, product });
      // Still 200 — a malformed session shouldn't cause endless Stripe retries.
      // Check Vercel logs for sessions like this and fulfil manually if needed.
      return res.status(200).json({ received: true, warning: 'unknown_product' });
    }
    if (!email) {
      console.error('Webhook: missing customer email', { sessionId: session.id, product });
      return res.status(200).json({ received: true, warning: 'missing_email' });
    }

    // Reuses an existing token if the session-token endpoint already
    // fulfilled this purchase via the immediate-redirect path.
    const token = await getOrCreateToken(product, email, session.id);

    // 7-day dedupe window is plenty — Stripe stops retrying long before that.
    await redis.set(dedupeKey, '1', { ex: 60 * 60 * 24 * 7 });

    await sendAccessEmail({ product, email, token });

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    // 500 tells Stripe to retry. The dedupe key above means retries are
    // cheap once the first attempt actually succeeds.
    return res.status(500).json({ error: 'processing_failed' });
  }
};
