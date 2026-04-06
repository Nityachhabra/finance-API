// src/seed.js
// Creates the default admin + sample users + sample financial records.
// Safe to run multiple times — skips anything that already exists.
// Usage: node src/seed.js

'use strict';

const fs = require('fs'), path = require('path');
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
}

const { createUser, findByEmail } = require('./services/userService');
const { createRecord }            = require('./services/recordService');
const { findAll }                 = require('./db/store');

const USERS = [
  { name: 'Super Admin',   email: 'admin@finance.dev',   password: 'Admin1234!',   role: 'admin'   },
  { name: 'Alice Analyst', email: 'analyst@finance.dev', password: 'Analyst123!',  role: 'analyst' },
  { name: 'Victor Viewer', email: 'viewer@finance.dev',  password: 'Viewer123!',   role: 'viewer'  },
];

const RECORDS = [
  { amount: 12000, type: 'income',  category: 'Salary',      date: '2024-01-01', notes: 'January salary'   },
  { amount: 12000, type: 'income',  category: 'Salary',      date: '2024-02-01', notes: 'February salary'  },
  { amount: 12000, type: 'income',  category: 'Salary',      date: '2024-03-01', notes: 'March salary'     },
  { amount:  3500, type: 'income',  category: 'Freelance',   date: '2024-01-15', notes: 'Website project'  },
  { amount:  2100, type: 'income',  category: 'Freelance',   date: '2024-03-20', notes: 'Logo design'      },
  { amount:   800, type: 'income',  category: 'Investments', date: '2024-02-28', notes: 'Dividend payout'  },
  { amount:  1500, type: 'expense', category: 'Rent',        date: '2024-01-05', notes: 'January rent'     },
  { amount:  1500, type: 'expense', category: 'Rent',        date: '2024-02-05', notes: 'February rent'    },
  { amount:  1500, type: 'expense', category: 'Rent',        date: '2024-03-05', notes: 'March rent'       },
  { amount:   320, type: 'expense', category: 'Groceries',   date: '2024-01-10' },
  { amount:   290, type: 'expense', category: 'Groceries',   date: '2024-02-12' },
  { amount:   345, type: 'expense', category: 'Groceries',   date: '2024-03-14' },
  { amount:    85, type: 'expense', category: 'Utilities',   date: '2024-01-20', notes: 'Electric bill'    },
  { amount:    92, type: 'expense', category: 'Utilities',   date: '2024-02-20', notes: 'Electric bill'    },
  { amount:    78, type: 'expense', category: 'Utilities',   date: '2024-03-20', notes: 'Electric bill'    },
  { amount:   450, type: 'expense', category: 'Transport',   date: '2024-01-25', notes: 'Car insurance'    },
  { amount:    60, type: 'expense', category: 'Transport',   date: '2024-02-15', notes: 'Fuel'             },
  { amount:   120, type: 'expense', category: 'Dining',      date: '2024-01-18' },
  { amount:    95, type: 'expense', category: 'Dining',      date: '2024-02-22' },
  { amount:   210, type: 'expense', category: 'Shopping',    date: '2024-03-10', notes: 'Clothing'         },
];

console.log('\n🌱  Seeding Finance API...\n');

let admin;
for (const u of USERS) {
  if (findByEmail(u.email)) {
    console.log(`  ⏭  ${u.role} already exists: ${u.email}`);
    if (u.role === 'admin') admin = findByEmail(u.email);
  } else {
    const created = createUser(u);
    console.log(`  ✅  Created ${u.role}: ${u.email}`);
    if (u.role === 'admin') admin = created;
  }
}

console.log('');

const existing = findAll('records').length;
if (existing > 0) {
  console.log(`  ⏭  ${existing} records already exist — skipping record seed\n`);
} else {
  for (const r of RECORDS) createRecord(r, admin.id);
  console.log(`  ✅  Created ${RECORDS.length} sample financial records\n`);
}

console.log('┌─────────────────────────────────────────────────────┐');
console.log('│  Login credentials                                   │');
console.log('│                                                      │');
console.log('│  Admin    admin@finance.dev    Admin1234!            │');
console.log('│  Analyst  analyst@finance.dev  Analyst123!           │');
console.log('│  Viewer   viewer@finance.dev   Viewer123!            │');
console.log('└─────────────────────────────────────────────────────┘\n');
