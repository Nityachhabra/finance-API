// src/controllers/authController.js
'use strict';

const { createUser }  = require('../services/userService');
const { login }       = require('../services/authService');

function register(req, res, next) {
  try {
    const user = createUser(req.body);
    res.status(201).json({ message: 'User created', user });
  } catch (err) { next(err); }
}

function loginHandler(req, res, next) {
  try {
    const { user, token } = login(req.body.email, req.body.password);
    res.json({ message: 'Login successful', user, token });
  } catch (err) { next(err); }
}

function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, loginHandler, me };
