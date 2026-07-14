// ═══════════════════════════════════════════════════════════
// Called from the product page right after Stripe redirects the
// customer back with ?session_id={CHECKOUT_SESSION_ID}.
// Verifies payment directly with Stripe and returns a token
// immediately — no waiting for the webhook. The webhook is the
// backup path (handles the case where the tab closes before this
// call finishes, and always sends the email either way).
//
// Works for every product — nothing here is product-specific.
// ═══════════════════════════════════════════════════════════

const Stripe = require('stripe');
const { getOrCreateToken } = require('../lib/tokens');
const { PRODUCTS } = require('../lib/products');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'missing_session_id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'not_paid' });
    }

    const product = session.client_reference_id || (session.metadata && session.metadata.product);
    const email = session.customer_details && session.customer_details.email;

    if (!product || !PRODUCTS[product]) {
      return res.status(400).json({ error: 'unknown_product' });
    }
    if (!email) {
      return res.status(400).json({ error: 'missing_email' });
    }

    const token = await getOrCreateToken(product, email, session.id);

    return res.status(200).json({
      token,
      product,
      redirectUrl: PRODUCTS[product].productUrl
    });
  } catch (err) {
    console.error('session-token error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
};
