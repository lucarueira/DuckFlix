const test = require('node:test');
const assert = require('node:assert/strict');
const queueCore = require('../extensoes-queue.js');
const playerCore = require('../extensoes-player.js');
const { fixture, settle } = require('./extensions-fixture');
const movie = id => ({ id: `tmdb:${id}`, tmdbId: id, name: `Movie ${id}`, type: 'movie' });
function setup(t, { streams, details, allowed, media: customizeMedia } = {}) {
  const app = fixture(), timers = new Map(), played = [], events = [];
  let timerId = 0, queue;
  const media = { ...app.media, ...customizeMedia };
  const player = playerCore.create({ document: app.document, media,
    getDetails: details || (async item => item),
    getStreams: streams || (async (id, type, signal, batch) => batch([{ url: `https://video.example/${id}.mp4` }])),
    onMovieFinished: event => { events.push(event); queue.advance(event); },
    onClose: () => queue.stop(), onManualOpen: () => queue.stop(),
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: id => timers.delete(id)
  });
  queue = queueCore.create({ allowed, play: (item, token) => { played.push(item.id); return player.open(item, { queueToken: token }); } });
  t.after(() => player.close());
  return { ...app, player, queue, timers, played, events };
}
test('saved list deduplicates movie identities, supports ordering/removal and survives reload without autoplay', () => {
  const data = new Map(), storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const queue = queueCore.create({ storage, play: () => assert.fail('Should not autoplay') });
  assert.equal(queue.add(movie(1)), true); assert.equal(queue.add(movie(2)), true);
  assert.equal(queue.add({ ...movie(1), id: 'tt999' }), false);
  assert.equal(queue.add({ ...movie(3), type: 'series' }), false);
  queue.move('tmdb:2', -1);
  const restored = queueCore.create({ storage });
  assert.deepEqual(restored.snapshot().items.map(i => i.id), ['tmdb:2', 'tmdb:1']);
  assert.equal(restored.snapshot().active, false);
  restored.remove('tmdb:1'); assert.equal(restored.snapshot().items.length, 1);
  restored.clear(); assert.equal(JSON.parse([...data.values()][0]).length, 0);
});
test('ended advances through movies once and stops at the end without looping or deleting the saved list', async t => {
  const app = setup(t);
  app.queue.add(movie(1)); app.queue.add(movie(2));
  await app.queue.start(); await settle();
  app.video.dispatchEvent(new app.window.Event('ended')); await settle();
  assert.deepEqual(app.played, ['tmdb:1', 'tmdb:2']);
  assert.equal(app.queue.snapshot().current, 'tmdb:2');
  app.video.dispatchEvent(new app.window.Event('ended')); await settle();
  assert.equal(app.queue.snapshot().active, false);
  assert.match(app.queue.snapshot().message, /concluída/);
  assert.equal(app.queue.snapshot().items.length, 2);
  app.video.dispatchEvent(new app.window.Event('ended')); await settle();
  assert.equal(app.played.length, 2);
});
test('missing sources and failed metadata skip to the next playable movie', async t => {
  const app = setup(t, {
    details: async item => { if (item.tmdbId === 1) throw new Error('Offline'); return item; },
    streams: async (id, type, signal, batch) => batch(id === 'tmdb:2' ? [] : [{ url: 'https://video.example/good.mp4' }])
  });
  for (const id of [1, 2, 3]) app.queue.add(movie(id));
  await app.queue.start(); await settle();
  assert.deepEqual(app.played, ['tmdb:1', 'tmdb:2', 'tmdb:3']);
  assert.equal(app.video.src, 'https://video.example/good.mp4');
  assert.equal(app.queue.snapshot().active, true);
});
test('queue scans beyond the first source batch but caps attempts and terminates an entirely broken list', async t => {
  const app = setup(t, { streams: async (id, type, signal, batch) => batch(Array.from({ length: 60 }, (_, i) => ({ url: `https://video.example/broken-${id}-${i}.mp4` }))) });
  app.queue.add(movie(1)); app.queue.add(movie(2));
  await app.queue.start();
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(app.queue.snapshot().active, false);
  assert.deepEqual(app.played, ['tmdb:1', 'tmdb:2']);
  assert.equal(app.probes.length, 72);
  assert.equal(app.events.length, 2);
});
test('a failed playing source tries alternatives before skipping the movie', async t => {
  const app = setup(t, { streams: async (id, type, signal, batch) => batch([{ url: `https://video.example/${id}-a.mp4` }, { url: `https://video.example/${id}-b.mp4` }]) });
  app.queue.add(movie(1)); app.queue.add(movie(2)); await app.queue.start(); await settle();
  app.connections[0].options.onError(); await settle();
  assert.equal(app.played.length, 1); assert.match(app.video.src, /-b.mp4$/);
  app.connections[1].options.onError(); await settle();
  assert.deepEqual(app.played, ['tmdb:1', 'tmdb:2']);
  app.connections[0].options.onError(); await settle();
  assert.equal(app.played.length, 2, 'Old source callbacks must not skip the new movie');
});
test('browser autoplay restrictions wait for a gesture instead of discarding a playable movie', async t => {
  const app = setup(t);
  app.queue.add(movie(1)); app.queue.add(movie(2)); await app.queue.start(); await settle();
  app.connections[0].options.onBlocked();
  assert.equal(app.el('start-video').hidden, false);
  assert.equal([...app.timers.values()].some(timer => timer.delay === 90000), false);
  assert.deepEqual(app.played, ['tmdb:1']);
});

