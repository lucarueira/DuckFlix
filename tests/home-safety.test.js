const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { parseHTML } = require('linkedom');
const settle = () => new Promise(resolve => setImmediate(resolve));
test('home mode toggle removes adult catalog, search results, saved entries and playback without deleting history', async () => {
  const { window, document } = parseHTML(fs.readFileSync('duckflix.html', 'utf8'));
  const el = id => document.getElementById(id);
  const saved = { 18: { id: 18, title: 'Adult film', type: 'filme', poster: '/adult.jpg', visto: 1 }, 12: { id: 12, title: 'Family film', type: 'filme', poster: '/family.jpg', visto: 2 } };
  const storage = new Map([['favs', JSON.stringify(saved)], ['historico', JSON.stringify(saved)]]);
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  window.localStorage = localStorage;
  window.DuckFlixTMDB = { apiKey: 'test' };
  window.scrollTo = () => {};
  for (const element of document.querySelectorAll('*')) element.scrollIntoView = () => {};
  const timers = new Map(); let timerId = 0;
  const setTimeout = (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; };
  const clearTimeout = id => timers.delete(id);
  const fetch = async input => {
    const url = new URL(input);
    let data;
    if (/release_dates|content_ratings/.test(url.pathname)) {
      const rating = url.pathname.includes('/18/') ? '18' : '12';
      data = { results: [{ iso_3166_1: 'BR', rating, release_dates: [{ certification: rating }] }] };
    } else data = { results: [18, 12].map(id => ({ id, title: id === 18 ? 'Adult film' : 'Family film', poster_path: `/${id}.jpg`, media_type: 'movie' })) };
    return { ok: true, json: async () => data };
  };
  window.fetch = fetch;
  const context = vm.createContext({ window, document, localStorage, fetch, URL, URLSearchParams, AbortController, DOMException, CustomEvent: window.CustomEvent, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, console });
  for (const path of ['content-policy.js', 'site.js', 'home-search.js', 'script.js']) vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });
  await settle();
  assert.match(el('filmes').textContent, /Adult film/);
  el('busca').value = 'film';
  el('busca').dispatchEvent(new window.Event('input'));
  for (const [id, timer] of [...timers]) if (timer.delay === 350) { timers.delete(id); timer.callback(); }
  await settle();
  assert.match(el('searchList').textContent, /Adult film/);
  await vm.runInContext('abrirPlayer({ id: 18, title: "Adult film", type: "filme", poster: "/adult.jpg" })', context);
  assert.equal(el('playerArea').classList.contains('hidden'), false);
  el('btnModoLivre').click();
  assert.equal(el('player').childElementCount, 0);
  assert.equal(el('sugestoes').childElementCount, 0);
  await settle();
  for (const id of ['filmes', 'historico', 'favList']) {
    assert.doesNotMatch(el(id).textContent, /Adult film/);
    assert.match(el(id).textContent, /Family film/);
  }
  assert.ok(JSON.parse(storage.get('historico'))[18]);
  el('busca').dispatchEvent(new window.Event('input'));
  for (const [id, timer] of [...timers]) if (timer.delay === 350) { timers.delete(id); timer.callback(); }
  el('btnBusca').click();
  await settle();
  for (const id of ['searchList']) {
    assert.doesNotMatch(el(id).textContent, /Adult film/);
    assert.match(el(id).textContent, /Family film/);
  }
  await vm.runInContext('abrirPlayer({ id: 18, title: "Adult film", type: "filme" })', context);
  assert.equal(el('player').childElementCount, 0);
  el('btnModoLivre').click(); await settle();
  assert.match(el('filmes').textContent, /Adult film/);
});
