'use strict';
// Seller dashboard. Clean baseline: seller/admin only, scoped to own products.
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/products', requireAuth, requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const rows = await db.query(
      'SELECT id, title, price_cents, category, stock, rating_avg, created_at FROM products WHERE seller_id = ? ORDER BY id DESC',
      [req.user.sub]
    );
    res.json({ products: rows });
  } catch (e) { next(e); }
});

router.post('/products', requireAuth, requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const { title, description, price_cents, category, image_url, stock } = req.body || {};
    if (!title || price_cents == null) return res.status(400).json({ error: 'title and price_cents required' });
    const r = await db.query(
      'INSERT INTO products (seller_id, title, description, price_cents, category, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.sub, title, description || '', parseInt(price_cents, 10) || 0, category || 'general', image_url || null, parseInt(stock, 10) || 0]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
});

// Aggregate sales for the seller's own products.
router.get('/sales', requireAuth, requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT oi.product_id, oi.title,
              SUM(oi.quantity) AS units_sold,
              SUM(oi.quantity * oi.unit_price_cents) AS revenue_cents
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
        WHERE p.seller_id = ?
        GROUP BY oi.product_id, oi.title
        ORDER BY revenue_cents DESC`,
      [req.user.sub]
    );
    res.json({ sales: rows });
  } catch (e) { next(e); }
});

module.exports = router;
