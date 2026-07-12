// /api/bvc-save-progress.js
// POST { token, progress } -> stores JSON progress keyed by token
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const { token, progress } = req.body || {};

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ error: 'invalid token' });
  }

  try {
    const record = await redis.get(`bvc:token:${token}`);
    if (!record) return res.status(403).json({ error: 'unknown token' });

    await redis.set(`bvc:progress:${token}`, JSON.stringify(progress || {}));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('BVC save-progress error:', err);
    return res.status(500).json({ error: 'storage failure' });
  }
}
