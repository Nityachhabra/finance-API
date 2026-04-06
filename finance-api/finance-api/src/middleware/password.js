// src/middleware/password.js
// Secure password hashing with PBKDF2 (built-in Node crypto).
// Format: pbkdf2:sha256:<iterations>:<salt_hex>:<hash_hex>
// 100k iterations matches bcrypt cost 12 in security level.

'use strict';

const crypto = require('crypto');

const ITERATIONS = 100_000;
const KEY_LEN    = 64;
const DIGEST     = 'sha256';
const SALT_BYTES = 32;

function hash(password) {
  const salt   = crypto.randomBytes(SALT_BYTES).toString('hex');
  const digest = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return `pbkdf2:${DIGEST}:${ITERATIONS}:${salt}:${digest}`;
}

function compare(password, stored) {
  try {
    const parts = stored.split(':');
    if (parts.length !== 5) return false;
    const [, digest, iters, salt, expected] = parts;
    const actual = crypto
      .pbkdf2Sync(password, salt, parseInt(iters, 10), KEY_LEN, digest)
      .toString('hex');
    const a = Buffer.from(actual,   'hex');
    const b = Buffer.from(expected, 'hex');
    // Guard length before timingSafeEqual — it throws if lengths differ
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = { hash, compare };
