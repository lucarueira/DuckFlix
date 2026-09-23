const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { parseHTML } = require('linkedom');
function fixture(fetcher, values = {}) {
  const { window, document } = parseHTML('<html><body><button id="btnModoLivre"></button></body></html>');
  const storage = new Map(Object.entries(values));
  window.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  window.fetch = fetcher;
  window.DuckFlixTMDB = { apiKey: 'test' };
  vm.runInNewContext(fs.readFileSync('content-policy.js', 'utf8'), { window, URL, DOMException, AbortController, CustomEvent: window.CustomEvent, setTimeout, clearTimeout });
  return { window, document, policy: window.DuckFlixSafety, storage };
}
const reply = data => ({ ok: true, json: async () => data });
const ratings = (type, value) => ({ results: [{ iso_3166_1: 'BR', ...(type === 'tv' ? { rating: value } : { release_dates: [{ certification: value }] }) }] });
test('Brazilian ratings exclude 18 and unknown; animation and romance are not age ratings', async () => {
  const { policy } = fixture(async url => reply(ratings(url.includes('/tv/') ? 'tv' : 'movie', { 1: 'L', 2: '16', 3: '18', 4: '' }[url.match(/\/(?:movie|tv)\/(\d+)\//)[1]])), { 'duckflix.modoLivre': 'true' });
  const items = [1, 2, 3, 4].map(id => ({ id, title: `Title ${id}`, genre_ids: [16, 10749] }));
  assert.deepEqual(Array.from(await policy.filter(items), i => i.id), [1, 2]);
  assert.equal(policy.certification({ results: [{ iso_3166_1: 'BR', release_dates: [{ certification: '14' }, { certification: '18' }] }] }, 'movie'), 18);
  assert.equal(policy.certification({ results: [{ iso_3166_1: 'US', rating: 'TV-PG' }] }, 'tv'), null);
});
test('search responses, history and favorites share the same rating check and type-aware cache', async () => {
  const calls = [];
  const { policy } = fixture(async url => {
    calls.push(url);
    if (url.includes('/search/')) return reply({ results: [{ id: 7, media_type: 'movie', title: 'Film' }, { id: 7, media_type: 'tv', name: 'Show' }, { id: 8, media_type: 'person', name: 'Actor' }] });
    return reply(ratings(url.includes('/tv/') ? 'tv' : 'movie', url.includes('/tv/') ? '18' : '12'));
  }, { 'duckflix.modoLivre': 'true' });
  const data = await (await policy.fetch('https://api.themoviedb.org/3/search/multi?query=test')).json();
  assert.deepEqual(Array.from(data.results, i => i.media_type), ['movie']);
  assert.equal(await policy.allowed({ id: 'tmdb:7', tmdbId: 7, type: 'movie', name: 'Film' }), true);
  assert.equal(await policy.allowed({ id: 7, type: 'serie', title: 'Show' }), false);
  assert.equal(calls.filter(url => /release_dates|content_ratings/.test(url)).length, 2);
  assert.match(calls[0], /include_adult=false/);
});
test('mode switch is accessible, persists across pages and modern false overrides legacy true', async () => {
  const { policy, document, storage, window } = fixture(async () => reply({}), { 'duckflix.modoLivre': 'false', kidsMode: 'true' });
  assert.equal(policy.enabled(), false);
  let changes = 0;
  window.addEventListener('duckflix:modechange', () => changes++);
  document.getElementById('btnModoLivre').click();
  assert.equal(policy.enabled(), true);
  assert.equal(document.getElementById('btnModoLivre').getAttribute('aria-checked'), 'true');
  assert.equal(storage.get('kidsMode'), 'true');
  storage.set('duckflix.modoLivre', 'false');
  const event = new window.Event('storage'); event.key = 'duckflix.modoLivre'; window.dispatchEvent(event);
  assert.equal(policy.enabled(), false);
  assert.equal(changes, 2);
});
test('pending searches are discarded when the mode changes; trailer metadata is not filtered as a title', async () => {
  let release;
  const { policy } = fixture(url => url.includes('/search/') ? new Promise(resolve => { release = resolve; }) : Promise.resolve(reply({ results: [{ key: 'trailer-key', type: 'Trailer' }] })));
  const pending = policy.fetch('https://api.themoviedb.org/3/search/multi?query=test');
  policy.setEnabled(true);
  release(reply({ results: [{ id: 1, title: 'Old result' }] }));
  await assert.rejects(async () => (await pending).json(), { name: 'AbortError' });
  const data = await (await policy.fetch('https://api.themoviedb.org/3/movie/1/videos')).json();
  assert.equal(data.results[0].key, 'trailer-key');
});
test('rating service failures hide titles while enabled and recover on the next request', async () => {
  let fail = true;
  const { policy } = fixture(async () => { if (fail) throw new Error('offline'); return reply(ratings('movie', '14')); }, { 'duckflix.modoLivre': 'true' });
  assert.equal(await policy.allowed({ id: 2, type: 'movie' }), false);
  fail = false;
  assert.equal(await policy.allowed({ id: 2, type: 'movie' }), true);
  assert.equal(policy.channelAllowed({ name: 'Unclassified live channel' }), false);
  policy.setEnabled(false);
  assert.equal(policy.channelAllowed({}), true);
});
test('explicit titles stay hidden without substring false positives and disabled mode needs no rating requests', async () => {
  const { policy } = fixture(() => { throw new Error('Should not fetch'); });
  assert.equal(await policy.allowed({ title: 'Super Hero' }), true);
  assert.equal(await policy.allowed({ title: 'A hero returns', adult: true }), false);
  assert.equal(await policy.allowed({ title: 'Hentai collection' }), false);
});
test('classification requests use at most six network slots and stale queued requests do not leak results', async () => {
  let active = 0, peak = 0;
  const { policy } = fixture(async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setImmediate(resolve)); active--;
    return reply(ratings('movie', '12'));
  }, { 'duckflix.modoLivre': 'true' });
  const result = await policy.filter(Array.from({ length: 24 }, (_, id) => ({ id: id + 1, type: 'movie' })));
  assert.equal(result.length, 24); assert.equal(peak, 6);
  const pending = policy.filter(Array.from({ length: 24 }, (_, id) => ({ id: id + 40, type: 'movie' })));
  policy.setEnabled(false);
  await assert.rejects(pending, { name: 'AbortError' });
});
