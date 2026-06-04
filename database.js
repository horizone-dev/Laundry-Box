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
      image TEXT,
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
      billNumber TEXT,
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
      updatedAt TEXT,
      paymentMethod TEXT DEFAULT 'CASH',
      expectedDeliveryDate TEXT,
      specialInstructions TEXT
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
      createdAt TEXT,
      updatedAt TEXT
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

    CREATE TABLE IF NOT EXISTS sync_state (
      shopId TEXT PRIMARY KEY,
      lastSyncTimestamp TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS deleted_orders (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      billNumber TEXT,
      customerId TEXT,
      customerName TEXT,
      customerPhone TEXT,
      totalAmount REAL,
      items JSON,
      deletedAt TEXT,
      deletedBy TEXT
    );

    CREATE TABLE IF NOT EXISTS credit_override_logs (
      id TEXT PRIMARY KEY,
      customerId TEXT,
      customerName TEXT,
      orderId TEXT,
      userId TEXT,
      managerId TEXT,
      creditLimit REAL,
      outstandingBalance REAL,
      orderAmount REAL,
      exceededAmount REAL,
      actionType TEXT,
      timestamp TEXT
    );
  `);

  // Create indexes for search, filters, sorting, and synchronization performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customerId);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_bill ON orders(billNumber);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_synced ON orders(isSynced);
    
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_synced ON customers(isSynced);
    
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(orderId);
    CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_payments_synced ON payments(isSynced);
    
    CREATE INDEX IF NOT EXISTS idx_account_txn_date ON account_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
  `);

  try {
    db.exec(`ALTER TABLE orders ADD COLUMN expectedDeliveryDate TEXT;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN specialInstructions TEXT;`);
  } catch (e) { /* already exists */ }

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
    if (!orderCols.some(col => col.name === 'billNumber')) {
      db.exec("ALTER TABLE orders ADD COLUMN billNumber TEXT;");
    }
    if (!orderCols.some(col => col.name === 'paymentMethod')) {
      db.exec("ALTER TABLE orders ADD COLUMN paymentMethod TEXT DEFAULT 'CASH';");
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
    if (!payCols.some(col => col.name === 'updatedAt')) {
      db.exec("ALTER TABLE payments ADD COLUMN updatedAt TEXT;");
      db.exec("UPDATE payments SET updatedAt = createdAt WHERE updatedAt IS NULL;");
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

    const serviceCols = db.prepare("PRAGMA table_info(services)").all();
    if (!serviceCols.some(col => col.name === 'image')) {
      db.exec("ALTER TABLE services ADD COLUMN image TEXT;");
    }
    if (!serviceCols.some(col => col.name === 'pricing')) {
      db.exec("ALTER TABLE services ADD COLUMN pricing TEXT DEFAULT '[]';");
      
      // Auto-migrate legacy services
      try {
        const existingTypes = db.prepare("SELECT id FROM service_types").all();
        const allServices = db.prepare("SELECT id, price FROM services").all();
        const updateStmt = db.prepare("UPDATE services SET pricing = ? WHERE id = ?");
        for (const s of allServices) {
          const defaultPricing = existingTypes.map(t => ({
            serviceTypeId: t.id,
            price: s.price || 0
          }));
          updateStmt.run(JSON.stringify(defaultPricing), s.id);
        }
        console.log(`Auto-migrated ${allServices.length} legacy services with pricing data.`);
      } catch (migrateErr) {
        console.error("Auto-migration of services failed:", migrateErr);
      }
    }
    // Data Healer: Run on init
    runDataHealer(db);
  } catch (err) {
    console.error("Migrations failed:", err);
  }
}

