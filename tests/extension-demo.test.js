const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
function setup(fetcher) {
  const { window, document } = parseHTML(fs.readFileSync('instalar-extensao.html', 'utf8'));
  const video = document.getElementById('test-video'); video.pause = video.load = () => {};
  const loaded = [];
  class Hls {
    static isSupported() { return true; }
    static Events = { ERROR: 'error', MANIFEST_PARSED: 'parsed' };
    on() {} destroy() {} attachMedia() {} loadSource(url) { loaded.push(url); }
  }
  window.Hls = Hls; window.DuckFlixExtension = { connected: true, hlsConfig: () => ({}) };
  const context = vm.createContext({ window, document, Hls, fetch: fetcher, URL, AbortController, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync('extension-test.js', 'utf8'), context);
  return { window, loaded, el: id => document.getElementById(id) };
}
test('Minha TV test button resolves a fresh HTTP source and starts the existing player', async () => {
  const calls = [];
  const app = setup(async url => { calls.push(url); return { ok: true, json: async () => url.includes('/catalog/') ? { metas: [{ id: 'record:id', name: 'RecordTV SP UHD' }] } : { streams: [{ url: 'http://video.example/live.m3u8' }] } }; });
  await app.el('test-minhatv').onclick();
  assert.equal(app.el('test-url').value, 'http://video.example/live.m3u8');
  assert.deepEqual(app.loaded, ['http://video.example/live.m3u8']);
  assert.match(calls[1], /record%3Aid/);
  assert.match(app.el('test-status').textContent, /RecordTV SP UHD/);
  assert.equal(app.el('test-minhatv').disabled, false);
});
test('stopping an addon lookup prevents late responses from starting a video', async () => {
  let resolve;
  const app = setup(() => new Promise(done => { resolve = done; }));
  const pending = app.el('test-minhatv').onclick();
  app.el('test-stop').onclick();
  resolve({ ok: true, json: async () => ({ metas: [] }) });
  await pending;
  assert.equal(app.loaded.length, 0);
  assert.equal(app.el('test-status').textContent, 'Teste encerrado.');
});
