const { app, BrowserWindow, ipcMain, net, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { initDB, getDB } = require('./database');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Check if we are in dev mode
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // mainWindow.webContents.openDevTools();
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
  
  // Seed initial data if tables are empty
  const db = getDB();
  const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
  if (serviceCount === 0) {
    console.log("Seeding initial POS data...");
    const shopId = 'SHOP_01';
    const now = new Date().toISOString();
    
    const insertService = db.prepare('INSERT INTO services (id, shopId, name, price, icon, category, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertService.run('1', shopId, "Men's Shirt", 3.50, 'Shirt', 'Laundry', now);
    insertService.run('2', shopId, "Women's Dress", 8.00, 'Heart', 'Laundry', now);
    insertService.run('3', shopId, "Suit Jacket", 12.50, 'Layers', 'Dry Cleaning', now);
    insertService.run('4', shopId, "Pants", 5.00, 'Shirt', 'Laundry', now);
    insertService.run('5', shopId, "Bedding", 15.00, 'Bed', 'Laundry', now);

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
  if (backendProcess) {
    backendProcess.kill();
  }
});

// Offline/online handling
ipcMain.handle('check-connection', () => {
  return net.isOnline();
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

ipcMain.handle('verify-manager-pin', (event, { pin, customerId, customerName, orderId, creditLimit, outstandingBalance, orderAmount, exceededAmount, userId }) => {
  try {
    const db = getDB();
    const shopResult = db.prepare('SELECT settings FROM shops LIMIT 1').get();
    const settings = shopResult && shopResult.settings ? JSON.parse(shopResult.settings) : {};
    
    const correctPin = settings.orderDeletePin || '0000';
    if (String(pin) === String(correctPin)) {
      activeOverrides[customerId] = {
        timestamp: Date.now(),
        amount: orderAmount
      };
      
      logOverrideEvent(db, {
        customerId,
        customerName,
        orderId,
        userId,
        managerId: 'orderDeletePinOwner',
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

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Native PDF generation via Electron (properly renders Arabic/RTL text)
ipcMain.handle('print-to-pdf', async (event, options) => {
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
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

    // Write to a temp file
    const tmpPath = path.join(app.getPath('temp'), `invoice_print_${Date.now()}.html`);
    fs.writeFileSync(tmpPath, fullHtml, 'utf8');

    // Open a hidden BrowserWindow just for printing
    const printWin = new BrowserWindow({
      width: 600,
      height: 900,
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    await printWin.loadFile(tmpPath);

    // Wait for full render (fonts, images, React effects)
    await new Promise(resolve => setTimeout(resolve, 800));

    // Print to PDF — exact A5: 148mm × 210mm
    const data = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: { width: 148000, height: 210000 },
      landscape: false,
      marginsType: 1,
    });

    printWin.close();

    // Clean up temp file
    try { fs.unlinkSync(tmpPath); } catch (_) {}

    fs.writeFileSync(filePath, data);
    return { success: true, filePath };
  } catch (err) {
    console.error('printToPDF error:', err);
    return { success: false, error: err.message };
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
    const db = getDB();

    // 1. Perform SQLite clean backup to the main filename
    await db.backup(mainBackupPath);

    // 2. Create timestamped copy
    const date = new Date();
    const yyyymmdd = date.getFullYear() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0');
    const hhmmss = String(date.getHours()).padStart(2, '0') +
      String(date.getMinutes()).padStart(2, '0') +
      String(date.getSeconds()).padStart(2, '0');
    const timestampedFile = `laundry_pos_backup_${yyyymmdd}_${hhmmss}.sqlite`;
    const timestampedPath = path.join(targetPath, timestampedFile);

    fs.copyFileSync(mainBackupPath, timestampedPath);

    // 3. Keep only the last 10 backups in target path
    const files = fs.readdirSync(targetPath);
    const backupFiles = files
      .filter(f => f.startsWith('laundry_pos_backup_') && f.endsWith('.sqlite'))
      .map(f => ({
        name: f,
        filePath: path.join(targetPath, f),
        mtime: fs.statSync(path.join(targetPath, f)).mtimeMs
      }))
      .sort((a, b) => a.mtime - b.mtime); // Sort ascending (oldest first)

    if (backupFiles.length > 10) {
      const filesToDelete = backupFiles.slice(0, backupFiles.length - 10);
      for (const fileInfo of filesToDelete) {
        try {
          fs.unlinkSync(fileInfo.filePath);
        } catch (delErr) {
          console.error(`Failed to delete old backup file ${fileInfo.name}:`, delErr);
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
ipcMain.on('check-for-updates', (event) => {
  const isDev = !app.isPackaged;
  event.reply('update-status', { type: 'checking' });
  
  setTimeout(() => {
    if (isDev) {
      event.reply('update-status', { 
        type: 'available', 
        version: '1.1.0', 
        releaseNotes: '• Added premium Software Update screen.\n• Bidirectional payment synchronization with duplicate protection.\n• General performance optimizations and layout fixes.'
      });
    } else {
      try {
        const { autoUpdater } = require('electron-updater');
        autoUpdater.checkForUpdatesAndNotify();
      } catch (err) {
        event.reply('update-status', { type: 'error', message: 'Auto-updater not configured or available.' });
      }
    }
  }, 1500);
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


