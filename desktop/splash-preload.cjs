const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('DuckFlixIntro', Object.freeze({
  complete: () => ipcRenderer.send('duckflix:intro-complete'),
  onFallback: callback => ipcRenderer.on('duckflix:intro-fallback', () => callback())
}));
