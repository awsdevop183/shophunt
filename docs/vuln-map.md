# ShopHunt — Vulnerability Map (Instructor Answer Key)

> ⚠️ **Instructor-only.** This is the answer key. Keep it away from students until
> the debrief. It documents which real feature hides which bug, how to exploit it,
> and a professional-format write-up to feed the "report preparation" lesson.

This file is filled in **feature-by-feature** as the lab is built. Each entry
follows the same professional finding format students are expected to reproduce.

## Legend

- **Feature** — the normal business feature the bug lives inside (no vuln labels
  in the UI).
- **Location** — endpoint(s) / component.
- **Severity** — rough CVSS-style rating for teaching.

---

## Planned findings (tracking)

| # | Vulnerability | Hidden inside feature | Status |
|---|---------------|----------------------|--------|
| 1 | SQL injection (error-based + blind) | Login form, product search | ⏳ pending |
| 2 | IDOR | Order details, user profile | ⏳ pending |
| 3 | Broken access control | Seller/admin API routes | ⏳ pending |
| 4 | JWT flaws (alg:none, weak secret, no expiry) | Auth | ⏳ pending |
| 5 | Mass assignment (role escalation) | Update profile (`PATCH /api/users/me`) | ⏳ pending |
| 6 | Business logic (coupon stacking, negative qty, client price) | Cart / checkout | ⏳ pending |
| 7 | **SSRF → mock IMDS (flagship)** | Import avatar from URL | 🏗️ service ready |
| 8 | Unrestricted file upload → RCE; SVG → stored XSS | Avatar / attachments | ⏳ pending |
| 9 | Stored XSS | Product reviews | ⏳ pending |
| 10 | Blind XSS | Support ticket → admin panel | ⏳ pending |
| 11 | CSRF | Change email (state-changing) | ⏳ pending |
| 12 | Missing rate limit | Login, password-reset OTP | ⏳ pending |
| 13 | Info disclosure (stack traces, /.git, source maps, JS secret) | Recon surface | ⏳ pending |

---

## 7. SSRF → Mock Instance Metadata (FLAGSHIP)

- **Feature:** Profile → "Import avatar from URL".
- **Location:** (backend avatar-import endpoint — wired in the SSRF phase).
- **Severity:** Critical.
- **Status:** Mock metadata service is built and self-contained; the vulnerable
  fetch endpoint is embedded in the SSRF feature phase.

### The mock target

A dependency-free Node service (`metadata/server.js`) imitates a cloud instance
metadata service (IMDS). It is reachable **only inside the docker network** at
`http://169.254.169.254/` (and hostname `http://metadata/`) and is never
published to the host.

It exposes AWS-style paths so real payloads/tooling work:

- `GET /latest/meta-data/` — index listing
- `GET /latest/meta-data/iam/security-credentials/` — role name
  (`shophunt-app-instance-role`)
- `GET /latest/meta-data/iam/security-credentials/<role>` — **fake** IAM creds
- `GET /latest/dynamic/instance-identity/document` — fake identity doc
- `GET /latest/user-data` — fake bootstrap script (leaks fake secrets)
- `PUT /latest/api/token` — IMDSv2 token (IMDSv1 also works — intentionally weak)

### Post-exploitation (impact demo)

- `GET /lab-cloud/s3/backups` — a **fake internal cloud API** that returns
  "sensitive" (fake) backup listings **only** when the stolen `AccessKeyId`
  (`AKIAI44QH8DHBLABFAKE`) is presented via `Authorization:` header or
  `?access_key=`. This shows why leaked IMDS creds matter — without any real
  cloud access.

### Example payloads (to be finalized with the vulnerable endpoint)

```
# via the "import avatar from URL" feature:
http://169.254.169.254/latest/meta-data/iam/security-credentials/shophunt-app-instance-role
http://metadata/latest/user-data
```

### Why it's safe

See README "How ShopHunt keeps the SSRF lab safe": internal-only networks, mock
not published to host, and a backend code-level pin that prevents reaching a real
metadata endpoint.

### Remediation (for the write-up lesson)

- Never fetch user-supplied URLs without an allowlist of schemes/hosts.
- Resolve the hostname and reject private/link-local/loopback/metadata ranges
  (and re-check after redirects; block DNS-rebinding by pinning the resolved IP).
- Drop the instance role / use IMDSv2 with hop limit 1; prefer no ambient cloud
  credentials for services that fetch external URLs.

---

_More findings are appended here as each feature is built._
