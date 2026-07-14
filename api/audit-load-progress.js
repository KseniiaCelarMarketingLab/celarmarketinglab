// api/audit-load-progress.js
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
    return res.status(200).json({ progress: null });
  }

  try {
    const tokenData = await redis.get('audit_token:' + token);
    if (!tokenData) return res.status(200).json({ progress: null });

    let raw = await redis.get('audit_progress:' + token);
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) { raw = null; }
    }
    return res.status(200).json({ progress: raw || null });
  } catch (err) {
    console.error('audit-load-progress error:', err.message);
    return res.status(200).json({ progress: null });
  }
}
