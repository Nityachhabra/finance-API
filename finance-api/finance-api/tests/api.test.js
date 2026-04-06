// tests/api.test.js
// Full integration tests — zero external deps, uses node:test + node:assert.
// Each test suite uses an isolated in-memory (temp file) database.
// Run: node --test tests/api.test.js

'use strict';

const { test, describe, before, after } = require('node:test');
const assert  = require('node:assert/strict');
const http    = require('http');
const fs      = require('fs');
const os      = require('os');
const path    = require('path');

// ── Isolated temp database per test run ───────────────────────────────────────
const TMP_DB = path.join(os.tmpdir(), `finance-test-${Date.now()}.json`);
process.env.DB_PATH     = TMP_DB;
process.env.JWT_SECRET  = 'test-secret-do-not-use-in-prod';
process.env.NODE_ENV    = 'test';

const { createServer } = require('../src/app');

// ── Tiny HTTP client ──────────────────────────────────────────────────────────
function request(server, method, urlPath, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const addr   = server.address();
    const data   = body ? JSON.stringify(body) : undefined;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data)  headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(
      { hostname: '127.0.0.1', port: addr.port, path: urlPath, method, headers },
      (res) => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Test setup ────────────────────────────────────────────────────────────────
let server;
let req; // bound to the running server

before(async () => {
  server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  req = (method, path, opts) => request(server, method, path, opts);

  // Seed initial users directly via service (no HTTP round-trip)
  const { createUser } = require('../src/services/userService');
  createUser({ name: 'Admin',   email: 'admin@t.com',   password: 'Admin1234!',  role: 'admin'   });
  createUser({ name: 'Analyst', email: 'analyst@t.com', password: 'Analyst123!', role: 'analyst' });
  createUser({ name: 'Viewer',  email: 'viewer@t.com',  password: 'Viewer123!',  role: 'viewer'  });
});

after(() => {
  server.close();
  try { fs.unlinkSync(TMP_DB); } catch {}
});

async function token(email, password) {
  const r = await req('POST', '/auth/login', { body: { email, password } });
  return r.body.token;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Health', () => {
  test('GET /health returns ok', async () => {
    const r = await req('GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
  });
});

describe('Auth — login', () => {
  test('valid credentials return token and safe user', async () => {
    const r = await req('POST', '/auth/login', { body: { email: 'admin@t.com', password: 'Admin1234!' } });
    assert.equal(r.status, 200);
    assert.ok(r.body.token, 'token must be present');
    assert.equal(r.body.user.role, 'admin');
    assert.equal(r.body.user.password, undefined, 'password hash must not be returned');
  });

  test('wrong password returns 401', async () => {
    const r = await req('POST', '/auth/login', { body: { email: 'admin@t.com', password: 'wrong' } });
    assert.equal(r.status, 401);
  });

  test('unknown email returns 401 (no user enumeration)', async () => {
    const r = await req('POST', '/auth/login', { body: { email: 'ghost@x.com', password: 'any' } });
    assert.equal(r.status, 401);
  });

  test('missing fields return 400 with details', async () => {
    const r = await req('POST', '/auth/login', { body: { email: 'not-an-email' } });
    assert.equal(r.status, 400);
    assert.ok(Array.isArray(r.body.details));
  });
});

describe('Auth — /me', () => {
  test('GET /auth/me returns current user', async () => {
    const t = await token('analyst@t.com', 'Analyst123!');
    const r = await req('GET', '/auth/me', { token: t });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.email, 'analyst@t.com');
  });

  test('no token → 401', async () => {
    const r = await req('GET', '/auth/me');
    assert.equal(r.status, 401);
  });

  test('garbage token → 401', async () => {
    const r = await req('GET', '/auth/me', { token: 'not.a.token' });
    assert.equal(r.status, 401);
  });
});

