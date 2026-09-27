'use strict';
// User profile routes. Clean baseline: /me is scoped to the authenticated user,
// role cannot be changed by the client, and other users' records are not exposed.
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

const PUBLIC_FIELDS = 'id, email, name, role, avatar_url, bio, phone, created_at';

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [req.user.sub]);
    if (!rows.length) return res.status(404).json({ error: 'user not found' });
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});

// Update own profile.
// VULN (mass assignment): the update accepts ANY column the client sends,
// including `role`. A customer can PATCH {"role":"admin"} and the app honors it
// (privilege escalation). The UI only ever sends name/bio/phone/avatar_url.
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const updatable = ['name', 'bio', 'phone', 'avatar_url', 'role', 'email']; // role/email should NOT be here
    const sets = [];
    const params = [];
    for (const key of Object.keys(req.body || {})) {
      if (updatable.includes(key)) { sets.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (!sets.length) return res.status(400).json({ error: 'no updatable fields provided' });
    params.push(req.user.sub);
    await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    const rows = await db.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [req.user.sub]);
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});

// GET /api/users/:id
// VULN (IDOR): returns any user's full record (email, phone, role, ...) with no
// authorization check tying :id to the caller.
router.get('/:id', async (req, res, next) => {
  try {
    const rows = await db.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'user not found' });
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});

// Change email (state-changing).
// VULN (CSRF): authenticated via the non-httpOnly `token` cookie, with no CSRF
// token, no Origin/Referer check, and permissive CORS (credentials + reflected
// origin). A cross-site page can force a victim's email change. Also accepts
// urlencoded bodies, so a plain auto-submitting HTML form works.
router.post('/me/email', requireAuth, async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const taken = await db.query('SELECT id FROM users WHERE email = ? AND id <> ?', [email, req.user.sub]);
    if (taken.length) return res.status(409).json({ error: 'email already in use' });
    await db.query('UPDATE users SET email = ? WHERE id = ?', [email, req.user.sub]);
    res.json({ message: 'email updated', email });
  } catch (e) { next(e); }
});

module.exports = router;
