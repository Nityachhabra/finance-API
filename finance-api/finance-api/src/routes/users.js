// src/routes/users.js
'use strict';

const Router      = require('../middleware/router');
const { list, getOne, update } = require('../controllers/userController');
const { authenticate, authorize, validate } = require('../middleware');
const { updateUserSchema } = require('../validators/schemas');

const router = new Router();

// All user management is admin-only
router.use(authenticate, authorize('admin'));

router.get('/',    list);
router.get('/:id', getOne);
router.patch('/:id', validate(updateUserSchema), update);

module.exports = router;
