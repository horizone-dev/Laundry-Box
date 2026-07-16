const { app } = require('electron'); app.whenReady().then(() => { console.log('USERDATA:', app.getPath('userData')); app.quit(); });
