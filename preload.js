const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkConnection: () => ipcRenderer.invoke('check-connection'),
  dbQuery: (query, params) => ipcRenderer.invoke('db-query', { query, params }),
  runDataHealer: () => ipcRenderer.invoke('run-data-healer'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  printToPDF: (options) => ipcRenderer.invoke('print-to-pdf', options),
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  silentBackup: (targetPath) => ipcRenderer.invoke('silent-backup', targetPath),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', callback),
  offUpdateStatus: (callback) => ipcRenderer.off('update-status', callback),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  verifyManagerPin: (options) => ipcRenderer.invoke('verify-manager-pin', options),
  logOverrideRejection: (options) => ipcRenderer.invoke('log-override-rejection', options),
});
