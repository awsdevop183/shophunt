'use strict';
/* ShopHunt seed — FAKE data only (no real PII). Idempotent-ish: with
 * { reset:true } it truncates and reloads. Known lab passwords are intentional
 * so instructors/students can log in; documented in the instructor answer key. */
const bcrypt = require('bcryptjs');
const db = require('./db');

// --- Fake accounts (known lab credentials) ---------------------------------
const USERS = [
  { email: 'admin@shophunt.local',   name: 'Site Admin',      role: 'admin',    password: 'Admin123!' },
  { email: 'nadia.seller@shophunt.local', name: 'Nadia Okoro', role: 'seller',  password: 'Seller123!' },
  { email: 'raj.seller@shophunt.local',   name: 'Raj Patel',   role: 'seller',  password: 'Seller123!' },
  { email: 'alice@shophunt.local',   name: 'Alice Martin',    role: 'customer', password: 'Passw0rd!' },
  { email: 'bob@shophunt.local',     name: 'Bob Chen',        role: 'customer', password: 'Passw0rd!' },
  { email: 'carol@shophunt.local',   name: 'Carol Diaz',      role: 'customer', password: 'Passw0rd!' },
];

const PRODUCTS = [
  { seller: 1, title: 'Aurora Wireless Headphones', price: 12999, category: 'audio', stock: 40, desc: 'Over-ear ANC headphones with 30h battery.' },
  { seller: 1, title: 'PulseFit Smart Watch',        price: 8999,  category: 'wearables', stock: 65, desc: 'Heart-rate, GPS, 7-day battery.' },
  { seller: 1, title: 'NovaBook 14 Laptop Sleeve',   price: 2499,  category: 'accessories', stock: 120, desc: 'Water-resistant 14" sleeve.' },
  { seller: 2, title: 'BrewMaster Pour-Over Kit',    price: 3499,  category: 'kitchen', stock: 80, desc: 'Ceramic dripper + gooseneck kettle.' },
  { seller: 2, title: 'TrailLight Headlamp',         price: 1999,  category: 'outdoor', stock: 200, desc: 'USB-C rechargeable, 400 lumens.' },
  { seller: 2, title: 'ZenDesk Bamboo Organizer',    price: 2799,  category: 'office', stock: 55, desc: 'Modular bamboo desk organizer.' },
  { seller: 1, title: 'Lumen Smart Bulb (4-pack)',   price: 3999,  category: 'smart-home', stock: 90, desc: 'RGBW, app + voice control.' },
  { seller: 2, title: 'AquaPure Water Bottle 1L',    price: 1599,  category: 'outdoor', stock: 300, desc: 'Insulated stainless steel.' },
];

const COUPONS = [
  { code: 'WELCOME10', kind: 'percent', value: 10 },
  { code: 'SAVE5',     kind: 'fixed',   value: 500 },
  { code: 'VIP20',     kind: 'percent', value: 20 },
];

const REVIEWS = [
  { product: 1, user: 4, rating: 5, body: 'Incredible sound and the noise cancelling is superb.' },
  { product: 1, user: 5, rating: 4, body: 'Great value, a little tight after a few hours.' },
  { product: 2, user: 6, rating: 5, body: 'Battery really does last a week!' },
  { product: 4, user: 4, rating: 5, body: 'Best morning coffee I have made at home.' },
  { product: 5, user: 5, rating: 4, body: 'Bright and light. Wish it had a red mode.' },
];

async function truncateAll() {
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  const tables = ['order_items', 'orders', 'cart_items', 'carts', 'reviews',
    'products', 'coupons', 'support_tickets', 'password_resets', 'users'];
  for (const t of tables) await db.query(`TRUNCATE TABLE ${t}`);
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function seed({ reset = false } = {}) {
  if (reset) await truncateAll();

  // Skip if already seeded (non-reset call).
  const existing = await db.query('SELECT COUNT(*) AS c FROM users');
  if (!reset && existing[0].c > 0) {
    console.log('[seed] users already present; skipping (use reset to reload).');
    return;
  }

  const userIds = [];
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const r = await db.query('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [u.email, hash, u.name, u.role]);
    userIds.push(r.insertId);
    await db.query('INSERT INTO carts (user_id) VALUES (?)', [r.insertId]);
  }

  const productIds = [];
  for (const p of PRODUCTS) {
    const r = await db.query(
      'INSERT INTO products (seller_id, title, description, price_cents, category, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [userIds[p.seller - 1], p.title, p.desc, p.price, p.category, p.stock]);
    productIds.push(r.insertId);
  }

  for (const c of COUPONS) {
    await db.query('INSERT INTO coupons (code, kind, value, active) VALUES (?, ?, ?, 1)', [c.code, c.kind, c.value]);
  }

  for (const rv of REVIEWS) {
    const author = USERS[rv.user - 1];
    await db.query('INSERT INTO reviews (product_id, user_id, author_name, rating, body) VALUES (?, ?, ?, ?, ?)',
      [productIds[rv.product - 1], userIds[rv.user - 1], author.name, rv.rating, rv.body]);
    await db.query('UPDATE products SET rating_avg = (SELECT AVG(rating) FROM reviews WHERE product_id = ?) WHERE id = ?',
      [productIds[rv.product - 1], productIds[rv.product - 1]]);
  }

  // A couple of fake orders so seller sales + order history have data.
  const alice = userIds[3], bob = userIds[4];
  async function makeOrder(userId, items, couponCode = null) {
    let subtotal = 0;
    for (const it of items) subtotal += it.price * it.qty;
    const discount = couponCode === 'WELCOME10' ? Math.floor(subtotal * 0.1) : 0;
    const total = subtotal - discount;
    const o = await db.query(
      `INSERT INTO orders (user_id, subtotal_cents, discount_cents, total_cents, status, coupon_code, ship_name, ship_address)
       VALUES (?, ?, ?, ?, 'paid', ?, ?, ?)`,
      [userId, subtotal, discount, total, couponCode, 'Lab User', '123 Fake St, Testville']);
    for (const it of items) {
      await db.query('INSERT INTO order_items (order_id, product_id, title, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?)',
        [o.insertId, it.id, it.title, it.qty, it.price]);
    }
  }
  await makeOrder(alice, [
    { id: productIds[0], title: PRODUCTS[0].title, price: PRODUCTS[0].price, qty: 1 },
    { id: productIds[2], title: PRODUCTS[2].title, price: PRODUCTS[2].price, qty: 2 },
  ], 'WELCOME10');
  await makeOrder(bob, [
    { id: productIds[3], title: PRODUCTS[3].title, price: PRODUCTS[3].price, qty: 1 },
  ]);

  // Seed a support ticket.
  await db.query('INSERT INTO support_tickets (user_id, email, subject, body) VALUES (?, ?, ?, ?)',
    [alice, USERS[3].email, 'Where is my order?', 'Hi, I ordered headphones last week and want a shipping update.']);

  console.log('[seed] done. users=%d products=%d', userIds.length, productIds.length);
}

module.exports = { seed };

// Allow `npm run seed`.
if (require.main === module) {
  const reset = process.argv.includes('--reset');
  seed({ reset })
    .then(() => { console.log('[seed] complete'); process.exit(0); })
    .catch((e) => { console.error('[seed] error', e); process.exit(1); });
}
