const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('DuckFlixDesktop', Object.freeze({
  connected: true,
  request(type, payload = {}) {
    const id = typeof payload.id === 'string' ? payload.id : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return ipcRenderer.invoke('duckflix:request', { id, type, ...payload });
  },
  cancel(id) { ipcRenderer.send('duckflix:cancel', id); },
  downloads: Object.freeze({
    start: (id, url) => ipcRenderer.invoke('duckflix:download-start', { id, url }),
    control: (id, action) => ipcRenderer.send('duckflix:download-control', id, action),
    show: id => ipcRenderer.invoke('duckflix:download-show', id),
    onEvent(callback) { ipcRenderer.on('duckflix:download-event', (e, payload) => callback(payload)); }
  })
}));