describe('Auth — register', () => {
  test('admin can register a new user', async () => {
    const t = await token('admin@t.com', 'Admin1234!');
    const r = await req('POST', '/auth/register', {
      token: t,
      body: { name: 'New User', email: 'new@t.com', password: 'NewPass123!', role: 'viewer' },
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.role, 'viewer');
  });

  test('duplicate email → 409', async () => {
    const t = await token('admin@t.com', 'Admin1234!');
    const r = await req('POST', '/auth/register', {
      token: t,
      body: { name: 'Dup', email: 'admin@t.com', password: 'Admin1234!', role: 'admin' },
    });
    assert.equal(r.status, 409);
  });

  test('viewer cannot register users → 403', async () => {
    const t = await token('viewer@t.com', 'Viewer123!');
    const r = await req('POST', '/auth/register', {
      token: t,
      body: { name: 'X', email: 'x@t.com', password: 'Xpass123!', role: 'viewer' },
    });
    assert.equal(r.status, 403);
  });
});

describe('Records — access control', () => {
  test('viewer can list records', async () => {
    const t = await token('viewer@t.com', 'Viewer123!');
    const r = await req('GET', '/records', { token: t });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.data));
  });

  test('viewer cannot create records → 403', async () => {
    const t = await token('viewer@t.com', 'Viewer123!');
    const r = await req('POST', '/records', {
      token: t,
      body: { amount: 100, type: 'income', category: 'Salary', date: '2024-01-01' },
    });
    assert.equal(r.status, 403);
  });

  test('analyst cannot create records → 403', async () => {
    const t = await token('analyst@t.com', 'Analyst123!');
    const r = await req('POST', '/records', {
      token: t,
      body: { amount: 100, type: 'income', category: 'Salary', date: '2024-01-01' },
    });
    assert.equal(r.status, 403);
  });

  test('viewer cannot access summary → 403', async () => {
    const t = await token('viewer@t.com', 'Viewer123!');
    const r = await req('GET', '/records/summary', { token: t });
    assert.equal(r.status, 403);
  });

  test('analyst can access summary', async () => {
    const t = await token('analyst@t.com', 'Analyst123!');
    const r = await req('GET', '/records/summary', { token: t });
    assert.equal(r.status, 200);
    assert.ok('net_balance' in r.body.data);
    assert.ok('monthly_trend' in r.body.data);
    assert.ok('category_breakdown' in r.body.data);
  });

  test('unauthenticated request → 401', async () => {
    const r = await req('GET', '/records');
    assert.equal(r.status, 401);
  });
});

describe('Records — validation', () => {
  let adminToken;
  before(async () => { adminToken = await token('admin@t.com', 'Admin1234!'); });

  test('negative amount → 400', async () => {
    const r = await req('POST', '/records', {
      token: adminToken,
      body: { amount: -50, type: 'income', category: 'Test', date: '2024-01-01' },
    });
    assert.equal(r.status, 400);
  });

  test('string amount → 400', async () => {
    const r = await req('POST', '/records', {
      token: adminToken,
      body: { amount: 'abc', type: 'income', category: 'Test', date: '2024-01-01' },
    });
    assert.equal(r.status, 400);
  });

  test('invalid type → 400', async () => {
    const r = await req('POST', '/records', {
      token: adminToken,
      body: { amount: 100, type: 'revenue', category: 'Test', date: '2024-01-01' },
    });
    assert.equal(r.status, 400);
  });

  test('malformed date → 400', async () => {
    const r = await req('POST', '/records', {
      token: adminToken,
      body: { amount: 100, type: 'income', category: 'Test', date: '01-01-2024' },
    });
    assert.equal(r.status, 400);
  });

  test('missing required fields → 400 with field details', async () => {
    const r = await req('POST', '/records', { token: adminToken, body: {} });
    assert.equal(r.status, 400);
    const fields = r.body.details.map(d => d.field);
    assert.ok(fields.includes('amount'));
    assert.ok(fields.includes('type'));
  });
});

