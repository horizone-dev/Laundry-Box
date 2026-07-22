const { app, BrowserWindow, ipcMain, net, shell, dialog, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

// Diagnostic Startup Logger
function logStartup(message, error = null) {
  const timestamp = new Date().toISOString();
  let logText = `[${timestamp}] ${message}\n`;
  if (error) {
    logText += `Stack Trace: ${error.stack || error}\n`;
  }
  console.log(message);
  try {
    let appDataPath = process.env.APPDATA;
    if (!appDataPath) {
      if (process.platform === 'darwin') {
        appDataPath = path.join(process.env.HOME || '', 'Library/Application Support');
      } else {
        appDataPath = path.join(process.env.HOME || '', '.config');
      }
    }
    const logDirectory = path.join(appDataPath, 'Laundry Box');
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }
    const logPath = path.join(logDirectory, 'startup.log');
    fs.appendFileSync(logPath, logText);
  } catch (err) {
    console.error('Failed to write to startup.log:', err);
  }
}

logStartup('==================================================');
logStartup('Application initialization started (main process).');

// Helper to detect if an error is network-related
function checkNetworkError(err) {
  if (!err) return false;
  const networkErrors = [
    'ERR_INTERNET_DISCONNECTED',
    'ERR_NETWORK_CHANGED',
    'ERR_NAME_NOT_RESOLVED',
    'ERR_CONNECTION_REFUSED',
    'ERR_CONNECTION_RESET',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNABORTED',
    'EAI_AGAIN',
    'socket hang up',
    'network timeout'
  ];

  const errMsg = err.message || '';
  const errStack = err.stack || '';
  const errCode = err.code || '';
  const errStr = String(err);

  return networkErrors.some(code =>
    errMsg.includes(code) ||
    errStack.includes(code) ||
    errCode.includes(code) ||
    errStr.includes(code)
  );
}

// Global error handlers to log main process exceptions and terminate the process cleanly
process.on('uncaughtException', (err) => {
  if (checkNetworkError(err)) {
    logStartup(`[Network Uncaught Exception - Ignored] ${err ? (err.stack || err.message || err) : 'Unknown network error'}`);
    return; // Continue running normally in offline mode
  }

  try {
    const errorMsg = err ? (err.stack || err.message || err) : 'Unknown error';
    logStartup(`CRITICAL UNCAUGHT EXCEPTION: ${errorMsg}`);
    dialog.showErrorBox(
      'Laundry Box - Startup Crash',
      `A critical unhandled exception occurred during startup:\n\n${errorMsg}\n\nThe application will now close.`
    );
  } catch (_) { }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  if (checkNetworkError(reason)) {
    logStartup(`[Network Unhandled Rejection - Ignored] ${reason ? (reason.stack || reason.message || reason) : 'Unknown network rejection'}`);
    return; // Continue running normally in offline mode
  }

  try {
    const errorMsg = reason instanceof Error ? (reason.stack || reason.message) : reason;
    logStartup(`CRITICAL UNHANDLED REJECTION: ${errorMsg}`);
    dialog.showErrorBox(
      'Laundry Box - Promise Rejection',
      `An unhandled Promise rejection occurred during startup:\n\n${errorMsg}\n\nThe application will now close.`
    );
  } catch (_) { }
  process.exit(1);
});


