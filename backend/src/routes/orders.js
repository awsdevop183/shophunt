'use strict';
// Checkout + orders. Clean baseline: prices come from the DB (never trusted from
// the client), a single coupon is applied, and orders are scoped to their owner.
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { getOrCreateCart, cartView } = require('./cart');

const router = express.Router();

async function resolveCoupon(code) {
  if (!code) return null;
  const rows = await db.query('SELECT * FROM coupons WHERE code = ? AND active = 1', [code]);
  return rows[0] || null;
}

function applyCoupon(subtotal, coupon) {
  if (!coupon) return 0;
  if (coupon.kind === 'percent') return Math.floor(subtotal * Math.min(100, coupon.value) / 100);
  return Math.min(subtotal, coupon.value); // fixed
}

// GET /api/orders — the authenticated user's own orders.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      'SELECT id, subtotal_cents, discount_cents, total_cents, status, coupon_code, created_at FROM orders WHERE user_id = ? ORDER BY id DESC',
      [req.user.sub]
    );
    res.json({ orders: rows });
  } catch (e) { next(e); }
});

// GET /api/orders/:id
// VULN (IDOR): authenticated, but the ownership check is gone — any logged-in
// user can read ANY order (and its shipping PII) by incrementing the id.
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'order not found' });
    const items = await db.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ order: rows[0], items });
  } catch (e) { next(e); }
});

// POST /api/orders/checkout — turns the user's cart into an order.
// VULNS (business logic / parameter tampering):
//   * client price trust: if the request supplies `items` with unit prices,
//     those prices are trusted instead of the catalog price.
//   * coupon stacking: `coupon_codes` (array) applies EVERY coupon cumulatively,
//     and there is no floor beyond 0 per-coupon, so stacking + negative-quantity
//     cart lines can drive the total to $0.
router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const cartId = await getOrCreateCart(req.user.sub);
    const cart = await cartView(cartId);

    // VULN: trust client-supplied line items/prices when present.
    const items = Array.isArray(req.body?.items) && req.body.items.length
      ? req.body.items.map(it => ({
          product_id: parseInt(it.product_id, 10),
          title: it.title || 'item',
          quantity: parseInt(it.quantity, 10) || 1,
          price_cents: parseInt(it.unit_price_cents ?? it.price_cents, 10), // trusted!
        }))
      : cart.items;
    if (!items.length) return res.status(400).json({ error: 'cart is empty' });

    const subtotal_cents = items.reduce((s, it) => s + it.price_cents * it.quantity, 0);

    // VULN: stack every provided coupon (single `coupon_code` still supported).
    const codes = [];
    if (Array.isArray(req.body?.coupon_codes)) codes.push(...req.body.coupon_codes);
    if (req.body?.coupon_code) codes.push(req.body.coupon_code);
    let discount = 0;
    const applied = [];
    for (const code of codes) {
      const coupon = await resolveCoupon(code);
      if (coupon) { discount += applyCoupon(subtotal_cents, coupon); applied.push(coupon.code); }
    }
    const total = subtotal_cents - discount; // note: not floored to >= 0

    const { ship_name, ship_address } = req.body || {};
    const order = await db.query(
      `INSERT INTO orders (user_id, subtotal_cents, discount_cents, total_cents, status, coupon_code, ship_name, ship_address)
       VALUES (?, ?, ?, ?, 'paid', ?, ?, ?)`,
      [req.user.sub, subtotal_cents, discount, total, applied.join(',') || null, ship_name || null, ship_address || null]
    );
    for (const it of items) {
      await db.query(
        'INSERT INTO order_items (order_id, product_id, title, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?)',
        [order.insertId, it.product_id, it.title, it.quantity, it.price_cents]
      );
    }
    await db.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
    res.status(201).json({ order_id: order.insertId, subtotal_cents, discount_cents: discount, total_cents: total });
  } catch (e) { next(e); }
});

module.exports = { router, resolveCoupon, applyCoupon };
