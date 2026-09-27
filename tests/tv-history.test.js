const test = require('node:test');
const assert = require('node:assert/strict');
const { create, KEY } = require('../tv-history');

test('favorites persist independently and remove by stable addon endpoint', () => {
  const storage = memory();
  const history = create(storage);
  const favorites = create(storage, { key: 'duckflix.tv.favorites', limit: 100 });
  const channel = { name: 'TV', url: 'https://video.example/temporary', addonEndpoint: 'https://addon.example/stream/tv/a.json' };
  favorites.add(channel);
  channel.url = 'https://video.example/renewed';
  assert.equal(favorites.has(channel), true);
  assert.equal(create(storage, { key: favorites.key }).list().length, 1);
  history.clear();
  assert.equal(favorites.list().length, 1);
  favorites.remove(channel);
  assert.equal(favorites.list().length, 0);
});

function memory(initial) {
  const values = new Map(initial ? [[KEY, initial]] : []);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}

test('TV history stores only successful channel metadata, deduplicates and survives reload', () => {
  const storage = memory();
  const history = create(storage, { limit: 3 });
  history.add({ name: 'Canal A', url: 'https://video.example/a.m3u8', logo: 'http://unsafe/logo', categories: ['News'] }, 10);
  history.add({ name: 'Canal B', url: 'https://video.example/b.m3u8', categories: ['Sports'] }, 20);
  history.add({ name: 'Canal A atualizado', url: 'https://video.example/a.m3u8', categories: ['General'] }, 30);
  const restored = create(storage, { limit: 3 }).list();
  assert.deepEqual(restored.map(channel => channel.name), ['Canal A atualizado', 'Canal B']);
  assert.equal(restored[0].logo, '');
  assert.equal(restored[0].search, 'canal a atualizado');
});

test('TV history stores addon endpoint instead of expiring resolved stream and rejects unsafe records', () => {
  const storage = memory();
  const history = create(storage);
  history.add({ name: 'Addon TV', url: 'https://temporary.example/token.m3u8', addonEndpoint: 'https://addon.example/stream/tv/one.json' }, 50);
  history.add({ name: 'Unsafe', url: 'javascript:alert(1)' }, 60);
  const [saved] = history.list();
  assert.equal(saved.url, 'https://addon.example/stream/tv/one.json');
  assert.equal(saved.addonEndpoint, 'https://addon.example/stream/tv/one.json');
  assert.equal(history.list().length, 1);
  history.clear();
  assert.deepEqual(history.list(), []);
});
