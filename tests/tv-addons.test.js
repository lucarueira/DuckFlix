const test = require('node:test');
const assert = require('node:assert/strict');
const { load, probe, SOURCES } = require('../tv-addons');
const json = data => ({ ok: true, json: async () => data });
test('FrostView reports server errors instead of retrying through the extension', async t => {
  globalThis.DuckFlixExtension = { connected: true, fetchJSON: async () => json({ metas: [] }).json() };
  t.after(() => { delete globalThis.DuckFlixExtension; });
  const reports = [];
  await load(new AbortController().signal, async () => ({ ok: false, status: 408 }), status => reports.push(status));
  assert.ok(reports.some(report => report.source.includes('frostview') && report.error === 'HTTP 408'));
});

test('FrostView catalog can use authorized extension after a browser network failure', async t => {
  const requests = [];
  globalThis.DuckFlixExtension = { connected: true, fetchJSON: async url => {
    requests.push(url);
    return { metas: url.includes('frostview') ? [{ id: 'a', name: 'TV', genre: 'News' }] : [] };
  } };
  t.after(() => { delete globalThis.DuckFlixExtension; });
  const channels = await load(new AbortController().signal, async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(channels.length, 1);
  assert.deepEqual(channels[0].categories, ['News']);
  assert.ok(requests.some(url => url.includes('frostview')));
});
test('TV catalog follows pagination, ignores adult flags and stops when providers repeat a page', async () => {
  let calls = 0;
  const metas = Array.from({ length: 100 }, (_, id) => ({ id: `channel:${id}`, name: `Canal ${id}`, genre: ['TV'], poster: 'http://unsafe/logo', adult: id === 0 }));
  const channels = await load(new AbortController().signal, async url => {
    if (!url.includes('frostview')) return json({ metas: [] });
    calls++; return json({ metas });
  });
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

test('new TV catalogs preserve base paths, label providers and interleave independent sources', async () => {
  const calls = [];
  const channels = await load(new AbortController().signal, async url => {
    calls.push(url);
    if (url.includes('frostview')) throw new Error('offline');
    return json({ metas: [{ id: 'live:a%20b', name: 'Canal A' }, { id: 'second', name: 'Canal B' }] });
  });
  assert.equal(channels.length, 4, 'three TvVoo catalogs share channel identity in this fixture');
  assert.ok(calls.includes('https://dev.nebulawp.org/stremio/pluto-tv-addon/catalog/tv/pluto.json'));
  for (const source of SOURCES.filter(source => source.name)) {
    assert.ok(calls.includes(`${source.base}/catalog/tv/${source.catalog}.json`));
  }
  assert.match(channels[0].addonEndpoint, /pluto-tv-addon\/stream\/tv\/live%3Aa%2520b.json$/);
  assert.match(channels[1].addonEndpoint, /cfg-it-uk-fr\/stream\/tv\/live%3Aa%2520b.json$/);
  assert.ok(channels[0].categories.includes('Pluto TV'));
  assert.match(channels[1].search, /tvvoo/);
});
