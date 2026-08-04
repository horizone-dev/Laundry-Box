const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runDataHealer, refreshCustomerFinancialCaches } = require('../database');

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, balance REAL, advanceBalance REAL, openingBalance REAL, isSynced INTEGER, updatedAt TEXT);
  CREATE TABLE orders (id TEXT PRIMARY KEY, customerId TEXT, totalAmount REAL, paidAmount REAL, dueAmount REAL, paymentStatus TEXT, status TEXT);
  CREATE TABLE payments (id TEXT PRIMARY KEY, customerId TEXT, orderId TEXT, amount REAL, method TEXT, status TEXT);
  CREATE TABLE advance_allocations (id TEXT PRIMARY KEY, paymentId TEXT, orderId TEXT, amountUsed REAL);
  CREATE TABLE deleted_orders (id TEXT PRIMARY KEY, customerId TEXT, refundStatus TEXT, returnStatus TEXT, paidAmount REAL, payments TEXT);
  CREATE TABLE refunds (id TEXT PRIMARY KEY, customerId TEXT, orderId TEXT, amount REAL, createdAt TEXT, isSynced INTEGER, updatedAt TEXT);
  CREATE TABLE customer_ledger (id TEXT PRIMARY KEY, customerId TEXT, balance REAL);
  CREATE TABLE account_transactions (id TEXT PRIMARY KEY, category TEXT, accountType TEXT, type TEXT, amount REAL, description TEXT, date TEXT);
`);

db.prepare('INSERT INTO customers (id, name, balance, advanceBalance, openingBalance) VALUES (?, ?, ?, ?, ?)').run('C1', 'Read Only Customer', 50, 0, 0);
db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?)').run('O1', 'C1', 100, 0, 100, 'Credit', 'Payment Pending');
db.prepare('INSERT INTO customer_ledger VALUES (?, ?, ?)').run('L1', 'C1', 50);

const result = runDataHealer(db, 'C1');

assert.equal(result.success, true);
assert.equal(result.mode, 'read-only');
assert.equal(result.report.summary.balanceMismatches, 1);
assert.equal(db.prepare('SELECT balance FROM customers WHERE id = ?').get('C1').balance, 50);
assert.equal(db.prepare('SELECT paidAmount FROM orders WHERE id = ?').get('O1').paidAmount, 0);
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 0);

const refreshResult = refreshCustomerFinancialCaches(db, 'C1', '2026-01-01T00:00:00.000Z');
assert.equal(refreshResult.updated, 1);
assert.equal(db.prepare('SELECT balance FROM customers WHERE id = ?').get('C1').balance, 100);
assert.equal(refreshResult.ledgerUpdated, 1);
assert.equal(db.prepare('SELECT balance FROM customer_ledger WHERE id = ?').get('L1').balance, 100);

// Auto-repair must not make a financial decision when an allocation is
// already invalid. That customer is left unchanged for manual review.
db.prepare('INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?)').run('C2', 'Review Customer', 50, 0, 0, 0, '');
db.prepare('INSERT INTO payments VALUES (?, ?, ?, ?, ?, ?)').run('P1', 'C2', null, 100, 'Cash', 'SUCCESS');
db.prepare('INSERT INTO advance_allocations VALUES (?, ?, ?, ?)').run('A1', 'P1', 'O2', 120);
const reviewResult = refreshCustomerFinancialCaches(db, 'C2', '2026-01-01T00:00:00.000Z');
assert.equal(reviewResult.updated, 0);
assert.equal(reviewResult.skippedForReview, 1);
assert.equal(db.prepare('SELECT balance FROM customers WHERE id = ?').get('C2').balance, 50);

db.close();
console.log('data healer read-only tests passed');