const { spawn } = require('child_process');
logStartup('Importing database module...');
const { initDB, getDB, closeDB, generateServiceSVG } = require('./database');
logStartup('Importing email service module...');
const emailService = require('./emailService');
logStartup('Importing payment checkout service module...');
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
  logStartup('Creating BrowserWindow instance...');
  const preloadPath = path.join(__dirname, 'preload.js');
  logStartup(`Verifying preload script existence at: ${preloadPath}`);
  if (!fs.existsSync(preloadPath)) {
    const err = new Error(`Preload script not found: ${preloadPath}`);
    logStartup('CRITICAL PRELOAD ERROR', err);
    throw err;
  }

  const isDev = !app.isPackaged;
  const indexPath = path.join(__dirname, 'frontend/dist/index.html');
  if (!isDev) {
    logStartup(`Verifying production index.html existence at: ${indexPath}`);
    if (!fs.existsSync(indexPath)) {
      const err = new Error(`Production index.html file not found: ${indexPath}`);
      logStartup('CRITICAL RENDERER ERROR', err);
      throw err;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Start hidden to prevent visual flickering
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: preloadPath
    }
  });

  // Remove default window menu bar (File, Edit, View, Window)
  mainWindow.setMenu(null);
  logStartup('BrowserWindow menu bar removed.');

  // Lock down navigation to local resources only
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsedUrl = new URL(url);
      const allowedHosts = ['localhost', '127.0.0.1'];
      if (parsedUrl.protocol !== 'file:' && !allowedHosts.includes(parsedUrl.hostname)) {
        event.preventDefault();
        console.warn(`Blocked unauthorized navigation to: ${url}`);
        logStartup(`Security warning: Blocked unauthorized navigation to ${url}`);
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
      shell.openExternal(url).catch(err => {
        console.error("Failed to open link:", err);
        logStartup(`Error opening external link: ${url}`, err);
      });
    } else {
      console.warn(`Blocked attempt to open external window: ${url}`);
      logStartup(`Security warning: Blocked attempt to open external window: ${url}`);
    }
    return { action: 'deny' };
  });

  // Log all frontend console messages to a local file for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    try {
      fs.appendFileSync(path.join(app.getPath('userData'), 'frontend_console.log'), `[LVL:${level}] ${message} (${path.basename(sourceId)}:${line})\n`);
    } catch (_) { }
  });

  // Log any page load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logStartup(`CRITICAL: Page load failed: ${errorDescription} (Code: ${errorCode}) URL: ${validatedURL}`);
  });

  // Log when renderer process is terminated
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logStartup(`CRITICAL: BrowserWindow renderer process gone. Reason: ${details.reason}, Exit Code: ${details.exitCode}`);
  });

  // Show window once it is fully ready
  mainWindow.once('ready-to-show', () => {
    logStartup('BrowserWindow: ready-to-show event fired. Displaying main window.');
    mainWindow.show();
  });

  if (isDev) {
    logStartup('Opening DevTools in development mode...');
    mainWindow.webContents.openDevTools();
    logStartup('Loading development server URL: http://localhost:5173...');
    mainWindow.loadURL('http://localhost:5173').catch(err => {
      logStartup('Vite not ready, retrying in 2s...', err);
      setTimeout(() => mainWindow.loadURL('http://localhost:5173'), 2000);
    });
  } else {
    logStartup(`Loading production UI file: ${indexPath}...`);
    mainWindow.loadFile(indexPath).catch(err => {
      logStartup(`CRITICAL ERROR: Failed to load production index.html`, err);
    });
  }

  mainWindow.on('focus', () => {
    logStartup('BrowserWindow event: focus');
  });

  mainWindow.on('blur', () => {
    logStartup('BrowserWindow event: blur');
  });

  mainWindow.on('closed', () => {
    logStartup('BrowserWindow event: closed. Destroying window instance.');
    mainWindow = null;
  });
}

