const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHTML } = require('linkedom');
const { create } = require('../home-search');
const settle = () => new Promise(resolve => setImmediate(resolve));
const item = (id, media_type = 'movie') => ({ id, media_type, title: `Title ${id}`, poster_path: '/poster.jpg' });
function setup(fetchPage) {
  const { window, document } = parseHTML('<input><button id="submit"></button><button id="more"></button><p></p><div></div>');
  const input = document.querySelector('input'), list = document.querySelector('div'), status = document.querySelector('p');
  const button = document.getElementById('submit'), more = document.getElementById('more');
  const timers = new Map(); let n = 0, opened = false;
  const api = create({ input, list, status, button, more, fetchPage, render: data => { const el = document.createElement('span'); el.textContent = data.title; list.append(el); }, open: () => { opened = true; }, close: () => { opened = false; }, schedule: (fn, delay) => { timers.set(++n, { fn, delay }); return n; }, cancel: id => timers.delete(id) });
  return { ...api, input, list, status, button, more, get opened() { return opened; }, type(value) { input.value = value; input.dispatchEvent(new window.Event('input')); }, async tick() { for (const [id, timer] of [...timers]) if (timer.delay === 350) { timers.delete(id); timer.fn(); } await settle(); }, timers };
}
test('typing searches, paginates with type-aware deduplication and clearing restores catalog', async () => {
  const app = setup(async (q, page) => ({ results: page === 1 ? [item(1), item(2, 'person')] : [item(1), item(1, 'tv')], total_pages: 2 }));
  app.type('film'); await app.tick();
  assert.equal(app.opened, true); assert.equal(app.list.childElementCount, 1); assert.equal(app.more.hidden, false);
  await app.more.onclick(); assert.equal(app.list.childElementCount, 2); assert.equal(app.more.hidden, true);
  app.type(''); assert.equal(app.opened, false); assert.equal(app.list.childElementCount, 0);
});
test('replacement queries abort in flight and stale responses cannot overwrite or reopen cleared results', async () => {
  const pending = [];
  const app = setup((q, page, signal) => new Promise(resolve => pending.push({ q, signal, resolve })));
  app.type('old'); await app.tick(); app.type('new'); await app.tick();
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve({ results: [item(2)] }); await settle();
  pending[0].resolve({ results: [item(1)] }); await settle(); assert.equal(app.list.textContent, 'Title 2');
  app.type('last'); await app.tick(); app.type(''); pending[2].resolve({ results: [item(3)] }); await settle();
  assert.equal(app.opened, false); assert.equal(app.list.childElementCount, 0);
});
test('submit cancels debounce, errors release busy state and retry preserves the failed page', async () => {
  let calls = 0;
  const app = setup(async () => { if (++calls === 1) throw new Error('offline'); return { results: [item(1)] }; });
  app.type('film'); await app.button.onclick(); await app.tick();
  assert.equal(calls, 1); assert.equal(app.list.getAttribute('aria-busy'), 'false'); assert.equal(app.more.hidden, false);
  await app.more.onclick(); assert.equal(calls, 2); assert.equal(app.list.childElementCount, 1);
});
