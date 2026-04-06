// src/db/store.js
// Persistent JSON file store — no external dependencies.
// Each "table" is a key in data.json. Writes are atomic (write to tmp, rename).
// For a production version, swap this module's interface for better-sqlite3
// without changing any service code.

'use strict';

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.resolve(process.env.DB_PATH || './data.json');

// ── Initial schema ─────────────────────────────────────────────────────────────

const EMPTY_DB = {
  users:   [],
  records: [],
};

// ── Load / save ────────────────────────────────────────────────────────────────

function load() {
  if (!fs.existsSync(DB_PATH)) {
    save(EMPTY_DB);
    return structuredClone(EMPTY_DB);
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    save(EMPTY_DB);
    return structuredClone(EMPTY_DB);
  }
}

function save(data) {
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH); // atomic on same filesystem
}

// ── Generic table helpers ──────────────────────────────────────────────────────

function getTable(table) {
  return load()[table] || [];
}

function findAll(table, predicate) {
  return getTable(table).filter(predicate || (() => true));
}

function findOne(table, predicate) {
  return getTable(table).find(predicate) || null;
}

function insert(table, record) {
  const db = load();
  db[table] = db[table] || [];
  db[table].push(record);
  save(db);
  return record;
}

function update(table, predicate, updater) {
  const db   = load();
  const rows = db[table] || [];
  let updated = null;
  db[table] = rows.map(row => {
    if (predicate(row)) {
      updated = { ...row, ...updater(row), updated_at: new Date().toISOString() };
      return updated;
    }
    return row;
  });
  if (updated) save(db);
  return updated;
}

// ── Expose a thin query interface ──────────────────────────────────────────────

module.exports = { findAll, findOne, insert, update };
