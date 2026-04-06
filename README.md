# FinanceOS — Backend API

A lightweight Finance Dashboard REST API built with Node.js — zero external dependencies except bcrypt and jsonwebtoken.

## 🚀 Live Demo
https://finance-api-production-365f.up.railway.app

## 🛠 Tech Stack
- Node.js (no Express — custom router)
- JWT Authentication
- bcrypt password hashing
- JSON file-based data storage
- Role-based access control

## 👥 Roles
| Role | Permissions |
|------|-------------|
| Admin | Full access — manage users, records |
| Analyst | View + filter records, dashboard |
| Viewer | View records only |

## 🔐 Seed Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@finance.dev | Admin1234! |
| Analyst | analyst@finance.dev | Analyst123! |
| Viewer | viewer@finance.dev | Viewer123! |

## 📁 Project Structure
finance-api/
├── src/
│   ├── controllers/
│   ├── db/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── validators/
│   └── app.js
├── index.html
├── data.json
├── package.json
└── .env
## ⚙️ Setup Locally
```bash
git clone https://github.com/Nityachhabra/finance-API.git
cd finance-api/finance-api
npm install
node src/seed.js
npm start
```

## 🌐 API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/login | Login user |
| POST | /auth/register | Register user |
| GET | /auth/me | Get current user |
| GET | /records | List all records |
| POST | /records | Create record |
| PATCH | /records/:id | Update record |
| DELETE | /records/:id | Delete record |
| GET | /records/summary | Dashboard summary |
| GET | /users | List all users |
| PATCH | /users/:id | Update user |

## ⚠️ Known Limitations
- Data is stored in a JSON file, not a database
- Data may reset on Railway free tier restarts
- Not recommended for production use at scale

## 📦 Deployment
Deployed on Railway. Root directory set to `/finance-api/finance-api`.

# FinanceOS — Frontend

A single-file finance dashboard frontend built with vanilla HTML, CSS, and JavaScript.

## 🚀 Live Demo
https://finance-api-production-365f.up.railway.app

## 🛠 Tech Stack
- Vanilla HTML, CSS, JavaScript
- Chart.js (for charts and graphs)
- Google Fonts (Syne, DM Sans, DM Mono)
- Served directly from the Node.js backend

## ✨ Features
- Login with JWT authentication
- Role-based UI (admin sees more than viewer)
- Dashboard with stats, charts, recent activity
- Financial records table with filters
- Add, edit, delete records (admin only)
- User management (admin only)
- Pagination on records
- Toast notifications
- Responsive design

## 📄 Pages
| Page | Description |
|------|-------------|
| Login | JWT auth with quick-fill seed buttons |
| Dashboard | Stats, monthly trend chart, category breakdown |
| Records | Full CRUD with filters by type, category, date |
| Users | Admin-only user management |

## 🔐 Seed Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@finance.dev | Admin1234! |
| Analyst | analyst@finance.dev | Analyst123! |
| Viewer | viewer@finance.dev | Viewer123! |

## ⚙️ Setup
No build step required. The HTML file is served directly by the backend.
Just run the backend and visit the root URL.

## ⚠️ Known Limitations
- Single HTML file — no component framework
- No offline support
- Charts require internet (Chart.js via CDN)
