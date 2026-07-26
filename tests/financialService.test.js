const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { settleCustomerBalance, editDiscountReceipt } = require('../financialService');

function setup() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, balance REAL DEFAULT 0, openingBalance REAL DEFAULT 0, advanceBalance REAL DEFAULT 0, isSynced INTEGER, updatedAt TEXT);
    CREATE TABLE orders (id TEXT PRIMARY KEY, customerId TEXT, status TEXT, totalAmount REAL, paidAmount REAL, dueAmount REAL, paymentStatus TEXT, paymentMethod TEXT, createdAt TEXT, isSynced INTEGER, updatedAt TEXT);
    CREATE TABLE payments (id TEXT PRIMARY KEY, customerId TEXT, orderId TEXT, shopId TEXT, amount REAL, method TEXT, status TEXT, createdAt TEXT, isSynced INTEGER, updatedAt TEXT, paymentReference TEXT, discountScope TEXT);
    CREATE TABLE advance_allocations (id TEXT PRIMARY KEY, paymentId TEXT, orderId TEXT, amountUsed REAL);
    CREATE TABLE deleted_orders (id TEXT PRIMARY KEY, customerId TEXT, refundStatus TEXT, returnStatus TEXT, paidAmount REAL, payments TEXT);
    CREATE TABLE payment_sequence (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE discount_sequence (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE account_transactions (id TEXT PRIMARY KEY, shopId TEXT, accountType TEXT, type TEXT, category TEXT, amount REAL, description TEXT, date TEXT, isSynced INTEGER, updatedAt TEXT, icon TEXT, bankAccountId TEXT, createdBy TEXT, createdById TEXT, createdByRole TEXT);
    CREATE TABLE customer_ledger (id TEXT PRIMARY KEY, shopId TEXT, customerId TEXT, orderId TEXT, transactionType TEXT, debit REAL, credit REAL, balance REAL, description TEXT, createdAt TEXT);
    CREATE TABLE audit_logs (id TEXT PRIMARY KEY, event TEXT, details TEXT, userId TEXT, userRole TEXT, timestamp TEXT, device TEXT);
  `);
  return db;
}

{
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, advanceBalance) VALUES (?, ?, ?, ?)').run('C1', 'Customer One', 100, 0);
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('O1', 'C1', 'Payment Pending', 100, 0, 100, 'Credit', 'Not Paid', '2026-01-01', 0, '2026-01-01');

  const result = settleCustomerBalance(db, {
    customerId: 'C1',
    splits: [{ method: 'Cash', amount: 60 }],
    discount: 40,
    actor: { id: 'U1', name: 'Tester', role: 'manager' }
  });

  assert.equal(result.success, true);
  assert.equal(db.prepare('SELECT dueAmount FROM orders WHERE id = ?').get('O1').dueAmount, 0);
  assert.equal(db.prepare('SELECT balance FROM customers WHERE id = ?').get('C1').balance, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM payments WHERE paymentReference = 'DISC-0000001'").get().count, 1);
  assert.equal(db.prepare("SELECT id FROM payments WHERE method = 'Cash'").get().id, 'RV-000001');
  assert.deepEqual(db.prepare("SELECT id, paymentReference, discountScope FROM payments WHERE method = 'Discount'").get(), {
    id: 'DISC-0000001', paymentReference: 'DISC-0000001', discountScope: 'settlement'
  });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM account_transactions').get().count, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM audit_logs WHERE event = ?').get('CUSTOMER_SETTLEMENT_POSTED').count, 1);
  db.close();
}

{
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, advanceBalance) VALUES (?, ?, ?, ?)').run('C1', 'Customer One', 100, 0);
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('O1', 'C1', 'Payment Pending', 100, 0, 100, 'Credit', 'Not Paid', '2026-01-01', 0, '2026-01-01');
  const settled = settleCustomerBalance(db, {
    customerId: 'C1',
    orderId: 'O1',
    discount: 25,
    splits: [{ method: 'Cash', amount: 75 }]
  });
  const discountPaymentId = settled.paymentIds.find((id) => db.prepare('SELECT method FROM payments WHERE id = ?').get(id).method === 'Discount');

  const edited = editDiscountReceipt(db, { paymentId: discountPaymentId, amount: 20 });
  assert.equal(edited.success, true);
  assert.equal(db.prepare('SELECT amount FROM payments WHERE id = ?').get(discountPaymentId).amount, 20);
  assert.equal(db.prepare('SELECT dueAmount FROM orders WHERE id = ?').get('O1').dueAmount, 5);
  assert.equal(db.prepare('SELECT balance FROM customers WHERE id = ?').get('C1').balance, 5);
  db.close();
}

{
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, advanceBalance) VALUES (?, ?, ?, ?)').run('C1', 'Customer One', 100, 0);
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('O1', 'C1', 'Payment Pending', 100, 0, 100, 'Credit', 'Not Paid', '2026-01-01', 0, '2026-01-01');

  const result = settleCustomerBalance(db, {
    customerId: 'C1',
    orderId: 'O1',
    discount: 25,
    splits: [{ method: 'Cash', amount: 75 }]
  });

  assert.equal(result.discountScope, 'order');
  assert.deepEqual(db.prepare("SELECT paymentReference, discountScope FROM payments WHERE method = 'Discount'").get(), {
    paymentReference: 'DISC-0000001', discountScope: 'order'
  });
  db.close();
}

{
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, advanceBalance) VALUES (?, ?, ?, ?)').run('C1', 'Customer One', 100, 0);
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('O1', 'C1', 'Payment Pending', 100, 0, 100, 'Credit', 'Not Paid', '2026-01-01', 0, '2026-01-01');

  const result = settleCustomerBalance(db, {
    customerId: 'C1',
    splits: [{ method: 'Card', amount: 150, bankAccountId: 'BANK-1' }]
  });

  assert.equal(result.advanceCreated, 50);
  assert.equal(db.prepare('SELECT balance FROM customers WHERE id = ?').get('C1').balance, -50);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM payments WHERE orderId IS NULL").get().count, 1);
  db.close();
}

{
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, openingBalance, advanceBalance) VALUES (?, ?, ?, ?, ?)')
    .run('C1', 'Customer One', 1100, 1000, 0);
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('O1', 'C1', 'Payment Pending', 100, 0, 100, 'Credit', 'Not Paid', '2026-01-01', 0, '2026-01-01');

  const result = settleCustomerBalance(db, {
    customerId: 'C1',
    orderId: 'O1',
    splits: [{ method: 'Cash', amount: 150 }]
  });

  assert.equal(result.accountPaymentApplied, 50);
  assert.equal(result.advanceCreated, 0);
  assert.equal(db.prepare('SELECT dueAmount FROM orders WHERE id = ?').get('O1').dueAmount, 0);
  assert.equal(db.prepare('SELECT balance FROM customers WHERE id = ?').get('C1').balance, 950);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM payments WHERE paymentReference LIKE 'ACC-%'").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM payments WHERE paymentReference LIKE 'ADV-%'").get().count, 0);
  db.close();
}

{
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, advanceBalance) VALUES (?, ?, ?, ?)').run('C1', 'Customer One', 200, 0);
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('O1', 'C1', 'Payment Pending', 100, 0, 100, 'Credit', 'Not Paid', '2026-01-01', 0, '2026-01-01');
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('O2', 'C1', 'Payment Pending', 100, 0, 100, 'Credit', 'Not Paid', '2026-01-02', 0, '2026-01-02');

  const result = settleCustomerBalance(db, {
    customerId: 'C1',
    orderId: 'O1',
    splits: [{ method: 'Cash', amount: 150 }]
  });

  assert.equal(result.advanceCreated, 0);
  assert.equal(db.prepare('SELECT dueAmount FROM orders WHERE id = ?').get('O1').dueAmount, 0);
  assert.equal(db.prepare('SELECT dueAmount FROM orders WHERE id = ?').get('O2').dueAmount, 50);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payments WHERE orderId IS NULL').get().count, 0);
  db.close();
}

{
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, advanceBalance) VALUES (?, ?, ?, ?)').run('C1', 'Customer One', 100, 0);
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('O1', 'C1', 'Payment Pending', 100, 0, 100, 'Credit', 'Not Paid', '2026-01-01', 0, '2026-01-01');

  assert.throws(() => settleCustomerBalance(db, {
    customerId: 'C1',
    orderId: 'O1',
    discount: 101
  }), /Discount is greater/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 0);
  db.close();
}

{
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, openingBalance, advanceBalance) VALUES (?, ?, ?, ?, ?)')
    .run('C1', 'Customer One', 100, 100, 0);

  const result = settleCustomerBalance(db, {
    customerId: 'C1',
    discount: 50
  });
  assert.equal(result.discountScope, 'settlement');
  assert.equal(result.settlementDiscountApplied, 50);
  assert.equal(db.prepare('SELECT balance FROM customers WHERE id = ?').get('C1').balance, 50);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM payments WHERE paymentReference = 'DISC-0000001'").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM account_transactions WHERE category = 'Discount Given' AND type = 'EXPENSE'").get().count, 1);
  db.close();
}

{
  // Quick/customer settlement discounts are validated against the payment,
  // not against an invoice or the current customer due. With no due, both
  // the money and settlement discount become clearly recorded customer credit.
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, openingBalance, advanceBalance) VALUES (?, ?, ?, ?, ?)')
    .run('C1', 'Customer One', 0, 0, 0);

  const result = settleCustomerBalance(db, {
    customerId: 'C1',
    splits: [{ method: 'Bank', amount: 500, bankAccountId: 'BANK-1' }],
    discount: 100
  });

  assert.equal(result.success, true);
  assert.equal(result.discountScope, 'settlement');
  assert.equal(result.advanceCreated, 500);
  assert.equal(db.prepare('SELECT balance FROM customers WHERE id = ?').get('C1').balance, -600);
  assert.deepEqual(db.prepare("SELECT paymentReference, discountScope FROM payments WHERE method = 'Discount'").get(), {
    paymentReference: 'DISC-0000001', discountScope: 'settlement'
  });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM payments WHERE method = 'Bank' AND paymentReference LIKE 'ADV-%'").get().count, 1);
  db.close();
}

{
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, openingBalance, advanceBalance) VALUES (?, ?, ?, ?, ?)')
    .run('C1', 'Customer One', 0, 0, 0);

  assert.throws(() => settleCustomerBalance(db, {
    customerId: 'C1',
    splits: [{ method: 'Cash', amount: 500 }],
    discount: 501
  }), /settlement payment amount/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 0);
  db.close();
}

{
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, advanceBalance) VALUES (?, ?, ?, ?)').run('C1', 'Customer One', 50, 0);
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('O1', 'C1', 'Payment Pending', 100, 0, 100, 'Credit', 'Not Paid', '2026-01-01', 0, '2026-01-01');

  assert.throws(() => settleCustomerBalance(db, {
    customerId: 'C1',
    splits: [{ method: 'Cash', amount: 10 }]
  }), /legacy balance difference/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 0);
  db.close();
}

{
  const db = setup();
  db.prepare('INSERT INTO customers (id, name, balance, advanceBalance) VALUES (?, ?, ?, ?)').run('C1', 'Customer One', 100, 0);
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('O1', 'C1', 'Payment Pending', 100, 0, 100, 'Credit', 'Not Paid', '2026-01-01', 0, '2026-01-01');

  const result = settleCustomerBalance(db, {
    customerId: 'C1',
    splits: [{ method: 'Card', amount: 100, bankAccountId: 'BANK-1' }],
    cardCommissionRate: 1.5
  });

  assert.equal(result.cardCommission, 1.5);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM account_transactions WHERE category = 'Card Commission'").get().count, 1);
  db.close();
}

console.log('financialService tests passed');