function startBackend() {
  const isDev = !app.isPackaged;
  const scriptPath = isDev
    ? path.join(__dirname, 'backend', 'server.js')
    : path.join(process.resourcesPath, 'backend', 'server.js');

  logStartup(`Backend process startup requested. Script path: ${scriptPath}`);

  if (!fs.existsSync(scriptPath)) {
    logStartup(`CRITICAL ERROR: Backend script not found at ${scriptPath}`);
    return;
  }

  logStartup(`Spawning backend process running: ${process.execPath} with ELECTRON_RUN_AS_NODE=1...`);
  try {
    backendProcess = spawn(process.execPath, [scriptPath], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: '3000' }
    });

    logStartup(`Backend process spawned successfully. PID: ${backendProcess.pid}`);

    backendProcess.stdout.on('data', (data) => {
      logStartup(`Backend Process stdout: ${data.toString().trim()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      logStartup(`Backend Process stderr: ${data.toString().trim()}`);
    });

    backendProcess.on('error', (err) => {
      logStartup('Backend Process failed to start or experienced an error:', err);
    });

    backendProcess.on('close', (code, signal) => {
      logStartup(`Backend Process closed: Code = ${code}, Signal = ${signal}`);
    });

    backendProcess.on('exit', (code, signal) => {
      logStartup(`Backend Process exited: Code = ${code}, Signal = ${signal}`);
    });
  } catch (err) {
    logStartup('CRITICAL ERROR: Failed to spawn backend child process', err);
  }
}

async function waitForServer(url, timeout = 10000) {
  const start = Date.now();
  logStartup(`Initiating health check for local server at: ${url} (Timeout: ${timeout}ms)...`);

  while (true) {
    try {
      const response = await new Promise((resolve, reject) => {
        // Enforce network timeout on health checks to prevent infinite socket hanging
        const request = net.request({
          url: url,
          timeout: 2000
        });

        request.on('response', (res) => {
          resolve(res.statusCode === 200);
        });

        request.on('error', (err) => {
          reject(err);
        });

        request.on('login', () => {
          resolve(false);
        });

        request.end();
      });

      if (response) {
        logStartup("Server is ready! Health check succeeded.");
        return true;
      }
    } catch (err) {
      logStartup(`Health check attempt failed: ${err.message || err}. Retrying in 500ms...`);
    }

    if (Date.now() - start > timeout) {
      logStartup("WARNING: Server health check timed out. Proceeding to display main window anyway.");
      return false;
    }

    await new Promise(r => setTimeout(r, 500));
  }
}

app.whenReady().then(async () => {
  logStartup('System initialization: app whenReady fired.');

  // Register global app lifecycle gone handlers
  app.on('render-process-gone', (event, webContents, details) => {
    logStartup(`CRITICAL: Renderer process terminated unexpectedly. Reason: ${details.reason}, Exit Code: ${details.exitCode}`);
  });

  app.on('child-process-gone', (event, details) => {
    logStartup(`CRITICAL: App child process terminated unexpectedly. Name: ${details.name}, Type: ${details.type}, Reason: ${details.reason}, Exit Code: ${details.exitCode}`);
  });

  logStartup('Connecting to SQLite database...');
  try {
    initDB(app.getPath('userData'));
    logStartup('SQLite Database connection and migrations completed.');
  } catch (dbErr) {
    logStartup('CRITICAL ERROR: Failed to initialize SQLite database', dbErr);
    throw dbErr; // Let the process error handlers catch it and exit cleanly
  }

  logStartup('Initializing Email service scheduler...');
  try {
    emailService.initScheduler();
    logStartup('Email service scheduler initialized successfully.');
  } catch (emailErr) {
    logStartup('Warning: Email service scheduler failed to start:', emailErr);
  }

  // Seed initial data if tables are empty (disabled to start with a clean database for new installations)
  const db = getDB();
  const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
  if (serviceCount === 0) {
    logStartup("Database is empty. Fresh installation detected (seeding skipped to start clean).");
  }

  // App open -> server auto start
  startBackend();

  // -> server ready check
  await waitForServer('http://127.0.0.1:3000/api/health');

  // -> then UI load
  createWindow();

  // Resume tracking for recent pending payments and show reminder
  logStartup("Resuming active tracking for recent pending checkouts...");
  resumeRecentPendingTrackers();
  showPendingPaymentsReminder();

  app.on('activate', () => {
    logStartup('App event: activate');
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logStartup('App event: window-all-closed');
  if (process.platform !== 'darwin') {
    logStartup('Quitting application.');
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

  if (currentOutstanding >= creditLimit || newOutstanding > creditLimit) {
    const override = activeOverrides[customerId];
    if (override && (Date.now() - override.timestamp < 1000 * 15) && Math.abs(override.amount - amountToAdd) < 0.05) {
      return null; // Allowed!
    }
    return 'CREDIT_LIMIT_EXCEEDED';
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

ipcMain.handle('get-next-rv-number', async (event) => {
  try {
    const db = getDB();
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
  } catch (err) {
    console.error("Failed to generate sequential RV number:", err);
    throw err;
  }
});

ipcMain.handle('get-next-payment-reference', async (event, paymentType) => {
  try {
    const db = getDB();
    const { getNextPaymentReference } = require('./database');
    return getNextPaymentReference(db, paymentType);
  } catch (err) {
    console.error("Failed to generate sequential payment reference:", err);
    throw err;
  }
});

const DEBUG_NOMOD = true;

function logNomodRequest(url, method, apiKey, settings, body = null) {
  if (!DEBUG_NOMOD) return;
  const apiKeyExists = !!apiKey;
  const maskedKey = apiKeyExists ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'N/A';
  const len = apiKeyExists ? apiKey.length : 0;
  const trimmedLen = apiKeyExists ? apiKey.trim().length : 0;
  const spaces = apiKeyExists ? (apiKey.length !== apiKey.trim().length) : false;
  const hasNewline = apiKeyExists ? (apiKey.includes('\n') || apiKey.includes('\r')) : false;

  console.log(`
[NoMOD Debug - Request]
Environment: ${settings.nomodEnv || 'sandbox'}
API Key Exists: ${apiKeyExists}
API Key Masked: ${maskedKey}
API Key Length: ${len}
API Key Trimmed Length: ${trimmedLen}
Has leading/trailing spaces: ${spaces}
Has newlines: ${hasNewline}
settings.nomodApiKey matches key: ${apiKeyExists && settings.nomodApiKey === apiKey}
Request URL: ${url}
HTTP Method: ${method}
Headers:
  X-API-KEY: ${maskedKey} (length: ${len})
  Content-Type: application/json
Payload:
${body ? JSON.stringify(body, null, 2) : '{}'}
`);
}

function logNomodResponse(url, status, duration, responseText, headers = {}) {
  if (!DEBUG_NOMOD) return;
  console.log(`
[NoMOD Debug - Response]
URL: ${url}
Status: ${status}
Duration: ${duration} ms
Response Headers: ${JSON.stringify(headers, null, 2)}
Response:
${responseText}
`);
}

function logNomodError(err, url, env) {
  if (!DEBUG_NOMOD) return;
  console.error(`
[NoMOD Debug - Error]
Request URL: ${url}
Environment: ${env}
Error Name: ${err.name}
Error Message: ${err.message}
Stack Trace:
${err.stack}
`);
}

ipcMain.handle('create-nomod-checkout', async (event, { amount, currency, customer, orderId, userRole }) => {
  const db = getDB();
  const shopResult = db.prepare('SELECT settings FROM shops LIMIT 1').get();
  const settings = shopResult && shopResult.settings ? JSON.parse(shopResult.settings) : {};
  const apiKey = settings.nomodApiKey;
  const mode = settings.nomodEnv || 'sandbox';
  const url = 'https://api.nomod.com/v1/links';

  try {
    const linkId = `LNK-${Date.now().toString().slice(-4)}`;

    // Settings validation debug logs
    if (DEBUG_NOMOD) {
      console.log(`[NoMOD Debug - Settings Validation] Loaded from database settings. nomodApiKey exists: ${!!apiKey}, nomodEnv: ${mode}`);
    }

    // If no API key configured or it is a placeholder/empty, return a sandbox demo link without calling the real API
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('placeholder') || apiKey.length < 10) {
      if (mode === 'live') {
        throw new Error("Nomod API key is missing. Please configure it in Settings.");
      }
      const sandboxUrl = `https://demo.nomod.com/pay?ref=${linkId}&amount=${parseFloat(amount).toFixed(2)}&currency=${currency || settings.nomodCurrency || 'AED'}`;
      if (DEBUG_NOMOD) {
        console.log(`[NoMOD Debug] Returning sandbox URL directly: ${sandboxUrl}`);
      }
      return { success: true, data: { url: sandboxUrl, id: linkId }, linkId };
    }

    const payload = {
      title: `Order #${orderId || ''} Payment`.trim(),
      amount: parseFloat(amount).toFixed(2),
      currency: currency || settings.nomodCurrency || 'AED',
      note: `Payment for Order #${orderId}`,
      items: [
        {
          name: `Order #${orderId || ''} Payment`.trim(),
          amount: parseFloat(amount).toFixed(2)
        }
      ]
    };

    logNomodRequest(url, 'POST', apiKey, settings, payload);

    const headers = {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json'
    };

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    const duration = Date.now() - startTime;

    const responseHeaders = {};
    response.headers.forEach((value, name) => {
      responseHeaders[name] = value;
    });

    logNomodResponse(url, response.status, duration, responseText, responseHeaders);

    if (!response.ok) {
      throw new Error(`Nomod API response error: ${response.status} - ${responseText}`);
    }

    const responseData = JSON.parse(responseText);
    // Wrap to match POS expected return payload structure: { url, id }
    return { success: true, data: { url: responseData.url, id: responseData.id }, linkId };
  } catch (err) {
    logNomodError(err, url, mode);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('retrieve-nomod-checkout-status', async (event, { checkoutId, userRole }) => {
  const db = getDB();
  const shopResult = db.prepare('SELECT settings FROM shops LIMIT 1').get();
  const settings = shopResult && shopResult.settings ? JSON.parse(shopResult.settings) : {};
  const mode = settings.nomodEnv || 'sandbox';
  const apiKey = settings.nomodApiKey;
  const chargesUrl = `https://api.nomod.com/v1/charges?link_id=${checkoutId}`;

  try {
    // Enforce role permission rules on backend
    if (userRole === 'staff') {
      throw new Error("Staff are unauthorized to perform Nomod actions.");
    }

    if (!apiKey) {
      throw new Error("Nomod API key is missing. Please configure it in Settings.");
    }

    if (DEBUG_NOMOD) {
      console.log(`[NoMOD Debug - Settings Validation] Loaded status settings. nomodApiKey exists: ${!!apiKey}, nomodEnv: ${mode}`);
    }

    // Step 1: Check if there are any charges for this link
    logNomodRequest(chargesUrl, 'GET', apiKey, settings);

    const startTime = Date.now();
    const response = await fetch(chargesUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();
    const duration = Date.now() - startTime;

    const responseHeaders = {};
    response.headers.forEach((value, name) => {
      responseHeaders[name] = value;
    });

    logNomodResponse(chargesUrl, response.status, duration, responseText, responseHeaders);

    if (!response.ok) {
      throw new Error(`Nomod Charges API failed: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const results = data.results || data.data || [];

    if (results.length > 0) {
      // Link has been paid
      const mainTxn = results[0];
      return {
        success: true,
        data: {
          status: 'paid',
          transactions: [
            {
              id: mainTxn.id,
              created_at: mainTxn.created_at || new Date().toISOString()
            }
          ]
        }
      };
    }

    // Step 2: No charges yet. Fetch link to see if it's active or disabled
    const linkUrl = `https://api.nomod.com/v1/links/${checkoutId}`;
    logNomodRequest(linkUrl, 'GET', apiKey, settings);

    const linkStartTime = Date.now();
    const linkResponse = await fetch(linkUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const linkResponseText = await linkResponse.text();
    const linkDuration = Date.now() - linkStartTime;

    const linkResponseHeaders = {};
    linkResponse.headers.forEach((value, name) => {
      linkResponseHeaders[name] = value;
    });

    logNomodResponse(linkUrl, linkResponse.status, linkDuration, linkResponseText, linkResponseHeaders);

    if (!linkResponse.ok) {
      throw new Error(`Nomod Links API failed: ${linkResponse.status} - ${linkResponseText}`);
    }

    const linkData = JSON.parse(linkResponseText);
    const mappedStatus = linkData.status === 'enabled' ? 'created' : 'cancelled';

    return {
      success: true,
      data: {
        status: mappedStatus
      }
    };
  } catch (err) {
    logNomodError(err, chargesUrl, mode);
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
                  const { getNextPaymentReference } = require('./database');
                  const payRef = getNextPaymentReference(db, 'ONL');
                  db.prepare(`
                    INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
                    VALUES (?, ?, ?, ?, ?, 'Nomod', 'SUCCESS', ?, 0, ?, ?)
                  `).run(payId, customerId, bill.id, 'SHOP_01', allocate, paidAt || nowStr, nowStr, payRef);
                } else {
                  logTracker(orderId, `Duplicate payment record check: payment ${payId} already exists. Skipping insert.`, 'warn');
                }

                remaining -= allocate;
              }

              if (remaining > 0) {
                const advPayId = `PAY-ADV-NOMOD-${checkoutId}`;
                const exists = db.prepare('SELECT COUNT(*) as count FROM payments WHERE id = ?').get(advPayId).count;
                if (exists === 0) {
                  const { getNextPaymentReference } = require('./database');
                  const payRef = getNextPaymentReference(db, 'ONL');
                  db.prepare(`
                    INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
                    VALUES (?, ?, ?, ?, ?, 'Nomod', 'SUCCESS', ?, 0, ?, ?)
                  `).run(advPayId, customerId, null, 'SHOP_01', remaining, paidAt || nowStr, nowStr, payRef);
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
                  (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
                  VALUES (?, 'SHOP_01', 'GATEWAY', 'INCOME', 'Sales Settlement', ?, ?, ?, 0, ?, 'CreditCard', NULL, 'System', 'SYSTEM', 'system')
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
              const { getNextPaymentReference } = require('./database');
              const payRef = getNextPaymentReference(db, 'ONL');
              db.prepare(`
                INSERT INTO payments (id, customerId, orderId, shopId, amount, method, status, createdAt, isSynced, updatedAt, paymentReference) 
                VALUES (?, ?, ?, ?, ?, 'Nomod', 'SUCCESS', ?, 0, ?, ?)
              `).run(payId, order.customerId || 'Walk-in', orderId, order.shopId || 'SHOP_01', order.totalAmount, paidAt || nowStr, nowStr, payRef);
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
                (id, shopId, accountType, type, category, amount, description, date, isSynced, updatedAt, icon, bankAccountId, createdBy, createdById, createdByRole) 
                VALUES (?, 'SHOP_01', 'GATEWAY', 'INCOME', 'Sales', ?, ?, ?, 0, ?, 'CreditCard', NULL, 'System', 'SYSTEM', 'system')
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
    const { filename = 'Invoice.pdf', html = '', css = '', pdfDownloadPath = '', origin = '', pageSize = 'A5' } = options || {};
    console.log("print-to-pdf IPC received options: filename =", filename, "pdfDownloadPath =", pdfDownloadPath, "origin =", origin, "pageSize =", pageSize);

    // Use target download path if configured, otherwise default to user's Downloads directory
    const targetFolder = pdfDownloadPath && fs.existsSync(pdfDownloadPath)
      ? pdfDownloadPath
      : app.getPath('downloads');
    let filePath = path.join(targetFolder, filename);

    if (fs.existsSync(filePath)) {
      const { response } = await dialog.showMessageBox(mainWindow || null, {
        type: 'question',
        buttons: ['Replace', 'Keep Both (Rename)', 'Cancel'],
        defaultId: 1,
        title: 'File Already Exists',
        message: `A file named "${filename}" already exists in your destination folder. What would you like to do?`,
        cancelId: 2
      });

      if (response === 2) {
        return { success: false, error: 'Cancelled' };
      } else if (response === 1) {
        // Keep Both (Auto-rename)
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);
        let counter = 1;
        while (fs.existsSync(filePath)) {
          filePath = path.join(targetFolder, `${base} (${counter})${ext}`);
          counter++;
        }
      }
    }

    // Define CSS page size override based on pageSize to force Chromium rendering layout size
    let pageCssRule = '';
    if (pageSize === 'thermal') {
      pageCssRule = '@page { size: 80mm 200mm; margin: 0; }';
    } else if (pageSize === 'A4') {
      pageCssRule = '@page { size: A4; margin: 10mm; }';
    } else if (pageSize === 'A6') {
      pageCssRule = '@page { size: A6; margin: 3mm; }';
    } else {
      pageCssRule = '@page { size: A5; margin: 5mm; }'; // Default A5
    }

    // Build a standalone HTML document with all styles embedded
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${origin ? `<base href="${origin}/">` : ''}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background: white;
      color: #1E293B;
      ${pageSize === 'thermal' ? 'padding: 0 4mm !important;' : ''}
    }
    ${css}
    ${pageCssRule}

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
        new Promise(resolve => setTimeout(resolve, 500)) // Safety timeout threshold of 500ms
      ]);
    } catch (jsErr) {
      console.warn('Print Window: Resource check scripting error (proceeding to print anyway):', jsErr.message);
    }

    // Delay to let Chromium layout/repaint the DOM before exporting
    await new Promise(resolve => setTimeout(resolve, 250));

    // Print to PDF — exact A5 with default margins
    const data = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: pageSize === 'thermal' ? { width: 80000, height: 200000 } : pageSize,
      landscape: false,
      marginsType: 0,
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
      } catch (_) { }
    }
    // Clean up temporary HTML file
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) { }
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
      filters: [
        { name: 'SQLite Database (*.sqlite, *.db, *.bak)', extensions: ['sqlite', 'db', 'bak'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, error: 'Cancelled' };
    }

    const backupSrcPath = filePaths[0];
    const targetDbPath = path.join(app.getPath('userData'), 'laundry_pos.sqlite');

    // 1. Validate that the selected file is a valid SQLite database
    const Database = require('better-sqlite3');
    try {
      const testDb = new Database(backupSrcPath, { readonly: true });
      testDb.prepare('SELECT count(*) FROM sqlite_master').get();
      testDb.close();
    } catch (validErr) {
      return { success: false, error: 'Selected file is not a valid SQLite database backup file.' };
    }

    // 2. Checkpoint and truncate WAL file on active DB to flush pending frames
    try {
      const activeDb = getDB();
      if (activeDb) {
        activeDb.pragma('wal_checkpoint(TRUNCATE)');
        activeDb.pragma('journal_mode = DELETE');
      }
    } catch (walErr) {
      console.error('Error truncating WAL during import prepare:', walErr);
    }

    // 3. Close active DB connection
    closeDB();

    // Pause briefly to allow OS file handles to release on Windows
    await new Promise(resolve => setTimeout(resolve, 300));

    // Remove SQLite temporary/WAL files if they exist to prevent recovery log replay
    const walPath = targetDbPath + '-wal';
    const shmPath = targetDbPath + '-shm';
    const journalPath = targetDbPath + '-journal';
    [walPath, shmPath, journalPath].forEach(fp => {
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch (e) { console.error(`Failed to delete ${fp}:`, e); }
      }
    });

    // 4. Overwrite active database file with backup (with retry and fallback)
    let copied = false;
    let attempts = 10;
    while (!copied && attempts > 0) {
      try {
        fs.copyFileSync(backupSrcPath, targetDbPath);
        copied = true;
      } catch (copyErr) {
        attempts--;
        if (attempts === 0) {
          // Fallback: try SQLite online backup from source to target
          try {
            const srcDb = new Database(backupSrcPath, { readonly: true });
            await srcDb.backup(targetDbPath);
            srcDb.close();
            copied = true;
          } catch (backupFallbackErr) {
            throw copyErr;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    // Remove any WAL/shm files left after copy
    [walPath, shmPath, journalPath].forEach(fp => {
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch (_) {}
      }
    });

    // 5. Re-initialize active DB
    initDB(app.getPath('userData'));

    return { success: true };
  } catch (err) {
    console.error('Database import error:', err);
    try {
      initDB(app.getPath('userData'));
    } catch (_) { }
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
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('Production auto-updater check failed (offline?):', err.message);
        event.reply('update-status', { type: 'error', message: `Update check failed: ${err.message}` });
      });
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
      autoUpdater.downloadUpdate().catch((err) => {
        console.warn('Production auto-updater download failed:', err.message);
        event.reply('update-status', { type: 'error', message: `Download failed: ${err.message}` });
      });
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

ipcMain.handle('print-invoice', async (event, { html, css, printerName, silent, pageSize }) => {
  console.log("[main.js] print-invoice received options: printerName =", printerName, "silent =", silent, "pageSize =", pageSize);
  if (printerName && printerName !== 'System Default Printer') {
    try {
      const printers = await event.sender.getPrintersAsync();
      const printer = printers.find(p => p.name === printerName);
      if (!printer) {
        return { success: false, error: `Selected printer "${printerName}" was not found or is disconnected.` };
      }
    } catch (err) {
      console.error("Printer validation failed:", err);
    }
  }

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

    tmpPath = path.join(app.getPath('temp'), `print_invoice_${Date.now()}.html`);
    fs.writeFileSync(tmpPath, fullHtml, 'utf8');

    printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await printWin.loadFile(tmpPath);

    // Wait for fonts and images to render before printing (max 500ms)
    try {
      await Promise.race([
        printWin.webContents.executeJavaScript(`
          new Promise((resolve) => {
            const imgs = Array.from(document.querySelectorAll('img'));
            const imgPromises = imgs.map(img => {
              if (img.complete) return Promise.resolve();
              return new Promise(r => { img.onload = r; img.onerror = r; });
            });
            const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
            Promise.all([...imgPromises, fontsReady]).then(resolve).catch(resolve);
          })
        `),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
    } catch (_) { }

    // Short layout settle delay
    await new Promise(resolve => setTimeout(resolve, 150));

    const result = await new Promise((resolve) => {
      printWin.webContents.print({
        silent: silent !== false,   // Respect user preference (defaults to true)
        printBackground: true,
        margins: { marginType: 'printableArea' },
        scaleFactor: 100,
        pageSize: pageSize || 'A5', // Pass options custom size or string format
        deviceName: (printerName === 'System Default Printer' || !printerName) ? '' : printerName
      }, (success, failureReason) => {
        if (success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: failureReason || 'Unknown printer hardware error' });
        }
      });
    });
    return result;
  } catch (err) {
    console.error('Print-Invoice error:', err);
    return { success: false, error: err.message };
  } finally {
    if (printWin) {
      const winToClose = printWin;
      setTimeout(() => {
        try {
          winToClose.close();
        } catch (_) { }
      }, 1500); // 1.5 second safety delay to let printer spooler process data fully
    }
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) { }
    }
  }
});

