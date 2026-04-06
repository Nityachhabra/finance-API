# How to run this project locally

## This project has ZERO npm dependencies
You do NOT need to run `npm install`. There is nothing to install.
Just Node.js 18+ is all you need.

---

## Step 1 — Check your Node version

Open a terminal and run:
```
node --version
```
It must show v18 or higher (e.g. v18.x.x, v20.x.x, v22.x.x).

If it shows v16 or lower, download the latest Node from: https://nodejs.org

---

## Step 2 — Open the project in terminal

In VS Code: open the terminal with Ctrl+` (backtick) or go to Terminal → New Terminal.

Make sure you are INSIDE the finance-api folder:
```
cd finance-api
```

You should see these files when you run `ls` (Mac/Linux) or `dir` (Windows):
```
package.json   README.md   src/   tests/   .env
```

---

## Step 3 — Seed the database (run once)

```
node src/seed.js
```

This creates a `data.json` file with 3 users and 20 sample records.

You should see:
```
✅ Created admin:   admin@finance.dev
✅ Created analyst: analyst@finance.dev
✅ Created viewer:  viewer@finance.dev
✅ Created 20 sample financial records
```

---

## Step 4 — Start the server

```
node src/app.js
```

You should see:
```
🚀  Finance API  —  http://localhost:5000
```

The server is now running. Open http://localhost:5000/health in your browser.
You should see: {"status":"ok"}

---

## Step 5 — Test it with curl or Postman

Login:
```
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@finance.dev","password":"Admin1234!"}'
```

Copy the token from the response, then:
```
curl http://localhost:5000/records \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## VS Code showing red errors / warnings?

This is normal. VS Code sometimes shows warnings because:
1. There is no `node_modules` folder (correct — this project needs none)
2. The `dev` script is missing from package.json (we use `node src/app.js` directly)

These are editor cosmetic warnings. They do NOT stop the server from running.

To stop VS Code from showing these, you can:
- Ignore them (they don't affect anything)
- Install the ESLint extension and configure it to ignore missing modules

---

## Login credentials

| Role    | Email                  | Password    |
|---------|------------------------|-------------|
| Admin   | admin@finance.dev      | Admin1234!  |
| Analyst | analyst@finance.dev    | Analyst123! |
| Viewer  | viewer@finance.dev     | Viewer123!  |

---

## To stop the server

Press Ctrl+C in the terminal.

## To run tests

```
node --test tests/api.test.js
```

All 39 tests should pass.
