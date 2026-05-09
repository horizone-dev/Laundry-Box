const { app, BrowserWindow, ipcMain, net, shell } = require('electron');
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
ipcMain.handle('db-query', (event, { query, params }) => {
  try {
    const db = getDB();
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
