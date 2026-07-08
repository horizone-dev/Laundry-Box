const { app, BrowserWindow, ipcMain, net, shell, dialog, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

// Global error handlers to log main process exceptions
process.on('uncaughtException', (err) => {
  try {
    const logPath = path.join(app.getPath('userData'), 'startup.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Uncaught Exception: ${err.stack || err}\n`);
  } catch (_) {}
});

process.on('unhandledRejection', (reason) => {
  try {
    const logPath = path.join(app.getPath('userData'), 'startup.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n`);
  } catch (_) {}
});
const { spawn } = require('child_process');
const { initDB, getDB, closeDB, generateServiceSVG } = require('./database');
const emailService = require('./emailService');
const nomodService = require('./backend/services/nomodService');

// Configuration for payment status tracking
const PAYMENT_TRACKING_CONFIG = {
  fastIntervalMs: 10000,          // Polling interval in phase 1 (10s)
  slowIntervalMs: 30000,          // Polling interval in phase 2 (30s)
  transitionThresholdMs: 120000,  // When to switch from fast to slow (2 minutes)
  maxTrackingDurationMs: 600000,  // Maximum duration to track a payment (10 minutes)
  resumeWindowMs: 2700000         // Time window for resuming pending links on startup (45 minutes)
};

// Global tracker map and logger
const activeTrackers = new Map();

function logTracker(orderId, message, level = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [payment-tracker] [${level.toUpperCase()}] [Order: ${orderId}] ${message}`);
}

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Remove default window menu bar (File, Edit, View, Window)
  mainWindow.setMenu(null);

  // Lock down navigation to local resources only
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsedUrl = new URL(url);
      const allowedHosts = ['localhost', '127.0.0.1'];
      if (parsedUrl.protocol !== 'file:' && !allowedHosts.includes(parsedUrl.hostname)) {
        event.preventDefault();
        console.warn(`Blocked unauthorized navigation to: ${url}`);
      }
    } catch (e) {
      event.preventDefault();
    }
  });

  // Safe external URL opening
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const allowedPrefixes = [
      'https://wa.me/',
      'https://api.whatsapp.com/',
      'tel:',
      'mailto:'
    ];
    const isAllowed = allowedPrefixes.some(prefix => url.startsWith(prefix));
    if (isAllowed) {
      shell.openExternal(url).catch(err => console.error("Failed to open link:", err));
    } else {
      console.warn(`Blocked attempt to open external window: ${url}`);
    }
    return { action: 'deny' };
  });

  // Log all frontend console messages to a local file for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    try {
      fs.appendFileSync(path.join(app.getPath('userData'), 'frontend_console.log'), `[LVL:${level}] ${message} (${path.basename(sourceId)}:${line})\n`);
    } catch (_) {}
  });

  // Log any page load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    try {
      fs.appendFileSync(path.join(app.getPath('userData'), 'startup.log'), `[${new Date().toISOString()}] Page Load Failed: ${errorDescription} (Code: ${errorCode}) URL: ${validatedURL}\n`);
    } catch (_) {}
  });

  // Check if we are in dev mode
  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
    mainWindow.loadURL('http://localhost:5173').catch(err => {
      console.log('Vite not ready, retrying in 2s...');
      setTimeout(() => mainWindow.loadURL('http://localhost:5173'), 2000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const isDev = !app.isPackaged;
  const scriptPath = isDev 
    ? path.join(__dirname, 'backend', 'server.js')
    : path.join(process.resourcesPath, 'backend', 'server.js');

  console.log('Starting backend process...');
  backendProcess = spawn(process.execPath, [scriptPath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: '3000' }
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend process:', err);
  });
}

async function waitForServer(url, timeout = 10000) {
  const start = Date.now();
  console.log("Checking server health...");
  
  while (true) {
    try {
      const response = await new Promise((resolve, reject) => {
        const request = net.request(url);
        request.on('response', (res) => {
          resolve(res.statusCode === 200);
        });
        request.on('error', (err) => {
          reject(err);
        });
        request.end();
      });
      
      if (response) {
        console.log("Server is ready!");
        return true;
      }
    } catch (err) {
      // Ignore errors and retry
    }

    if (Date.now() - start > timeout) {
      console.error("Server ready check timed out.");
      return false;
    }

    await new Promise(r => setTimeout(r, 500));
  }
}

app.whenReady().then(async () => {
  console.log("Starting system...");
  initDB(app.getPath('userData'));
  emailService.initScheduler();
  
  // Seed initial data if tables are empty
  const db = getDB();
  const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
  if (serviceCount === 0) {
    console.log("Seeding initial POS data...");
    const shopId = 'SHOP_01';
    const now = new Date().toISOString();
    
    const insertService = db.prepare('INSERT INTO services (id, shopId, name, price, icon, category, image, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insertService.run('1', shopId, "Men's Shirt", 3.50, 'Shirt', 'Laundry', generateServiceSVG("Men's Shirt", 'Laundry'), now);
    insertService.run('2', shopId, "Women's Dress", 8.00, 'Heart', 'Laundry', generateServiceSVG("Women's Dress", 'Laundry'), now);
    insertService.run('3', shopId, "Suit Jacket", 12.50, 'Layers', 'Dry Cleaning', generateServiceSVG("Suit Jacket", 'Dry Cleaning'), now);
    insertService.run('4', shopId, "Pants", 5.00, 'Shirt', 'Laundry', generateServiceSVG("Pants", 'Laundry'), now);
    insertService.run('5', shopId, "Bedding", 15.00, 'Bed', 'Laundry', generateServiceSVG("Bedding", 'Laundry'), now);

    const insertType = db.prepare('INSERT INTO service_types (id, shopId, name, price, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
    insertType.run('wf', shopId, 'Wash & Fold', 4.50, 'Droplet', now);
    insertType.run('dc', shopId, 'Dry Clean', 7.25, 'Wind', now);
    insertType.run('po', shopId, 'Pressing Only', 3.00, 'Layers', now);

    const insertAddon = db.prepare('INSERT INTO addons (id, shopId, name, price, icon, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
    insertAddon.run('sd', shopId, 'Scented Detergent', 0.50, 'Droplet', now);
    insertAddon.run('fs', shopId, 'Fabric Softener', 0.50, 'Sparkles', now);
    insertAddon.run('ex', shopId, 'Express 4h', 5.00, 'Zap', now);

    const insertCategory = db.prepare('INSERT INTO service_categories (id, shopId, name, icon, updatedAt) VALUES (?, ?, ?, ?, ?)');
    insertCategory.run('cat1', shopId, 'Laundry', 'Droplet', now);
    insertCategory.run('cat2', shopId, 'Dry Cleaning', 'Wind', now);
    insertCategory.run('cat3', shopId, 'Alterations', 'Scissors', now);
    insertCategory.run('cat4', shopId, 'Premium', 'Sparkles', now);
  }

  // App open -> server auto start
  startBackend();
  
  // -> server ready check
  await waitForServer('http://127.0.0.1:3000/api/health');
  
  // -> then UI load
  createWindow();

  // Resume tracking for recent pending payments and show reminder
  resumeRecentPendingTrackers();
  showPendingPaymentsReminder();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  console.log('[payment-tracker] [INFO] App quit. Clearing all active payment status trackers.');
  for (const [orderId, tracker] of activeTrackers.entries()) {
    clearTimeout(tracker.timeoutId);
  }
  activeTrackers.clear();

  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('will-quit', () => {
  console.log('[payment-tracker] [INFO] App will quit. Clearing all active payment status trackers.');
  for (const [orderId, tracker] of activeTrackers.entries()) {
    clearTimeout(tracker.timeoutId);
  }
  activeTrackers.clear();
});

// Offline/online handling
ipcMain.handle('check-connection', () => {
  return net.isOnline();
});

ipcMain.on('request-refocus', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.blur();
    win.focus();
  }
});

// DB IPC Handlers
ipcMain.handle('run-data-healer', () => {
  try {
    const { runDataHealer, getDB } = require('./database');
    runDataHealer(getDB());
    return { success: true };
  } catch (err) {
    console.error('Failed to run healer:', err);
    return { success: false, error: err.message };
  }
});

const activeOverrides = {}; // key: customerId, value: { timestamp: number, amount: number }

function logOverrideEvent(db, { customerId, customerName, orderId, userId, managerId, creditLimit, outstandingBalance, orderAmount, exceededAmount, actionType }) {
  const logId = `AUDIT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = new Date().toISOString();
  try {
    db.prepare(`
      INSERT INTO credit_override_logs 
      (id, customerId, customerName, orderId, userId, managerId, creditLimit, outstandingBalance, orderAmount, exceededAmount, actionType, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(logId, customerId, customerName, orderId || null, userId, managerId || null, creditLimit, outstandingBalance, orderAmount, exceededAmount, actionType, timestamp);
    console.log(`Credit override logged: ${actionType} for customer ${customerId}`);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

function getParamValue(setClause, paramName, params) {
  const parts = setClause.split(',').map(p => p.trim());
  let paramIndex = 0;
  for (const part of parts) {
    const match = part.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
    if (match) {
      const colName = match[1].toLowerCase();
      const valExpr = match[2];
      const isPlaceholder = valExpr.includes('?');
      if (colName === paramName.toLowerCase()) {
        if (isPlaceholder) {
          return params[paramIndex];
        } else {
          return parseFloat(valExpr) || valExpr;
        }
      }
      if (isPlaceholder) {
        paramIndex++;
      }
    }
  }
  return null;
}

function checkCustomerCreditLimitRules(db, customerId, amountToAdd) {
  const shopResult = db.prepare('SELECT settings FROM shops LIMIT 1').get();
  const settings = shopResult && shopResult.settings ? JSON.parse(shopResult.settings) : {};

  const enableCreditLimitProtection = settings.enableCreditLimitProtection ?? true;
  const enableManagerOverride = settings.enableManagerOverride ?? true;

  if (!enableCreditLimitProtection) {
    return null;
  }

  const customer = db.prepare('SELECT name, balance, creditLimit FROM customers WHERE id = ?').get(customerId);
  if (!customer) {
    return null;
  }

  const currentOutstanding = customer.balance || 0;
  const creditLimit = customer.creditLimit !== undefined && customer.creditLimit !== null && customer.creditLimit !== 0
    ? customer.creditLimit 
    : (settings.defaultCreditLimit ?? 500);
  const newOutstanding = currentOutstanding + amountToAdd;

  // Block if ALREADY at/over limit OR if new order would exceed limit
  if (currentOutstanding >= creditLimit || newOutstanding > creditLimit) {
    if (enableManagerOverride) {
      const override = activeOverrides[customerId];
      if (override && (Date.now() - override.timestamp < 1000 * 15) && Math.abs(override.amount - amountToAdd) < 0.05) {
        return null; // Allowed!
      } else {
        return 'CREDIT_LIMIT_EXCEEDED';
      }
    } else {
      return `Credit limit exceeded. Credit limit protection is enabled. Transaction blocked.`;
    }
  }

  return null;
}

function validateQueryCreditLimit(db, query, params) {
  const cleanQuery = query.replace(/\s+/g, ' ').trim();
  const queryUpper = cleanQuery.toUpperCase();

  if (queryUpper.startsWith('INSERT INTO ORDERS')) {
    const columnsMatch = cleanQuery.match(/\(([^)]+)\)\s+VALUES/i);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(',').map(c => c.trim().toLowerCase());
      const customerIdIdx = columns.indexOf('customerid');
      const dueAmountIdx = columns.indexOf('dueamount');

      if (customerIdIdx !== -1 && dueAmountIdx !== -1) {
        const customerId = params[customerIdIdx];
        const dueAmount = parseFloat(params[dueAmountIdx]) || 0;

        if (customerId && customerId !== 'Walk-in' && dueAmount > 0) {
          const ruleErr = checkCustomerCreditLimitRules(db, customerId, dueAmount);
          if (ruleErr) {
            throw new Error(ruleErr);
          }
        }
      }
    }
  }
  else if (queryUpper.startsWith('UPDATE ORDERS')) {
    const setMatch = cleanQuery.match(/UPDATE\s+orders\s+SET\s+(.+?)(?:\s+WHERE|$)/i);
    if (setMatch) {
      const setClause = setMatch[1];
      const dueAmount = getParamValue(setClause, 'dueAmount', params);
      
      if (dueAmount !== null) {
        const whereMatch = cleanQuery.match(/WHERE\s+id\s*=\s*(.+)$/i);
        let orderId = null;
        if (whereMatch) {
          const expr = whereMatch[1].trim();
          if (expr === '?') {
            orderId = params[params.length - 1];
          } else {
            orderId = expr.replace(/['"]/g, '');
          }
        }

        if (orderId) {
          const order = db.prepare('SELECT customerId, dueAmount FROM orders WHERE id = ?').get(orderId);
          if (order && order.customerId && order.customerId !== 'Walk-in') {
            const oldDueAmount = order.dueAmount || 0;
            const netIncrease = dueAmount - oldDueAmount;
            if (netIncrease > 0) {
              const ruleErr = checkCustomerCreditLimitRules(db, order.customerId, netIncrease);
              if (ruleErr) {
                throw new Error(ruleErr);
              }
            }
          }
        }
      }
    }
  }
  else if (queryUpper.startsWith('UPDATE CUSTOMERS') && queryUpper.includes('SET BALANCE')) {
    const whereMatch = cleanQuery.match(/WHERE\s+id\s*=\s*(.+)$/i);
    let customerId = null;
    if (whereMatch) {
      const expr = whereMatch[1].trim();
      if (expr === '?') {
        customerId = params[params.length - 1];
      } else {
        customerId = expr.replace(/['"]/g, '');
      }
    }

    if (customerId && customerId !== 'Walk-in') {
      const isSubtraction = cleanQuery.toLowerCase().includes('balance -');
      const netIncrease = isSubtraction ? -parseFloat(params[0]) : parseFloat(params[0]) || 0;
      if (netIncrease > 0) {
        const ruleErr = checkCustomerCreditLimitRules(db, customerId, netIncrease);
        if (ruleErr) {
          throw new Error(ruleErr);
        }
      }
    }
  }
}

ipcMain.handle('verify-manager-pin', async (event, { pin, customerId, customerName, orderId, creditLimit, outstandingBalance, orderAmount, exceededAmount, userId }) => {
  try {
    const db = getDB();
    const shopResult = db.prepare('SELECT settings FROM shops LIMIT 1').get();
    const settings = shopResult && shopResult.settings ? JSON.parse(shopResult.settings) : {};
    
    const correctPin = settings.orderDeletePin || '0000';
    let pinOwner = null;
    if (String(pin) === String(correctPin)) {
      pinOwner = 'Manager (PIN)';
    } else {
      // Fallback to checking active manager PINs on the backend
      try {
        const response = await fetch('http://localhost:3000/api/auth/verify-manager-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.valid) {
            pinOwner = `Manager: ${data.managerName}`;
          }
        }
      } catch (apiErr) {
        console.warn('Backend PIN check failed or offline:', apiErr.message);
      }
    }

    if (pinOwner) {
      activeOverrides[customerId] = {
        timestamp: Date.now(),
        amount: orderAmount
      };
      
      logOverrideEvent(db, {
        customerId,
        customerName,
        orderId,
        userId,
        managerId: pinOwner,
        creditLimit,
        outstandingBalance,
        orderAmount,
        exceededAmount,
        actionType: 'APPROVED'
      });
      
      return { success: true, message: 'Manager Override Approved' };
    } else {
      logOverrideEvent(db, {
        customerId,
        customerName,
        orderId,
        userId,
        managerId: null,
        creditLimit,
        outstandingBalance,
        orderAmount,
        exceededAmount,
        actionType: 'FAILED_PIN'
      });
      
      return { success: false, error: 'Incorrect PIN! Access Denied.' };
    }
  } catch (err) {
    console.error('verify-manager-pin error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('log-override-rejection', (event, { customerId, customerName, orderId, creditLimit, outstandingBalance, orderAmount, exceededAmount, userId, actionType }) => {
  try {
    const db = getDB();
    logOverrideEvent(db, {
      customerId,
      customerName,
      orderId,
      userId,
      managerId: null,
      creditLimit,
      outstandingBalance,
      orderAmount,
      exceededAmount,
      actionType: actionType || 'REJECTED'
    });
    return { success: true };
  } catch (err) {
    console.error('log-override-rejection error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db-query', (event, { query, params }) => {
  try {
    const db = getDB();
    
    // Check credit limit rules
    validateQueryCreditLimit(db, query, params || []);

    const stmt = db.prepare(query);
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      return { success: true, data: stmt.all(params || []) };
    } else {
      const info = stmt.run(params || []);
      return { success: true, data: info };
    }
  } catch (err) {
    console.error('DB Error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('create-nomod-checkout', async (event, { amount, currency, customer, orderId, userRole }) => {
  try {
    const db = getDB();
    const shopResult = db.prepare('SELECT settings FROM shops LIMIT 1').get();
    const settings = shopResult && shopResult.settings ? JSON.parse(shopResult.settings) : {};

    const apiKey = settings.nomodApiKey;
    const linkId = `LNK-${Date.now().toString().slice(-4)}`;

    // If no API key configured or it is a placeholder/empty, return a sandbox demo link without calling the real API
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('placeholder') || apiKey.length < 10) {
      const sandboxUrl = `https://demo.nomod.com/pay?ref=${linkId}&amount=${parseFloat(amount).toFixed(2)}&currency=${currency || settings.nomodCurrency || 'AED'}`;
      return { success: true, data: { url: sandboxUrl, id: linkId }, linkId };
    }

    const response = await fetch('https://api.nomod.com/v1/checkout', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reference_id: linkId,
        amount: parseFloat(amount).toFixed(2),
        currency: currency || settings.nomodCurrency || 'AED',
        success_url: settings.nomodSuccessUrl || 'https://pay.lundry.ae/success',
        failure_url: settings.nomodFailureUrl || 'https://pay.lundry.ae/failure',
        cancelled_url: settings.nomodFailureUrl || 'https://pay.lundry.ae/cancelled',
        customer: {
          first_name: (customer?.name || 'Customer').split(' ')[0],
          last_name: (customer?.name || 'Customer').split(' ').slice(1).join(' ') || 'Laundry',
          phone_number: customer?.phone || ''
        },
        metadata: {
          orderId: orderId,
          description: `Payment for Order #${orderId}`
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nomod API response error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { success: true, data, linkId };
  } catch (err) {
    console.error("create-nomod-checkout failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('retrieve-nomod-checkout-status', async (event, { checkoutId, userRole }) => {
  try {
    const db = getDB();
    const shopResult = db.prepare('SELECT settings FROM shops LIMIT 1').get();
    const settings = shopResult && shopResult.settings ? JSON.parse(shopResult.settings) : {};

    // Enforce role permission rules on backend
    if (userRole === 'staff') {
      throw new Error("Staff are unauthorized to perform Nomod actions.");
    }

    const apiKey = settings.nomodApiKey;
    if (!apiKey) {
      throw new Error("Nomod API key is missing. Please configure it in Settings.");
    }

    const response = await fetch(`https://api.nomod.com/v1/checkout/${checkoutId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nomod Status API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    console.error("retrieve-nomod-checkout-status failed:", err);
    return { success: false, error: err.message };
  }
});

// Payment status tracking logic

async function checkPaymentStatusInternal(orderId, checkoutId) {
  try {
    const db = getDB();
    const shopResult = db.prepare('SELECT settings FROM shops LIMIT 1').get();
    const settings = shopResult && shopResult.settings ? JSON.parse(shopResult.settings) : {};
    const apiKey = settings.nomodApiKey;

    logTracker(orderId, `Requesting checkout status from Nomod service for checkoutId: ${checkoutId}`, 'debug');
    const res = await nomodService.getCheckoutStatus(checkoutId, apiKey);
    
    if (!res.success) {
      logTracker(orderId, `Nomod checkout status request failed: ${res.error} (type: ${res.errorType || 'unknown'})`, 'warn');
      
      if (res.errorType === 'unauthorized') {
        logTracker(orderId, `Stopping tracker due to 401 Unauthorized credentials error.`, 'error');
        return { isFinal: true, stopReason: 'unauthorized' };
      }
      if (res.errorType === 'notFound') {
        logTracker(orderId, `Checkout not found (404). Stopping tracker and marking status as Failed.`, 'error');
        const nowStr = new Date().toISOString();
        
        const dbTransaction = db.transaction(() => {
          if (orderId.startsWith('SETTLE-')) {
            db.prepare(`UPDATE payment_links SET status = 'Failed' WHERE checkoutId = ?`).run(checkoutId);
          } else {
            db.prepare(`UPDATE orders SET nomodPaymentStatus = 'Failed', isSynced = 0, updatedAt = ? WHERE id = ?`).run(nowStr, orderId);
            db.prepare(`UPDATE payment_links SET status = 'Failed' WHERE checkoutId = ?`).run(checkoutId);
          }
        });
        dbTransaction();
        
        if (mainWindow && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('payment-status-changed', { orderId, checkoutId, status: 'Failed' });
        }
        return { isFinal: true, stopReason: 'notFound' };
      }
      
      return { isFinal: false, stopReason: 'network_error' };
    }

    const { status, paidAt, transactionReference, rawData } = res;
    const isFinal = ['Paid', 'Failed', 'Expired', 'Cancelled'].includes(status);
    const nowStr = new Date().toISOString();

    if (orderId && orderId.startsWith('SETTLE-')) {
      const linkRecord = db.prepare('SELECT status, customerId, customerName, amount FROM payment_links WHERE checkoutId = ?').get(checkoutId);
      const currentNomodStatus = linkRecord ? linkRecord.status : 'Pending';

      if (currentNomodStatus === 'Paid') {
        logTracker(orderId, `Settlement payment already marked as Paid. Skipping.`, 'info');
        return { isFinal: true, stopReason: 'already_paid' };
      }

      if (status !== currentNomodStatus) {
        logTracker(orderId, `Status changed for settlement link: ${currentNomodStatus} -> ${status}`, 'info');

        if (status === 'Paid') {
          const dbTransaction = db.transaction(() => {
            db.prepare(`
              UPDATE payment_links 
              SET status = 'Paid', 
                  paidAt = ?, 
                  transactionReference = ? 
              WHERE checkoutId = ?
            `).run(paidAt || nowStr, transactionReference || '', checkoutId);

            if (linkRecord) {
              const customerId = linkRecord.customerId;
              const customerName = linkRecord.customerName || 'Walk-in Customer';
              const amount = linkRecord.amount;

              const bills = db.prepare(`
                SELECT id, totalAmount, paidAmount, dueAmount 
                FROM orders 
                WHERE customerId = ? 
                  AND paymentStatus IN ('Pending', 'Partial') 
                  AND status != 'Cancelled' 
                ORDER BY createdAt ASC
              `).all(customerId);

              let remaining = amount;
              for (const bill of bills) {
                if (remaining <= 0) break;
                const due = bill.dueAmount ?? (bill.totalAmount - (bill.paidAmount || 0));
                if (due <= 0) continue;

                const allocate = Math.min(remaining, due);
                const newPaid = (bill.paidAmount || 0) + allocate;
                const newDue = due - allocate;
                const newStatus = newDue <= 0 ? 'Paid' : 'Partial';

                db.prepare(`
                  UPDATE orders 
                  SET paidAmount = ?, 
                      dueAmount = ?, 
                      paymentStatus = ?, 
                      isSynced = 0, 
                      updatedAt = ? 
                  WHERE id = ?
                `).run(newPaid, newDue, newStatus, nowStr, bill.id);

                const payId = `PAY-NOMOD-SETTLE-${bill.id}-${checkoutId}`;
                const exists = db.prepare('SELECT COUNT(*) as count FROM payments WHERE id = ?').get(payId).count;
                if (exists === 0) {
                  db.prepare(`
                    INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
                    VALUES (?, ?, ?, ?, ?, 'Nomod', 'SUCCESS', ?, 0, ?)
                  `).run(payId, customerId, bill.id, 'SHOP_01', allocate, paidAt || nowStr, nowStr);
                } else {
                  logTracker(orderId, `Duplicate payment record check: payment ${payId} already exists. Skipping insert.`, 'warn');
                }

                remaining -= allocate;
              }

              if (remaining > 0) {
                const advPayId = `PAY-ADV-NOMOD-${checkoutId}`;
                const exists = db.prepare('SELECT COUNT(*) as count FROM payments WHERE id = ?').get(advPayId).count;
                if (exists === 0) {
                  db.prepare(`
                    INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
                    VALUES (?, ?, ?, ?, ?, 'Nomod', 'SUCCESS', ?, 0, ?)
                  `).run(advPayId, customerId, null, 'SHOP_01', remaining, paidAt || nowStr, nowStr);
                } else {
                  logTracker(orderId, `Duplicate payment record check: advance payment ${advPayId} already exists. Skipping insert.`, 'warn');
                }
              }

              db.prepare(`
                UPDATE customers 
                SET balance = balance - ?, 
                    isSynced = 0, 
                    updatedAt = ? 
                WHERE id = ?
              `).run(amount, nowStr, customerId);

              const txnId = `TXN-NOMOD-SETTLE-${checkoutId}`;
              const txnExists = db.prepare('SELECT COUNT(*) as count FROM account_transactions WHERE id = ?').get(txnId).count;
              if (txnExists === 0) {
                const _nowT = new Date(paidAt || nowStr);
                const txnTimestamp = `${_nowT.getFullYear()}-${String(_nowT.getMonth() + 1).padStart(2, '0')}-${String(_nowT.getDate()).padStart(2, '0')} ${String(_nowT.getHours()).padStart(2, '0')}:${String(_nowT.getMinutes()).padStart(2, '0')}:${String(_nowT.getSeconds()).padStart(2, '0')}`;
                
                db.prepare(`
                  INSERT INTO account_transactions 
                  (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
                  VALUES (?, 'SHOP_01', 'GATEWAY', 'INCOME', 'Sales Settlement', ?, ?, ?, 0, ?, 'CreditCard', NULL)
                `).run(
                  txnId,
                  amount,
                  `Settlement for Customer ${customerName} via Nomod`,
                  txnTimestamp,
                  nowStr
                );
              }
            }
          });

          try {
            dbTransaction();
            logTracker(orderId, `Database transaction succeeded for paid settlement.`, 'info');
          } catch (err) {
            logTracker(orderId, `Database transaction failed: ${err.message}. Rolled back.`, 'error');
            throw err;
          }

          try {
            const { runDataHealer } = require('./database');
            runDataHealer(db);
            logTracker(orderId, `Reconciliation runDataHealer successfully executed.`, 'info');
          } catch (healErr) {
            logTracker(orderId, `Healer run failed: ${healErr.message}`, 'error');
          }
        } else {
          db.prepare(`UPDATE payment_links SET status = ? WHERE checkoutId = ?`).run(status, checkoutId);
        }

        const customerName = linkRecord ? linkRecord.customerName : 'Customer';
        const amount = linkRecord ? linkRecord.amount : 0;

        if (status === 'Paid') {
          logTracker(orderId, `Displaying native OS success notification for settlement of customer ${customerName}`, 'info');
          const { Notification } = require('electron');
          if (Notification.isSupported()) {
            new Notification({
              title: '✅ Payment Received Successfully',
              body: `Customer: ${customerName}\nInvoice: ${orderId}\nAmount: AED ${amount.toFixed(2)}`
            }).show();
          }
        }

        if (mainWindow && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('payment-status-changed', {
            orderId,
            checkoutId,
            status,
            customerId: linkRecord ? linkRecord.customerId : 'all',
            customerName,
            amount,
            rawData
          });
        }
      }
    } else {
      const order = db.prepare('SELECT nomodPaymentStatus, totalAmount, customerId, shopId, paymentStatus FROM orders WHERE id = ?').get(orderId);
      if (!order) {
        logTracker(orderId, `Order not found in database.`, 'warn');
        return { isFinal: true, stopReason: 'order_missing' };
      }

      const currentNomodStatus = order.nomodPaymentStatus;

      if (order.paymentStatus === 'Paid') {
        logTracker(orderId, `Order is already marked as Paid. Skipping.`, 'info');
        return { isFinal: true, stopReason: 'already_paid' };
      }

      if (status !== currentNomodStatus) {
        logTracker(orderId, `Status changed: ${currentNomodStatus} -> ${status}`, 'info');

        if (status === 'Paid') {
          const dbTransaction = db.transaction(() => {
            db.prepare(`
              UPDATE orders 
              SET paymentStatus = 'Paid', 
                  paidAmount = totalAmount, 
                  dueAmount = 0, 
                  paymentMethod = 'Nomod', 
                  paidAt = ?, 
                  nomodPaymentStatus = 'Paid', 
                  nomodCheckoutId = ?, 
                  isSynced = 0, 
                  updatedAt = ? 
              WHERE id = ?
            `).run(paidAt || nowStr, checkoutId, nowStr, orderId);

            db.prepare(`
              UPDATE payment_links 
              SET status = 'Paid', 
                  paidAt = ?, 
                  transactionReference = ? 
              WHERE checkoutId = ?
            `).run(paidAt || nowStr, transactionReference || '', checkoutId);

            const payId = `PAY-NOMOD-${checkoutId}`;
            const exists = db.prepare('SELECT COUNT(*) as count FROM payments WHERE id = ?').get(payId).count;
            if (exists === 0) {
              db.prepare(`
                INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt) 
                VALUES (?, ?, ?, ?, ?, 'Nomod', 'SUCCESS', ?, 0, ?)
              `).run(payId, order.customerId || 'Walk-in', orderId, order.shopId || 'SHOP_01', order.totalAmount, paidAt || nowStr, nowStr);
            } else {
              logTracker(orderId, `Duplicate payment record check: payment ${payId} already exists. Skipping insert.`, 'warn');
            }

            const txnId = `TXN-NOMOD-${checkoutId}`;
            const txnExists = db.prepare('SELECT COUNT(*) as count FROM account_transactions WHERE id = ?').get(txnId).count;
            if (txnExists === 0) {
              const _nowT = new Date(paidAt || nowStr);
              const txnTimestamp = `${_nowT.getFullYear()}-${String(_nowT.getMonth() + 1).padStart(2, '0')}-${String(_nowT.getDate()).padStart(2, '0')} ${String(_nowT.getHours()).padStart(2, '0')}:${String(_nowT.getMinutes()).padStart(2, '0')}:${String(_nowT.getSeconds()).padStart(2, '0')}`;
              
              db.prepare(`
                INSERT INTO account_transactions 
                (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId) 
                VALUES (?, 'SHOP_01', 'GATEWAY', 'INCOME', 'Sales', ?, ?, ?, 0, ?, 'CreditCard', NULL)
              `).run(
                txnId,
                order.totalAmount,
                `Payment for Order ${orderId} via Nomod`,
                txnTimestamp,
                nowStr
              );
            }
          });

          try {
            dbTransaction();
            logTracker(orderId, `Database transaction succeeded for paid order.`, 'info');
          } catch (err) {
            logTracker(orderId, `Database transaction failed: ${err.message}. Rolled back.`, 'error');
            throw err;
          }

          try {
            const { runDataHealer } = require('./database');
            runDataHealer(db);
            logTracker(orderId, `Reconciliation runDataHealer successfully executed.`, 'info');
          } catch (healErr) {
            logTracker(orderId, `Healer run failed: ${healErr.message}`, 'error');
          }
        } else {
          db.prepare(`
            UPDATE orders 
            SET nomodPaymentStatus = ?, 
                isSynced = 0, 
                updatedAt = ? 
            WHERE id = ?
          `).run(status, nowStr, orderId);

          db.prepare(`
            UPDATE payment_links 
            SET status = ? 
            WHERE checkoutId = ?
          `).run(status, checkoutId);
        }

        const customerNameResult = db.prepare('SELECT name FROM customers WHERE id = ?').get(order.customerId);
        const customerName = customerNameResult ? customerNameResult.name : 'Customer';
        const amount = order.totalAmount || 0;

        if (status === 'Paid') {
          logTracker(orderId, `Displaying native OS success notification for order ${orderId}`, 'info');
          const { Notification } = require('electron');
          if (Notification.isSupported()) {
            new Notification({
              title: '✅ Payment Received Successfully',
              body: `Customer: ${customerName}\nInvoice: ${orderId}\nAmount: AED ${amount.toFixed(2)}`
            }).show();
          }
        }

        if (mainWindow && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('payment-status-changed', {
            orderId,
            checkoutId,
            status,
            customerName,
            amount,
            rawData
          });
        }
      }
    }

    return { isFinal, stopReason: isFinal ? 'final_status' : null };
  } catch (err) {
    logTracker(orderId, `Failed checking status: ${err.message}`, 'error');
    return { isFinal: false, stopReason: 'exception' };
  }
}

function startPaymentTrackingInternal(orderId, checkoutId) {
  if (!checkoutId) return;

  if (activeTrackers.has(orderId)) {
    logTracker(orderId, `Resetting tracker for order ${orderId}`, 'info');
    clearTimeout(activeTrackers.get(orderId).timeoutId);
  }

  logTracker(orderId, `Starting status tracking for checkoutId ${checkoutId}`, 'info');
  const startTime = Date.now();

  const poll = async () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > PAYMENT_TRACKING_CONFIG.maxTrackingDurationMs) {
      logTracker(orderId, `Stopping polling: reached maximum tracking duration of ${PAYMENT_TRACKING_CONFIG.maxTrackingDurationMs / 60000} mins.`, 'info');
      activeTrackers.delete(orderId);
      return;
    }

    let interval = PAYMENT_TRACKING_CONFIG.slowIntervalMs;
    if (elapsed <= PAYMENT_TRACKING_CONFIG.transitionThresholdMs) {
      interval = PAYMENT_TRACKING_CONFIG.fastIntervalMs;
    }

    try {
      const { isFinal, stopReason } = await checkPaymentStatusInternal(orderId, checkoutId);
      if (isFinal) {
        logTracker(orderId, `Stop polling: final status achieved or stop signal received (${stopReason}).`, 'info');
        activeTrackers.delete(orderId);
        return;
      }
    } catch (err) {
      logTracker(orderId, `Polling check error: ${err.message}. Retrying on cycle.`, 'error');
    }

    logTracker(orderId, `Scheduling next poll in ${interval / 1000} seconds...`, 'debug');
    const timeoutId = setTimeout(poll, interval);
    activeTrackers.set(orderId, { timeoutId, startTime, checkoutId });
  };

  poll();
}

function stopPaymentTrackingInternal(orderId) {
  if (activeTrackers.has(orderId)) {
    logTracker(orderId, `Stopping tracking for order ${orderId}`, 'info');
    clearTimeout(activeTrackers.get(orderId).timeoutId);
    activeTrackers.delete(orderId);
  }
}

function resumeRecentPendingTrackers() {
  try {
    const db = getDB();
    const resumeThresholdTime = new Date(Date.now() - PAYMENT_TRACKING_CONFIG.resumeWindowMs).toISOString();
    const recentPending = db.prepare(`
      SELECT id as orderId, nomodCheckoutId as checkoutId 
      FROM orders 
      WHERE nomodPaymentStatus = 'Pending' 
        AND nomodCheckoutId IS NOT NULL 
        AND nomodCheckoutId != ''
        AND createdAt >= ?
    `).all(resumeThresholdTime);

    console.log(`[payment-tracker] [INFO] Resuming tracking for ${recentPending.length} pending checkouts from the last ${PAYMENT_TRACKING_CONFIG.resumeWindowMs / 60000} mins.`);
    for (const item of recentPending) {
      startPaymentTrackingInternal(item.orderId, item.checkoutId);
    }
  } catch (err) {
    console.error("[payment-tracker] [ERROR] Failed to resume recent pending trackers:", err);
  }
}

ipcMain.on('start-payment-tracking', (event, { orderId, checkoutId }) => {
  startPaymentTrackingInternal(orderId, checkoutId);
});

ipcMain.on('stop-payment-tracking', (event, { orderId }) => {
  stopPaymentTrackingInternal(orderId);
});

ipcMain.handle('check-payment-status-now', async (event, { orderId, checkoutId }) => {
  try {
    const { isFinal, stopReason } = await checkPaymentStatusInternal(orderId, checkoutId);
    if (isFinal) {
      stopPaymentTrackingInternal(orderId);
    }
    const db = getDB();
    if (orderId.startsWith('SETTLE-')) {
      const link = db.prepare('SELECT status FROM payment_links WHERE checkoutId = ?').get(checkoutId);
      return { success: true, status: link ? link.status : 'Pending' };
    } else {
      const order = db.prepare('SELECT nomodPaymentStatus FROM orders WHERE id = ?').get(orderId);
      return { success: true, status: order ? order.nomodPaymentStatus : 'Pending' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('log-audit-event', async (event, { eventName, details, userId, userRole }) => {
  try {
    const db = getDB();
    const logId = `AUDIT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = new Date().toISOString();
    const device = process.platform + ' (' + process.arch + ')';

    db.prepare(`
      INSERT INTO audit_logs (id, event, details, userId, userRole, timestamp, device)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(logId, eventName, details || '', userId || 'System', userRole || 'System', timestamp, device);

    return { success: true };
  } catch (err) {
    console.error("log-audit-event failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Native PDF generation via Electron (properly renders Arabic/RTL text)
ipcMain.handle('print-to-pdf', async (event, options) => {
  let printWin = null;
  let tmpPath = '';
  try {
    const { filename = 'Invoice.pdf', html = '', css = '' } = options || {};

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Invoice as PDF',
      defaultPath: filename,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    // Build a standalone HTML document with all styles embedded
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background: white;
      color: #1E293B;
    }
    ${css}

    /* Print Override Fixes to prevent blank/invisible pages */
    @media print {
      html, body, body * {
        visibility: visible !important;
      }
      /* Keep specific elements hidden */
      .topBar,
      .footerActions,
      .editModeBar,
      .addItemRowBtn,
      button,
      [data-noprint="true"],
      [data-noprint="true"] * {
        visibility: hidden !important;
        display: none !important;
      }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

    // Write to a temp file
    tmpPath = path.join(app.getPath('temp'), `invoice_print_${Date.now()}.html`);
    console.log("Printing HTML (first 1000 chars):", fullHtml.substring(0, 1000));
    fs.writeFileSync(tmpPath, fullHtml, 'utf8');

    // Open a hidden BrowserWindow just for printing
    printWin = new BrowserWindow({
      width: 600,
      height: 900,
      show: false,
      webPreferences: { 
        nodeIntegration: false, 
        contextIsolation: true,
        paintWhenInitiallyHidden: true
      }
    });

    // Logging handler for loading failures
    printWin.webContents.on('did-fail-load', (e, errorCode, errorDescription, validatedURL) => {
      console.error(`Print Window failed to load: ${errorDescription} (Error Code: ${errorCode}), URL: ${validatedURL}`);
    });

    // Logging handler for console messages (detect missing fonts, bad resource links, etc.)
    printWin.webContents.on('console-message', (e, level, message, line, sourceId) => {
      const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
      console.log(`[Print Window Console] [${levels[level] || 'LOG'}] ${message} (Line: ${line}, Source: ${sourceId})`);
    });

    // Load the temp file and wait for load completion
    await printWin.loadFile(tmpPath);

    // Wait for all resources (images, fonts, stylesheets) to load fully in DOM
    try {
      await Promise.race([
        printWin.webContents.executeJavaScript(`
          new Promise((resolve) => {
            const checkResources = () => {
              const imgs = Array.from(document.querySelectorAll('img'));
              const imgPromises = imgs.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(r => {
                  img.onload = r;
                  img.onerror = (e) => {
                    console.error('Print Window: Failed to load image resource:', img.src);
                    r();
                  };
                });
              });

              const fontsPromise = document.fonts ? document.fonts.ready : Promise.resolve();

              Promise.all([...imgPromises, fontsPromise])
                .then(() => resolve(true))
                .catch((err) => {
                  console.error('Print Window: Error loading fonts/images:', err);
                  resolve(false);
                });
            };

            if (document.readyState === 'complete' || document.readyState === 'interactive') {
              checkResources();
            } else {
              window.addEventListener('DOMContentLoaded', checkResources);
            }
          });
        `),
        new Promise(resolve => setTimeout(resolve, 3000)) // Safety timeout threshold of 3 seconds
      ]);
    } catch (jsErr) {
      console.warn('Print Window: Resource check scripting error (proceeding to print anyway):', jsErr.message);
    }

    // Delay to let Chromium layout/repaint the DOM before exporting
    await new Promise(resolve => setTimeout(resolve, 250));

    // Print to PDF — exact A5: 148mm × 210mm
    const data = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: { width: 148000, height: 210000 },
      landscape: false,
      marginsType: 1,
    });

    fs.writeFileSync(filePath, data);
    return { success: true, filePath };
  } catch (err) {
    console.error('printToPDF error:', err);
    return { success: false, error: err.message };
  } finally {
    // Safely close the printing window
    if (printWin) {
      try {
        printWin.close();
      } catch (_) {}
    }
    // Clean up temporary HTML file
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {}
    }
  }
});

// Database backup manual export
ipcMain.handle('backup-database', async () => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Database Backup',
      defaultPath: 'laundry_pos_backup.sqlite',
      filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }]
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Cancelled' };
    }

    const db = getDB();
    await db.backup(filePath);
    return { success: true, path: filePath };
  } catch (err) {
    console.error('Manual backup error:', err);
    return { success: false, error: err.message };
  }
});

// Database import and restore
ipcMain.handle('import-database', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Backup Database to Import',
      filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, error: 'Cancelled' };
    }

    const backupSrcPath = filePaths[0];
    const targetDbPath = path.join(app.getPath('userData'), 'laundry_pos.sqlite');

    // 1. Close active DB connection
    closeDB();

    // Pause briefly to allow SQLite to release OS file locks on Windows
    await new Promise(resolve => setTimeout(resolve, 200));

    // Remove SQLite temporary/WAL files if they exist to prevent recovery log replay from corrupting new database state
    const walPath = targetDbPath + '-wal';
    const shmPath = targetDbPath + '-shm';
    const journalPath = targetDbPath + '-journal';
    if (fs.existsSync(walPath)) {
      try { fs.unlinkSync(walPath); } catch (e) { console.error('Failed to delete WAL file:', e); }
    }
    if (fs.existsSync(shmPath)) {
      try { fs.unlinkSync(shmPath); } catch (e) { console.error('Failed to delete SHM file:', e); }
    }
    if (fs.existsSync(journalPath)) {
      try { fs.unlinkSync(journalPath); } catch (e) { console.error('Failed to delete journal file:', e); }
    }

    // 2. Overwrite the active database file with the backup (with retry loop)
    let copied = false;
    let attempts = 5;
    while (!copied && attempts > 0) {
      try {
        fs.copyFileSync(backupSrcPath, targetDbPath);
        copied = true;
      } catch (copyErr) {
        attempts--;
        if (attempts === 0) throw copyErr;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 3. Re-initialize DB
    initDB(app.getPath('userData'));

    // 4. Force frontend reload to fetch new data state
    if (mainWindow) {
      mainWindow.reload();
    }

    return { success: true };
  } catch (err) {
    console.error('Database import error:', err);
    // Attempt to re-initialize if closed but failed
    try {
      initDB(app.getPath('userData'));
    } catch (_) {}
    return { success: false, error: err.message };
  }
});

// Retrieve desktop path
ipcMain.handle('get-desktop-path', () => {
  return app.getPath('desktop');
});

// Select folder for auto backup
ipcMain.handle('select-folder', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Auto-Backup Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }
    return filePaths[0];
  } catch (err) {
    console.error('Select folder error:', err);
    return null;
  }
});

// Silent auto backup execution
ipcMain.handle('silent-backup', async (event, targetPath) => {
  try {
    if (!targetPath) {
      return { success: false, error: 'No backup path configured' };
    }

    // Ensure target directory exists
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    const mainBackupPath = path.join(targetPath, 'laundry_pos_backup.sqlite');
    const secondaryBackupPath = path.join(targetPath, 'laundry_pos_backup_2.sqlite');

    // 1. If main backup file exists, rotate it to the secondary file
    if (fs.existsSync(mainBackupPath)) {
      fs.copyFileSync(mainBackupPath, secondaryBackupPath);
    }

    // 2. Perform SQLite clean backup of active DB to main filename
    const db = getDB();
    await db.backup(mainBackupPath);

    // 3. Clean up any other old timestamped backup files in this folder
    const files = fs.readdirSync(targetPath);
    for (const file of files) {
      if (
        file.startsWith('laundry_pos_backup') &&
        file.endsWith('.sqlite') &&
        file !== 'laundry_pos_backup.sqlite' &&
        file !== 'laundry_pos_backup_2.sqlite'
      ) {
        try {
          fs.unlinkSync(path.join(targetPath, file));
        } catch (delErr) {
          console.error(`Failed to delete legacy backup file ${file}:`, delErr);
        }
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Silent backup error:', err);
    return { success: false, error: err.message };
  }
});

// Software Update Handlers
function getGitHubToken() {
  try {
    const { execSync } = require('child_process');
    const input = "protocol=https\nhost=github.com\n\n";
    const output = execSync('git credential fill', { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const match = output.match(/password=(.+)/);
    return match ? match[1].trim() : null;
  } catch (err) {
    console.error('Failed to retrieve git credentials:', err);
    return null;
  }
}

ipcMain.on('check-for-updates', async (event) => {
  const isDev = !app.isPackaged;
  event.reply('update-status', { type: 'checking' });
  
  if (isDev) {
    try {
      console.log('Update Check [DEV]: Fetching latest release from GitHub API...');
      const token = getGitHubToken();
      const headers = { 'User-Agent': 'Laundry-Box-Updater' };
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }
      
      const response = await fetch('https://api.github.com/repos/horizone-dev/Laundry-Box/releases/latest', {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`);
      }
      
      const data = await response.json();
      const latestVersion = data.tag_name; // e.g., "v1.0.0"
      const currentVersion = app.getVersion(); // e.g., "1.0.0"
      
      console.log(`Update Check [DEV]: Current Version = v${currentVersion}, Latest GitHub Release = ${latestVersion}`);
      
      const cleanVersion = (v) => v.replace(/^v/, '').trim();
      const currentParsed = cleanVersion(currentVersion).split('.').map(Number);
      const latestParsed = cleanVersion(latestVersion).split('.').map(Number);
      
      let isNewer = false;
      for (let i = 0; i < 3; i++) {
        const c = currentParsed[i] || 0;
        const l = latestParsed[i] || 0;
        if (l !== c) {
          isNewer = l > c;
          break;
        }
      }
      
      if (isNewer) {
        console.log(`Update Check [DEV]: Update available! v${cleanVersion(latestVersion)}`);
        event.reply('update-status', { 
          type: 'available', 
          version: cleanVersion(latestVersion), 
          releaseNotes: data.body || 'No release notes provided.'
        });
      } else {
        console.log(`Update Check [DEV]: No updates available. Application is up to date.`);
        event.reply('update-status', { type: 'not-available' });
      }
    } catch (err) {
      console.error('Failed to check for updates in dev mode:', err);
      event.reply('update-status', { type: 'error', message: `Failed to check updates: ${err.message}` });
    }
  } else {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.checkForUpdates();
    } catch (err) {
      event.reply('update-status', { type: 'error', message: 'Auto-updater not configured or available.' });
    }
  }
});

let downloadInterval = null;
ipcMain.on('download-update', (event) => {
  const isDev = !app.isPackaged;
  if (isDev) {
    let progress = 0;
    event.reply('update-status', { type: 'downloading', progress });
    
    if (downloadInterval) clearInterval(downloadInterval);
    downloadInterval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(downloadInterval);
        event.reply('update-status', { type: 'downloaded' });
      } else {
        event.reply('update-status', { type: 'downloading', progress });
      }
    }, 400);
  } else {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.downloadUpdate();
    } catch (err) {
      event.reply('update-status', { type: 'error', message: 'Failed to initiate download.' });
    }
  }
});

