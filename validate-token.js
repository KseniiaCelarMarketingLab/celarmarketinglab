// api/validate-token.js
// Called by the course page to check if a token is valid
// Returns { valid: true/false }

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS — only allow from celarlab.com
  res.setHeader('Access-Control-Allow-Origin', 'https://celarlab.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') return res.status(405).end();

  const { token } = req.query;
  if (!token || typeof token !== 'string' || token.length !== 64) {
    return res.status(200).json({ valid: false });
  }

  try {
    const data = await kv.get(`smm_token:${token}`);
    return res.status(200).json({ valid: !!data });
  } catch (err) {
    console.error('KV error:', err);
    // Fail open on KV errors — don't lock out real users
    return res.status(200).json({ valid: false, error: true });
  }
}
