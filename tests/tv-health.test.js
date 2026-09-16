const { test } = require('node:test');
const assert = require('node:assert/strict');
const { probeChannel, scanChannels, isAvailable, isFresh, FRESH_MS } = require('../tv-health.js');

class Video extends EventTarget {
  readyState = 0;
  videoWidth = 0;
  paused = false;
  removed = false;
  canPlayType() { return 'probably'; }
  pause() { this.paused = true; }
  removeAttribute(key) { if (key === 'src') { this.removed = true; delete this.src; } }
  load() {}
  image() { this.readyState = 2; this.videoWidth = 640; this.dispatchEvent(new Event('loadeddata')); }
}
const options = video => ({ createVideo: () => video, timeoutMs: 200 });

test('only approves a decoded video image, not metadata or a manifest', async () => {
  const video = new Video();
  let settled = false;
  const pending = probeChannel('https://example.com/live.m3u8', options(video)).then(result => { settled = true; return result; });
  video.dispatchEvent(new Event('loadedmetadata'));
  video.dispatchEvent(new Event('loadeddata'));
  await Promise.resolve();
  assert.equal(settled, false);
  video.image();
  assert.equal((await pending).ok, true);
  assert.equal(video.muted, true);
  assert.equal(video.paused, true);
  assert.equal(video.removed, true);
});

test('timeouts and decoding errors never enter the available list', async () => {
  const timeout = await probeChannel('https://example.com/live', { ...options(new Video()), timeoutMs: 5 });
  assert.equal(isAvailable(timeout), false);
  const video = new Video();
  const pending = probeChannel('https://example.com/live', options(video));
  video.dispatchEvent(new Event('error'));
  assert.equal((await pending).ok, false);
  assert.equal(video.paused, true);
});

test('abort releases the player without marking a channel offline', async () => {
  const video = new Video();
  const controller = new AbortController();
  const pending = probeChannel('https://example.com/live', { ...options(video), signal: controller.signal });
  controller.abort();
  assert.equal(await pending, null);
  assert.equal(video.removed, true);
  assert.equal(await probeChannel('https://example.com/live', { signal: controller.signal, createVideo() { throw new Error('Must not allocate'); } }), null);
});

test('HLS fatal errors destroy the probe and never count as success', async () => {
  let instance;
  class Hls {
    static Events = { ERROR: 'error' };
    static isSupported() { return true; }
    constructor() { instance = this; }
    on(_event, callback) { this.callback = callback; }
    loadSource() {}
    attachMedia() {}
    destroy() { this.destroyed = true; }
  }
  const video = new Video();
  video.canPlayType = () => '';
  const pending = probeChannel('https://example.com/live', { ...options(video), Hls });
  instance.callback('error', { fatal: true });
  assert.equal((await pending).ok, false);
  assert.equal(instance.destroyed, true);
});

test('unsupported browsers and unsafe streams fail closed', async () => {
  const video = new Video();
  video.canPlayType = () => '';
  assert.equal((await probeChannel('https://example.com/live', { ...options(video), Hls: null })).ok, false);
  for (const url of ['http://example.com/live', 'javascript:alert(1)', 'https://user:pass@example.com/live']) {
    assert.equal((await probeChannel(url, options(new Video()))).ok, false);
  }
});

test('successful checks expire after five minutes; failed checks remain unavailable', () => {
  const checkedAt = 10000;
  assert.equal(isAvailable({ ok: true, checkedAt }, checkedAt + FRESH_MS - 1), true);
  assert.equal(isAvailable({ ok: true, checkedAt }, checkedAt + FRESH_MS), false);
  assert.equal(isAvailable({ ok: false, checkedAt }, checkedAt), false);
  assert.equal(isFresh({ ok: false, checkedAt }, checkedAt), true);
  assert.equal(isAvailable(undefined), false);
});

test('scan limits simultaneous decoders to two and visits every candidate once', async () => {
  let active = 0;
  let peak = 0;
  const visited = [];
  await scanChannels(Array.from({ length: 7 }, (_, id) => ({ url: String(id) })), {
    signal: new AbortController().signal,
    probe: async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 2));
      active--;
      return { ok: true, checkedAt: Date.now() };
    },
    onResult: channel => visited.push(channel.url)
  });
  assert.equal(peak, 2);
  assert.equal(new Set(visited).size, 7);
});

test('cancelled scans cannot overwrite results from a newer selection', async () => {
  const controller = new AbortController();
  let calls = 0;
  let results = 0;
  await scanChannels([{ url: '1' }, { url: '2' }, { url: '3' }], {
    signal: controller.signal,
    probe: async () => { calls++; controller.abort(); return { ok: true, checkedAt: Date.now() }; },
    onResult: () => { results++; }
  });
  assert.equal(calls, 1);
  assert.equal(results, 0);
});
