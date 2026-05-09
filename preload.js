const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkConnection: () => ipcRenderer.invoke('check-connection'),
  dbQuery: (query, params) => ipcRenderer.invoke('db-query', { query, params }),
  openExternal: (url) => ipcRenderer.send('open-external', url)
});
