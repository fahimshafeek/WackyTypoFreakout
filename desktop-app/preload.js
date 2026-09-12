const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startLockdown: () => ipcRenderer.send('start-lockdown'),
  stopLockdown: () => ipcRenderer.send('stop-lockdown'),
  onWindowBlur: (callback) => ipcRenderer.on('window-blur', callback),
  onWindowFocus: (callback) => ipcRenderer.on('window-focus', callback),
  onLeaveFullscreen: (callback) => ipcRenderer.on('leave-fullscreen', callback),
  onWindowMinimize: (callback) => ipcRenderer.on('window-minimize', callback)
});
