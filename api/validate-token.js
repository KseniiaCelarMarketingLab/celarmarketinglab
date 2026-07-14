// ═══════════════════════════════════════════════════════════
// Called client-side by every gated product page to confirm a
// token is real. Same endpoint your SMM Challenge page already
// calls — no change needed on that page.
// ═══════════════════════════════════════════════════════════

const { redis } = require('../lib/redis');

module.exports = async (req, res) => {
  const token = (req.query.token || '').toString();

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(200).json({ valid: false });
  }

  try {
    const raw = await redis.get(`token:${token}`);
    if (!raw) return res.status(200).json({ valid: false });

    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return res.status(200).json({ valid: true, product: data.product });
  } catch (err) {
    console.error('validate-token error:', err);
    // Fail closed here (this is the endpoint that decides access) —
    // the product pages themselves fail OPEN on network errors so a
    // real customer never gets blocked by a flaky request.
    return res.status(200).json({ valid: false, error: 'lookup_failed' });
  }
};