ipcMain.on('install-update', (event) => {
  const isDev = !app.isPackaged;
  if (isDev) {
    app.relaunch();
    app.exit();
  } else {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.quitAndInstall();
    } catch (err) {
      event.reply('update-status', { type: 'error', message: 'Failed to apply update and restart.' });
    }
  }
});

// Setup auto-updater listeners for production if electron-updater is installed
try {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-status', { type: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', { type: 'available', version: info.version, releaseNotes: info.releaseNotes });
  });
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', { type: 'not-available' });
  });
  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('update-status', { type: 'downloading', progress: Math.round(progressObj.percent) });
  });
  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-status', { type: 'downloaded' });
  });
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-status', { type: 'error', message: err.message });
  });
} catch (e) {
  // Graceful fallback
}

ipcMain.handle('get-printers', async () => {
  if (mainWindow) {
    try {
      return await mainWindow.webContents.getPrintersAsync();
    } catch (err) {
      console.error('Failed to get printers:', err);
    }
  }
  return [];
});

ipcMain.handle('print-html', async (event, { html, css, printerName }) => {
  let printWin = null;
  let tmpPath = '';
  try {
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: white;
      color: black;
    }
    ${css}
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

    tmpPath = path.join(app.getPath('temp'), `print_job_${Date.now()}.html`);
    fs.writeFileSync(tmpPath, fullHtml, 'utf8');

    printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await printWin.loadFile(tmpPath);

    return new Promise((resolve) => {
      printWin.webContents.print({
        silent: true,
        printBackground: true,
        deviceName: (printerName === 'System Default Printer' || !printerName) ? '' : printerName
      }, (success, failureReason) => {
        resolve({ success, error: failureReason });
      });

    });
  } catch (err) {
    console.error('Print-HTML error:', err);
    return { success: false, error: err.message };
  } finally {
    if (printWin) {
      try {
        printWin.close();
      } catch (_) {}
    }
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {}
    }
  }
});

ipcMain.handle('get-email-settings', async () => {
  return await emailService.getEmailSettings();
});

ipcMain.handle('save-email-settings', async (event, settings) => {
  try {
    emailService.saveEmailSettings(settings);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('test-email', async () => {
  return await emailService.sendEmailReport(0);
});

function showPendingPaymentsReminder() {
  try {
    const db = getDB();
    const result = db.prepare("SELECT COUNT(*) as count FROM payment_links WHERE status = 'Pending'").get();
    const count = result ? result.count : 0;
    if (count > 0) {
      logTracker('SYSTEM', `Displaying pending payment reminder for ${count} links`, 'info');
      const { Notification } = require('electron');
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: '🔔 Pending Payments Reminder',
          body: `You have ${count} pending payment links awaiting payment.`
        });
        notification.on('click', () => {
          logTracker('SYSTEM', `Pending payments reminder clicked. Directing user to pending page.`, 'info');
          if (mainWindow && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('navigate-to-pending-payments');
          }
        });
        notification.show();
      }
    }
  } catch (err) {
    console.error("[payment-tracker] [ERROR] Failed to show pending payments reminder:", err);
  }
}
