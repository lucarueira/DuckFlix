const fs = require('node:fs');
const { parseHTML } = require('linkedom');
const mediaCore = require('../extensoes-media.js');
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const { window, document } = parseHTML(fs.readFileSync('extensoes.html', 'utf8'));
  const el = id => document.getElementById(id);
  for (const id of ['season-select', 'video-speed']) Object.defineProperty(el(id), 'value', { value: '', writable: true });
  el('autoplay-next').checked = true;
  const video = el('extension-video');
  video.currentTime = 0; video.duration = 120; video.paused = true; video.muted = false;
  video.pause = () => { video.paused = true; };
  video.load = () => {};
  video.play = () => { video.paused = false; return Promise.resolve(); };
  const dialog = el('watch-dialog');
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new window.Event('close')); };
  const connections = [], probes = [];
  const media = {
    ...mediaCore,
    probe: async (source, options) => { probes.push({ source, options }); return { ok: !source.url.includes('broken'), mode: 'native' }; },
    connect(video, source, options) {
      video.src = source.url;
      const connection = { source, options, dispose() { this.disposed = true; video.pause(); video.removeAttribute('src'); }, play() { video.play(); } };
      connections.push(connection);
      queueMicrotask(() => { if (!connection.disposed) { video.currentTime = options.startAt || 0; options.onReady(); if (options.autoplay) connection.play(); } });
      return connection;
    }
  };
  return { window, document, el, video, connections, probes, media };
}
module.exports = { fixture, settle };
