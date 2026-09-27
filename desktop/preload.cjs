const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('DuckFlixDesktop', Object.freeze({
  connected: true,
  request(type, payload = {}) {
    const id = typeof payload.id === 'string' ? payload.id : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return ipcRenderer.invoke('duckflix:request', { id, type, ...payload });
  },
  cancel(id) { ipcRenderer.send('duckflix:cancel', id); }
}));
