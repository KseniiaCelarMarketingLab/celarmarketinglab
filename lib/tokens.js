const crypto = require('crypto');
const { redis } = require('./redis');

// Token format matches what's already deployed for SMM Challenge:
// 64-character hex string (32 random bytes).

async function getOrCreateToken(product, email, sessionId) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const emailKey = `email_token:${product}:${normalizedEmail}`;

  // Reuse an existing token for this email+product if one already exists.
  // This is the idempotency rule from the product notes: whichever path
  // (webhook or immediate session-token) runs first wins, the other reuses it.
  const existing = await redis.get(emailKey);
  if (existing) return existing;

  const token = crypto.randomBytes(32).toString('hex');
  const record = JSON.stringify({
    product,
    email: normalizedEmail,
    sessionId: sessionId || null,
    createdAt: Date.now()
  });

  await redis.set(`token:${token}`, record);
  await redis.set(emailKey, token);

  return token;
}

module.exports = { getOrCreateToken };
