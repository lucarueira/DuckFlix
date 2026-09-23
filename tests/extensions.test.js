const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ext = require('../extensoes.js');
const playerCore = require('../extensoes-player.js');
const { fixture, settle } = require('./extensions-fixture');

test('manifest and resource paths preserve configuration and reject unsafe URLs', () => {
  assert.equal(ext.manifestURL('stremio://example.com/config/manifest.json'), 'https://example.com/config/manifest.json');
  for (const value of ['javascript:alert(1)', 'http://example.com/manifest.json', 'https://user:pass@example.com/manifest.json']) assert.throws(() => ext.manifestURL(value));
  assert.equal(ext.resourceURL('https://example.com/config/manifest.json?key=x', 'stream', 'series', 'tt123:1:2'), 'https://example.com/config/stream/series/tt123%3A1%3A2.json?key=x');
  assert.equal(ext.FIXED_ADDONS.some(addon => /flixnest/.test(addon.url)), false);
});
test('TMDB excludes people and adult entries but retains separate film and series IDs', () => {
  const result = ext.tmdbItems([{ id: 1, media_type: 'movie', title: 'Filme' }, { id: 1, media_type: 'tv', name: 'Série' }, { id: 2, media_type: 'person' }, { id: 3, media_type: 'movie', adult: true }]);
  assert.deepEqual(result.map(item => item.type), ['movie', 'series']);
  const url = new URL(ext.tmdbURL('search/multi', { query: 'ação & amor' }, 'test'));
  assert.equal(url.searchParams.get('query'), 'ação & amor'); assert.equal(url.searchParams.get('language'), 'pt-BR');
});
test('resource restrictions respect media types and prefixes', () => {
  const m = { resources: [{ name: 'stream', types: ['movie'], idPrefixes: ['tt'] }] };
  assert.equal(ext.supports(m, 'stream', 'movie', 'tt123'), true);
  assert.equal(ext.supports(m, 'stream', 'series', 'tt123'), false);
});

