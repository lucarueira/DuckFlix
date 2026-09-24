const test = require('node:test');
const assert = require('node:assert/strict');
const { load, probe } = require('../tv-addons');
const json = data => ({ ok: true, json: async () => data });
test('TV catalog follows pagination, ignores adult flags and stops when providers repeat a page', async () => {
  let calls = 0;
  const metas = Array.from({ length: 100 }, (_, id) => ({ id: `channel:${id}`, name: `Canal ${id}`, genre: ['TV'], poster: 'http://unsafe/logo', adult: id === 0 }));
  const channels = await load(new AbortController().signal, async () => { calls++; return json({ metas }); });
  assert.equal(calls, 2); assert.equal(channels.length, 99); assert.equal(channels[0].logo, '');
  assert.match(channels[0].addonEndpoint, /channel%3A1.json$/);
});
test('TV probes HTTPS sources, skips incompatible streams, falls back and stores only a decoded source', async () => {
  const channel = { url: 'https://addon/stream', addonEndpoint: 'https://addon/stream' }, tested = [];
  const result = await probe(channel, { signal: new AbortController().signal, fetcher: async () => json({ streams: [{ infoHash: 'hash' }, { url: 'http://unsafe/video' }, { url: 'https://video/headers', behaviorHints: { proxyHeaders: {} } }, { url: 'https://video/broken' }, { url: 'https://video/good' }] }), probeChannel: async url => { tested.push(url); return { ok: url.endsWith('good'), checkedAt: Date.now() }; } });
  assert.equal(result.ok, true); assert.deepEqual(tested, ['https://video/broken', 'https://video/good']); assert.equal(channel.url, 'https://video/good');
});
test('unavailable or cancelled TV addon never becomes an available channel', async () => {
  const channel = { url: 'https://addon/stream', addonEndpoint: 'https://addon/stream' };
  const result = await probe(channel, { signal: new AbortController().signal, fetcher: async () => { throw new Error('offline'); } });
  assert.equal(result.ok, false); assert.equal(channel.url, channel.addonEndpoint);
  const controller = new AbortController(); controller.abort();
  assert.equal(await probe(channel, { signal: controller.signal }), null);
});
