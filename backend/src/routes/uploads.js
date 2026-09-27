'use strict';
/* ============================================================================
 * Avatar upload + "import avatar from URL".
 * INTENTIONALLY VULNERABLE (flagship SSRF + unrestricted upload / RCE / SVG XSS).
 * ==========================================================================
 * SAFETY: the SSRF is fully contained. All containers run on internal-only
 * docker networks (no route to the real internet or host link-local). In
 * addition, the fetch below PINS any link-local/metadata target to the MOCK
 * metadata service, so even if this were ever run on a real cloud VM the
 * request can never reach a genuine 169.254.169.254.
 * ========================================================================== */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const db = require('../db');
const { requireAuth } = require('../auth');
const config = require('../config');

const router = express.Router();

// --- Unrestricted file upload (RCE via filename + SVG/HTML stored XSS) -------
// VULN: no fileFilter (any content-type accepted) and the ORIGINAL filename is
// preserved. SVG/HTML uploads are then served from /uploads with their real
// content-type -> stored XSS. The post-upload "metadata extraction" shells out
// over the stored path, so a crafted filename injects shell commands -> RCE.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

router.post('/avatar', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
    const stored = path.join(config.uploadDir, req.file.filename);
    const url = `/uploads/${req.file.filename}`;
    await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.user.sub]);

    // VULN (command injection -> RCE): unsanitized path in a shell command.
    exec(`file ${stored}`, { timeout: 4000 }, (err, stdout, stderr) => {
      res.status(201).json({ avatar_url: url, analysis: (stdout || '') + (stderr || '') });
    });
  } catch (e) { next(e); }
});

// --- SSRF: import avatar from a user-supplied URL ---------------------------
function isLinkLocalOrMetadata(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 169 && b === 254;                 // link-local / metadata range
  }
  if (net.isIPv6(ip)) return ip.toLowerCase().startsWith('fe80');
  return false;
}

function looksLikeImage(buf) {
  if (!buf || buf.length < 4) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.slice(0, 3).toString() === 'GIF') return 'gif';
  if (buf.slice(0, 4).toString() === 'RIFF') return 'webp';
  return false;
}

// Fetch a URL server-side. VULN: no scheme/host allowlist, no anti-SSRF filter.
// The only control is the SAFETY PIN that reroutes link-local/metadata targets
// to the mock service (never a real IMDS).
function fetchUrl(target, redirectsLeft = 5) {
  return new Promise(async (resolve, reject) => {
    let u;
    try { u = new URL(target); } catch { return reject(new Error('invalid url')); }
    if (!['http:', 'https:'].includes(u.protocol)) return reject(new Error('unsupported scheme'));

    let connectHost = u.hostname;
    let hostHeader = u.host;
    // SAFETY PIN (containment): if the target resolves to a link-local/metadata
    // address, OR is a metadata hostname, connect to the MOCK metadata service
    // instead. This preserves the SSRF lesson while guaranteeing a real cloud
    // metadata endpoint can never be reached from here.
    try {
      const isMetaHost = u.hostname === config.metadata.ip || u.hostname === config.metadata.host || u.hostname === 'metadata';
      let pinned = isMetaHost;
      if (!pinned) {
        const addrs = await dns.lookup(u.hostname, { all: true });
        pinned = addrs.some(a => isLinkLocalOrMetadata(a.address));
      }
      if (pinned) { connectHost = config.metadata.host; hostHeader = u.host; }
    } catch (e) { /* dns failure: fall through and let the request error out */ }

    const lib = u.protocol === 'https:' ? https : http;
    const opts = {
      protocol: u.protocol, host: connectHost, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search, method: 'GET', headers: { Host: hostHeader },
    };
    const rq = lib.request(opts, (r) => {
      // Follow redirects (a common SSRF filter bypass — kept on purpose).
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && redirectsLeft > 0) {
        const next = new URL(r.headers.location, target).toString();
        return resolve(fetchUrl(next, redirectsLeft - 1));
      }
      const chunks = [];
      r.on('data', c => { chunks.push(c); if (Buffer.concat(chunks).length > 8 * 1024 * 1024) rq.destroy(); });
      r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks) }));
    });
    rq.on('error', reject);
    rq.setTimeout(5000, () => rq.destroy(new Error('timeout')));
    rq.end();
  });
}

router.post('/avatar/import', requireAuth, async (req, res, next) => {
  try {
    const target = String(req.body?.url || '');
    if (!target) return res.status(400).json({ error: 'url required' });
    const result = await fetchUrl(target);

    const kind = looksLikeImage(result.body);
    if (kind) {
      const fname = `${Date.now()}_import.${kind}`;
      fs.writeFileSync(path.join(config.uploadDir, fname), result.body);
      const url = `/uploads/${fname}`;
      await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.user.sub]);
      return res.status(201).json({ avatar_url: url });
    }
    // VULN: non-image responses are echoed back in the error, so the SSRF is not
    // blind — the fetched content (e.g. IAM credentials) is returned to the user.
    return res.status(400).json({
      error: 'Imported file is not a valid image',
      fetched_status: result.status,
      content_type: result.headers['content-type'] || null,
      preview: result.body.toString('utf8').slice(0, 4000),
    });
  } catch (e) { next(e); }
});

module.exports = router;
