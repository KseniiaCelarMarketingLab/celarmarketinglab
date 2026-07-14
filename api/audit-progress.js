// ═══════════════════════════════════════════════════════════
// Content Audit Template — progress save/load only.
// This is deliberately separate from session-token.js and
// validate-token.js: those two now handle ALL products' payment
// and access logic. This file only persists in-progress audit
// data (goal, logged posts, scores, fix-list checkmarks) — the
// same job audit-api.js used to do alongside payment handling.
// ═══════════════════════════════════════════════════════════

const { redis } = require('../lib/redis');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const action = req.query.action;
    const token = req.query.token;

    if (action !== 'load') {
      return res.status(400).json({ error: 'unsupported_action' });
    }
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(200).json({ progress: null });
    }

    try {
      const raw = await redis.get('audit_progress:' + token);
      const progress = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
      return res.status(200).json({ progress });
    } catch (err) {
      console.error('audit-progress load error:', err);
      return res.status(200).json({ progress: null });
    }
  }

  if (req.method === 'POST') {
    try {
      const { token, progress } = req.body || {};
      if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({ error: 'invalid_token' });
      }
      await redis.set('audit_progress:' + token, JSON.stringify(progress || {}));
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('audit-progress save error:', err);
      return res.status(500).json({ error: 'save_failed' });
    }
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
