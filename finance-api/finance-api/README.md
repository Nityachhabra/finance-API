# Finance API

A fully-featured finance dashboard REST API built with **zero external dependencies** — only Node.js built-ins (`http`, `crypto`, `fs`). No Express, no JWT library, no ORM.

---

## Quick Start

```bash
# Node.js 18+ required — no npm install needed
node --version

# 1. Configure environment
cp .env.example .env
# Edit JWT_SECRET to a long random string

# 2. Seed the database (creates users + 20 sample records)
node src/seed.js

# 3. Start the server
node src/app.js
# → http://localhost:5000

# 4. Run tests
npm test
```

---

## Project Structure

```
finance-api/
├── src/
│   ├── app.js                    # HTTP server, route mounting
│   ├── seed.js                   # Creates users + sample data
│   ├── db/
│   │   └── store.js              # Persistent JSON store (atomic writes)
│   ├── middleware/
│   │   ├── router.js             # Express-like router (built-in only)
│   │   ├── jwt.js                # HS256 JWT sign/verify (crypto.createHmac)
│   │   ├── password.js           # PBKDF2 hashing (100k iterations)
│   │   └── index.js              # authenticate, authorize, validate, errorHandler
│   ├── validators/
│   │   └── schemas.js            # All input schemas
│   ├── services/
│   │   ├── authService.js        # Login logic
│   │   ├── userService.js        # User CRUD
│   │   └── recordService.js      # Record CRUD + analytics
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   └── recordController.js
│   └── routes/
│       ├── auth.js
│       ├── users.js
│       └── records.js
└── tests/
    └── api.test.js               # Integration tests (isolated temp DB)
```

---

## Seed Credentials

| Role    | Email                  | Password     |
|---------|------------------------|--------------|
| Admin   | admin@finance.dev      | Admin1234!   |
| Analyst | analyst@finance.dev    | Analyst123!  |
| Viewer  | viewer@finance.dev     | Viewer123!   |

---

## API Reference

All protected routes require:
```
Authorization: Bearer <token>
```

### Auth

| Method | Path             | Auth          | Description          |
|--------|------------------|---------------|----------------------|
| POST   | /auth/login      | Public        | Login, get JWT       |
| POST   | /auth/register   | Admin only    | Create a new user    |
| GET    | /auth/me         | Any role      | Get current user     |

**POST /auth/login**
```json
{ "email": "admin@finance.dev", "password": "Admin1234!" }

// 200
{ "token": "eyJ...", "user": { "id": "...", "role": "admin", ... } }
```

**POST /auth/register**
```json
{ "name": "Jane", "email": "jane@co.com", "password": "Pass1234!", "role": "analyst" }
```

---

### Users  *(Admin only)*

| Method | Path        | Description                                     |
|--------|-------------|-------------------------------------------------|
| GET    | /users      | List users. `?include_inactive=true` for all    |
| GET    | /users/:id  | Get one user                                    |
| PATCH  | /users/:id  | Update name / role / is_active                  |

```json
// PATCH /users/:id
{ "role": "viewer", "is_active": false }
```

---

### Records

| Method | Path              | Roles                | Description            |
|--------|-------------------|----------------------|------------------------|
| GET    | /records          | viewer, analyst, admin | List + filter records |
| GET    | /records/summary  | analyst, admin       | Dashboard analytics    |
| GET    | /records/:id      | viewer, analyst, admin | Get one record        |
| POST   | /records          | admin                | Create record          |
| PATCH  | /records/:id      | admin                | Update record          |
| DELETE | /records/:id      | admin                | Soft-delete record     |

**GET /records** — query params:

| Param     | Type                   | Description                 |
|-----------|------------------------|-----------------------------|
| type      | `income` \| `expense`  | Filter by type              |
| category  | string                 | Filter by category          |
| date_from | `YYYY-MM-DD`           | On or after this date       |
| date_to   | `YYYY-MM-DD`           | On or before this date      |
| page      | integer (default: 1)   | Page number                 |
| limit     | integer (default: 20)  | Max 100 per page            |

```json
// GET /records?type=income&page=1&limit=5 — 200
{
  "data": [{ "id": "...", "amount": 12000, "type": "income", "category": "Salary", "date": "2024-03-01" }],
  "pagination": { "total": 9, "page": 1, "limit": 5, "total_pages": 2 }
}
```

**POST /records**
```json
{ "amount": 1500.00, "type": "expense", "category": "Rent", "date": "2024-04-01", "notes": "Optional" }
```

**GET /records/summary** (supports `?date_from=&date_to=`)
```json
{
  "data": {
    "total_income": 39600,
    "total_expenses": 8765,
    "net_balance": 30835,
    "total_records": 20,
    "category_breakdown": [
      { "category": "Salary", "type": "income", "total": 36000, "count": 3 }
    ],
    "monthly_trend": [
      { "month": "2024-01", "income": 15500, "expenses": 2955 }
    ],
    "recent_activity": [...]
  }
}
```

---

## Error Format

```json
{ "error": "Validation failed", "details": [{ "field": "amount", "message": "Must be greater than 0" }] }
```

| Status | Meaning                          |
|--------|----------------------------------|
| 200    | OK                               |
| 201    | Created                          |
| 400    | Validation error                 |
| 401    | Missing / invalid / expired JWT  |
| 403    | Wrong role, or deactivated user  |
| 404    | Resource not found               |
| 409    | Conflict (duplicate email)       |
| 500    | Unexpected server error          |

---

## Design Decisions

**Zero dependencies.** The router, JWT, and password hashing are all implemented from Node.js built-ins (`http`, `crypto`, `fs`). This makes the project fully portable — `node src/app.js` is the only command needed after cloning.

**JWT with `crypto.createHmac`.** HS256 implemented manually: base64url-encode header + payload, HMAC-SHA256 the signature, verify with `crypto.timingSafeEqual` to prevent timing attacks.

**PBKDF2 passwords.** Using `crypto.pbkdf2Sync` at 100,000 iterations — equivalent strength to bcrypt cost 12. Format: `pbkdf2:sha256:<iters>:<salt>:<hash>`.

**Atomic JSON store.** `data.json` is written by writing to a `.tmp` file then `fs.renameSync`-ing it into place. On the same filesystem this is an atomic operation — a crash mid-write can't corrupt the database.

**Soft deletes.** Records get `is_deleted: true` rather than being removed. Financial records should never be permanently destroyed.

**Re-fetch user on every request.** The `authenticate` middleware re-reads the user from the store on every request. This means deactivating an account takes effect immediately, even for users holding valid 7-day tokens.

**Timing-safe comparisons everywhere.** Both JWT verification and password comparison use `crypto.timingSafeEqual` to prevent attackers inferring validity from response latency.

**To add a real database:** Replace `src/db/store.js` with a `better-sqlite3` implementation exposing the same `findAll / findOne / insert / update` interface. No other files change.
