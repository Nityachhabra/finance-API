// src/routes/records.js
'use strict';

const Router = require('../middleware/router');
const { create, list, getOne, update, remove, summary } = require('../controllers/recordController');
const { authenticate, authorize, validate } = require('../middleware');
const {
  createRecordSchema, updateRecordSchema, recordFilterSchema,
} = require('../validators/schemas');

const router = new Router();

// All record routes require a valid JWT
router.use(authenticate);

// /records/summary — analyst + admin only
// Declared before /:id so the literal "summary" isn't captured as a param
router.get('/summary', authorize('analyst', 'admin'), summary);

// Read — all roles
router.get('/',    validate(recordFilterSchema, 'query'), list);
router.get('/:id', getOne);

// Mutations — admin only
router.post('/',    authorize('admin'), validate(createRecordSchema), create);
router.patch('/:id', authorize('admin'), validate(updateRecordSchema), update);
router.delete('/:id', authorize('admin'), remove);

module.exports = router;
