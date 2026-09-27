'use strict';
/* ============================================================================
 * ShopHunt backend — entrypoint (Phase 1 skeleton).
 * The real store (auth, catalog, cart, profile, ...) is built in Phase 2 and
 * vulnerabilities are embedded feature-by-feature after that.
 *
 * ⚠️  INTENTIONALLY VULNERABLE TRAINING TARGET — isolated lab use only.
 * ========================================================================== */

const express = require('express');

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

// Discourage search-engine indexing everywhere (safety requirement).
app.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'shophunt-backend', phase: 'skeleton' });
});

app.get('/', (req, res) => {
  res.type('text/plain').send(
    'ShopHunt API — a training target by Madhukar Reddy (@awsandevops).\n' +
    'INTENTIONALLY VULNERABLE. Isolated lab use only.\n'
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[shophunt-backend] listening on :${PORT} (skeleton)`);
});
