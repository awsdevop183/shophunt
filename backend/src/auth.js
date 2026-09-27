'use strict';
// Clean JWT auth baseline. (A later phase intentionally weakens verification for
// the JWT lab; this baseline is the "correct" reference implementation.)
const jwt = require('jsonwebtoken');
const config = require('./config');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: '2h', algorithm: 'HS256' }
  );
}

// Extracts a bearer token from Authorization header or `token` cookie.
function getToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

// Require a valid token; attaches req.user.
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'authentication required' });
  try {
    req.user = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Optional auth: attaches req.user if a valid token is present, else continues.
function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (token) {
    try { req.user = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }); }
    catch (e) { /* ignore */ }
  }
  next();
}

// Require a specific role.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'authentication required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

module.exports = { signToken, requireAuth, optionalAuth, requireRole, getToken };
