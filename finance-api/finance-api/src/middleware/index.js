// src/middleware/index.js
// authenticate  – verifies JWT, loads user, checks is_active
// authorize     – role-based guard (must follow authenticate)
// validate      – runs a schema function, returns 400 on failure
// errorHandler  – last-resort 4-arg error handler

'use strict';

const { verify }     = require('./jwt');
const { findOne }    = require('../db/store');

// ── JWT authentication ────────────────────────────────────────────────────────

function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  let payload;
  try {
    payload = verify(header.slice(7));
  } catch (e) {
    const msg = e.message === 'Token expired' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: msg });
  }

  // Re-fetch user on every request so deactivations take effect immediately
  const user = findOne('users', u => u.id === payload.sub);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated' });

  // Attach safe user (no password hash) to req
  const { password: _pw, ...safeUser } = user;
  req.user = safeUser;
  next();
}

// ── Role-based access control ─────────────────────────────────────────────────

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error:   'Forbidden',
        message: `Requires role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
}

// ── Schema validation ─────────────────────────────────────────────────────────
// schemaFn receives req.body or req.query; returns { ok, data, errors }

function validate(schemaFn, source) {
  return (req, res, next) => {
    const input = source === 'query' ? req.query : req.body;
    const result = schemaFn(input);
    if (!result.ok) {
      return res.status(400).json({ error: 'Validation failed', details: result.errors });
    }
    if (source === 'query') req.query = result.data;
    else req.body = result.data;
    next();
  };
}

// ── Global error handler ──────────────────────────────────────────────────────

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[${new Date().toISOString()}] ERROR ${req.method} ${req.path} —`, err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = { authenticate, authorize, validate, errorHandler };
