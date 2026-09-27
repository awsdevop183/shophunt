'use strict';
// Cart routes. Clean baseline: quantities must be positive integers.
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

async function getOrCreateCart(userId) {
  const rows = await db.query('SELECT id FROM carts WHERE user_id = ?', [userId]);
  if (rows.length) return rows[0].id;
  const r = await db.query('INSERT INTO carts (user_id) VALUES (?)', [userId]);
  return r.insertId;
}

async function cartView(cartId) {
  const items = await db.query(
    `SELECT ci.id, ci.product_id, ci.quantity, p.title, p.price_cents, p.image_url
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = ?`,
    [cartId]
  );
  const subtotal = items.reduce((s, it) => s + it.price_cents * it.quantity, 0);
  return { items, subtotal_cents: subtotal };
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const cartId = await getOrCreateCart(req.user.sub);
    res.json(await cartView(cartId));
  } catch (e) { next(e); }
});

router.post('/items', requireAuth, async (req, res, next) => {
  try {
    const productId = parseInt(req.body?.product_id, 10);
    const quantity = parseInt(req.body?.quantity, 10);
    if (!productId) return res.status(400).json({ error: 'product_id required' });
    // VULN (business logic): negative and zero quantities are accepted. A
    // negative-quantity line item produces a negative subtotal, which can zero
    // out or reverse an order total at checkout.
    if (!Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'quantity must be an integer' });
    }
    const prod = await db.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (!prod.length) return res.status(404).json({ error: 'product not found' });

    const cartId = await getOrCreateCart(req.user.sub);
    const existing = await db.query('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?', [cartId, productId]);
    if (existing.length) {
      await db.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [existing[0].quantity + quantity, existing[0].id]);
    } else {
      await db.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)', [cartId, productId, quantity]);
    }
    res.status(201).json(await cartView(cartId));
  } catch (e) { next(e); }
});

router.patch('/items/:itemId', requireAuth, async (req, res, next) => {
  try {
    const quantity = parseInt(req.body?.quantity, 10);
    // VULN (business logic): no lower bound — negative quantities allowed.
    if (!Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'quantity must be an integer' });
    }
    const cartId = await getOrCreateCart(req.user.sub);
    // Ownership: item must belong to this user's cart.
    const own = await db.query('SELECT id FROM cart_items WHERE id = ? AND cart_id = ?', [req.params.itemId, cartId]);
    if (!own.length) return res.status(404).json({ error: 'cart item not found' });
    await db.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, req.params.itemId]);
    res.json(await cartView(cartId));
  } catch (e) { next(e); }
});

router.delete('/items/:itemId', requireAuth, async (req, res, next) => {
  try {
    const cartId = await getOrCreateCart(req.user.sub);
    await db.query('DELETE FROM cart_items WHERE id = ? AND cart_id = ?', [req.params.itemId, cartId]);
    res.json(await cartView(cartId));
  } catch (e) { next(e); }
});

module.exports = { router, getOrCreateCart, cartView };
