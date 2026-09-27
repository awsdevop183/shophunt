'use strict';
// Admin panel API. Clean baseline: admin role required on every route.
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { seed } = require('../seed');
const { clearCaptures } = require('../state');
const config = require('../config');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// VULN (broken access control): these admin routes require only a valid login,
// NOT the admin role. Any authenticated customer can call /api/admin/* directly
// (the admin panel is merely hidden in the UI). The `requireRole('admin')` that
// belongs here has been removed.
router.use(requireAuth /* , requireRole('admin') */);

router.get('/users', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT id, email, name, role, created_at FROM users ORDER BY id');
    res.json({ users: rows });
  } catch (e) { next(e); }
});

router.get('/tickets', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT id, user_id, email, subject, status, created_at FROM support_tickets ORDER BY id DESC');
    res.json({ tickets: rows });
  } catch (e) { next(e); }
});

router.get('/tickets/:id', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'ticket not found' });
    await db.query('UPDATE support_tickets SET admin_seen = 1 WHERE id = ?', [req.params.id]);
    res.json({ ticket: rows[0] });
  } catch (e) { next(e); }
});

// Reset Lab: re-seed the DB and clear uploaded files so a class can start clean.
router.post('/reset-lab', async (req, res, next) => {
  try {
    await seed({ reset: true });
    clearCaptures();
    // Clear uploads dir (keep the directory + .gitkeep).
    try {
      const dir = config.uploadDir;
      for (const f of fs.readdirSync(dir)) {
        if (f === '.gitkeep') continue;
        fs.rmSync(path.join(dir, f), { recursive: true, force: true });
      }
    } catch (e) { /* uploads dir may not exist yet */ }
    res.json({ message: 'Lab reset: database re-seeded and uploads cleared.' });
  } catch (e) { next(e); }
});

module.exports = router;
