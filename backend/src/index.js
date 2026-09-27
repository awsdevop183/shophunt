'use strict';
/* ShopHunt backend entrypoint.
 * ⚠️ INTENTIONALLY VULNERABLE TRAINING TARGET — isolated lab use only. */
const app = require('./app');
const db = require('./db');
const config = require('./config');
const { seed } = require('./seed');
const adminBot = require('./botAdmin');

async function waitForDb(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try { await db.query('SELECT 1'); return; }
    catch (e) {
      console.log(`[startup] waiting for db (${i + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('database not reachable');
}

(async () => {
  try {
    await waitForDb();
    await seed({});                 // seed once if empty (idempotent)
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`[shophunt-backend] listening on :${config.port}`);
    });
    adminBot.start(); // blind-XSS admin viewer simulation
  } catch (e) {
    console.error('[startup] fatal:', e.message);
    process.exit(1);
  }
})();
