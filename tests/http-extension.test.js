const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { allowedSender, target } = require('../chrome-extension/policy');
const settle = () => new Promise(resolve => setImmediate(resolve));
const sender = { url: 'https://duckflix42.netlify.app/tv.html', frameId: 0, tab: { id: 1 }, documentId: 'test' };
function worker(fetcher, permission = true) {
  let listener;
  const stored = {};
  const chrome = {
    runtime: { getManifest: () => ({ version: '0.1.0' }), onMessage: { addListener: fn => { listener = fn; } } },
    permissions: { contains: async () => permission },
    storage: { session: { set: async data => Object.assign(stored, data) } },
    action: { setBadgeText: async () => {} }, tabs: { onRemoved: { addListener() {} } }
  };
  const context = vm.createContext({ chrome, fetch: fetcher, URL, AbortController, DOMException, setTimeout, clearTimeout, Uint8Array, btoa });
  context.importScripts = name => vm.runInContext(fs.readFileSync(`chrome-extension/${name}`, 'utf8'), context);
  vm.runInContext(fs.readFileSync('chrome-extension/background.js', 'utf8'), context);
  return { stored, send(message, from = sender) { return new Promise(resolve => { if (!listener(message, from, resolve)) resolve(undefined); }); } };
}
test('extension accepts only DuckFlix top-level pages and rejects unsafe destinations', () => {
  assert.equal(allowedSender(sender), true);
  assert.equal(allowedSender({ ...sender, frameId: 1 }), false);
  assert.equal(allowedSender({ ...sender, url: 'https://evil.example' }), false);
  for (const url of ['http://127.1/a', 'http://0x7f000001/a', 'http://192.168.0.1/a', 'http://10.0.0.1/a', 'http://169.254.169.254/a', 'http://[::1]/a', 'http://router.local/a', 'http://localhost/a', 'file:///a', 'http://user:pass@video.example/a', 'http://video.example:22/a']) assert.throws(() => target(url), url);
  assert.equal(target('http://video.example/live.m3u8').origin, 'http://video.example/*');
});
test('missing permission stores only origin and makes no network request', async () => {
  const app = worker(() => { throw new Error('must not fetch'); }, false);
  const result = await app.send({ id: '1', type: 'fetch', url: 'http://video.example/private/path.m3u8?token=secret' });
  assert.equal(result.permission, 'http://video.example/*');
  assert.deepEqual(Object.keys(app.stored), ['http://video.example/*']);
  assert.equal(await app.send({ id: '1', type: 'fetch', url: 'http://video.example/a' }, { ...sender, url: 'https://other.example' }), undefined);
});
test('authorized fetch preserves bytes/ranges, omits cookies and rejects ignored ranges', async () => {
  let options;
  const app = worker(async (url, input) => { options = input; return new Response(new Uint8Array([0, 255, 128, 42]), { status: 206 }); });
  const result = await app.send({ type: 'fetch', id: '1', url: 'http://video.example/segment.ts', range: 'bytes=4-7' });
  assert.equal(result.ok, true); assert.deepEqual([...Buffer.from(result.data, 'base64')], [0,255,128,42]);
  assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error'); assert.equal(options.headers.Range, 'bytes=4-7');
  const bad = worker(async () => new Response('full file'));
  assert.equal((await bad.send({ type: 'fetch', id: '1', url: 'http://video.example/s', range: 'bytes=4-7' })).ok, false);
});
test('cancel aborts background network work and oversized segments fail closed', async () => {
  let signal;
  const app = worker(async (url, options) => { signal = options.signal; return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))); });
  const pending = app.send({ type: 'fetch', id: '1', url: 'http://video.example/live.m3u8' });
  await settle(); await app.send({ type: 'cancel', id: '1' });
  assert.equal(signal.aborted, true); assert.equal((await pending).ok, false);
  const large = worker(async () => new Response(new Uint8Array(24 * 1024 * 1024 + 1)));
  assert.match((await large.send({ type: 'fetch', id: 'big', url: 'http://video.example/huge' })).error, /24 MB/);
});
test('site bridge, content script and worker relay playlist and binary HLS resources end to end', async () => {
  const calls = [];
  const app = worker(async (url, options) => { calls.push({ url, options }); return new Response(url.endsWith('.json') ? JSON.stringify({ metas: [{ name: 'Canal de televisão' }] }) : url.endsWith('m3u8') ? '#EXTM3U\n#EXTINF:5,\nsegment.ts' : new Uint8Array([0,255,128]), { status: options.headers.Range ? 206 : 200 }); });
  const events = new Map(); const status = { textContent: '', hidden: true };
  const window = {
    addEventListener: (type, fn) => { if (!events.has(type)) events.set(type, []); events.get(type).push(fn); },
    dispatchEvent: event => { for (const fn of events.get(event.type) || []) fn(event); },
    postMessage(data) { setImmediate(() => window.dispatchEvent({ type: 'message', data, origin: 'https://duckflix42.netlify.app', source: window })); }
  };
  const context = vm.createContext({ window, document: { readyState: 'complete', querySelectorAll: () => [status] }, location: { origin: 'https://duckflix42.netlify.app' }, chrome: { runtime: { sendMessage: message => app.send(message) } }, crypto, setTimeout, clearTimeout, AbortController, DOMException, Uint8Array, TextDecoder, atob, performance, CustomEvent: class { constructor(type) { this.type = type; } } });
  for (const file of ['chrome-extension/content.js', 'extension-bridge.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  for (let i = 0; i < 5; i++) await settle();
  const api = window.DuckFlixExtension;
  assert.equal(api.connected, true); assert.match(status.textContent, /conectada/);
  const Hls = { DefaultConfig: { loader: class { constructor() { this.stats = {}; } destroy() {} } } };
  assert.equal(Object.keys(api.hlsConfig('https://video.example/x', Hls)).length, 0);
  const Loader = api.hlsConfig('http://video.example/x', Hls).loader;
  async function load(context) {
    const instance = new Loader({});
    return new Promise((resolve, reject) => instance.load(context, {}, { onSuccess: (result, stats) => { instance.destroy(); resolve({ result, stats }); }, onError: reject }));
  }
  const playlist = await load({ url: 'http://video.example/live.m3u8', responseType: 'text' });
  assert.match(playlist.result.data, /#EXTM3U/);
  const segment = await load({ url: 'http://video.example/segment.ts', responseType: 'arraybuffer', rangeStart: 0, rangeEnd: 3 });
  assert.deepEqual([...new Uint8Array(segment.result.data)], [0,255,128]); assert.equal(segment.stats.loaded, 3);
  assert.equal(calls[1].options.headers.Range, 'bytes=0-2');
  const catalog = await api.fetchJSON('https://addon.example/catalog.json');
  assert.equal(catalog.metas[0].name, 'Canal de televisão');
});
test('download ZIP contains exactly the shipped extension files without development data', () => {
  const zip = fs.readFileSync('downloads/duckflix-http-0.1.0.zip');
  let offset = 0; const names = [];
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const size = zip.readUInt32LE(offset + 18), length = zip.readUInt16LE(offset + 26), extra = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + length).toString(); names.push(name);
    const start = offset + 30 + length + extra;
    assert.deepEqual(zip.subarray(start, start + size), fs.readFileSync(name.replace('duckflix-http/', 'chrome-extension/')));
    offset = start + size;
  }
  assert.equal(names.length, 8); assert.ok(names.includes('duckflix-http/manifest.json'));
});

test('HTTP sources enter the media player and Minha TV only while the extension is connected', async t => {
  const media = require('../extensoes-media');
  const tv = require('../tv-addons');
  const previous = globalThis.DuckFlixExtension;
  t.after(() => { if (previous === undefined) delete globalThis.DuckFlixExtension; else globalThis.DuckFlixExtension = previous; });
  const stream = { url: 'http://video.example/live.m3u8' };
  assert.match(media.candidate(stream).url, /^https:/);
  globalThis.DuckFlixExtension = { connected: true };
  assert.equal(media.candidate(stream).url, stream.url);
  assert.match(media.candidate({ url: 'http://video.example/movie.mp4' }).url, /^https:/, 'MP4 stays on the existing HTTPS attempt');
  const called = [];
  await tv.load(new AbortController().signal, async url => { called.push(url); return { ok: true, json: async () => ({ metas: [] }) }; });
  assert.ok(called.some(url => url.includes('minhatv')));
  const channel = { addonEndpoint: 'https://addon.example/stream', url: 'https://addon.example/stream' };
  const result = await tv.probe(channel, { signal: new AbortController().signal, fetcher: async () => ({ ok: true, json: async () => ({ streams: [stream] }) }), probeChannel: async url => { assert.equal(url, stream.url); return { ok: true }; } });
  assert.equal(result.ok, true); assert.equal(channel.url, stream.url);
});
