const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const health = require('../tv-health.js');

const directory = '#EXTM3U\n' + Array.from({ length: 32 }, (_, i) =>
  `#EXTINF:-1 group-title="General",Canal ${String(i).padStart(2, '0')}\nhttps://example.com/channel-${i}`
).join('\n');
const cartoons = '#EXTM3U\n#EXTINF:-1 group-title="Animation",Desenho\nhttps://example.com/cartoon';
const settle = () => new Promise(resolve => setImmediate(resolve));

async function setup(t, { manual = false } = {}) {
  const { window, document } = parseHTML(fs.readFileSync(path.join(__dirname, '../tv.html'), 'utf8'));
  const el = id => document.getElementById(id);
  const batches = [];
  const timers = new Map();
  let timerId = 0;
  let pauses = 0;
  Object.defineProperty(el('playlist'), 'value', { value: 'br', writable: true });
  Object.defineProperty(el('category'), 'value', { value: '', writable: true });
  el('category').add = option => el('category').append(option);
  const video = el('live-video');
  video.canPlayType = () => 'probably';
  video.pause = () => { pauses++; video.paused = true; };
  video.load = () => {};
  video.play = () => { video.paused = false; return Promise.resolve(); };
  el('watch').scrollIntoView = () => {};
  window.matchMedia = () => ({ matches: true });
  window.DuckTVHealth = {
    ...health,
    scanChannels: (items, options) => {
      const batch = { items, ...options };
      batches.push(batch);
      return new Promise((resolve, reject) => {
        batch.resolve = resolve;
        batch.reject = reject;
        if (!manual) {
          for (const channel of items) options.onResult(channel, { ok: true, checkedAt: Date.now() });
          resolve();
        }
      });
    }
  };
  const context = vm.createContext({
    window, document, URL, AbortController, console,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id), setInterval: () => 0,
    Option: function(text, value) { const option = document.createElement('option'); option.textContent = text; option.value = value; return option; },
    fetch: async url => ({ ok: true, text: async () => url.includes('/categories/') ? cartoons : directory })
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../tv.js'), 'utf8'), context);
  await settle();
  t.after(() => window.dispatchEvent(new window.Event('pagehide')));
  async function runTimers(delay) {
    for (const [id, timer] of [...timers]) if (timer.delay <= delay && timers.has(id)) { timers.delete(id); timer.callback(); }
    await settle();
  }
  async function search(text) {
    el('channel-search').value = text;
    el('channel-search').dispatchEvent(new window.Event('input'));
    await runTimers(450);
  }
  return { el, window, video, batches, search, runTimers, get pauses() { return pauses; } };
}

test('second and third searches verify new channels while the first channel keeps playing', async t => {
  const app = await setup(t);
  await app.search('Canal 01');
  app.el('channel-grid').firstElementChild.click();
  const currentSource = app.video.src;
  const pauses = app.pauses;
  await app.search('Canal 29');
  assert.match(app.el('channel-grid').textContent, /Canal 29/);
  assert.equal(app.batches.at(-1).concurrency, 1);
  assert.equal(app.batches.at(-1).items.length, 1, 'search must not wait for unrelated cartoons');
  await app.search('Canal 30');
  assert.match(app.el('channel-grid').textContent, /Canal 30/);
  assert.doesNotMatch(app.el('channel-grid').textContent, /Canal 29/);
  assert.equal(app.video.src, currentSource);
  assert.equal(app.pauses, pauses, 'search must not stop current playback');
});

test('a search with no matches completes immediately; clearing it restores the verified directory', async t => {
  const app = await setup(t);
  const count = app.batches.length;
  await app.search('nao-existe');
  assert.equal(app.batches.length, count);
  assert.equal(app.el('channel-grid').children.length, 0);
  assert.match(app.el('list-status').textContent, /Nenhum canal corresponde/);
  assert.equal(app.el('animation-carousel').children.length, 1);
  app.el('category').value = 'Animation';
  app.el('clear-filters').click();
  assert.equal(app.el('channel-search').value, '');
  assert.equal(app.el('category').value, '');
  assert.equal(app.el('channel-grid').children.length, 24);
});

test('old scan callbacks cannot update or clear a newer search', async t => {
  const app = await setup(t, { manual: true });
  await app.search('Canal 28');
  const older = app.batches.at(-1);
  await app.search('Canal 29');
  const current = app.batches.at(-1);
  assert.equal(older.signal.aborted, true);
  older.onResult(older.items[0], { ok: true, checkedAt: Date.now() });
  older.resolve();
  await settle();
  assert.equal(app.el('channel-grid').children.length, 0);
  assert.equal(app.el('channel-grid').getAttribute('aria-busy'), 'true');
  current.onResult(current.items[0], { ok: true, checkedAt: Date.now() });
  current.resolve();
  await settle();
  assert.match(app.el('channel-grid').textContent, /Canal 29/);
  await app.search('Canal 28');
  assert.equal(app.el('channel-grid').children.length, 0, 'aborted result must not enter the cache');
});

test('an unexpected scan failure releases the busy state and permits another search', async t => {
  const app = await setup(t, { manual: true });
  await app.search('Canal 28');
  app.batches.at(-1).reject(new Error('Decoder allocation failed'));
  await settle();
  assert.equal(app.el('channel-grid').getAttribute('aria-busy'), 'false');
  assert.equal(app.el('scan-more').hidden, false);
  await app.search('Canal 29');
  const current = app.batches.at(-1);
  current.onResult(current.items[0], { ok: true, checkedAt: Date.now() });
  current.resolve();
  await settle();
  assert.match(app.el('channel-grid').textContent, /Canal 29/);
});

test('Enter runs the latest search immediately without leaving a duplicate debounce', async t => {
  const app = await setup(t);
  const input = app.el('channel-search');
  input.value = 'Canal 31';
  input.dispatchEvent(new app.window.Event('input'));
  const enter = new app.window.Event('keydown');
  enter.key = 'Enter';
  input.dispatchEvent(enter);
  await settle();
  assert.match(app.el('channel-grid').textContent, /Canal 31/);
  const count = app.batches.length;
  await app.runTimers(450);
  assert.equal(app.batches.length, count);
});
