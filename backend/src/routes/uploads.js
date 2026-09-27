'use strict';
// Avatar upload + "import avatar from URL". CLEAN BASELINE — safe on purpose:
//   * file upload validates image content-types and uses a random name
//   * URL import blocks private/link-local/loopback targets (anti-SSRF)
// The SSRF flagship phase intentionally REPLACES the URL-import guard with a
// vulnerable version; the file-upload phase weakens the upload validation.
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const db = require('../db');
const { requireAuth } = require('../auth');
const config = require('../config');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
  },
});
const ALLOWED_IMAGE = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE.includes(file.mimetype)) return cb(null, true);
    cb(new Error('only image uploads are allowed'));
  },
});

router.post('/avatar', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.user.sub]);
    res.status(201).json({ avatar_url: url });
  } catch (e) { next(e); }
});

// --- clean anti-SSRF guard --------------------------------------------------
function isBlockedIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127) return true;                 // loopback
    if (a === 10) return true;                  // private
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;    // private
    if (a === 169 && b === 254) return true;    // link-local / metadata
    if (a === 0) return true;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === '::1' || low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd')) return true;
  }
  return false;
}

router.post('/avatar/import', requireAuth, async (req, res, next) => {
  try {
    const target = String(req.body?.url || '');
    let u;
    try { u = new URL(target); } catch { return res.status(400).json({ error: 'invalid url' }); }
    if (!['http:', 'https:'].includes(u.protocol)) return res.status(400).json({ error: 'unsupported scheme' });

    const addrs = await dns.lookup(u.hostname, { all: true });
    if (addrs.some(a => isBlockedIp(a.address))) {
      return res.status(400).json({ error: 'refusing to fetch internal address' });
    }

    const lib = u.protocol === 'https:' ? https : http;
    const data = await new Promise((resolve, reject) => {
      const rq = lib.get(target, (r) => {
        if (r.statusCode >= 400) return reject(new Error(`upstream ${r.statusCode}`));
        const chunks = [];
        r.on('data', c => { chunks.push(c); if (Buffer.concat(chunks).length > 5 * 1024 * 1024) rq.destroy(); });
        r.on('end', () => resolve(Buffer.concat(chunks)));
      });
      rq.on('error', reject);
      rq.setTimeout(5000, () => rq.destroy(new Error('timeout')));
    });

    const ext = (u.pathname.match(/\.(png|jpe?g|gif|webp)$/i) || ['', 'png'])[1].toLowerCase();
    const fname = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
    require('fs').writeFileSync(path.join(config.uploadDir, fname), data);
    const url = `/uploads/${fname}`;
    await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.user.sub]);
    res.status(201).json({ avatar_url: url });
  } catch (e) { next(e); }
});

module.exports = router;
