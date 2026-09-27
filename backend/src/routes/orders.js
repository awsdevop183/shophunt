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

// GET /api/orders/:id — clean baseline enforces ownership.
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.sub]);
    if (!rows.length) return res.status(404).json({ error: 'order not found' });
    const items = await db.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ order: rows[0], items });
  } catch (e) { next(e); }
});

// POST /api/checkout — turns the user's cart into an order.
router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const cartId = await getOrCreateCart(req.user.sub);
    const { items, subtotal_cents } = await cartView(cartId);
    if (!items.length) return res.status(400).json({ error: 'cart is empty' });

    const coupon = await resolveCoupon(req.body?.coupon_code);
    const discount = applyCoupon(subtotal_cents, coupon);
    const total = Math.max(0, subtotal_cents - discount);

    const { ship_name, ship_address } = req.body || {};
    const order = await db.query(
      `INSERT INTO orders (user_id, subtotal_cents, discount_cents, total_cents, status, coupon_code, ship_name, ship_address)
       VALUES (?, ?, ?, ?, 'paid', ?, ?, ?)`,
      [req.user.sub, subtotal_cents, discount, total, coupon ? coupon.code : null, ship_name || null, ship_address || null]
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
