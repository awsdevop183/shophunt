'use strict';
// Coupon validation endpoint (used by the cart UI to preview a discount).
const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/:code', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT code, kind, value, active FROM coupons WHERE code = ?', [req.params.code]);
    if (!rows.length || !rows[0].active) return res.status(404).json({ error: 'invalid coupon' });
    res.json({ coupon: rows[0] });
  } catch (e) { next(e); }
});

module.exports = router;
