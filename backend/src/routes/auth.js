'use strict';
// Auth routes: signup, login, password reset (OTP). Clean baseline.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, issueSession } = require('../auth');

const router = express.Router();

// NOTE (rate-limit lab): login and the reset endpoints below have NO throttling
// or lockout, so 6-digit OTPs and passwords are brute-forceable.

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password and name are required' });
    }
    const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, hash, name, 'customer']
    );
    const user = { id: result.insertId, email, name, role: 'customer' };
    await db.query('INSERT INTO carts (user_id) VALUES (?)', [user.id]);
    return res.status(201).json({ token: issueSession(res, user), user });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    // VULN (SQL injection): the email is concatenated straight into the query.
    // Error-based and blind SQLi are possible here; DB errors surface via the
    // verbose error handler. Password is still bcrypt-checked, so this is an
    // extraction primitive (the /api/v1 login below additionally bypasses auth).
    const rows = await db.raw(`SELECT * FROM users WHERE email = '${email}'`);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    const pub = { id: user.id, email: user.email, name: user.name, role: user.role };
    return res.json({ token: issueSession(res, pub), user: pub });
  } catch (e) { next(e); }
});

// Request a password-reset OTP. (Clean baseline: OTP is generated and stored;
// in a real product it would be emailed. Here we return a generic message.)
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const rows = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length) {
      const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
      await db.query('INSERT INTO password_resets (user_id, otp) VALUES (?, ?)', [rows[0].id, otp]);
      // In production this would be emailed, never returned. (Lab note.)
    }
    return res.json({ message: 'If that account exists, a reset code has been sent.' });
  } catch (e) { next(e); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, otp, password } = req.body || {};
    if (!email || !otp || !password) return res.status(400).json({ error: 'email, otp and password required' });
    const rows = await db.query(
      `SELECT pr.id AS reset_id, u.id AS user_id
         FROM password_resets pr JOIN users u ON u.id = pr.user_id
        WHERE u.email = ? AND pr.otp = ? AND pr.used = 0
        ORDER BY pr.id DESC LIMIT 1`,
      [email, otp]
    );
    if (!rows.length) return res.status(400).json({ error: 'invalid or expired code' });
    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, rows[0].user_id]);
    await db.query('UPDATE password_resets SET used = 1 WHERE id = ?', [rows[0].reset_id]);
    return res.json({ message: 'Password updated.' });
  } catch (e) { next(e); }
});

module.exports = router;
