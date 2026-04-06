// src/services/userService.js
'use strict';

const { randomUUID }   = require('crypto');
const { hash }         = require('../middleware/password');
const { findAll, findOne, insert, update } = require('../db/store');

function sanitize(user) {
  if (!user) return null;
  const { password: _pw, ...safe } = user;
  return safe;
}

function createUser({ name, email, password, role }) {
  const existing = findOne('users', u => u.email === email);
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }
  const user = {
    id:         randomUUID(),
    name,
    email,
    password:   hash(password),
    role,
    is_active:  true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  insert('users', user);
  return sanitize(user);
}

function findByEmail(email) {
  return findOne('users', u => u.email === email) || null;
}

function findById(id) {
  return sanitize(findOne('users', u => u.id === id));
}

function listUsers({ includeInactive = false } = {}) {
  return findAll('users', u => includeInactive || u.is_active).map(sanitize);
}

function updateUser(id, updates) {
  const existing = findOne('users', u => u.id === id);
  if (!existing) return null;

  const allowed = {};
  if (updates.name      !== undefined) allowed.name      = updates.name;
  if (updates.role      !== undefined) allowed.role      = updates.role;
  if (updates.is_active !== undefined) allowed.is_active = updates.is_active;

  if (Object.keys(allowed).length === 0) return sanitize(existing);
  return sanitize(update('users', u => u.id === id, () => allowed));
}

module.exports = { createUser, findByEmail, findById, listUsers, updateUser };
