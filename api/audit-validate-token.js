// api/audit-validate-token.js
// Background check called after the tool has already been shown (fail-open
// pattern) to confirm a token is real. Cheap Redis lookup, no Stripe call.

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://celarmarketinglab.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method !== 'GET') return res.status(405).end();

  const { token } = req.query;
  if (!token || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(200).json({ valid: false });
  }

  try {
    const data = await redis.get('audit_token:' + token);
    return res.status(200).json({ valid: !!data });
  } catch (err) {
    console.error('audit-validate-token error:', err.message);
    // fail open — a Redis hiccup shouldn't lock out a real buyer
    return res.status(200).json({ valid: true });
  }
}
