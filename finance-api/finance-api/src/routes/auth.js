// src/routes/auth.js
'use strict';

const Router        = require('../middleware/router');
const { register, loginHandler, me } = require('../controllers/authController');
const { authenticate, authorize, validate } = require('../middleware');
const { registerSchema, loginSchema }       = require('../validators/schemas');

const router = new Router();

// Public
router.post('/login',    validate(loginSchema),    loginHandler);

// Admin creates users
router.post('/register', authenticate, authorize('admin'), validate(registerSchema), register);

// Any authenticated user
router.get('/me', authenticate, me);

module.exports = router;
