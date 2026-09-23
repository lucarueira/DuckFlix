const { test } = require('node:test');
const assert = require('node:assert/strict');
const { candidate, connect, probe, orderedEpisodes } = require('../extensoes-media.js');
class Video extends EventTarget {
  readyState = 0; videoWidth = 0; duration = 100; currentTime = 0;
  canPlayType() { return ''; } pause() { this.paused = true; } load() {}
  removeAttribute() { delete this.src; } play() { return Promise.resolve(); }
  image() { this.readyState = 2; this.videoWidth = 640; this.dispatchEvent(new Event('loadeddata')); }
}
test('HTTPS upgrades remain candidates, while credentials, torrents and custom headers are rejected', () => {
  assert.equal(candidate({ url: 'http://example.com:80/a.mp4' }).url, 'https://example.com/a.mp4');
  for (const stream of [{ url: 'javascript:alert(1)' }, { url: 'https://u:p@example.com/a' }, { infoHash: 'abc' }, { url: 'https://example.com/a', behaviorHints: { proxyHeaders: { request: { Referer: 'x' } } } }]) assert.equal(candidate(stream), null);
  const result = candidate({ name: 'Hidden Provider 1080p', title: 'Dublado', url: 'https://example.com/a.m3u8' });
  assert.equal(result.quality, '1080P'); assert.equal(result.language, 'Dublado'); assert.equal(result.mode, 'hls');
});
test('probe approves a decoded frame, never an HTTP response or metadata alone', async () => {
  const video = new Video(); let finished = false;
  const pending = probe({ url: 'https://example.com/a.mp4', mode: 'auto' }, { createVideo: () => video, Hls: null }).then(r => { finished = true; return r; });
  video.dispatchEvent(new Event('loadedmetadata')); video.dispatchEvent(new Event('loadeddata')); await Promise.resolve(); assert.equal(finished, false);
  video.image(); assert.equal((await pending).ok, true); assert.equal(video.src, undefined); assert.equal(video.muted, true);
});
test('failed and cancelled probes release media without producing a usable option', async () => {
  const video = new Video(); const controller = new AbortController();
  const pending = probe({ url: 'https://example.com/a' }, { createVideo: () => video, Hls: null, signal: controller.signal });
  controller.abort(); assert.equal(await pending, null); assert.equal(video.src, undefined);
  const timeout = await probe({ url: 'https://example.com/a' }, { createVideo: () => new Video(), Hls: null, timeoutMs: 5 }); assert.equal(timeout.ok, false);
});
test('opaque HLS falls back from native playback and shares the confirmed engine with the player', async () => {
  let hls;
  class Hls {
    static Events = { ERROR: 'error' }; static isSupported() { return true; }
    constructor() { hls = this; } on(_, callback) { this.callback = callback; } loadSource(url) { this.url = url; } attachMedia() {} destroy() { this.destroyed = true; }
  }
  const video = new Video(); const pending = probe({ url: 'https://example.com/opaque', mode: 'auto' }, { createVideo: () => video, Hls });
  video.dispatchEvent(new Event('error')); assert.equal(hls.url, 'https://example.com/opaque'); video.image();
  assert.deepEqual(await pending, { ok: true, mode: 'hls' }); assert.equal(hls.destroyed, true);
});
test('autoplay denial asks for user play rather than rejecting a working source', async () => {
  const video = new Video(); let blocked = 0, failed = 0;
  video.play = () => Promise.reject(Object.assign(new Error(), { name: 'NotAllowedError' }));
  const connection = connect(video, { url: 'https://example.com/a' }, { Hls: null, autoplay: true, onBlocked: () => blocked++, onError: () => failed++ });
  video.image(); await Promise.resolve(); assert.equal(blocked, 1); assert.equal(failed, 0); connection.dispose();
});
test('episode order is numeric, deduplicated and excludes future releases', () => {
  const now = Date.parse('2026-09-22');
  const episodes = orderedEpisodes([{ id: 'b', season: 2, episode: 1 }, { id: 'a', season: 1, episode: 10 }, { id: 'z', season: 1, episode: 2 }, { id: 'a', season: 1, episode: 10 }, { id: 'future', season: 3, episode: 1, released: '2030-01-01' }], now);
  assert.deepEqual(episodes.map(ep => ep.id), ['z', 'a', 'b']);
});