async function setup(t, override) {
  const app = fixture(), { window, document, el, media } = app;
  const calls = [], timers = new Map(); let timerID = 0;
  window.DuckFlixTMDB = { apiKey: 'test' }; window.DuckFlixExtensions = ext;
  window.DuckFlixPlayer = { create: options => playerCore.create({ ...options, media }) };
  const fetch = async (url, options) => {
    calls.push({ url, options }); const replacement = override?.(url, options); if (replacement) return replacement;
    const parsed = new URL(url); let data;
    if (url.endsWith('/manifest.json')) data = { id: 'test', name: 'Provider', resources: ['stream'], types: ['movie', 'series'], catalogs: [] };
    else if (parsed.pathname.endsWith('/external_ids')) data = { imdb_id: parsed.pathname.includes('/tv/') ? 'tt3' : 'tt1' };
    else if (parsed.pathname.includes('/meta/')) data = { meta: { videos: [{ id: 'tt3:1:1', season: 1, episode: 1 }, { id: 'tt3:1:2', season: 1, episode: 2 }] } };
    else if (parsed.pathname.includes('/stream/')) data = { streams: [{ name: 'SECRET PROVIDER 1080p', title: 'Dublado', url: 'https://video.example/good.mp4' }, { url: 'https://video.example/broken.mp4' }, { name: 'Paid tier', externalUrl: 'https://example.com/pay' }] };
    else if (parsed.pathname.endsWith('/search/multi')) data = { total_pages: 2, results: [{ id: Number(parsed.searchParams.get('page')) + 100, media_type: 'movie', title: `${parsed.searchParams.get('query')} página ${parsed.searchParams.get('page')}` }] };
    else data = { total_pages: 1, results: [{ id: 1, title: 'Ação <img src=x onerror=alert(1)>', name: 'Uma série', genre_ids: [16], original_language: 'ja' }] };
    return { ok: true, json: async () => data };
  };
  const context = vm.createContext({ window, document, URL, URLSearchParams, AbortController, console, fetch,
    setTimeout: (callback, delay) => { const id = ++timerID; timers.set(id, { callback, delay }); return id; }, clearTimeout: id => timers.delete(id) });
  vm.runInContext(fs.readFileSync('extensoes.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('extensoes-app.js', 'utf8'), context);
  await settle(); t.after(() => window.dispatchEvent(new window.Event('pagehide')));
  async function search(query, submit = true) {
    el('catalog-search').value = query; el('catalog-search').dispatchEvent(new window.Event('input'));
    if (submit) el('search-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    else for (const [id, timer] of [...timers]) if (timer.delay === 350) { timers.delete(id); timer.callback(); }
    await settle();
  }
  return { ...app, calls, timers, search };
}
test('global search paginates, handles Enter, restores browse and treats names as text', async t => {
  const app = await setup(t);
  assert.equal(app.el('addon-form'), null); assert.equal(app.el('catalog-select'), null);
  assert.match(app.el('catalog-grid').textContent, /<img src=x/); assert.equal(app.el('catalog-grid').querySelector('img'), null);
  await app.search('Harry Potter & amigos'); assert.match(app.el('catalog-grid').textContent, /página 1/);
  assert.equal([...app.timers.values()].some(timer => timer.delay === 350), false);
  app.el('load-more').click(); await settle(); assert.equal(app.el('catalog-grid').children.length, 2); assert.equal(app.el('load-more').hidden, true);
  await app.search(''); assert.match(app.el('catalog-grid').textContent, /Ação/);
});
test('simple anime category requests Japanese animation, without exposing addon catalogs', async t => {
  const app = await setup(t); app.document.querySelector('[data-category="anime"]').click(); await settle();
  const call = app.calls.find(call => call.url.includes('/discover/tv'));
  assert.equal(new URL(call.url).searchParams.get('with_genres'), '16'); assert.equal(new URL(call.url).searchParams.get('with_original_language'), 'ja');
  assert.match(app.el('catalog-grid').textContent, /Anime/);
  assert.doesNotMatch(app.document.body.textContent, /FenixFlix|Flix Streams|BestCine|Zeus|FrostStream/);
});
test('film identities query all free addons, deduplicate and display only verified anonymous options', async t => {
  const app = await setup(t); app.el('catalog-grid').firstElementChild.click(); await settle();
  assert(app.calls.some(call => call.url.includes('/movie/1/external_ids')));
  for (const addon of ext.FIXED_ADDONS) assert(app.calls.some(call => call.url === ext.resourceURL(addon.url, 'stream', 'movie', 'tt1')));
  assert.equal(app.el('stream-list').children.length, 1); assert.equal(app.probes.length, 2);
  assert.doesNotMatch(app.el('stream-list').textContent, /SECRET|PROVIDER|Paid/);
  assert.equal(app.video.src, 'https://video.example/good.mp4');
});
test('series resolve episodes and automatically query the next episode', async t => {
  const app = await setup(t); app.document.querySelector('[data-category="series"]').click(); await settle();
  app.el('catalog-grid').firstElementChild.click(); await settle();
  assert.equal(app.el('episode-list').children.length, 2);
  app.video.dispatchEvent(new app.window.Event('ended')); await settle();
  assert(app.calls.some(call => call.url.includes('/stream/series/tt3%3A1%3A2.json')));
});
test('addon failures do not block search and stale queries cannot replace newer results', async t => {
  let resolve;
  const app = await setup(t, url => url.endsWith('/manifest.json') ? Promise.resolve({ ok: false, status: 503 }) : url.includes('/search/multi') && new URL(url).searchParams.get('query') === 'Antiga' ? new Promise(done => { resolve = done; }) : null);
  await app.search('Antiga'); await app.search('Nova');
  resolve({ ok: true, json: async () => ({ results: [{ id: 5, media_type: 'movie', title: 'Antiga' }], total_pages: 1 }) }); await settle();
  assert.match(app.el('catalog-grid').textContent, /Nova/); assert.doesNotMatch(app.el('catalog-grid').textContent, /Antiga/);
  assert.equal(app.el('catalog-grid').getAttribute('aria-busy'), 'false');
});
test('search failures release loading state and another query recovers', async t => {
  const app = await setup(t, url => url.includes('/search/multi') && new URL(url).searchParams.get('query') === 'Erro' && Promise.resolve({ ok: false, status: 503 }));
  await app.search('Erro'); assert.match(app.el('catalog-status').textContent, /503/); assert.equal(app.el('catalog-grid').getAttribute('aria-busy'), 'false');
  await app.search('Recuperou', false); assert.match(app.el('catalog-grid').textContent, /Recuperou/);
});