ipcMain.handle('print-html', async (event, { html, css, printerName, silent }) => {
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
        silent: silent !== false,
        printBackground: true,
        margins: { marginType: 'none' },
        scaleFactor: 100,
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
      } catch (_) { }
    }
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) { }
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

ipcMain.handle('send-otp-email', async (event, { recipient, otp, username }) => {
  try {
    const settings = await emailService.getEmailSettings();
    if (!settings || !settings.enabled) {
      throw new Error('Email reporting is not enabled in settings.');
    }
    
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 465,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.username,
        pass: settings.password
      },
      requireTLS: true,
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      }
    });

    const mailOptions = {
      from: `"${settings.username}" <${settings.username}>`,
      to: recipient,
      subject: 'Security Verification PIN Reset OTP',
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 24px; max-width: 500px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 16px; background: white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #0F172A; font-weight: 800; margin-bottom: 16px; font-size: 1.25rem;">PIN Reset Verification</h2>
          <p style="color: #475569; font-size: 0.95rem; line-height: 1.5; margin-bottom: 24px;">
            A request has been received to reset the login PIN for user <strong>${username}</strong>. Use the following One-Time Password (OTP) to complete the reset:
          </p>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 2.25rem; font-weight: 800; letter-spacing: 6px; color: #2563EB;">${otp}</span>
          </div>
          <p style="color: #64748B; font-size: 0.8rem; line-height: 1.4; margin: 0;">
            This OTP is valid for 5 minutes. If you did not request this code, please secure your system settings.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (err) {
    console.error('Failed to send OTP email via IPC:', err);
    return { success: false, error: err.message };
  }
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
