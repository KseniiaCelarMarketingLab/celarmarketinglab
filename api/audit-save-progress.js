// api/audit-save-progress.js
// Background cloud sync for a buyer's audit progress. localStorage is the
// instant write and source of truth if this ever fails — this just lets
// someone pick the audit back up on a different device.

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://celarmarketinglab.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  if (req.method !== 'POST') return res.status(405).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { token, progress } = body || {};

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(200).json({ ok: false, reason: 'invalid_token' });
  }

  try {
    const tokenData = await redis.get('audit_token:' + token);
    if (!tokenData) return res.status(200).json({ ok: false, reason: 'unknown_token' });

    const ttl = 60 * 60 * 24 * 365 * 10;
    await redis.set(
      'audit_progress:' + token,
      JSON.stringify(Object.assign({}, progress, { ts: Date.now() })),
      { ex: ttl }
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('audit-save-progress error:', err.message);
    return res.status(200).json({ ok: false, reason: 'server_error' });
  }
}
