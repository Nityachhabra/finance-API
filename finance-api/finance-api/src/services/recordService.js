// src/services/recordService.js
'use strict';

const { randomUUID } = require('crypto');
const { findAll, findOne, insert, update } = require('../db/store');

const ALLOWED_UPDATE_FIELDS = ['amount', 'type', 'category', 'date', 'notes'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isVisible(r) { return !r.is_deleted; }

function applyFilters(records, { type, category, date_from, date_to }) {
  return records.filter(r => {
    if (!isVisible(r))              return false;
    if (type      && r.type      !== type)      return false;
    if (category  && r.category  !== category)  return false;
    if (date_from && r.date      <  date_from)  return false;
    if (date_to   && r.date      >  date_to)    return false;
    return true;
  });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function createRecord({ amount, type, category, date, notes }, createdBy) {
  const record = {
    id:         randomUUID(),
    amount,
    type,
    category,
    date,
    notes:      notes || null,
    is_deleted: false,
    created_by: createdBy,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return insert('records', record);
}

function getRecord(id) {
  const r = findOne('records', r => r.id === id);
  return (r && !r.is_deleted) ? r : null;
}

function listRecords(filters) {
  const { page, limit } = filters;
  const all = applyFilters(findAll('records'), filters);

  // Sort by date desc, then created_at desc
  all.sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
  });

  const total       = all.length;
  const offset      = (page - 1) * limit;
  const data        = all.slice(offset, offset + limit);
  const total_pages = Math.ceil(total / limit) || 1;

  return { data, pagination: { total, page, limit, total_pages } };
}

function updateRecord(id, updates) {
  const existing = findOne('records', r => r.id === id && !r.is_deleted);
  if (!existing) return null;

  const allowed = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (updates[key] !== undefined) allowed[key] = updates[key];
  }
  if (Object.keys(allowed).length === 0) return existing;
  return update('records', r => r.id === id, () => allowed);
}

function deleteRecord(id) {
  const existing = findOne('records', r => r.id === id && !r.is_deleted);
  if (!existing) return false;
  update('records', r => r.id === id, () => ({ is_deleted: true }));
  return true;
}

// ── Analytics / summary ───────────────────────────────────────────────────────

function getSummary({ date_from, date_to } = {}) {
  const visible = applyFilters(findAll('records'), { date_from, date_to });

  let total_income   = 0;
  let total_expenses = 0;
  const catMap       = {};  // "Salary:income" -> { category, type, total, count }
  const monthMap     = {};  // "2024-01" -> { month, income, expenses }

  for (const r of visible) {
    if (r.type === 'income')  total_income   += r.amount;
    else                      total_expenses += r.amount;

    // Category breakdown
    const catKey = `${r.category}:${r.type}`;
    if (!catMap[catKey]) catMap[catKey] = { category: r.category, type: r.type, total: 0, count: 0 };
    catMap[catKey].total += r.amount;
    catMap[catKey].count += 1;

    // Monthly trend
    const month = r.date.slice(0, 7); // YYYY-MM
    if (!monthMap[month]) monthMap[month] = { month, income: 0, expenses: 0 };
    if (r.type === 'income') monthMap[month].income   += r.amount;
    else                     monthMap[month].expenses += r.amount;
  }

  // Sort category breakdown by total desc
  const category_breakdown = Object.values(catMap)
    .sort((a, b) => b.total - a.total);

  // Monthly trend: last 12 months, chronological
  const monthly_trend = Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);

  // Recent activity: 5 most recent
  const recent_activity = [...visible]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map(({ id, amount, type, category, date, notes, created_at }) =>
      ({ id, amount, type, category, date, notes, created_at }));

  return {
    total_income:      round2(total_income),
    total_expenses:    round2(total_expenses),
    net_balance:       round2(total_income - total_expenses),
    total_records:     visible.length,
    category_breakdown,
    monthly_trend,
    recent_activity,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { createRecord, getRecord, listRecords, updateRecord, deleteRecord, getSummary };