test('a frozen movie times out even when timeupdate fires without playback progress', async t => {
  const app = setup(t);
  app.queue.add(movie(1)); app.queue.add(movie(2)); await app.queue.start(); await settle();
  app.video.dispatchEvent(new app.window.Event('waiting'));
  app.video.dispatchEvent(new app.window.Event('timeupdate'));
  app.video.dispatchEvent(new app.window.Event('stalled'));
  const waiting = [...app.timers].filter(([, timer]) => timer.delay === 25000);
  assert.equal(waiting.length, 1);
  const [id, timer] = waiting[0]; app.timers.delete(id); timer.callback(); await settle();
  assert.deepEqual(app.played, ['tmdb:1', 'tmdb:2']);
});
test('startup watchdog skips a hung title and ignores its late metadata response', async t => {
  let release;
  const app = setup(t, { details: item => item.tmdbId === 1 ? new Promise(resolve => { release = () => resolve(item); }) : Promise.resolve(item) });
  app.queue.add(movie(1)); app.queue.add(movie(2)); app.queue.start(); await settle();
  const [id, timer] = [...app.timers].find(([, timer]) => timer.delay === 90000);
  app.timers.delete(id); timer.callback(); await settle();
  assert.deepEqual(app.played, ['tmdb:1', 'tmdb:2']);
  release(); await settle();
  assert.match(app.el('watch-title').textContent, /Movie 2/);
});
test('closing during source checks cancels the queue and late results cannot restart playback', async t => {
  let release;
  const app = setup(t, { streams: (id, type, signal, batch) => new Promise(resolve => { release = () => { batch([]); resolve(); }; }) });
  app.queue.add(movie(1)); app.queue.add(movie(2)); await app.queue.start(); await settle();
  app.player.close(); release(); await settle();
  assert.equal(app.queue.snapshot().active, false);
  assert.equal(app.el('watch-dialog').open, false);
  assert.equal(app.played.length, 1);
});
test('Modo Livre skips blocked entries without deleting them and cancelled filtering cannot open a movie', async () => {
  const played = [];
  const queue = queueCore.create({ allowed: async item => item.tmdbId !== 18, play: async item => played.push(item.id) });
  queue.add(movie(18)); queue.add(movie(12)); await queue.start();
  assert.deepEqual(played, ['tmdb:12']); assert.equal(queue.snapshot().items.length, 2);
  let release;
  const pending = queueCore.create({ allowed: () => new Promise(resolve => { release = resolve; }), play: () => assert.fail('Cancelled') });
  pending.add(movie(1)); const task = pending.start(); pending.stop(); release(true); await task;
  assert.equal(pending.snapshot().active, false);
});
test('stopping the sequence keeps the current film playing and manual playback ends queue ownership', async t => {
  const app = setup(t);
  app.queue.add(movie(1)); app.queue.add(movie(2)); await app.queue.start(); await settle();
  app.queue.stop(); app.player.detachQueue();
  assert.equal(app.connections[0].disposed, undefined);
  app.video.dispatchEvent(new app.window.Event('ended')); await settle();
  assert.equal(app.played.length, 1);
  await app.queue.start(); await settle();
  await app.player.open(movie(3)); await settle();
  assert.equal(app.queue.snapshot().active, false);
  assert.match(app.el('watch-title').textContent, /Movie 3/);
});
