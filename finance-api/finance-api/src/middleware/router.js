// src/middleware/router.js
// Express-like router built on Node.js built-ins.
// Supports: route params (:id), middleware chains, next(err),
// automatic body parsing, res.json/status, query strings, sub-router mounting.
'use strict';

const { URL } = require('url');

class Router {
  constructor() {
    this._stack = []; // entries: { type, method?, regex?, keys?, prefix?, fns, _rawPath? }
  }

  // ── Middleware registration ──────────────────────────────────────────────────
  use(...args) {
    let prefix = null;
    let items  = args;
    if (typeof args[0] === 'string') { prefix = args[0]; items = args.slice(1); }

    for (const item of items) {
      if (item && item._stack) {
        this._mountRouter(prefix || '', item);
      } else if (typeof item === 'function') {
        this._stack.push({ type: 'mw', prefix, fns: [item] });
      }
    }
    return this;
  }

  _mountRouter(prefix, sub) {
    for (const entry of sub._stack) {
      if (entry.type === 'route') {
        // Combine prefix + sub-path, collapse duplicate slashes
        const fullPath = (prefix + entry._rawPath).replace(/\/+/g, '/') || '/';
        const { regex, keys } = pathToRegex(fullPath);
        this._stack.push({ type: 'route', method: entry.method, regex, keys, fns: entry.fns, _rawPath: fullPath });
      } else {
        const mwPrefix = entry.prefix != null ? (prefix + entry.prefix).replace(/\/+/g, '/') : (prefix || null);
        this._stack.push({ type: 'mw', prefix: mwPrefix, fns: entry.fns });
      }
    }
  }

  // Alias
  mount(prefix, sub) { return this.use(prefix, sub); }

  // ── Route helpers ────────────────────────────────────────────────────────────
  get(path, ...fns)    { return this._route('GET',    path, fns); }
  post(path, ...fns)   { return this._route('POST',   path, fns); }
  put(path, ...fns)    { return this._route('PUT',    path, fns); }
  patch(path, ...fns)  { return this._route('PATCH',  path, fns); }
  delete(path, ...fns) { return this._route('DELETE', path, fns); }

  _route(method, path, fns) {
    const { regex, keys } = pathToRegex(path);
    this._stack.push({ type: 'route', method, regex, keys, fns, _rawPath: path });
    return this;
  }

  // ── Request handler factory ──────────────────────────────────────────────────
  handler() {
    return async (req, res) => {
      // Augment res
      res.status = function(code) { this.statusCode = code; return this; };
      res.json   = function(data) {
        if (!this.headersSent) this.setHeader('Content-Type', 'application/json');
        this.end(JSON.stringify(data));
      };
      res.send = function(text) {
        if (!this.headersSent) this.setHeader('Content-Type', 'text/plain');
        this.end(String(text));
      };

      // Parse URL + body
      const url  = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      req.path   = url.pathname;
      req.query  = Object.fromEntries(url.searchParams);
      req.params = {};
      req.body   = {};
      await parseBody(req);

      const method = req.method.toUpperCase();

      // Build the handler chain for this request
      const chain = [];

      for (const entry of this._stack) {
        if (entry.type === 'mw') {
          const p = entry.prefix;
          const matches = p === null
            || req.path === p
            || req.path.startsWith(p === '/' ? '/' : p + '/');
          if (matches) chain.push(...entry.fns);

        } else if (entry.type === 'route' && entry.method === method) {
          const m = entry.regex.exec(req.path);
          if (m) {
            req.params = {};
            entry.keys.forEach((k, i) => { req.params[k] = decodeURIComponent(m[i + 1] || ''); });
            chain.push(...entry.fns);
            break; // first matching route wins
          }
        }
      }

      // 404 if no route matched
      const hasRoute = this._stack.some(e => e.type === 'route' && e.method === method && e.regex.test(req.path));
      if (!hasRoute) {
        chain.push((_q, rs) => rs.status(404).json({ error: `Cannot ${method} ${req.path}` }));
      }

      // Execute the chain
      let i = 0;
      function next(err) {
        if (i >= chain.length) {
          if (err) res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
          return;
        }
        const fn = chain[i++];
        if (err) {
          // In error mode: skip normal handlers (length < 4), run error handlers (length === 4)
          if (fn.length === 4) {
            try { fn(err, req, res, next); } catch (e) { next(e); }
          } else {
            next(err); // skip
          }
          return;
        }
        // Normal mode: skip error handlers
        if (fn.length === 4) { next(); return; }
        try {
          const r = fn(req, res, next);
          if (r && typeof r.catch === 'function') r.catch(next);
        } catch (e) { next(e); }
      }

      next();
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pathToRegex(path) {
  const keys = [];
  // Normalise: collapse duplicate slashes, remove trailing slash (except root)
  const clean = path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  const src = clean
    .replace(/\//g, '\\/')
    .replace(/:([^/]+)/g, (_, k) => { keys.push(k); return '([^\\/]+)'; });
  // Allow optional trailing slash
  const regex = new RegExp(`^${src}\\/?$`);
  return { regex, keys };
}

async function parseBody(req) {
  if (['GET', 'DELETE', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      if ((req.headers['content-type'] || '').includes('application/json') && raw) {
        try { req.body = JSON.parse(raw); } catch { req.body = {}; }
      }
      resolve();
    });
    req.on('error', () => resolve());
  });
}

module.exports = Router;
