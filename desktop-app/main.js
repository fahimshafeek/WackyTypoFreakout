const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    kiosk: false, 
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // Auto-allow all permissions (camera/mic)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });
  mainWindow.webContents.session.setPermissionCheckHandler(() => true);
  mainWindow.webContents.session.setDevicePermissionHandler(() => true);

  mainWindow.on('blur', () => {
    if (mainWindow) mainWindow.webContents.send('window-blur');
  });

  mainWindow.on('focus', () => {
    if (mainWindow) mainWindow.webContents.send('window-focus');
  });
  
  mainWindow.on('leave-full-screen', () => {
    if (mainWindow) mainWindow.webContents.send('leave-fullscreen');
  });
  
  mainWindow.on('minimize', () => {
    if (mainWindow) mainWindow.webContents.send('window-minimize');
  });
}

app.whenReady().then(() => {
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

// IPC handlers for lockdown mode
ipcMain.on('start-lockdown', () => {
  if (mainWindow) {
    mainWindow.setKiosk(true); // Forces fullscreen, no OS UI
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setSkipTaskbar(true);
    
    // Auto-allow permissions when locked down
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true);
    });
    mainWindow.webContents.session.setPermissionCheckHandler(() => true);
    mainWindow.webContents.session.setDevicePermissionHandler(() => true);
  }
});

ipcMain.on('stop-lockdown', () => {
  if (mainWindow) {
    mainWindow.setKiosk(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setSkipTaskbar(false);
  }
});
