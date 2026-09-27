'use strict';
// Support tickets. Clean baseline: users create/list their own tickets.
const express = require('express');
const db = require('../db');
const { optionalAuth, requireAuth } = require('../auth');

const router = express.Router();

// Anyone can open a support ticket (logged in or with an email).
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { subject, body, email } = req.body || {};
    if (!subject) return res.status(400).json({ error: 'subject required' });
    const userId = req.user ? req.user.sub : null;
    const r = await db.query(
      'INSERT INTO support_tickets (user_id, email, subject, body) VALUES (?, ?, ?, ?)',
      [userId, email || (req.user ? req.user.email : null), subject, body || '']
    );
    res.status(201).json({ id: r.insertId, message: 'Ticket submitted. Our team will get back to you.' });
  } catch (e) { next(e); }
});

// List the authenticated user's own tickets.
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      'SELECT id, subject, status, created_at FROM support_tickets WHERE user_id = ? ORDER BY id DESC',
      [req.user.sub]
    );
    res.json({ tickets: rows });
  } catch (e) { next(e); }
});

module.exports = router;
