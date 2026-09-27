'use strict';
/* ============================================================================
 * /api/v1 — deprecated, "legacy" API kept alive for old mobile clients.
 * Intentionally MORE vulnerable than the current endpoints. This is the
 * API-versioning recon lesson: find v1, and it's weaker than v2/current.
 * ========================================================================== */
const express = require('express');
const db = require('../db');
const http = require('http');
const config = require('../config');
const { issueSession } = require('../auth');
const { addCapture } = require('../state');

const router = express.Router();

// VULN (SQLi auth bypass): concatenated query AND no password verification —
// any row returned logs you in.  e.g. email = admin@shophunt.local' --
router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const rows = await db.raw(
      `SELECT * FROM users WHERE email = '${email}' AND password_hash = '${password}'`
    );
    if (!rows.length) return res.status(401).json({ error: 'invalid credentials' });
    const u = rows[0];
    const pub = { id: u.id, email: u.email, name: u.name, role: u.role };
    return res.json({ token: issueSession(res, pub), user: pub, note: 'v1 legacy login' });
  } catch (e) { next(e); }
});

// VULN (IDOR + over-disclosure): returns the password hash too.
router.get('/users/:id', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'user not found' });
    res.json({ user: rows[0] }); // includes password_hash
  } catch (e) { next(e); }
});

// Blind-XSS collector. The admin viewer bot (and any real XSS payload) beacons
// here; captures are viewable in instructor mode. Lets students confirm blind
// XSS fired without needing an external collaborator (egress is internal-only).
function collect(req, res) {
  addCapture({
    source: 'collector',
    ip: req.ip,
    ua: req.headers['user-agent'],
    query: req.query,
    cookie: req.query.c || req.query.cookie || null,
    data: req.query.d || null,
  });
  res.set('Content-Type', 'image/gif');
  res.end(Buffer.from('R0lGODlhAQABAAAAACwAAAAAAQABAAA=', 'base64')); // 1x1 gif
}
router.get('/collect', collect);
router.get('/debug/collect', collect);

// SSRF follow-on IMPACT demo: "cloud sync" accepts an instance access key and,
// server-side, calls the mock cloud API with it. Proves stolen IMDS creds have
// real impact (fake backup listing) — without any real cloud access.
router.post('/integrations/cloud-sync', (req, res) => {
  const accessKey = req.body?.access_key || '';
  const opts = {
    host: config.metadata.host, port: 80,
    path: `/lab-cloud/s3/backups?access_key=${encodeURIComponent(accessKey)}`,
    headers: { Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/lab` },
  };
  const rq = http.get(opts, (r) => {
    const chunks = [];
    r.on('data', c => chunks.push(c));
    r.on('end', () => {
      let body; try { body = JSON.parse(Buffer.concat(chunks)); } catch { body = Buffer.concat(chunks).toString(); }
      res.status(r.statusCode).json({ cloud_status: r.statusCode, result: body });
    });
  });
  rq.on('error', (e) => res.status(502).json({ error: e.message }));
  rq.setTimeout(4000, () => rq.destroy(new Error('timeout')));
});

module.exports = router;