function runDataHealer(db) {
  try {
    console.log("Running Data Healer...");
    const timestamp = new Date().toISOString();
    
    // 0. Delete corrupted orders (where id is null or empty)
    db.exec("DELETE FROM orders WHERE id IS NULL OR id = '';");

    // Fix legacy shopId = 'SHOP_1' to 'SHOP_01'
    db.exec(`UPDATE orders SET shopId = 'SHOP_01', isSynced = 0, updatedAt = '${timestamp}' WHERE shopId = 'SHOP_1';`);

    // Fix orders with dueAmount > 0 but paymentStatus = 'Paid' (correcting to Partial or Credit)
    db.exec(`UPDATE orders SET paymentStatus = CASE WHEN IFNULL(paidAmount, 0) > 0 THEN 'Partial' ELSE 'Credit' END, isSynced = 0, updatedAt = '${timestamp}' WHERE dueAmount > 0 AND paymentStatus = 'Paid';`);

    // 1. Fix inconsistent paymentStatus (Only if status is clearly Payment Pending but marked Paid)
    db.exec(`UPDATE orders SET paymentStatus = 'Credit', isSynced = 0, updatedAt = '${timestamp}' WHERE status = 'Payment Pending' AND (paidAmount = 0 OR paidAmount IS NULL) AND paymentStatus != 'Credit';`);
    db.exec(`UPDATE orders SET paymentStatus = 'Paid', status = 'Confirmed', isSynced = 0, updatedAt = '${timestamp}' WHERE status = 'Paid' AND (paymentStatus != 'Paid' OR status != 'Confirmed');`);
    
    // Fix orders that are mathematically paid but have incorrect status/paymentStatus fields
    db.exec(`UPDATE orders SET paymentStatus = 'Paid', isSynced = 0, updatedAt = '${timestamp}' WHERE dueAmount <= 0 AND paymentStatus != 'Paid';`);
    db.exec(`UPDATE orders SET status = 'Confirmed', isSynced = 0, updatedAt = '${timestamp}' WHERE dueAmount <= 0 AND status = 'Payment Pending';`);

    // 2. Data Healer: Only fix dueAmount if it's mathematically wrong, but don't overwrite Status unless confirmed
    db.exec(`UPDATE orders 
            SET dueAmount = totalAmount - IFNULL(paidAmount, 0), isSynced = 0, updatedAt = '${timestamp}'
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
        let newPaymentMethod = newDue <= 0 ? 'CASH' : (order.paymentMethod || 'Credit');
        
        db.prepare("UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?").run(newPaid, newDue, newStatus, newPaymentMethod, timestamp, order.id);
        advance -= apply;
      }
    }

    // 3.5. Smart Unapplied Payments Application:
    // If a customer has paid more than what the individual orders reflect (ledger balance < sum(dueAmount)),
    // apply the difference to settle their oldest outstanding credit/partial orders.
    console.log("Applying customer unapplied payments to credit orders...");
    const allCustomers = db.prepare("SELECT id, balance FROM customers").all();
    for (const customer of allCustomers) {
      const ordersDue = db.prepare("SELECT SUM(dueAmount) as totalDue FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND status != 'Cancelled'").get(customer.id);
      const totalDue = ordersDue ? (ordersDue.totalDue || 0) : 0;
      
      if (customer.balance < totalDue) {
        let unapplied = totalDue - customer.balance;
        const dueOrders = db.prepare("SELECT id, totalAmount, paidAmount, dueAmount, status FROM orders WHERE customerId = ? AND id IS NOT NULL AND id != '' AND (dueAmount > 0 OR paymentStatus = 'Credit' OR paymentStatus = 'Partial') AND status != 'Cancelled' ORDER BY createdAt ASC").all(customer.id);
        
        for (const order of dueOrders) {
          if (unapplied <= 0) break;
          const currentDue = order.dueAmount > 0 ? order.dueAmount : (order.totalAmount - (order.paidAmount || 0));
          if (currentDue <= 0) continue;
          
          let apply = Math.min(unapplied, currentDue);
          let newPaid = (order.paidAmount || 0) + apply;
          let newDue = order.totalAmount - newPaid;
          let newStatus = newDue <= 0 ? 'Paid' : 'Partial';
          
          const newWorkflowStatus = newDue <= 0 ? 'Confirmed' : order.status;
          
          // Reconcile payments table: split and link the unapplied payments
          let remainingToLink = apply;
          const unlinkedPayments = db.prepare("SELECT id, amount, method, shopId, createdAt FROM payments WHERE customerId = ? AND (orderId IS NULL OR orderId = '') ORDER BY createdAt ASC").all(customer.id);
          
          const firstPayment = unlinkedPayments[0];
          const finalPayMethod = (firstPayment && firstPayment.method && firstPayment.method.toUpperCase() !== 'CREDIT') ? firstPayment.method : 'CASH';
          
          db.prepare("UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, status = ?, paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?").run(newPaid, newDue, newStatus, newWorkflowStatus, finalPayMethod, timestamp, order.id);
          
          for (const payment of unlinkedPayments) {
            if (remainingToLink <= 0) break;
            
            const splitPayMethod = (payment.method && payment.method.toUpperCase() !== 'CREDIT') ? payment.method : 'CASH';
            if (payment.amount <= remainingToLink) {
              db.prepare("UPDATE payments SET orderId = ?, method = ?, isSynced = 0 WHERE id = ?").run(order.id, splitPayMethod, payment.id);
              remainingToLink -= payment.amount;
            } else {
              const newUnlinkedAmount = payment.amount - remainingToLink;
              db.prepare("UPDATE payments SET amount = ?, isSynced = 0 WHERE id = ?").run(newUnlinkedAmount, payment.id);
              
              db.prepare(`INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`)
                .run(`PAY-SPLIT-${Date.now()}-${order.id}`, customer.id, order.id, payment.shopId || 'SHOP_01', remainingToLink, splitPayMethod, 'SUCCESS', payment.createdAt, timestamp);
              
              remainingToLink = 0;
            }
          }
          
          unapplied -= apply;
        }
      }
    }

    // 4. Final Sync: Ensure customer balance matches the sum of remaining dueAmounts minus any remaining unlinked payments
    // Only update and mark isSynced = 0 if the balance has actually changed
    db.exec(`UPDATE customers SET balance = (
              SELECT IFNULL(SUM(dueAmount), 0) 
              FROM orders 
              WHERE orders.customerId = customers.id AND orders.id IS NOT NULL AND orders.id != '' AND orders.status != 'Cancelled'
            ) - IFNULL((
              SELECT SUM(amount) 
              FROM payments 
              WHERE payments.customerId = customers.id AND (payments.orderId IS NULL OR payments.orderId = '')
            ), 0), isSynced = 0, updatedAt = '${timestamp}'
            WHERE balance != (
              SELECT IFNULL(SUM(dueAmount), 0) 
              FROM orders 
              WHERE orders.customerId = customers.id AND orders.id IS NOT NULL AND orders.id != '' AND orders.status != 'Cancelled'
            ) - IFNULL((
              SELECT SUM(amount) 
              FROM payments 
              WHERE payments.customerId = customers.id AND (payments.orderId IS NULL OR payments.orderId = '')
            ), 0);`);

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
    console.error("Data Healer failed:", err);
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

module.exports = { initDB, getDB, runDataHealer };
