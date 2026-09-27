'use strict';
// Product catalog: list/search/filter, detail, reviews. Clean baseline.
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// GET /api/products?search=&category=&min=&max=&sort=
// VULN (SQL injection): `search` is concatenated directly into the WHERE clause,
// giving error-based, boolean-blind, time-based and UNION-based injection. An
// undocumented `order` parameter is also concatenated into ORDER BY (hidden
// parameter for the recon lab). Other filters remain parameterized.
router.get('/', async (req, res, next) => {
  try {
    const { search, category, min, max, sort, order } = req.query;
    const where = [];
    if (search) where.push(`(p.title LIKE '%${search}%' OR p.description LIKE '%${search}%')`);
    if (category) where.push(`p.category = '${category}'`);
    if (min) where.push(`p.price_cents >= ${parseInt(min, 10) || 0}`);
    if (max) where.push(`p.price_cents <= ${parseInt(max, 10) || 0}`);

    let orderBy = 'p.created_at DESC';
    if (sort === 'price_asc') orderBy = 'p.price_cents ASC';
    else if (sort === 'price_desc') orderBy = 'p.price_cents DESC';
    else if (sort === 'rating') orderBy = 'p.rating_avg DESC';
    if (order) orderBy = order; // undocumented param -> ORDER BY injection

    const sql =
      `SELECT p.id, p.title, p.description, p.price_cents, p.category, p.image_url,
              p.stock, p.rating_avg, u.name AS seller_name
         FROM products p JOIN users u ON u.id = p.seller_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY ${orderBy} LIMIT 100`;
    const rows = await db.raw(sql);
    res.json({ products: rows });
  } catch (e) { next(e); }
});

router.get('/categories', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT DISTINCT category FROM products ORDER BY category');
    res.json({ categories: rows.map(r => r.category) });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT p.*, u.name AS seller_name FROM products p
         JOIN users u ON u.id = p.seller_id WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'product not found' });
    const reviews = await db.query(
      'SELECT id, author_name, rating, body, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ product: rows[0], reviews });
  } catch (e) { next(e); }
});

// Post a review (auth required). Clean baseline stores plain text.
router.post('/:id/reviews', requireAuth, async (req, res, next) => {
  try {
    const { rating, body } = req.body || {};
    const prod = await db.query('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if (!prod.length) return res.status(404).json({ error: 'product not found' });
    const r = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
    await db.query(
      'INSERT INTO reviews (product_id, user_id, author_name, rating, body) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, req.user.sub, req.user.name, r, body || '']
    );
    // Recompute average.
    await db.query(
      'UPDATE products SET rating_avg = (SELECT AVG(rating) FROM reviews WHERE product_id = ?) WHERE id = ?',
      [req.params.id, req.params.id]
    );
    const reviews = await db.query(
      'SELECT id, author_name, rating, body, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.status(201).json({ reviews });
  } catch (e) { next(e); }
});

module.exports = router;
