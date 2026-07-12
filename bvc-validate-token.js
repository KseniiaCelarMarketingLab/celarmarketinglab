// /api/bvc-validate-token.js
// GET /api/bvc-validate-token?token=...
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(200).json({ valid: false });
  }

  try {
    const record = await redis.get(`bvc:token:${token}`);
    return res.status(200).json({ valid: !!record });
  } catch (err) {
    console.error('BVC validate-token error:', err);
    // Fail open — don't lock out a paying customer over a Redis blip.
    return res.status(200).json({ valid: true, warning: 'validation degraded' });
  }
}
