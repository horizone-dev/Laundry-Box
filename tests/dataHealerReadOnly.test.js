const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runDataHealer } = require('../database');

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, balance REAL, advanceBalance REAL, openingBalance REAL);
  CREATE TABLE orders (id TEXT PRIMARY KEY, customerId TEXT, totalAmount REAL, paidAmount REAL, dueAmount REAL, paymentStatus TEXT, status TEXT);
  CREATE TABLE payments (id TEXT PRIMARY KEY, customerId TEXT, orderId TEXT, amount REAL, method TEXT, status TEXT);
  CREATE TABLE advance_allocations (id TEXT PRIMARY KEY, paymentId TEXT, orderId TEXT, amountUsed REAL);
  CREATE TABLE deleted_orders (id TEXT PRIMARY KEY, customerId TEXT, refundStatus TEXT, returnStatus TEXT, paidAmount REAL, payments TEXT);
`);

db.prepare('INSERT INTO customers VALUES (?, ?, ?, ?, ?)').run('C1', 'Read Only Customer', 50, 0, 0);
db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?)').run('O1', 'C1', 100, 0, 100, 'Credit', 'Payment Pending');

const result = runDataHealer(db, 'C1');

assert.equal(result.success, true);
assert.equal(result.mode, 'read-only');
assert.equal(result.report.summary.balanceMismatches, 1);
assert.equal(db.prepare('SELECT balance FROM customers WHERE id = ?').get('C1').balance, 50);
assert.equal(db.prepare('SELECT paidAmount FROM orders WHERE id = ?').get('O1').paidAmount, 0);
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 0);

db.close();
console.log('data healer read-only tests passed');
