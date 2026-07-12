// api/icp-validate-token.js
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
    const data = await redis.get(`icp_token:${token}`);
    return res.status(200).json({ valid: !!data });
  } catch (err) {
    console.error('Redis error:', err);
    return res.status(200).json({ valid: false, error: true });
  }
}