describe('Records — CRUD', () => {
  let adminToken;
  let recordId;

  before(async () => {
    adminToken = await token('admin@t.com', 'Admin1234!');
    const r = await req('POST', '/records', {
      token: adminToken,
      body: { amount: 2500, type: 'expense', category: 'Rent', date: '2024-04-01', notes: 'April' },
    });
    recordId = r.body.data.id;
  });

  test('admin can create a record', async () => {
    const r = await req('POST', '/records', {
      token: adminToken,
      body: { amount: 500, type: 'income', category: 'Freelance', date: '2024-04-15' },
    });
    assert.equal(r.status, 201);
    assert.ok(r.body.data.id);
    assert.equal(r.body.data.amount, 500);
  });

  test('GET by id returns the record', async () => {
    const r = await req('GET', `/records/${recordId}`, { token: adminToken });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.id, recordId);
    assert.equal(r.body.data.amount, 2500);
  });

  test('PATCH updates only specified fields', async () => {
    const r = await req('PATCH', `/records/${recordId}`, {
      token: adminToken,
      body: { notes: 'Updated note' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.notes, 'Updated note');
    assert.equal(r.body.data.amount, 2500); // unchanged
  });

  test('PATCH cannot change id', async () => {
    await req('PATCH', `/records/${recordId}`, {
      token: adminToken,
      body: { id: 'hacked', amount: 9999 },
    });
    const check = await req('GET', `/records/${recordId}`, { token: adminToken });
    assert.equal(check.status, 200); // original id still works
    assert.equal(check.body.data.id, recordId);
  });

  test('DELETE soft-deletes — record disappears from API', async () => {
    const r = await req('DELETE', `/records/${recordId}`, { token: adminToken });
    assert.equal(r.status, 200);
    const check = await req('GET', `/records/${recordId}`, { token: adminToken });
    assert.equal(check.status, 404);
  });

  test('DELETE non-existent id → 404', async () => {
    const r = await req('DELETE', '/records/does-not-exist', { token: adminToken });
    assert.equal(r.status, 404);
  });
});

describe('Records — filtering & pagination', () => {
  let adminToken;

  before(async () => {
    adminToken = await token('admin@t.com', 'Admin1234!');
    // Seed a few records for filter tests
    const pairs = [
      { amount: 100, type: 'income',  category: 'Salary',  date: '2024-05-01' },
      { amount: 200, type: 'expense', category: 'Rent',    date: '2024-05-10' },
      { amount: 300, type: 'income',  category: 'Salary',  date: '2024-06-01' },
    ];
    for (const p of pairs) {
      await req('POST', '/records', { token: adminToken, body: p });
    }
  });

  test('filter by type=income returns only income', async () => {
    const r = await req('GET', '/records?type=income', { token: adminToken });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.every(rec => rec.type === 'income'));
  });

  test('filter by category', async () => {
    const r = await req('GET', '/records?category=Rent', { token: adminToken });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.every(rec => rec.category === 'Rent'));
  });

  test('filter by date_from and date_to', async () => {
    const r = await req('GET', '/records?date_from=2024-05-01&date_to=2024-05-31', { token: adminToken });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.every(rec => rec.date >= '2024-05-01' && rec.date <= '2024-05-31'));
  });

  test('pagination returns correct structure', async () => {
    const r = await req('GET', '/records?page=1&limit=2', { token: adminToken });
    assert.equal(r.status, 200);
    assert.ok(r.body.pagination);
    assert.ok(r.body.data.length <= 2);
    assert.ok('total' in r.body.pagination);
    assert.ok('total_pages' in r.body.pagination);
  });

  test('invalid pagination → 400', async () => {
    const r = await req('GET', '/records?page=abc', { token: adminToken });
    assert.equal(r.status, 400);
  });
});

describe('Users', () => {
  let adminToken;

  before(async () => { adminToken = await token('admin@t.com', 'Admin1234!'); });

  test('admin can list users', async () => {
    const r = await req('GET', '/users', { token: adminToken });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.data));
  });

  test('viewer cannot list users → 403', async () => {
    const t = await token('viewer@t.com', 'Viewer123!');
    const r = await req('GET', '/users', { token: t });
    assert.equal(r.status, 403);
  });

  test('admin can deactivate a user — token then blocked', async () => {
    // Register a throwaway user
    const created = await req('POST', '/auth/register', {
      token: adminToken,
      body: { name: 'Temp', email: 'temp@t.com', password: 'Temp1234!', role: 'viewer' },
    });
    const uid = created.body.user.id;
    const tempToken = await token('temp@t.com', 'Temp1234!');

    // Deactivate
    const patch = await req('PATCH', `/users/${uid}`, {
      token: adminToken,
      body: { is_active: false },
    });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.data.is_active, false);

    // Their token should now be rejected
    const me = await req('GET', '/auth/me', { token: tempToken });
    assert.equal(me.status, 403);
  });

  test('PATCH with invalid role → 400', async () => {
    const users = await req('GET', '/users', { token: adminToken });
    const uid   = users.body.data[0].id;
    const r = await req('PATCH', `/users/${uid}`, {
      token: adminToken,
      body: { role: 'superadmin' },
    });
    assert.equal(r.status, 400);
  });
});

describe('Summary analytics', () => {
  test('summary numbers are mathematically consistent', async () => {
    const t = await token('analyst@t.com', 'Analyst123!');
    const r = await req('GET', '/records/summary', { token: t });
    const d = r.body.data;
    assert.equal(r.status, 200);
    assert.equal(
      Math.round((d.total_income - d.total_expenses) * 100),
      Math.round(d.net_balance * 100),
      'net_balance must equal income − expenses'
    );
  });

  test('summary respects date filter', async () => {
    const t = await token('analyst@t.com', 'Analyst123!');
    const all  = (await req('GET', '/records/summary', { token: t })).body.data;
    const may  = (await req('GET', '/records/summary?date_from=2024-05-01&date_to=2024-05-31', { token: t })).body.data;
    // May subset should have fewer or equal records
    assert.ok(may.total_records <= all.total_records);
  });
});
