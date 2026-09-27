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

// Update own profile. Clean baseline: only a safe allowlist of fields; role and
// email-uniqueness handled server-side. (A later phase adds mass-assignment.)
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const allowed = ['name', 'bio', 'phone', 'avatar_url'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (req.body && req.body[key] !== undefined) { sets.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (!sets.length) return res.status(400).json({ error: 'no updatable fields provided' });
    params.push(req.user.sub);
    await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    const rows = await db.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [req.user.sub]);
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});

// Change email (state-changing). Clean baseline requires auth.
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
