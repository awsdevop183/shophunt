'use strict';
/* ============================================================================
 * JWT auth — INTENTIONALLY WEAKENED for the JWT lab.
 *  - weak, guessable secret (default "secret", from env)
 *  - tokens never expire (no exp claim)
 *  - verification accepts alg:"none" (unsigned tokens) AND the weak HS256 secret
 * The clean reference implementation lived in Phase 2's git history.
 * ========================================================================== */
const jwt = require('jsonwebtoken');
const config = require('./config');

// No expiry (VULN): tokens are valid forever.
function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    config.jwtSecret,
    { algorithm: 'HS256' } // note: no expiresIn
  );
}

// Also sets an auth cookie so cookie-authenticated (CSRF-able) flows work.
function issueSession(res, user) {
  const token = signToken(user);
  // VULN: not httpOnly, permissive SameSite -> assists XSS token theft + CSRF.
  res.cookie('token', token, { httpOnly: false, sameSite: 'lax', path: '/' });
  return token;
}

function getToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

// INSECURE verification (the heart of the JWT lab).
function verifyInsecure(token) {
  const parts = String(token).split('.');
  if (parts.length < 2) throw new Error('malformed token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));

  // VULN #1: accept alg:"none" — trust the payload with no signature at all.
  if (header.alg && header.alg.toLowerCase() === 'none') {
    return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  }
  // VULN #2: weak secret + no expiry check; accept HS* algorithms.
  return jwt.verify(token, config.jwtSecret, {
    algorithms: ['HS256', 'HS384', 'HS512'],
    ignoreExpiration: true,
  });
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'authentication required' });
  try { req.user = verifyInsecure(token); next(); }
  catch (e) { return res.status(401).json({ error: 'invalid token' }); }
}

function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (token) { try { req.user = verifyInsecure(token); } catch (e) { /* ignore */ } }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'authentication required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

module.exports = { signToken, issueSession, requireAuth, optionalAuth, requireRole, getToken, verifyInsecure };
