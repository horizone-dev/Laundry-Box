const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

function logDB(message, error = null) {
  const timestamp = new Date().toISOString();
  let logText = `[${timestamp}] [Database] ${message}\n`;
  if (error) {
    logText += `Stack Trace: ${error.stack || error}\n`;
  }
  console.log(`[Database] ${message}`);
  try {
    const appDataPath = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library/Application Support') : path.join(process.env.HOME, '.config'));
    const logDirectory = path.join(appDataPath, 'Laundry Box');
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }
    const logPath = path.join(logDirectory, 'startup.log');
    fs.appendFileSync(logPath, logText);
  } catch (err) {
    console.error('Failed to write to startup.log inside database.js:', err);
  }
}

function initDB(appPath) {
  // Use app data directory for production or local root for development
  const dbPath = path.join(appPath, 'laundry_pos.sqlite');
  logDB(`Connecting to SQLite database at: ${dbPath}`);
  
  try {
    db = new Database(dbPath, { verbose: (str) => console.log(`[Database SQL] ${str}`) });
    logDB(`SQLite database connected successfully.`);
  } catch (err) {
    logDB(`CRITICAL ERROR: Failed to open SQLite database`, err);
    throw err;
  }
  
  try {
    if (fs.existsSync(dbPath)) {
      fs.chmodSync(dbPath, 0o600);
      logDB("Strict database file permissions (0o600) set successfully.");
    }
  } catch (err) {
    logDB("Warning: Failed to set strict database file permissions:", err);
  }

  logDB("Configuring database pragmas (WAL, synchronous=NORMAL, cache_size=10000, foreign_keys=ON)...");
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 10000');
    db.pragma('foreign_keys = ON');
    logDB("Pragmas configured successfully.");
  } catch (pragmaErr) {
    logDB("Error configuring database pragmas:", pragmaErr);
  }

  logDB("Initializing database schema tables...");

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
      openingBalance REAL DEFAULT 0,
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
      sortOrder INTEGER DEFAULT 0,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS service_types (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      price REAL,
      icon TEXT,
      sortOrder INTEGER DEFAULT 0,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS addons (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      price REAL,
      icon TEXT,
      sortOrder INTEGER DEFAULT 0,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS service_categories (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      name TEXT,
      icon TEXT,
      sortOrder INTEGER DEFAULT 0,
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
      specialInstructions TEXT,
      paymentBreakdown TEXT
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
      updatedAt TEXT,
      paymentReference TEXT
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
      updatedAt TEXT,
      icon TEXT,
      bankAccountId TEXT,
      createdBy TEXT,
      createdById TEXT,
      createdByRole TEXT
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
      deletedBy TEXT,
      originalPaymentStatus TEXT,
      paidAmount REAL DEFAULT 0,
      returnStatus TEXT DEFAULT 'N/A',
      approvedBy TEXT,
      originalPaymentMethod TEXT,
      refundMethod TEXT,
      returnedAt TEXT,
      refundStatus TEXT DEFAULT 'Deleted',
      payments TEXT
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

    CREATE TABLE IF NOT EXISTS deleted_orders (
      id TEXT PRIMARY KEY,
      shopId TEXT,
      billNumber TEXT,
      customerId TEXT,
      customerName TEXT,
      customerPhone TEXT,
      totalAmount REAL,
      items JSON,
      createdAt TEXT,
      deletedAt TEXT,
      deletedBy TEXT,
      originalPaymentStatus TEXT,
      paidAmount REAL DEFAULT 0,
      returnStatus TEXT DEFAULT 'N/A',
      approvedBy TEXT,
      originalPaymentMethod TEXT,
      refundMethod TEXT,
      returnedAt TEXT,
      refundStatus TEXT DEFAULT 'Deleted',
      payments TEXT
    );

    CREATE TABLE IF NOT EXISTS advance_allocations (
      id TEXT PRIMARY KEY,
      paymentId TEXT,
      orderId TEXT,
      amountUsed REAL,
      date TEXT,
      isSynced INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_links (
      id TEXT PRIMARY KEY,
      customerId TEXT,
      customerName TEXT,
      description TEXT,
      amount REAL,
      channel TEXT,
      date TEXT,
      status TEXT,
      url TEXT,
      checkoutId TEXT,
      payment_method TEXT
    );

    CREATE TABLE IF NOT EXISTS nomod_transactions (
      id TEXT PRIMARY KEY,
      orderId TEXT,
      customerId TEXT,
      customerName TEXT,
      amount REAL,
      currency TEXT,
      status TEXT,
      url TEXT,
      transactionId TEXT,
      gatewayResponse TEXT,
      createdAt TEXT,
      paidAt TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event TEXT,
      details TEXT,
      userId TEXT,
      userRole TEXT,
      timestamp TEXT,
      device TEXT
    );

    CREATE TABLE IF NOT EXISTS reconciliations (
      id TEXT PRIMARY KEY,
      date TEXT,
      cashCounted REAL,
      cashExpected REAL,
      status TEXT,
      verifiedBy TEXT
    );

    CREATE TABLE IF NOT EXISTS payroll_employees (
      id TEXT PRIMARY KEY,
      name TEXT,
      role TEXT,
      baseSalary REAL
    );

    CREATE TABLE IF NOT EXISTS payroll_payments (
      id TEXT PRIMARY KEY,
      month TEXT,
      employeeName TEXT,
      role TEXT,
      base REAL,
      daysWorked INTEGER,
      overtime REAL,
      bonus REAL,
      deduction REAL,
      net REAL,
      status TEXT,
      date TEXT
    );

    CREATE TABLE IF NOT EXISTS accrual_logs (
      id TEXT PRIMARY KEY,
      date TEXT,
      employeeName TEXT,
      type TEXT,
      monthYear TEXT,
      amount REAL,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS email_settings (
      id TEXT PRIMARY KEY DEFAULT '1',
      enabled INTEGER DEFAULT 0,
      ownerEmail TEXT,
      sendTime TEXT DEFAULT '23:50',
      provider TEXT,
      smtpHost TEXT,
      smtpPort INTEGER,
      username TEXT,
      passwordBuffer BLOB,
      includePdf INTEGER DEFAULT 1,
      includeSalesCsv INTEGER DEFAULT 0,
      includeExpensesCsv INTEGER DEFAULT 0,
      includeCollectionsCsv INTEGER DEFAULT 0,
      includeOutstandingCsv INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS email_history (
      id TEXT PRIMARY KEY,
      date TEXT,
      time TEXT,
      recipient TEXT,
      status TEXT,
      reason TEXT,
      retryCount INTEGER DEFAULT 0
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
    CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customerId);
    CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_payments_synced ON payments(isSynced);
    
    CREATE INDEX IF NOT EXISTS idx_deleted_orders_customer ON deleted_orders(customerId);
    CREATE INDEX IF NOT EXISTS idx_account_txn_date ON account_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    
    CREATE INDEX IF NOT EXISTS idx_advance_allocations_payment ON advance_allocations(paymentId);
    CREATE INDEX IF NOT EXISTS idx_advance_allocations_order ON advance_allocations(orderId);
  `);

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS advance_allocations (
        id TEXT PRIMARY KEY,
        paymentId TEXT,
        orderId TEXT,
        amountUsed REAL,
        date TEXT,
        isSynced INTEGER DEFAULT 0,
        updatedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_advance_allocations_payment ON advance_allocations(paymentId);
      CREATE INDEX IF NOT EXISTS idx_advance_allocations_order ON advance_allocations(orderId);
    `);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN expectedDeliveryDate TEXT;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN specialInstructions TEXT;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE payment_links ADD COLUMN checkoutId TEXT;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE payment_links ADD COLUMN payment_method TEXT;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE deleted_orders ADD COLUMN createdAt TEXT;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE customers ADD COLUMN openingBalance REAL DEFAULT 0;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN paymentBreakdown TEXT;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN nomodCheckoutId TEXT;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN nomodPaymentLink TEXT;`);
  } catch (e) { /* already exists */ }

  // Migrations for audit_logs table self-healing
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        event TEXT,
        details TEXT,
        userId TEXT,
        userRole TEXT,
        timestamp TEXT,
        device TEXT
      );
    `);
    
    // Check if the event column exists (in case table was created with an old schema)
    const auditCols = db.prepare("PRAGMA table_info(audit_logs)").all();
    if (!auditCols.some(col => col.name === 'event')) {
      // If it doesn't have 'event', recreate or alter it
      db.exec("DROP TABLE IF EXISTS audit_logs;");
      db.exec(`
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          event TEXT,
          details TEXT,
          userId TEXT,
          userRole TEXT,
          timestamp TEXT,
          device TEXT
        );
      `);
    }
  } catch (err) {
    console.error("Failed to migrate audit_logs table:", err);
  }

  // Migrations
  try {
    const servicesCols = db.prepare("PRAGMA table_info(services)").all();
    if (!servicesCols.some(col => col.name === 'taxRate')) {
      db.exec("ALTER TABLE services ADD COLUMN taxRate REAL DEFAULT NULL;");
    }
    if (!servicesCols.some(col => col.name === 'sortOrder')) {
      db.exec("ALTER TABLE services ADD COLUMN sortOrder INTEGER DEFAULT 0;");
    }

    const serviceTypesCols = db.prepare("PRAGMA table_info(service_types)").all();
    if (!serviceTypesCols.some(col => col.name === 'sortOrder')) {
      db.exec("ALTER TABLE service_types ADD COLUMN sortOrder INTEGER DEFAULT 0;");
    }

    const addonsCols = db.prepare("PRAGMA table_info(addons)").all();
    if (!addonsCols.some(col => col.name === 'sortOrder')) {
      db.exec("ALTER TABLE addons ADD COLUMN sortOrder INTEGER DEFAULT 0;");
    }

    const categoriesCols = db.prepare("PRAGMA table_info(service_categories)").all();
    if (!categoriesCols.some(col => col.name === 'sortOrder')) {
      db.exec("ALTER TABLE service_categories ADD COLUMN sortOrder INTEGER DEFAULT 0;");
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
    
    db.prepare("INSERT OR IGNORE INTO shops (shopId, name, isActivated, settings) VALUES (?, ?, ?, ?)").run('SHOP_01', 'Laundry Box', 1, defaultSettings);
    db.exec("UPDATE shops SET name = 'Laundry Box' WHERE name = 'ABC Laundry' OR name = 'Laundry Management System';");

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
    if (!orderCols.some(col => col.name === 'paymentBreakdown')) {
      db.exec("ALTER TABLE orders ADD COLUMN paymentBreakdown TEXT;");
    }
    if (!orderCols.some(col => col.name === 'nomodCheckoutId')) {
      db.exec("ALTER TABLE orders ADD COLUMN nomodCheckoutId TEXT;");
    }
    if (!orderCols.some(col => col.name === 'nomodPaymentLink')) {
      db.exec("ALTER TABLE orders ADD COLUMN nomodPaymentLink TEXT;");
    }
    if (!orderCols.some(col => col.name === 'nomodTransactionId')) {
      db.exec("ALTER TABLE orders ADD COLUMN nomodTransactionId TEXT;");
    }
    if (!orderCols.some(col => col.name === 'nomodReference')) {
      db.exec("ALTER TABLE orders ADD COLUMN nomodReference TEXT;");
    }
    if (!orderCols.some(col => col.name === 'nomodGatewayResponse')) {
      db.exec("ALTER TABLE orders ADD COLUMN nomodGatewayResponse TEXT;");
    }
    if (!orderCols.some(col => col.name === 'nomodPaymentStatus')) {
      db.exec("ALTER TABLE orders ADD COLUMN nomodPaymentStatus TEXT;");
    }
    if (!orderCols.some(col => col.name === 'paymentVerified')) {
      db.exec("ALTER TABLE orders ADD COLUMN paymentVerified INTEGER DEFAULT 0;");
    }
    if (!orderCols.some(col => col.name === 'paidAt')) {
      db.exec("ALTER TABLE orders ADD COLUMN paidAt TEXT;");
    }

    const payLinkCols = db.prepare("PRAGMA table_info(payment_links)").all();
    if (!payLinkCols.some(col => col.name === 'paidAt')) {
      db.exec("ALTER TABLE payment_links ADD COLUMN paidAt TEXT;");
    }
    if (!payLinkCols.some(col => col.name === 'transactionReference')) {
      db.exec("ALTER TABLE payment_links ADD COLUMN transactionReference TEXT;");
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

    const emailSettingsCols = db.prepare("PRAGMA table_info(email_settings)").all();
    if (!emailSettingsCols.some(col => col.name === 'includePdf')) {
      db.exec("ALTER TABLE email_settings ADD COLUMN includePdf INTEGER DEFAULT 1;");
    }
    if (!emailSettingsCols.some(col => col.name === 'includeSalesCsv')) {
      db.exec("ALTER TABLE email_settings ADD COLUMN includeSalesCsv INTEGER DEFAULT 0;");
    }
    if (!emailSettingsCols.some(col => col.name === 'includeExpensesCsv')) {
      db.exec("ALTER TABLE email_settings ADD COLUMN includeExpensesCsv INTEGER DEFAULT 0;");
    }
    if (!emailSettingsCols.some(col => col.name === 'includeCollectionsCsv')) {
      db.exec("ALTER TABLE email_settings ADD COLUMN includeCollectionsCsv INTEGER DEFAULT 0;");
    }
    if (!emailSettingsCols.some(col => col.name === 'includeOutstandingCsv')) {
      db.exec("ALTER TABLE email_settings ADD COLUMN includeOutstandingCsv INTEGER DEFAULT 0;");
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
    if (!serviceCols.some(col => col.name === 'defaultDeliveryMethod')) {
      db.exec("ALTER TABLE services ADD COLUMN defaultDeliveryMethod TEXT DEFAULT 'Hanger';");
    }

    const deletedOrderCols = db.prepare("PRAGMA table_info(deleted_orders)").all();
    if (!deletedOrderCols.some(col => col.name === 'originalPaymentStatus')) {
      db.exec("ALTER TABLE deleted_orders ADD COLUMN originalPaymentStatus TEXT DEFAULT NULL;");
    }
    if (!deletedOrderCols.some(col => col.name === 'paidAmount')) {
      db.exec("ALTER TABLE deleted_orders ADD COLUMN paidAmount REAL DEFAULT 0;");
    }
    if (!deletedOrderCols.some(col => col.name === 'returnStatus')) {
      db.exec("ALTER TABLE deleted_orders ADD COLUMN returnStatus TEXT DEFAULT 'N/A';");
    }
    if (!deletedOrderCols.some(col => col.name === 'approvedBy')) {
      db.exec("ALTER TABLE deleted_orders ADD COLUMN approvedBy TEXT DEFAULT NULL;");
    }
    if (!deletedOrderCols.some(col => col.name === 'originalPaymentMethod')) {
      db.exec("ALTER TABLE deleted_orders ADD COLUMN originalPaymentMethod TEXT DEFAULT NULL;");
    }
    if (!deletedOrderCols.some(col => col.name === 'payments')) {
      db.exec("ALTER TABLE deleted_orders ADD COLUMN payments TEXT DEFAULT NULL;");
    }
    if (!deletedOrderCols.some(col => col.name === 'refundMethod')) {
      db.exec("ALTER TABLE deleted_orders ADD COLUMN refundMethod TEXT DEFAULT NULL;");
    }
    if (!deletedOrderCols.some(col => col.name === 'returnedAt')) {
      db.exec("ALTER TABLE deleted_orders ADD COLUMN returnedAt TEXT DEFAULT NULL;");
    }
    if (!deletedOrderCols.some(col => col.name === 'refundStatus')) {
      db.exec("ALTER TABLE deleted_orders ADD COLUMN refundStatus TEXT DEFAULT 'Deleted';");
    }

    // ─── Timezone Migration (run once per row) ──────────────────────────
    // Old records were stored using toISOString() (UTC). This migration
    // corrects them to local time by adding the UTC offset.
    // The timezoneMigrated flag ensures we never double-apply the shift.
    const txnCols2 = db.prepare("PRAGMA table_info(account_transactions)").all();
    if (!txnCols2.some(col => col.name === 'timezoneMigrated')) {
      db.exec("ALTER TABLE account_transactions ADD COLUMN timezoneMigrated INTEGER DEFAULT 0;");
    }
    if (!txnCols2.some(col => col.name === 'bankAccountId')) {
      db.exec("ALTER TABLE account_transactions ADD COLUMN bankAccountId TEXT;");
    }
    if (!txnCols2.some(col => col.name === 'createdBy')) {
      db.exec("ALTER TABLE account_transactions ADD COLUMN createdBy TEXT;");
    }
    if (!txnCols2.some(col => col.name === 'createdById')) {
      db.exec("ALTER TABLE account_transactions ADD COLUMN createdById TEXT;");
    }
    if (!txnCols2.some(col => col.name === 'createdByRole')) {
      db.exec("ALTER TABLE account_transactions ADD COLUMN createdByRole TEXT;");
    }

    // Detect the device's UTC offset in hours (positive = ahead of UTC, e.g. +4 for UAE)
    const tzOffsetHours = -(new Date().getTimezoneOffset()) / 60;

    if (tzOffsetHours !== 0) {
      // Only shift rows that haven't been migrated yet
      const unmigrated = db.prepare(
        "SELECT COUNT(*) as cnt FROM account_transactions WHERE timezoneMigrated = 0"
      ).get();

      if (unmigrated && unmigrated.cnt > 0) {
        const sign = tzOffsetHours >= 0 ? '+' : '-';
        const absHours = Math.abs(tzOffsetHours);
        const shiftExpr = `datetime(date, '${sign}${absHours} hours')`;
        db.exec(`
          UPDATE account_transactions
          SET date = ${shiftExpr},
              timezoneMigrated = 1
          WHERE timezoneMigrated = 0
            AND date IS NOT NULL
            AND date != '';
        `);
        const migratedCount = db.prepare(
          "SELECT COUNT(*) as cnt FROM account_transactions WHERE timezoneMigrated = 1"
        ).get();
        console.log(`[TZ Migration] Shifted ${migratedCount.cnt} account_transactions by ${sign}${absHours}h to local time.`);
      } else {
        console.log('[TZ Migration] All account_transactions already migrated. Skipping.');
      }
    } else {
      // UTC device — mark all rows as migrated so we never re-run
      db.exec("UPDATE account_transactions SET timezoneMigrated = 1 WHERE timezoneMigrated = 0;");
      console.log('[TZ Migration] UTC device detected. No shift needed.');
    }
    // ─── Payment Sequence Migration ──────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_sequence (
        id INTEGER PRIMARY KEY AUTOINCREMENT
      );
    `);
    const seqRow = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'payment_sequence'").get();
    if (!seqRow) {
      const maxRvRow = db.prepare("SELECT id FROM payments WHERE id LIKE 'RV-%' ORDER BY id DESC LIMIT 1").get();
      let seedVal = 0;
      if (maxRvRow) {
        const parts = maxRvRow.id.split('-');
        if (parts.length > 1) {
          const lastNum = parseInt(parts[1], 10);
          if (!isNaN(lastNum)) {
            seedVal = lastNum;
          }
        }
      }
      if (seedVal === 0) {
        const totalPayments = db.prepare("SELECT COUNT(*) as count FROM payments").get().count;
        seedVal = totalPayments;
      }
      if (seedVal > 0) {
        db.prepare("INSERT INTO payment_sequence (id) VALUES (?)").run(seedVal);
        console.log(`[Sequence Migration] Seeded payment_sequence with ID ${seedVal}`);
      }
    }

    // Alter table payments to add paymentReference column if missing
    const paymentCols = db.prepare("PRAGMA table_info(payments)").all();
    if (!paymentCols.some(col => col.name === 'paymentReference')) {
      db.exec("ALTER TABLE payments ADD COLUMN paymentReference TEXT DEFAULT NULL;");
      console.log("[Sequence Migration] Added paymentReference column to payments table.");
    }
    // ───────────────────────────────────────────────────────────────────

    // Run legacy advance payments migration
    migrateLegacyAdvancePayments(db);

    // Data Healer: Run on init
    logDB("Running Database Data Healer on initialization...");
    runDataHealer(db);
    logDB("Database Data Healer completed successfully.");
    logDB("All database tables initialized and migrations finished successfully.");
  } catch (err) {
    logDB("CRITICAL ERROR: Database migrations failed", err);
    console.error("Migrations failed:", err);
    throw err;
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

    // Fix inconsistent paymentStatus mathematically
    db.exec(`UPDATE orders SET paymentStatus = 'Credit', isSynced = 0, updatedAt = '${timestamp}' WHERE (paidAmount = 0 OR paidAmount IS NULL) AND paymentStatus != 'Credit';`);
    db.exec(`UPDATE orders SET paymentStatus = 'Partial', isSynced = 0, updatedAt = '${timestamp}' WHERE paidAmount > 0 AND paidAmount < totalAmount AND paymentStatus != 'Partial';`);
    db.exec(`UPDATE orders SET paymentStatus = 'Paid', dueAmount = 0, isSynced = 0, updatedAt = '${timestamp}' WHERE paidAmount >= totalAmount AND (paymentStatus != 'Paid' OR dueAmount > 0);`);
    db.exec(`UPDATE orders SET status = 'Confirmed', isSynced = 0, updatedAt = '${timestamp}' WHERE dueAmount <= 0 AND status = 'Payment Pending';`);

    // 2. Data Healer: Only fix dueAmount if it's mathematically wrong, but don't overwrite Status unless confirmed
    db.exec(`UPDATE orders 
            SET dueAmount = totalAmount - IFNULL(paidAmount, 0), isSynced = 0, updatedAt = '${timestamp}'
            WHERE ABS(dueAmount - (totalAmount - IFNULL(paidAmount, 0))) > 0.01;`);
            
    // Wipe micro-decimal dust
    db.exec(`UPDATE orders SET dueAmount = 0 WHERE dueAmount > 0 AND dueAmount < 0.01;`);

    // Heal already-corrupted credit/partial orders against payments table
    console.log("Healing mismatched order paid/due amounts against payments table...");
    const mismatchedOrders = db.prepare(`
      SELECT o.id, o.totalAmount, o.paidAmount, o.paymentStatus, IFNULL(SUM(p.amount), 0) as actualPaid
      FROM orders o
      LEFT JOIN payments p ON o.id = p.orderId
      WHERE o.paymentStatus IN ('Credit', 'Partial')
      GROUP BY o.id
      HAVING ABS(o.paidAmount - actualPaid) > 0.01
    `).all();

    for (const order of mismatchedOrders) {
      console.log(`Data Healer: Healing order ${order.id}. DB paidAmount: ${order.paidAmount}, actual payments: ${order.actualPaid}.`);
      const newPaid = order.actualPaid;
      const newDue = Math.max(0, order.totalAmount - newPaid);
      const newStatus = newDue <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Credit');
      
      let updateQuery = `UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, isSynced = 0, updatedAt = ?`;
      const params = [newPaid, newDue, newStatus, timestamp];
      if (newStatus === 'Credit') {
        updateQuery += `, paymentMethod = 'Not Paid'`;
      }
      updateQuery += ` WHERE id = ?`;
      params.push(order.id);
      db.prepare(updateQuery).run(params);
    }

    // Normalize legacy paymentMethod values to the 6-option system: Not Paid, Cash, Card, UPI, Bank, Multipayment
    console.log("Normalizing legacy paymentMethod values...");
    // Orders that are credit/unpaid: set to 'Not Paid'
    db.exec(`UPDATE orders SET paymentMethod = 'Not Paid', isSynced = 0, updatedAt = '${timestamp}'
             WHERE paymentStatus IN ('Credit') AND (paymentMethod IS NULL OR paymentMethod = '' OR paymentMethod NOT IN ('Not Paid', 'Cash', 'Card', 'UPI', 'Bank', 'Multipayment'));`);
    // Old 'Credit' method on any orders -> 'Not Paid'
    db.exec(`UPDATE orders SET paymentMethod = 'Not Paid', isSynced = 0, updatedAt = '${timestamp}' WHERE paymentMethod = 'Credit';`);
    // Normalize legacy uppercase / invalid method names (CASH -> Cash, BANK -> Bank, Wallet -> Cash, etc.)
    db.exec(`UPDATE orders SET paymentMethod = 'Cash', isSynced = 0, updatedAt = '${timestamp}' WHERE paymentMethod IN ('CASH', 'Wallet', 'UPI / QR Payment') AND paymentStatus = 'Paid';`);
    db.exec(`UPDATE orders SET paymentMethod = 'Bank', isSynced = 0, updatedAt = '${timestamp}' WHERE paymentMethod = 'BANK';`);
    // Auto-fix 0.00 fully paid orders that are marked as 'Not Paid' under paymentMethod to 'Cash'
    db.exec(`UPDATE orders SET paymentMethod = 'Cash', isSynced = 0, updatedAt = '${timestamp}' WHERE totalAmount = 0 AND paymentStatus = 'Paid' AND paymentMethod = 'Not Paid';`);

    // For fully-paid orders that came from settlements, recalculate paymentMethod from payments table
    console.log("Recalculating paymentMethod for settled credit orders from payment history...");
    const paidOrdersFromCredit = db.prepare(`
      SELECT id, paymentMethod 
      FROM orders 
      WHERE paymentStatus = 'Paid' AND dueAmount <= 0 AND paidAmount > 0
        AND (paymentMethod IS NULL OR paymentMethod = '' OR paymentMethod = 'Not Paid' OR paymentMethod NOT IN ('Cash', 'Card', 'UPI', 'Bank', 'Multipayment'))
    `).all();
    for (const order of paidOrdersFromCredit) {
      const payRows = db.prepare("SELECT DISTINCT method FROM payments WHERE orderId = ?").all(order.id);
      if (payRows.length === 0) continue;
      const methods = payRows.map(r => r.method).filter(m => m && m !== 'Not Paid');
      if (methods.length === 0) continue;
      
      let newMethod;
      if (methods.length === 1) {
        newMethod = methods[0];
      } else {
        newMethod = 'Multipayment';
      }
      
      if (order.paymentMethod !== newMethod) {
        db.prepare(`UPDATE orders SET paymentMethod = ?, isSynced = 0, updatedAt = ? WHERE id = ?`).run(newMethod, timestamp, order.id);
      }
    }

    // Recalculate customer balances from actual orders and payments before smart advance/unapplied payments logic
    // Formula: balance = active_orders_due - available_advance - (deleted_orders pending refund)
    //   available_advance = unlinked_payments - allocations_already_used
    //   deleted_orders pending refund: only those WITH paidAmount > 0 (i.e. customer actually paid for them)
    //   When refundStatus changes from 'Refund Pending' to 'Returned', that subtraction goes away — no manual update needed.
    db.exec(`UPDATE customers SET balance = (
              IFNULL(CASE WHEN openingBalance > 0 THEN openingBalance ELSE 0 END, 0) +
              (
                SELECT IFNULL(SUM(dueAmount), 0) 
                FROM orders 
                WHERE orders.customerId = customers.id AND orders.id IS NOT NULL AND orders.id != '' AND orders.status != 'Cancelled'
              ) - MAX(0, (
                IFNULL((
                  SELECT SUM(amount) 
                  FROM payments 
                  WHERE payments.customerId = customers.id AND (payments.orderId IS NULL OR payments.orderId = '')
                ), 0) - IFNULL((
                  SELECT SUM(a.amountUsed)
                  FROM advance_allocations a
                  JOIN orders o ON a.orderId = o.id
                  JOIN payments p ON a.paymentId = p.id
                  WHERE p.customerId = customers.id AND o.status != 'Cancelled'
                ), 0)
              )) - IFNULL((
                SELECT SUM(paidAmount)
                FROM deleted_orders
                WHERE deleted_orders.customerId = customers.id
                  AND deleted_orders.refundStatus = 'Refund Pending'
                  AND deleted_orders.paidAmount > 0
              ), 0) ), isSynced = 0, updatedAt = '${timestamp}'
            WHERE ABS(balance - (
              IFNULL(CASE WHEN openingBalance > 0 THEN openingBalance ELSE 0 END, 0) +
              (
                SELECT IFNULL(SUM(dueAmount), 0) 
                FROM orders 
                WHERE orders.customerId = customers.id AND orders.id IS NOT NULL AND orders.id != '' AND orders.status != 'Cancelled'
              ) - MAX(0, (
                IFNULL((
                  SELECT SUM(amount) 
                  FROM payments 
                  WHERE payments.customerId = customers.id AND (payments.orderId IS NULL OR payments.orderId = '')
                ), 0) - IFNULL((
                  SELECT SUM(a.amountUsed)
                  FROM advance_allocations a
                  JOIN orders o ON a.orderId = o.id
                  JOIN payments p ON a.paymentId = p.id
                  WHERE p.customerId = customers.id AND o.status != 'Cancelled'
                ), 0)
              )) - IFNULL((
                SELECT SUM(paidAmount)
                FROM deleted_orders
                WHERE deleted_orders.customerId = customers.id
                  AND deleted_orders.refundStatus = 'Refund Pending'
                  AND deleted_orders.paidAmount > 0
              ), 0)
            )) > 0.005;`);

    const getNextRvNumberSync = () => {
      const rows = db.prepare("SELECT id FROM payments WHERE id LIKE 'RV-%'").all();
      let maxNum = 0;
      if (rows && rows.length > 0) {
        rows.forEach(row => {
          const num = parseInt(row.id.replace('RV-', '').replace(/\D/g, ''));
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        });
      }
      const nextId = maxNum + 1;
      return `RV-${String(nextId).padStart(6, '0')}`;
    };

    // Auto-application of customer advances to positive openingBalance (dues)
    console.log("Auto-applying customer advances to positive opening balances...");
    const customersWithAdvAndOpeningDue = db.prepare(`
      SELECT id, openingBalance, 
             (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE customerId = customers.id AND (orderId IS NULL OR orderId = '')) as unapplied
      FROM customers
      WHERE openingBalance > 0
    `).all();

    for (const cust of customersWithAdvAndOpeningDue) {
      const unappliedAdv = cust.unapplied;
      if (unappliedAdv <= 0.01) continue;

      const offset = Math.min(cust.openingBalance, unappliedAdv);
      if (offset > 0.01) {
        console.log(`Auto-applying advance of ${offset} to opening balance due of ${cust.openingBalance} for customer ${cust.id}`);
        
        // 1. Deduct offset from opening balance and total balance
        db.prepare("UPDATE customers SET openingBalance = openingBalance - ?, balance = balance - ?, isSynced = 0, updatedAt = ? WHERE id = ?")
          .run(offset, offset, timestamp, cust.id);

        // 2. Deduct from advance pool by creating a negative unlinked payment
        const payIdAdv = getNextRvNumberSync();
        const payRefAdv = getNextPaymentReference(db, 'SYS');
        db.prepare(`INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference)
                    VALUES (?, ?, NULL, 'SHOP_01', ?, 'System Auto', 'SUCCESS', ?, 0, ?, ?)`).run(
          payIdAdv,
          cust.id,
          -offset,
          timestamp,
          timestamp,
          payRefAdv
        );
      }
    }

    // Clean up orphaned payments for deleted customers
    db.exec("DELETE FROM payments WHERE customerId NOT IN (SELECT id FROM customers) AND (orderId IS NULL OR orderId = '')");

    // Auto-application of customer advances and unapplied payments
    console.log("Auto-applying customer advances to oldest unpaid invoices...");
    const customersWithAdvance = db.prepare(`
      SELECT customerId, (
        IFNULL(SUM(amount), 0) - IFNULL((
          SELECT SUM(a.amountUsed)
          FROM advance_allocations a
          JOIN orders o ON a.orderId = o.id
          JOIN payments p ON a.paymentId = p.id
          WHERE p.customerId = payments.customerId AND o.status != 'Cancelled'
        ), 0)
      ) as unapplied
      FROM payments
      WHERE (orderId IS NULL OR orderId = '') AND method NOT IN ('Refund Advance')
      GROUP BY customerId
      HAVING unapplied > 0.01
    `).all();

    for (const cust of customersWithAdvance) {
      let advance = cust.unapplied;

      const unpaidOrders = db.prepare(`
        SELECT id, totalAmount, paidAmount, dueAmount, paymentStatus
        FROM orders
        WHERE customerId = ? AND paymentStatus IN ('Credit', 'Partial') AND dueAmount > 0
        ORDER BY createdAt ASC
      `).all(cust.customerId);

      for (const order of unpaidOrders) {
        if (advance <= 0.01) break; // Use up advance until mathematically zero
        
        let due = order.dueAmount;
        let paymentToApply = Math.min(advance, due);

        advance -= paymentToApply;
        let newPaid = order.paidAmount + paymentToApply;
        let newDue = Math.max(0, order.totalAmount - newPaid);
        let newStatus = newDue <= 0 ? 'Paid' : 'Partial';

        // Update the order
        db.prepare(`UPDATE orders SET paidAmount = ?, dueAmount = ?, paymentStatus = ?, isSynced = 0, updatedAt = ? WHERE id = ?`)
          .run(newPaid, newDue, newStatus, timestamp, order.id);

        // Deduct from advance pool by creating a negative unlinked payment (so customer balance remains perfectly accurate)
        const payIdAdv = getNextRvNumberSync();
        const payRefAdv = getNextPaymentReference(db, 'SYS');
        db.prepare(`INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`).run(
          payIdAdv,
          cust.customerId,
          null,
          'SHOP_01',
          -paymentToApply,
          'System Auto',
          'SUCCESS',
          timestamp,
          timestamp,
          payRefAdv
        );

        // Add a positive payment linked to the specific order (so the invoice has a proper payment history matching actualPaid)
        const payIdAuto = getNextRvNumberSync();
        const payRefAuto = getNextPaymentReference(db, 'SYS');
        db.prepare(`INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`).run(
          payIdAuto,
          cust.customerId,
          order.id,
          'SHOP_01',
          paymentToApply,
          'System Auto',
          'SUCCESS',
          timestamp,
          timestamp,
          payRefAuto
        );
        
        console.log(`Auto-applied ${paymentToApply} to order ${order.id}. New status: ${newStatus}`);
      }
    }

    // Final Recalculate customer balances after advance auto-application above may have changed dueAmount on orders
    db.exec(`UPDATE customers SET balance = (
              IFNULL(CASE WHEN openingBalance > 0 THEN openingBalance ELSE 0 END, 0) +
              (
                SELECT IFNULL(SUM(dueAmount), 0) 
                FROM orders 
                WHERE orders.customerId = customers.id AND orders.id IS NOT NULL AND orders.id != '' AND orders.status != 'Cancelled'
              ) - MAX(0, (
                IFNULL((
                  SELECT SUM(amount) 
                  FROM payments 
                  WHERE payments.customerId = customers.id AND (payments.orderId IS NULL OR payments.orderId = '')
                ), 0) - IFNULL((
                  SELECT SUM(a.amountUsed)
                  FROM advance_allocations a
                  JOIN orders o ON a.orderId = o.id
                  JOIN payments p ON a.paymentId = p.id
                  WHERE p.customerId = customers.id AND o.status != 'Cancelled'
                ), 0)
              )) - IFNULL((
                SELECT SUM(paidAmount)
                FROM deleted_orders
                WHERE deleted_orders.customerId = customers.id
                  AND deleted_orders.refundStatus = 'Refund Pending'
                  AND deleted_orders.paidAmount > 0
              ), 0) ), isSynced = 0, updatedAt = '${timestamp}'
            WHERE ABS(balance - (
              IFNULL(CASE WHEN openingBalance > 0 THEN openingBalance ELSE 0 END, 0) +
              (
                SELECT IFNULL(SUM(dueAmount), 0) 
                FROM orders 
                WHERE orders.customerId = customers.id AND orders.id IS NOT NULL AND orders.id != '' AND orders.status != 'Cancelled'
              ) - MAX(0, (
                IFNULL((
                  SELECT SUM(amount) 
                  FROM payments 
                  WHERE payments.customerId = customers.id AND (payments.orderId IS NULL OR payments.orderId = '')
                ), 0) - IFNULL((
                  SELECT SUM(a.amountUsed)
                  FROM advance_allocations a
                  JOIN orders o ON a.orderId = o.id
                  JOIN payments p ON a.paymentId = p.id
                  WHERE p.customerId = customers.id AND o.status != 'Cancelled'
                ), 0)
              )) - IFNULL((
                SELECT SUM(paidAmount)
                FROM deleted_orders
                WHERE deleted_orders.customerId = customers.id
                  AND deleted_orders.refundStatus = 'Refund Pending'
                  AND deleted_orders.paidAmount > 0
              ), 0)
            )) > 0.005;`);



    // 4. Pre-populate Categories if empty
    const catCheck = db.prepare("SELECT COUNT(*) as count FROM service_categories").get();
    db.prepare("DELETE FROM service_categories WHERE id IN ('cat-1', 'cat-2', 'cat-3', 'cat-4')").run();
    if (catCheck.count === 0) {
      console.log("Pre-populating default categories...");
      const defaultCats = [];
      const stmt = db.prepare("INSERT INTO service_categories (id, shopId, name, icon, updatedAt) VALUES (?, ?, ?, ?, ?)");
      defaultCats.forEach(cat => {
        stmt.run(cat.id, 'SHOP_01', cat.name, cat.icon, new Date().toISOString());
      });
    }

    // 5. Pre-populate Payroll Employees if empty
    const empCheck = db.prepare("SELECT COUNT(*) as count FROM payroll_employees").get();
    db.prepare("DELETE FROM payroll_employees WHERE id IN ('EMP-1', 'EMP-2', 'EMP-3', 'EMP-4')").run();
    if (empCheck.count === 0) {
      console.log("Pre-populating default payroll employees...");
      const defaultEmps = [];
      const stmt = db.prepare("INSERT INTO payroll_employees (id, name, role, baseSalary) VALUES (?, ?, ?, ?)");
      defaultEmps.forEach(emp => {
        stmt.run(emp.id, emp.name, emp.role, emp.baseSalary);
      });
    }

    // 6. Pre-populate Payment Links if empty
    const linkCheck = db.prepare("SELECT COUNT(*) as count FROM payment_links").get();
    db.prepare("DELETE FROM payment_links WHERE id IN ('LNK-1001', 'LNK-1002', 'LNK-1003')").run();
    if (linkCheck.count === 0) {
      console.log("Pre-populating default payment links...");
      const defaultLinks = [];
      const stmt = db.prepare("INSERT INTO payment_links (id, customerId, customerName, description, amount, channel, date, status, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
      defaultLinks.forEach(link => {
        stmt.run(link.id, link.customerId, link.customerName, link.description, link.amount, link.channel, link.date, link.status, link.url);
      });
    }

    // 7. Pre-populate Reconciliations if empty
    const recCheck = db.prepare("SELECT COUNT(*) as count FROM reconciliations").get();
    db.prepare("DELETE FROM reconciliations WHERE id IN ('REC-1001', 'REC-1002')").run();
    if (recCheck.count === 0) {
      console.log("Pre-populating default reconciliations...");
      const defaultRecs = [];
      const stmt = db.prepare("INSERT INTO reconciliations (id, date, cashCounted, cashExpected, status, verifiedBy) VALUES (?, ?, ?, ?, ?, ?)");
      defaultRecs.forEach(rec => {
        stmt.run(rec.id, rec.date, rec.cashCounted, rec.cashExpected, rec.status, rec.verifiedBy);
      });
    }

    // 8. Pre-populate Payroll Payments if empty
    const payCheck = db.prepare("SELECT COUNT(*) as count FROM payroll_payments").get();
    db.prepare("DELETE FROM payroll_payments WHERE id IN ('PR-1001', 'PR-1002')").run();
    if (payCheck.count === 0) {
      console.log("Pre-populating default payroll payments...");
      const defaultPayPayments = [];
      const stmt = db.prepare("INSERT INTO payroll_payments (id, month, employeeName, role, base, daysWorked, overtime, bonus, deduction, net, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      defaultPayPayments.forEach(p => {
        stmt.run(p.id, p.month, p.employeeName, p.role, p.base, p.daysWorked, p.overtime, p.bonus, p.deduction, p.net, p.status, p.date);
      });
    }

    // 9. Pre-populate Accrual Logs if empty
    const accCheck = db.prepare("SELECT COUNT(*) as count FROM accrual_logs").get();
    db.prepare("DELETE FROM accrual_logs WHERE id IN ('ACR-1001', 'ACR-1002', 'ACR-1003')").run();
    if (accCheck.count === 0) {
      console.log("Pre-populating default accrual logs...");
      const defaultAccs = [];
      const stmt = db.prepare("INSERT INTO accrual_logs (id, date, employeeName, type, monthYear, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
      defaultAccs.forEach(acc => {
        stmt.run(acc.id, acc.date, acc.employeeName, acc.type, acc.monthYear, acc.amount, acc.status);
      });
    }

    // 10. Populate default service images if null or empty
    const unmappedServices = db.prepare("SELECT id, name, category FROM services WHERE image IS NULL OR image = ''").all();
    if (unmappedServices.length > 0) {
      console.log(`Data Healer: Generating dynamic SVGs for ${unmappedServices.length} services...`);
      const updateStmt = db.prepare("UPDATE services SET image = ?, isSynced = 0, updatedAt = ? WHERE id = ?");
      const now = new Date().toISOString();
      for (const s of unmappedServices) {
        const svgDataUrl = generateServiceSVG(s.name, s.category);
        updateStmt.run(svgDataUrl, now, s.id);
      }
    }

    console.log("Data Healer completed.");
  } catch (err) {
    console.error("Data Healer failed:", err);
  }
}

function migrateLegacyAdvancePayments(db) {
  try {
    console.log("Checking for legacy advance payments to migrate...");
    
    // Find matching split payments by exact createdAt match
    const splits = db.prepare(`
      SELECT p1.id as originalId, p1.amount as originalRemainingAmount, 
             p2.id as splitId, p2.amount as splitUsedAmount, p2.orderId, p1.createdAt, p1.customerId
      FROM payments p1 
      JOIN payments p2 ON p1.createdAt = p2.createdAt AND p1.customerId = p2.customerId
      WHERE (p1.orderId IS NULL OR p1.orderId = '') 
        AND (p2.orderId IS NOT NULL AND p2.orderId != '')
    `).all();

    if (splits.length === 0) {
      console.log("No legacy advance payments need migration.");
      return;
    }

    console.log(`Found ${splits.length} legacy split payments. Beginning migration transaction...`);
    const timestamp = new Date().toISOString();

    // Perform updates inside a transaction
    db.transaction(() => {
      // 1. Create advance_allocations table and indexes if they don't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS advance_allocations (
          id TEXT PRIMARY KEY,
          paymentId TEXT,
          orderId TEXT,
          amountUsed REAL,
          date TEXT,
          isSynced INTEGER DEFAULT 0,
          updatedAt TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_advance_allocations_payment ON advance_allocations(paymentId);
        CREATE INDEX IF NOT EXISTS idx_advance_allocations_order ON advance_allocations(orderId);
      `);

      const restoredAmounts = {}; // originalId -> sum to restore
      let migratedCount = 0;

      for (const s of splits) {
        const origId = s.originalId;
        const splitId = s.splitId;
        const usedAmt = s.splitUsedAmount;
        const orderId = s.orderId;
        const createdAt = s.createdAt;

        const allocId = `ALLOC-LEGACY-${splitId}`;

        // Check if allocation already exists
        const exists = db.prepare("SELECT id FROM advance_allocations WHERE id = ?").get(allocId);
        if (exists) continue;

        // Insert allocation
        db.prepare(`
          INSERT INTO advance_allocations (id, paymentId, orderId, amountUsed, date, isSynced, updatedAt)
          VALUES (?, ?, ?, ?, ?, 0, ?)
        `).run(allocId, origId, orderId, usedAmt, createdAt, timestamp);

        // Delete split payment
        db.prepare("DELETE FROM payments WHERE id = ?").run(splitId);

        restoredAmounts[origId] = (restoredAmounts[origId] || 0) + usedAmt;
        migratedCount++;
      }

      // Update original payment amounts
      const updateStmt = db.prepare("UPDATE payments SET amount = amount + ?, isSynced = 0, updatedAt = ? WHERE id = ?");
      for (const [origId, addAmt] of Object.entries(restoredAmounts)) {
        updateStmt.run(addAmt, timestamp, origId);
      }

      console.log(`Successfully migrated ${migratedCount} split payments.`);
    })();
  } catch (err) {
    console.error("Failed to migrate legacy advance payments:", err);
  }
}

