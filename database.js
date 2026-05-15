const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDB(appPath) {
  // Use app data directory for production or local root for development
  const dbPath = path.join(appPath, 'laundry_pos.sqlite');
  db = new Database(dbPath, { verbose: console.log });

  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      shopId TEXT PRIMARY KEY,
      name TEXT,
      settings JSON,
      isActivated INTEGER DEFAULT 0,
      activationDate TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS branches (
      branchId TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      address TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      creditLimit REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      price REAL,
      icon TEXT,
      category TEXT,
      taxRate REAL DEFAULT NULL,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS service_types (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      price REAL,
      icon TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS addons (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      price REAL,
      icon TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS service_categories (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      icon TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      branchId TEXT,
      customerId TEXT,
      status TEXT,
      totalAmount REAL,
      paidAmount REAL DEFAULT 0,
      dueAmount REAL DEFAULT 0,
      paymentStatus TEXT DEFAULT 'Pending', -- 'Paid', 'Credit', 'Partial'
      items JSON,
      statusHistory JSON,
      createdAt TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      customerId TEXT,
      orderId TEXT,
      shopId TEXT,
      amount REAL,
      method TEXT,
      status TEXT,
      isSynced INTEGER DEFAULT 0,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      title TEXT,
      amount REAL,
      taxAmount REAL DEFAULT 0,
      isTaxEnabled INTEGER DEFAULT 0,
      taxMethod TEXT DEFAULT 'inclusive',
      category TEXT,
      date TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS account_transactions (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      accountType TEXT, -- 'CASH' or 'BANK'
      type TEXT,        -- 'INCOME' or 'EXPENSE'
      category TEXT,
      amount REAL,
      description TEXT,
      date TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );
  `);

  // Migrations
  try {
    const servicesCols = db.prepare("PRAGMA table_info(services)").all();
    if (!servicesCols.some(col => col.name === 'taxRate')) {
      db.exec("ALTER TABLE services ADD COLUMN taxRate REAL DEFAULT NULL;");
    }

    const shopCols = db.prepare("PRAGMA table_info(shops)").all();
    if (!shopCols.some(col => col.name === 'isActivated')) {
      db.exec("ALTER TABLE shops ADD COLUMN isActivated INTEGER DEFAULT 0;");
    }
    if (!shopCols.some(col => col.name === 'activationDate')) {
      db.exec("ALTER TABLE shops ADD COLUMN activationDate TEXT;");
    }

    // Ensure at least one shop exists with a default 30-day trial
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiryDate = thirtyDaysFromNow.toISOString().split('T')[0];
    const defaultSettings = JSON.stringify({ expiryDate, currencySymbol: 'د.إ' });
    
    db.prepare("INSERT OR IGNORE INTO shops (shopId, name, isActivated, settings) VALUES (?, ?, ?, ?)").run('SHOP_01', 'ABC Laundry', 1, defaultSettings);

    // Force activation for now as requested "manualy set"
    db.exec("UPDATE shops SET isActivated = 1 WHERE isActivated = 0;");

    const custCols = db.prepare("PRAGMA table_info(customers)").all();
    if (!custCols.some(col => col.name === 'creditLimit')) {
      db.exec("ALTER TABLE customers ADD COLUMN creditLimit REAL DEFAULT 0;");
    }
    if (!custCols.some(col => col.name === 'balance')) {
      db.exec("ALTER TABLE customers ADD COLUMN balance REAL DEFAULT 0;");
    }

    const orderCols = db.prepare("PRAGMA table_info(orders)").all();
    if (!orderCols.some(col => col.name === 'paidAmount')) {
      db.exec("ALTER TABLE orders ADD COLUMN paidAmount REAL DEFAULT 0;");
    }
    if (!orderCols.some(col => col.name === 'dueAmount')) {
      db.exec("ALTER TABLE orders ADD COLUMN dueAmount REAL DEFAULT 0;");
    }
    if (!orderCols.some(col => col.name === 'paymentStatus')) {
      db.exec("ALTER TABLE orders ADD COLUMN paymentStatus TEXT DEFAULT 'Paid';");
    }
    if (!orderCols.some(col => col.name === 'statusHistory')) {
      db.exec("ALTER TABLE orders ADD COLUMN statusHistory JSON;");
    }

    const payCols = db.prepare("PRAGMA table_info(payments)").all();
    if (!payCols.some(col => col.name === 'customerId')) {
      db.exec("ALTER TABLE payments ADD COLUMN customerId TEXT;");
    }
    if (!payCols.some(col => col.name === 'orderId')) {
      db.exec("ALTER TABLE payments ADD COLUMN orderId TEXT;");
    }
    if (!payCols.some(col => col.name === 'shopId')) {
      db.exec("ALTER TABLE payments ADD COLUMN shopId TEXT;");
    }
    const txnCols = db.prepare("PRAGMA table_info(account_transactions)").all();
    if (!txnCols.some(col => col.name === 'icon')) {
      db.exec("ALTER TABLE account_transactions ADD COLUMN icon TEXT DEFAULT 'DollarSign';");
    }

    const expCols = db.prepare("PRAGMA table_info(expenses)").all();
    if (!expCols.some(col => col.name === 'taxAmount')) {
      db.exec("ALTER TABLE expenses ADD COLUMN taxAmount REAL DEFAULT 0;");
    }
    if (!expCols.some(col => col.name === 'isTaxEnabled')) {
      db.exec("ALTER TABLE expenses ADD COLUMN isTaxEnabled INTEGER DEFAULT 0;");
    }
    if (!expCols.some(col => col.name === 'taxMethod')) {
      db.exec("ALTER TABLE expenses ADD COLUMN taxMethod TEXT DEFAULT 'inclusive';");
    }
    // Data Healer: Normalize statuses and fix broken financial records
    console.log("Running Data Healer...");
    // 1. Fix inconsistent paymentStatus (Only if status is clearly Payment Pending but marked Paid)
    db.exec("UPDATE orders SET paymentStatus = 'Credit' WHERE status = 'Payment Pending' AND (paidAmount = 0 OR paidAmount IS NULL);");
    db.exec("UPDATE orders SET paymentStatus = 'Paid', status = 'Confirmed' WHERE status = 'Paid';");
    
    // 2. Data Healer: Only fix dueAmount if it's mathematically wrong, but don't overwrite Status unless confirmed
    db.exec(`UPDATE orders 
            SET dueAmount = totalAmount - IFNULL(paidAmount, 0)
            WHERE ABS(dueAmount - (totalAmount - IFNULL(paidAmount, 0))) > 0.01;`);

    // 3. Smart Advance Application:
    // If a customer has a negative balance (Advance), try to apply it to their Credit orders
    console.log("Applying customer advances to credit orders...");
    const customersWithAdvance = db.prepare("SELECT id, balance FROM customers WHERE balance < 0").all();
    
    for (const customer of customersWithAdvance) {
      let advance = Math.abs(customer.balance);
      const creditOrders = db.prepare("SELECT id, totalAmount, paidAmount, dueAmount FROM orders WHERE customerId = ? AND (paymentStatus = 'Credit' OR paymentStatus = 'Partial') ORDER BY createdAt ASC").all(customer.id);
      
      for (const order of creditOrders) {
        if (advance <= 0) break;
        const remainingDue = order.totalAmount - (order.paidAmount || 0);
        if (remainingDue <= 0) continue;

        let apply = Math.min(advance, remainingDue);
        let newPaid = (order.paidAmount || 0) + apply;
        let newDue = order.totalAmount - newPaid;
        let newStatus = newDue <= 0 ? 'Paid' : 'Partial';
        
        db.prepare("UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ? WHERE id = ?").run(newPaid, newDue, newStatus, order.id);
        advance -= apply;
      }
    }

    // 4. Final Sync: Ensure customer balance matches the sum of remaining dueAmounts
    db.exec(`UPDATE customers SET balance = (
              SELECT IFNULL(SUM(dueAmount), 0) 
              FROM orders 
              WHERE orders.customerId = customers.id
            );`);

    // 4. Pre-populate Categories if empty
    const catCheck = db.prepare("SELECT COUNT(*) as count FROM service_categories").get();
    if (catCheck.count === 0) {
      console.log("Pre-populating default categories...");
      const defaultCats = [
        { id: 'cat-1', name: 'Laundry', icon: 'Shirt' },
        { id: 'cat-2', name: 'Dry Cleaning', icon: 'Sparkles' },
        { id: 'cat-3', name: 'Alterations', icon: 'Scissors' },
        { id: 'cat-4', name: 'Add-ons', icon: 'Zap' }
      ];
      const stmt = db.prepare("INSERT INTO service_categories (id, shopId, name, icon, updatedAt) VALUES (?, ?, ?, ?, ?)");
      defaultCats.forEach(cat => {
        stmt.run(cat.id, 'SHOP_01', cat.name, cat.icon, new Date().toISOString());
      });
    }

    console.log("Data Healer completed.");
  } catch (err) {
    console.error("Migrations/Data Healer failed:", err);
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

module.exports = { initDB, getDB };
