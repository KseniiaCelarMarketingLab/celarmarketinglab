// api/save-progress.js
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://celarmarketinglab.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { token, progress } = req.body;

  // Validate token format
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  // Check token exists in DB
  const tokenData = await redis.get(`smm_token:${token}`);
  if (!tokenData) {
    return res.status(401).json({ error: 'Token not found' });
  }

  // Save progress tied to token (10 year TTL)
  await redis.set(
    `smm_progress:${token}`,
    JSON.stringify({ ...progress, updatedAt: new Date().toISOString() }),
    { ex: 60 * 60 * 24 * 365 * 10 }
  );

  return res.status(200).json({ saved: true });
}
