// src/middleware/jwt.js
// Minimal JWT (HS256) built on Node's built-in crypto module.
// Implements only what we need: sign + verify. Compatible with
// standard JWT libraries on the client side.

'use strict';

const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'change-me-in-production-use-long-random-string';
const EXPIRES_IN_SEC = 60 * 60 * 24 * 7; // 7 days

function b64url(buf) {
  return (Buffer.isBuffer(buf) ? buf : Buffer.from(buf))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function sign(payload) {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = b64url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + EXPIRES_IN_SEC,
  }));
  const sig = b64url(
    crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') throw new Error('Missing token');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');

  const [header, body, sig] = parts;
  const expected = b64url(
    crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest()
  );

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(sig,      'base64');
  const expBuf = Buffer.from(expected, 'base64');
  if (sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid signature');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
  } catch {
    throw new Error('Malformed payload');
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

module.exports = { sign, verify };
