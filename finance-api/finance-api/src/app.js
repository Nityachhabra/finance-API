// src/app.js
'use strict';

// Load .env manually — no dotenv dependency needed
const fs   = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
}

const http   = require('http');
const Router = require('./middleware/router');
const { errorHandler } = require('./middleware');

const app = new Router();

// ── Request logger (dev only) ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use((req, _res, next) => {
    process.stdout.write(`[${new Date().toISOString()}] ${req.method} ${req.url}\n`);
    next();
  });
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Mount sub-routers ─────────────────────────────────────────────────────────
// The custom router's mount() copies all sub-router routes with the prefix
// prepended, so we can use the familiar /auth /users /records structure.

const authRouter    = require('./routes/auth');
const usersRouter   = require('./routes/users');
const recordsRouter = require('./routes/records');

app.mount('/auth',    authRouter);
app.mount('/users',   usersRouter);
app.mount('/records', recordsRouter);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── HTTP server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

function createServer() {
  return http.createServer(app.handler());
}

// Only listen when run directly (not when required by tests)
if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`\n🚀  Finance API  —  http://localhost:${PORT}`);
    console.log(`    Env : ${process.env.NODE_ENV || 'development'}`);
    console.log(`    Data: ${process.env.DB_PATH  || './data.json'}\n`);
  });
}

module.exports = { createServer };
