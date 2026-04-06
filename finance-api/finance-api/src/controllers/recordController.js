// src/controllers/recordController.js
'use strict';

const {
  createRecord, getRecord, listRecords,
  updateRecord, deleteRecord, getSummary,
} = require('../services/recordService');

function create(req, res, next) {
  try {
    const record = createRecord(req.body, req.user.id);
    res.status(201).json({ message: 'Record created', data: record });
  } catch (err) { next(err); }
}

function list(req, res, next) {
  try {
    res.json(listRecords(req.query));
  } catch (err) { next(err); }
}

function getOne(req, res) {
  const record = getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  res.json({ data: record });
}

function updateHandler(req, res, next) {
  try {
    const updated = updateRecord(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Record updated', data: updated });
  } catch (err) { next(err); }
}

function remove(req, res, next) {
  try {
    const deleted = deleteRecord(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Record deleted (soft)' });
  } catch (err) { next(err); }
}

function summary(req, res, next) {
  try {
    res.json({ data: getSummary({ date_from: req.query.date_from, date_to: req.query.date_to }) });
  } catch (err) { next(err); }
}

module.exports = { create, list, getOne, update: updateHandler, remove, summary };
