// src/controllers/userController.js
'use strict';

const { listUsers, findById, updateUser } = require('../services/userService');

function list(req, res) {
  const includeInactive = req.query.include_inactive === 'true';
  const users = listUsers({ includeInactive });
  res.json({ data: users, total: users.length });
}

function getOne(req, res) {
  const user = findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ data: user });
}

function updateHandler(req, res, next) {
  try {
    const updated = updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User updated', data: updated });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, update: updateHandler };
