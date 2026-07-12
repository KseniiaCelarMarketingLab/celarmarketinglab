// /api/bvc-load-progress.js
// GET /api/bvc-load-progress?token=... -> { progress: {...} } or { progress: null }
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ error: 'invalid token' });
  }

  try {
    const raw = await redis.get(`bvc:progress:${token}`);
    const progress = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    return res.status(200).json({ progress });
  } catch (err) {
    console.error('BVC load-progress error:', err);
    return res.status(200).json({ progress: null });
  }
}
