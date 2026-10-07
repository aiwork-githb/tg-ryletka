// Minimal, typed bridge between the game page and the Electron shell.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('native', {
  isElectron: true,
  setDisplayMode: (mode) => ipcRenderer.send('vt:displayMode', mode),
  setResolution: (w, h) => ipcRenderer.send('vt:resolution', w, h),
  setVSync: (on) => ipcRenderer.send('vt:vsync', on),
  quit: () => ipcRenderer.send('vt:quit'),
  getDisplayInfo: () => ipcRenderer.invoke('vt:displayInfo'),
});