function generateServiceSVG(name, category) {
  let startColor = '#3B82F6';
  let endColor = '#1D4ED8';
  let iconPath = '';

  const catStr = String(category || '').toLowerCase();
  if (catStr === 'dry cleaning') {
    startColor = '#8B5CF6';
    endColor = '#6D28D9';
  } else if (catStr === 'alterations') {
    startColor = '#EC4899';
    endColor = '#BE185D';
  }

  const nameLower = String(name || '').toLowerCase();
  if (nameLower.includes('shirt')) {
    iconPath = `<path d="M30 25 L40 33 L45 28 L55 28 L60 33 L70 25 L75 35 L70 50 L65 50 L65 75 C65 77 63 79 61 79 L39 79 C37 79 35 77 35 75 L35 50 L30 50 L25 35 Z" fill="white" />
                <path d="M50 35 L50 75" stroke="${endColor}" stroke-width="2" stroke-dasharray="3 3" />
                <circle cx="50" cy="45" r="2" fill="white" />
                <circle cx="50" cy="55" r="2" fill="white" />
                <circle cx="50" cy="65" r="2" fill="white" />`;
  } else if (nameLower.includes('dress')) {
    iconPath = `<path d="M38 25 C38 25 45 28 50 28 C55 28 62 25 62 25 L70 75 C70 77 68 79 66 79 L34 79 C32 79 30 77 30 75 Z" fill="white" />
                <path d="M42 35 C45 38 55 38 58 35" stroke="${startColor}" stroke-width="2" fill="none" />
                <path d="M44 48 C46 51 54 51 56 48" stroke="${startColor}" stroke-width="2" fill="none" />`;
  } else if (nameLower.includes('jacket') || nameLower.includes('suit')) {
    iconPath = `<path d="M28 28 L40 22 L50 26 L60 22 L72 28 L75 48 L70 50 L70 75 C70 77 68 79 66 79 L34 79 C32 79 30 77 30 75 L30 50 L25 48 Z" fill="white" />
                <path d="M42 22 L50 35 L58 22" stroke="${startColor}" stroke-width="2" fill="none" />
                <line x1="50" y1="35" x2="50" y2="79" stroke="${endColor}" stroke-width="2" />
                <path d="M38 45 H44" stroke="${endColor}" stroke-width="2" />
                <path d="M56 45 H62" stroke="${endColor}" stroke-width="2" />`;
  } else if (nameLower.includes('pants') || nameLower.includes('trousers')) {
    iconPath = `<path d="M32 22 H68 L64 75 C64 77 62 79 60 79 H52 C50 79 49 77 48 75 L45 42 L42 75 C41 77 40 79 38 79 H30 C28 79 26 77 26 75 Z" fill="white" />
                <line x1="32" y1="30" x2="68" y2="30" stroke="${endColor}" stroke-width="2" />`;
  } else if (nameLower.includes('bedding') || nameLower.includes('blanket') || nameLower.includes('bed')) {
    iconPath = `<path d="M20 30 C20 28 22 26 24 26 H76 C78 26 80 28 80 30 V70 C80 72 78 74 76 74 H24 C22 74 20 72 20 70 Z" fill="white" opacity="0.9" />
                <path d="M25 40 H75 V68 H25 Z" fill="${startColor}" opacity="0.15" />
                <path d="M28 32 H46 V42 H28 Z" fill="${endColor}" opacity="0.75" rx="2" />
                <path d="M54 32 H72 V42 H54 Z" fill="${endColor}" opacity="0.75" rx="2" />
                <path d="M20 50 H80" stroke="${endColor}" stroke-width="3" />`;
  } else {
    iconPath = `<path d="M25 35 H75 L70 72 C70 76 66 79 62 79 H38 C34 79 30 76 30 72 Z" fill="white" />
                <ellipse cx="50" cy="35" rx="25" ry="5" fill="${endColor}" />
                <path d="M30 45 L35 70" stroke="${startColor}" stroke-width="2" stroke-linecap="round" />
                <path d="M50 45 L50 70" stroke="${startColor}" stroke-width="2" stroke-linecap="round" />
                <path d="M70 45 L65 70" stroke="${startColor}" stroke-width="2" stroke-linecap="round" />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <defs>
      <linearGradient id="grad-${name.replace(/[^a-zA-Z]/g, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${startColor};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${endColor};stop-opacity:1" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.15"/>
      </filter>
    </defs>
    <rect width="100" height="100" rx="16" fill="url(#grad-${name.replace(/[^a-zA-Z]/g, '')})" />
    <g filter="url(#shadow)">
      ${iconPath}
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getNextPaymentReference(db, paymentType) {
  try {
    const info = db.prepare("INSERT INTO payment_sequence DEFAULT VALUES").run();
    const nextId = info.lastInsertRowid;
    db.prepare("DELETE FROM payment_sequence WHERE id < ?").run(nextId);
    const paddedSeq = String(nextId).padStart(6, '0');
    let prefix = 'PAY';
    switch (paymentType) {
      case 'ADV': prefix = 'ADV'; break;
      case 'APY': prefix = 'APY'; break;
      case 'QPY': prefix = 'QPY'; break;
      case 'PAY': prefix = 'PAY'; break;
      case 'REF': prefix = 'REF'; break;
      case 'SET': prefix = 'SET'; break;
      case 'ONL': prefix = 'ONL'; break;
      case 'SYS': prefix = 'SYS'; break;
      default: prefix = 'PAY';
    }
    return `${prefix}-${paddedSeq}`;
  } catch (err) {
    console.error("Failed to generate payment reference:", err);
    throw err;
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

function closeDB() {
  if (db) {
    db.close();
    db = null;
    console.log("Database connection closed.");
  }
}

module.exports = { initDB, getDB, runDataHealer, closeDB, generateServiceSVG, getNextPaymentReference };
