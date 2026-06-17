const { contextBridge, ipcRenderer, webFrame } = require('electron');

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
  requestRefocus: () => ipcRenderer.send('request-refocus'),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printHtml: (options) => ipcRenderer.invoke('print-html', options),
});

// Override native alert to show custom HTML/CSS Toast notifications, confirm to refocus, and print for silent routing
webFrame.executeJavaScript(`
  (function() {
    const _alert = window.alert;
    window.alert = function(message) {
      if (!document.body || !document.head) {
        _alert(message);
        return;
      }

      let styleEl = document.getElementById('app-toast-styles');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'app-toast-styles';
        styleEl.textContent = 
          '.app-toast-container {' +
          '  position: fixed;' +
          '  top: 24px;' +
          '  right: 24px;' +
          '  display: flex;' +
          '  flex-direction: column;' +
          '  gap: 12px;' +
          '  z-index: 999999;' +
          '  pointer-events: none;' +
          '  font-family: system-ui, -apple-system, sans-serif;' +
          '}' +
          '.app-toast {' +
          '  pointer-events: auto;' +
          '  min-width: 320px;' +
          '  max-width: 450px;' +
          '  background: rgba(255, 255, 255, 0.95);' +
          '  border-left: 5px solid #2563EB;' +
          '  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);' +
          '  border-radius: 12px;' +
          '  padding: 16px 20px;' +
          '  color: #1E293B;' +
          '  font-size: 0.9rem;' +
          '  font-weight: 600;' +
          '  display: flex;' +
          '  align-items: center;' +
          '  justify-content: space-between;' +
          '  gap: 16px;' +
          '  transform: translateX(120%);' +
          '  transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.35s ease;' +
          '  opacity: 0;' +
          '  backdrop-filter: blur(10px);' +
          '  position: relative;' +
          '  overflow: hidden;' +
          '}' +
          '.app-toast.show {' +
          '  transform: translateX(0);' +
          '  opacity: 1;' +
          '}' +
          '.app-toast-content {' +
          '  flex: 1;' +
          '  line-height: 1.4;' +
          '  display: flex;' +
          '  align-items: center;' +
          '}' +
          '.app-toast-close {' +
          '  background: none;' +
          '  border: none;' +
          '  color: #94A3B8;' +
          '  font-size: 1.2rem;' +
          '  cursor: pointer;' +
          '  display: flex;' +
          '  align-items: center;' +
          '  justify-content: center;' +
          '  padding: 4px;' +
          '  transition: color 0.15s;' +
          '}' +
          '.app-toast-close:hover {' +
          '  color: #64748B;' +
          '}' +
          '.app-toast.success {' +
          '  border-left-color: #10B981;' +
          '  background: rgba(240, 253, 250, 0.95);' +
          '}' +
          '.app-toast.error {' +
          '  border-left-color: #EF4444;' +
          '  background: rgba(254, 242, 242, 0.95);' +
          '}' +
          '.app-toast.warning {' +
          '  border-left-color: #F59E0B;' +
          '  background: rgba(255, 251, 235, 0.95);' +
          '}' +
          '.app-toast-progress {' +
          '  position: absolute;' +
          '  bottom: 0;' +
          '  left: 0;' +
          '  height: 3px;' +
          '  background-color: rgba(0, 0, 0, 0.05);' +
          '  width: 100%;' +
          '}' +
          '.app-toast-progress-bar {' +
          '  height: 100%;' +
          '  width: 100%;' +
          '  background-color: currentColor;' +
          '  opacity: 0.3;' +
          '  transform-origin: left center;' +
          '  animation: app-toast-shrink 4s linear forwards;' +
          '}' +
          '@keyframes app-toast-shrink {' +
          '  from { transform: scaleX(1); }' +
          '  to { transform: scaleX(0); }' +
          '}';
        document.head.appendChild(styleEl);
      }

      let container = document.getElementById('app-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'app-toast-container';
        container.className = 'app-toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = 'app-toast';

      const text = (message || '').toLowerCase();
      let type = 'info';
      if (text.includes('success') || text.includes('successfully') || text.includes('saved') || text.includes('paid') || text.includes('complete') || text.includes('تم') || text.includes('بنجاح')) {
        toast.classList.add('success');
        type = 'success';
      } else if (text.includes('error') || text.includes('fail') || text.includes('cannot') || text.includes('invalid') || text.includes('not found') || text.includes('فشل') || text.includes('خطأ')) {
        toast.classList.add('error');
        type = 'error';
      } else if (text.includes('warning') || text.includes('exists') || text.includes('sure') || text.includes('تحذير')) {
        toast.classList.add('warning');
        type = 'warning';
      }

      const content = document.createElement('div');
      content.className = 'app-toast-content';

      let iconHtml = '';
      if (type === 'success') iconHtml = '<span style="color: #10B981; font-size: 1.25rem; font-weight: bold; margin-right: 10px; display: inline-flex; align-items: center;">✓</span>';
      else if (type === 'error') iconHtml = '<span style="color: #EF4444; font-size: 1.25rem; font-weight: bold; margin-right: 10px; display: inline-flex; align-items: center;">✕</span>';
      else if (type === 'warning') iconHtml = '<span style="color: #F59E0B; font-size: 1.25rem; font-weight: bold; margin-right: 10px; display: inline-flex; align-items: center;">⚠️</span>';
      else iconHtml = '<span style="color: #2563EB; font-size: 1.25rem; font-weight: bold; margin-right: 10px; display: inline-flex; align-items: center;">ℹ</span>';

      content.innerHTML = iconHtml + '<span style="flex: 1;">' + message + '</span>';
      toast.appendChild(content);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'app-toast-close';
      closeBtn.innerHTML = '×';
      closeBtn.onclick = function() {
        toast.classList.remove('show');
        setTimeout(function() {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 400);
      };
      toast.appendChild(closeBtn);

      const progress = document.createElement('div');
      progress.className = 'app-toast-progress';
      const progressBar = document.createElement('div');
      progressBar.className = 'app-toast-progress-bar';
      progress.appendChild(progressBar);
      toast.appendChild(progress);

      container.appendChild(toast);

      setTimeout(function() {
        toast.classList.add('show');
      }, 10);

      setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 400);
      }, 4000);
    };

    const _confirm = window.confirm;
    window.confirm = function(message) {
      const result = _confirm(message);
      if (window.electronAPI && typeof window.electronAPI.requestRefocus === 'function') {
        window.electronAPI.requestRefocus();
      }
      return result;
    };

    const _print = window.print;
    window.print = function() {
      const isTag = document.body.classList.contains('printing-tags');
      const billingPrinter = window.localStorage.getItem('billingPrinter') || '';
      const tagPrinter = window.localStorage.getItem('tagPrinter') || '';
      const selectedPrinter = isTag ? tagPrinter : billingPrinter;

      if (!selectedPrinter || selectedPrinter === 'Show Print Dialog') {
        _print();
      } else {
        let css = '';
        for (const sheet of document.styleSheets) {
          try {
            const rules = Array.from(sheet.cssRules || []);
            css += rules.map(function(r) { return r.cssText; }).join('\\n') + '\\n';
          } catch (_) {}
        }
        const html = document.body.innerHTML;

        if (window.electronAPI && typeof window.electronAPI.printHtml === 'function') {
          window.electronAPI.printHtml({ html: html, css: css, printerName: selectedPrinter })
            .then(function(result) {
              if (result && !result.success) {
                console.error('Silent print failed:', result.error);
                _print();
              }
            })
            .catch(function(err) {
              console.error('Silent print exception:', err);
              _print();
            });
        } else {
          _print();
        }
      }
    };
  })();
`);


