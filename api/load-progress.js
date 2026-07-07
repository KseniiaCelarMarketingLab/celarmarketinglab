// api/load-progress.js
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://celarmarketinglab.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { token } = req.query;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  // Check token exists
  const tokenData = await redis.get(`smm_token:${token}`);
  if (!tokenData) {
    return res.status(401).json({ error: 'Token not found' });
  }

  // Load progress
  const progress = await redis.get(`smm_progress:${token}`);

  return res.status(200).json({
    progress: progress || null
  });
}
