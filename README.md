# ShopHunt

A believable online store / marketplace used as an **intentionally vulnerable
training target** for teaching real-world web application penetration testing and
bug bounty methodology.

> ShopHunt — a training target by **Madhukar Reddy (@awsandevops)**

Unlike labeled labs (DVWA-style), ShopHunt looks and behaves like a real
production SaaS. Vulnerabilities are **hidden inside genuine business features**,
so students must discover, exploit, chain, and report them the way they would on
a live bug-bounty target.

---

## ⚠️ SAFETY — READ THIS FIRST

**This application is deliberately insecure. It is for isolated lab use only.**

- 🚫 **Never expose ShopHunt on the public internet** or run it on a production
  server.
- 🚫 **Never deploy it on a real EC2 instance or any cloud VM** without first
  blocking access to the real cloud metadata service. ShopHunt's flagship lab is
  a **Server-Side Request Forgery (SSRF) → instance metadata** exercise. It ships
  with a **fully mocked, self-contained metadata service** and, by design and in
  code, must never be able to reach a real `169.254.169.254`. If you run this on a
  live cloud VM without isolation, a student's SSRF payload could otherwise reach
  your **real** metadata endpoint and steal **real** credentials.
- ✅ **Recommended:** run it **locally** (Docker on a laptop/VM you control). For
  any hosted classroom use, put it **behind a VPN + login + IP allowlist**, on a
  host with **no cloud instance role** and with egress to link-local/metadata
  ranges firewalled off.
- Every page shows a persistent red **"INTENTIONALLY VULNERABLE"** banner, and all
  responses send `X-Robots-Tag: noindex` to discourage indexing.

### How ShopHunt keeps the SSRF lab safe

- All containers run on `internal: true` docker networks — **no route to the real
  internet or the host's real link-local range** at runtime.
- The mock metadata service holds `169.254.169.254` **inside an isolated docker
  subnet** and is **not published to the host**; it is reachable only server-side
  (via the SSRF), exactly like a real IMDS.
- The backend additionally **pins the metadata address to the mock in code** and
  refuses other link-local targets, so even a misconfigured host cannot reach a
  genuine metadata endpoint.

---

## What's in the box

- **Frontend:** React SPA (Vite)
- **Backend:** Node.js + Express JSON REST API
- **Database:** MySQL, seeded with **fake data only** (no real PII)
- **Mock metadata service:** self-contained fake IMDS for the SSRF flagship
- **Auth:** JWT

## Requirements

- Docker + Docker Compose

## Run it (local, recommended)

```bash
git clone <this repo>
cd shophunt
cp .env.example .env        # tweak secrets/ports if you like (defaults are fine for local)
docker compose up --build
```

Then open:

- Storefront: <http://localhost:5173>
- API health: <http://localhost:4000/api/health>

Everything binds to `127.0.0.1` only. The mock metadata service is intentionally
**not** published to the host.

### Seeded lab accounts (FAKE)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@shophunt.local` | `Admin123!` |
| Seller | `nadia.seller@shophunt.local` | `Seller123!` |
| Seller | `raj.seller@shophunt.local` | `Seller123!` |
| Customer | `alice@shophunt.local` | `Passw0rd!` |
| Customer | `bob@shophunt.local` | `Passw0rd!` |
| Customer | `carol@shophunt.local` | `Passw0rd!` |

Students normally start by signing up their own account — these are for
instructors and for demonstrating IDOR/account-takeover chains.

> The app looks and behaves like a normal store. **Vulnerabilities are hidden
> inside real features** — there are no "vuln here" labels in the student UI. The
> full answer key is in `docs/vuln-map.md` and in instructor mode.

## Reset the lab

An admin **"Reset Lab"** action re-seeds the database and clears uploaded files so
a class can start clean. (Wired up alongside the admin panel.)

## Instructor mode (answer key)

A hidden instructor surface (OFF by default) exposes the full vulnerability map,
example payloads, and per-finding professional write-ups for a "report
preparation" lesson. Enable it only for instructors:

```bash
# in .env
INSTRUCTOR_MODE=on
INSTRUCTOR_PATH_TOKEN=<your-secret-segment>
```

It is served on a secret path and kept entirely separate from the student UI.
See `docs/vuln-map.md` for the written answer key.

## DevOps lesson: 3-tier EC2 deployment

`devops-3tier/` is a **separate, clean** app (ShopLite) for teaching how to deploy a
frontend, backend and database on three EC2 instances with systemd services.
It is safe to deploy and is not part of the vulnerable lab. See
[`devops-3tier/README.md`](devops-3tier/README.md).

## Docs

- `docs/vuln-map.md` — instructor answer key: which feature hides which bug.
- `docs/adding-a-vulnerability.md` — the pattern for embedding a new bug into a
  feature, so the lab can grow with your course.

## License / use

Educational use in isolated environments only. You are responsible for running it
safely. Do not use it to attack systems you do not own or have explicit permission
to test.
