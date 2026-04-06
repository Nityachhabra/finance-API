// src/validators/schemas.js
// Schema-based validation without external libraries.
// Each validator returns { ok: true, data } or { ok: false, errors: [...] }

'use strict';

const ROLES          = ['viewer', 'analyst', 'admin'];
const RECORD_TYPES   = ['income', 'expense'];
const DATE_RE        = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE       = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function err(field, message) {
  return { field, message };
}

function validate(rules, data) {
  const errors = [];
  const out    = {};

  for (const [field, checks] of Object.entries(rules)) {
    let val = data?.[field];

    for (const check of checks) {
      const result = check(val, field, data);
      if (result) { errors.push(result); break; }
    }

    if (!errors.find(e => e.field === field)) {
      out[field] = val;
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, data: out };
}

// ── Reusable check factories ───────────────────────────────────────────────────

const required = (v, f) => (v === undefined || v === null || v === '') ? err(f, 'Required') : null;
const isString = (v, f) => (v !== undefined && typeof v !== 'string') ? err(f, 'Must be a string') : null;
const isNumber = (v, f) => (v !== undefined && (typeof v !== 'number' || isNaN(v))) ? err(f, 'Must be a number') : null;
const isBool   = (v, f) => (v !== undefined && typeof v !== 'boolean') ? err(f, 'Must be a boolean') : null;
const minLen   = n => (v, f) => (v && v.length < n) ? err(f, `Must be at least ${n} characters`) : null;
const maxLen   = n => (v, f) => (v && v.length > n) ? err(f, `Must be at most ${n} characters`) : null;
const positive = (v, f) => (v !== undefined && v <= 0) ? err(f, 'Must be greater than 0') : null;
const oneOf    = opts => (v, f) => (v !== undefined && !opts.includes(v)) ? err(f, `Must be one of: ${opts.join(', ')}`) : null;
const isEmail  = (v, f) => (v && !EMAIL_RE.test(v)) ? err(f, 'Invalid email address') : null;
const isDate   = (v, f) => (v && !DATE_RE.test(v)) ? err(f, 'Must be in YYYY-MM-DD format') : null;
const optional = () => null; // marks a field as optional (no-op check)

// ── Concrete schemas ───────────────────────────────────────────────────────────

function loginSchema(body) {
  return validate({
    email:    [required, isString, isEmail],
    password: [required, isString],
  }, body);
}

function registerSchema(body) {
  return validate({
    name:     [required, isString, minLen(2), maxLen(100)],
    email:    [required, isString, isEmail],
    password: [required, isString, minLen(8)],
    role:     [required, isString, oneOf(ROLES)],
  }, body);
}

function updateUserSchema(body) {
  return validate({
    name:      [optional, isString, minLen(2), maxLen(100)],
    role:      [optional, isString, oneOf(ROLES)],
    is_active: [optional, isBool],
  }, body);
}

function createRecordSchema(body) {
  // Coerce amount to number if it came in as a string-number
  if (typeof body?.amount === 'string' && body.amount.trim() !== '') {
    body = { ...body, amount: Number(body.amount) };
  }
  return validate({
    amount:   [required, isNumber, positive],
    type:     [required, isString, oneOf(RECORD_TYPES)],
    category: [required, isString, minLen(1), maxLen(100)],
    date:     [required, isString, isDate],
    notes:    [optional, isString, maxLen(500)],
  }, body);
}

function updateRecordSchema(body) {
  if (typeof body?.amount === 'string' && body.amount.trim() !== '') {
    body = { ...body, amount: Number(body.amount) };
  }
  return validate({
    amount:   [optional, isNumber, positive],
    type:     [optional, isString, oneOf(RECORD_TYPES)],
    category: [optional, isString, minLen(1), maxLen(100)],
    date:     [optional, isString, isDate],
    notes:    [optional, isString, maxLen(500)],
  }, body);
}

function recordFilterSchema(query) {
  const q = { ...query };
  // Coerce pagination to numbers
  if (q.page)  q.page  = Number(q.page);
  if (q.limit) q.limit = Number(q.limit);

  const result = validate({
    type:      [optional, isString, oneOf(RECORD_TYPES)],
    category:  [optional, isString],
    date_from: [optional, isString, isDate],
    date_to:   [optional, isString, isDate],
    page:      [optional, isNumber, positive],
    limit:     [optional, isNumber, positive],
  }, q);

  if (result.ok) {
    result.data.page  = result.data.page  || 1;
    result.data.limit = Math.min(result.data.limit || 20, 100);
  }
  return result;
}

module.exports = {
  loginSchema,
  registerSchema,
  updateUserSchema,
  createRecordSchema,
  updateRecordSchema,
  recordFilterSchema,
};
