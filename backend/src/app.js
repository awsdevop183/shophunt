'use strict';
// Express app assembly (clean baseline).
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();

// CORS for the SPA (localhost only in the lab). Credentials allowed for cookies.
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Discourage indexing everywhere (safety requirement).
app.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// Serve uploaded files.
app.use('/uploads', express.static(config.uploadDir));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'shophunt-backend' }));

// Feature routes.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart').router);
app.use('/api/orders', require('./routes/orders').router);
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/users', require('./routes/users'));
app.use('/api/seller', require('./routes/sellers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/uploads', require('./routes/uploads'));

// Deprecated but still-live v1 API (recon lab): MORE vulnerable than the current
// endpoints above. Also hosts the blind-XSS collector + cloud-sync impact demo.
app.use('/api/v1', require('./routes/v1'));

// Hidden instructor answer-key surface (OFF unless INSTRUCTOR_MODE=on).
app.use('/api/instructor', require('./routes/instructor').router);

// 404
app.use((req, res) => res.status(404).json({ error: 'not found' }));

// Error handler — VULN (info disclosure): verbose stack traces and the failing
// SQL/message are returned to the client, which powers error-based SQLi and
// general recon. A real product would return a generic message + a log id.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'internal error',
    code: err.code,
    sqlMessage: err.sqlMessage,
    sql: err.sql,
    stack: err.stack,
  });
});

module.exports = app;
