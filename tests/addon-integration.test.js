const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../extensoes');
const media = require('../extensoes-media');
const tv = require('../tv-addons');
const { parsePlaylist } = require('../tv');
function globals(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const previous = globalThis[key]; globalThis[key] = value;
    t.after(() => { if (previous === undefined) delete globalThis[key]; else globalThis[key] = previous; });
  }
}
test('working addon JSON stays direct; only fixed addon network errors fall back to extension', async t => {
  const calls = [];
  globals(t, { fetch: async () => ({ ok: true, json: async () => ({ direct: true }) }), DuckFlixExtension: { connected: true, fetchJSON: async url => { calls.push(url); return { bridged: true }; } } });
  const url = api.FIXED_ADDONS[1].url;
  assert.deepEqual(await api.requestJSON(url), { direct: true }); assert.equal(calls.length, 0);
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await api.requestJSON(url), { bridged: true }); assert.equal(calls.length, 1);
  await assert.rejects(api.requestJSON('https://api.themoviedb.org/3/search/multi'));
  await assert.rejects(api.requestJSON('https://unconfigured.example/manifest.json'));
  assert.equal(calls.length, 1);
});
test('extension supports MIME-declared HLS without changing HTTPS, MP4 or torrent handling', t => {
  const stream = { url: 'http://video.example/play?id=10', mimeType: 'application/vnd.apple.mpegurl' };
  const normal = media.candidate(stream);
  globals(t, { DuckFlixExtension: { connected: true } });
  const extended = media.candidate(stream);
  assert.match(normal.url, /^https:/); assert.equal(extended.url, stream.url); assert.equal(extended.mode, 'hls');
  assert.match(media.candidate({ url: 'http://video.example/movie.mp4' }).url, /^https:/);
  assert.equal(media.candidate({ infoHash: 'torrent' }), null);
  assert.equal(media.candidate({ url: 'https://video.example/live.m3u8' }).url, 'https://video.example/live.m3u8');
});
test('TV directory preserves all HTTPS entries and adds only HTTP HLS when explicitly enabled', () => {
  const list = '#EXTM3U\n#EXTINF:-1,Existing\nhttps://video.example/live.m3u8\n#EXTINF:-1,HTTP\nhttp://video.example/live.m3u8\n#EXTINF:-1,MP4\nhttp://video.example/movie.mp4';
  const normal = parsePlaylist(list), extended = parsePlaylist(list, { allowHTTP: true });
  assert.equal(normal.channels.length, 1); assert.equal(extended.channels.length, 2);
  assert.deepEqual(extended.channels[0], normal.channels[0]);
});
test('BestCine TV is additive with extension and a failed new provider preserves old catalogs', async t => {
  globals(t, { DuckFlixExtension: { connected: true } });
  const calls = [];
  const channels = await tv.load(new AbortController().signal, async url => {
    calls.push(url);
    if (url.includes('bestcine')) throw new Error('offline');
    return { ok: true, json: async () => ({ metas: [{ id: 'old', name: 'Existing' }] }) };
  });
  assert.ok(calls.some(url => url.includes('bestcine_tv_catalog')));
  assert.equal(channels.length, 2);
  globalThis.DuckFlixExtension.connected = false; calls.length = 0;
  await tv.load(new AbortController().signal, async url => { calls.push(url); return { ok: true, json: async () => ({ metas: [] }) }; });
  assert.equal(calls.some(url => url.includes('bestcine')), false);
});
