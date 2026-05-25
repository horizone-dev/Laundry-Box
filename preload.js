const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkConnection: () => ipcRenderer.invoke('check-connection'),
  dbQuery: (query, params) => ipcRenderer.invoke('db-query', { query, params }),
  runDataHealer: () => ipcRenderer.invoke('run-data-healer'),
  openExternal: (url) => ipcRenderer.send('open-external', url)
});
