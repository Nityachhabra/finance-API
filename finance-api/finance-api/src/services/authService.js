// src/services/authService.js
'use strict';

const { compare }     = require('../middleware/password');
const { sign }        = require('../middleware/jwt');
const { findByEmail } = require('./userService');

// Fallback hash has correct PBKDF2 format so compare() won't crash on unknown emails.
// 64 zero-bytes in hex = 128 chars for the hash segment.
const DUMMY_HASH = 'pbkdf2:sha256:100000:' + '00'.repeat(32) + ':' + '00'.repeat(64);

function login(email, password) {
  const user = findByEmail(email);

  // Always run compare — prevents timing-based user enumeration
  const valid = compare(password, user?.password || DUMMY_HASH);

  if (!user || !valid) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }
  if (!user.is_active) {
    const err = new Error('Account is deactivated');
    err.status = 403;
    throw err;
  }

  const { password: _pw, ...safeUser } = user;
  return {
    user:  safeUser,
    token: sign({ sub: user.id, role: user.role, email: user.email }),
  };
}

module.exports = { login };
