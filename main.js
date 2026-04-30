const { app, BrowserWindow, ipcMain, net } = require('electron');
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
  backendProcess = spawn('node', [scriptPath], {
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
