const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { createServer } = require('../together-server');
const sync = require('../together-sync');
const client = require('../together-client');
const extensions = require('../extensoes');
const mediaCore = require('../extensoes-media');
const until = async fn => { for (let i = 0; i < 200; i++) { if (fn()) return; await new Promise(resolve => setTimeout(resolve, 5)); } assert.fail('UI did not reach expected state'); };
function app(base, label) {
  const { window: dom, document } = parseHTML(fs.readFileSync('together.html', 'utf8'));
  const el = id => document.getElementById(id), data = new Map(), intervals = new Map();
  let timerId = 0, safe = false;
  for (const id of ['room-speed', 'together-season', 'together-episode']) Object.defineProperty(el(id), 'value', { value: '1', writable: true });
  for (const element of document.querySelectorAll('*')) element.scrollIntoView = () => {};
  const video = el('together-video');
  video.currentTime = 0; video.duration = 500; video.paused = true;
  video.pause = () => { video.paused = true; };
  video.play = () => { video.paused = false; return Promise.resolve(); };
  const location = { href: 'https://duckflix42.netlify.app/together.html', pathname: '/together.html', hash: '' };
  const history = { replaceState(a, b, value) { const url = new URL(value, location.href); location.href = url.href; location.hash = url.hash; } };
  const sessionStorage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const window = {
    document, addEventListener: dom.addEventListener.bind(dom), dispatchEvent: dom.dispatchEvent.bind(dom),
    DuckTogetherSync: sync, DuckTogetherClient: client, DuckTogetherConfig: { serverUrl: base }, DuckFlixTMDB: { apiKey: 'test' },
    DuckFlixSafety: { allowed: async () => !safe },
    DuckFlixExtensions: { ...extensions, async requestJSON(url) {
      if (url.includes('/search/multi')) return { results: [{ id: 12, title: 'Shared movie', media_type: 'movie' }] };
      if (url.includes('/external_ids')) return { imdb_id: 'tt12' };
      if (url.endsWith('/manifest.json')) return { id: 'fixture', name: 'Provider', resources: ['stream'], types: ['movie'], catalogs: [] };
      return { streams: [{ url: 'https://video.example/movie.mp4' }] };
    } },
    DuckFlixMedia: { ...mediaCore, probe: async () => ({ ok: true, mode: 'native' }), connect(video, source, options) {
      let disposed = false; video.src = source.url;
      queueMicrotask(() => { if (!disposed) options.onReady(); });
      return { dispose() { disposed = true; video.pause(); video.removeAttribute('src'); video.src = ''; } };
    } }
  };
  const context = vm.createContext({ window, document, location, history, sessionStorage, URL, URLSearchParams, AbortController, console, navigator: {},
    setInterval: (fn, delay) => { intervals.set(++timerId, { fn, delay }); return timerId; }, clearInterval: id => intervals.delete(id) });
  vm.runInContext(fs.readFileSync('together.js', 'utf8'), context);
  el('member-name').value = label;
  return { el, video, window, document, data,
    event: (id, type) => el(id).dispatchEvent(new dom.Event(type, { cancelable: true })),
    tick: () => { for (const timer of intervals.values()) if (timer.delay === 500) timer.fn(); },
    safe() { safe = true; window.dispatchEvent(new dom.Event('duckflix:modechange')); },
    close: () => window.dispatchEvent(new dom.Event('pagehide'))
  };
}
test('Together UI creates and joins real rooms, publishes a movie, shares controls and respects guest Modo Livre', async t => {
  const server = createServer({ actionDelay: 0 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, leader = app(base, 'Leader'), guest = app(base, 'Guest');
  t.after(() => { leader.close(); guest.close(); server.shutdown(); });
  await until(() => !leader.el('create-room').disabled && !guest.el('join-room').disabled);
  leader.el('create-room').click(); await until(() => leader.el('member-count').textContent === '1');
  const invite = leader.el('invite-link').value;
  const credential = JSON.parse(leader.data.get('duckflix.together.session')).credential;
  assert.equal(invite.includes(credential), false);
  guest.el('room-invite').value = invite; guest.event('join-form', 'submit');
  await until(() => guest.el('member-count').textContent === '2');
  assert.equal(guest.el('host-picker').hidden, true); assert.equal(guest.el('room-play').disabled, true);
  leader.el('together-search').value = 'Shared'; leader.event('together-search-form', 'submit');
  await until(() => leader.el('together-results').children.length > 0);
  leader.el('together-results').firstElementChild.click(); await until(() => leader.el('together-sources').children.length > 0);
  leader.el('together-sources').firstElementChild.click();
  await until(() => leader.video.src && guest.video.src && !leader.el('room-play').disabled);
  assert.equal(guest.video.src, leader.video.src);
  await new Promise(resolve => setTimeout(resolve, 100));
  leader.el('room-play').click(); await until(() => !leader.video.paused && !guest.video.paused);
  await new Promise(resolve => setTimeout(resolve, 100));
  leader.el('room-play').click(); await until(() => leader.video.paused && guest.video.paused);
  assert.equal(guest.video.currentTime, leader.video.currentTime);
  guest.safe(); await until(() => guest.el('media-status').textContent.includes('Modo Livre'));
  assert.equal(guest.video.src, '');
  assert.doesNotMatch(guest.el('together-title').textContent, /Shared movie/);
  assert.match(leader.el('together-title').textContent, /Shared movie/);
  guest.el('leave-room').click(); await until(() => guest.el('room-entry').hidden === false);
  assert.equal(guest.data.has('duckflix.together.session'), false);
});
