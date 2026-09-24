const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../together-server');
const { readEvents } = require('../together-client');
async function fixture(t) {
  let time = 100000;
  const server = createServer({ now: () => time, allowedOrigins: ['https://duckflix42.netlify.app'] });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, streams = [];
  t.after(() => { for (const stream of streams) stream.abort(); server.shutdown(); });
  async function request(path, data, credential, origin) {
    const response = await fetch(base + '/api/together' + path, { method: data === undefined ? 'GET' : 'POST', headers: { ...(credential ? { Authorization: `Bearer ${credential}` } : {}), ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, data: await response.json(), response };
  }
  const created = (await request('/rooms', { name: 'Leader' })).data;
  const roomPath = `/rooms/${created.roomId}`;
  async function subscribe(credential) {
    const controller = new AbortController(), packets = []; streams.push(controller);
    const response = await fetch(base + '/api/together' + roomPath + '/events', { signal: controller.signal, headers: { Authorization: `Bearer ${credential}` } });
    assert.equal(response.status, 200);
    readEvents(response, packet => packets.push(packet)).catch(() => {});
    return { packets, abort: () => controller.abort() };
  }
  async function waitUntil(fn) { for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise(resolve => setTimeout(resolve, 5)); } assert.fail('Expected server event'); }
  const leader = await subscribe(created.credential);
  await waitUntil(() => leader.packets.length);
  return { request, created, leader, roomPath, subscribe, waitUntil, base, advance: ms => { time += ms; }, now: () => time };
}
const media = { url: 'https://video.example/movie.mp4', name: 'Shared film', tmdbId: 12, type: 'movie', mode: 'native' };
test('two network clients share media/play/seek/pause; guests and invitation tokens cannot command', async t => {
  const app = await fixture(t), { request, created, roomPath } = app;
  const guest = (await request(roomPath + '/join', { invite: created.invite, name: 'Guest' })).data;
  const viewer = await app.subscribe(guest.credential);
  await app.waitUntil(() => viewer.packets.length);
  assert.equal((await request(roomPath + '/command', { action: 'media', media }, guest.credential)).status, 403);
  assert.equal((await request(roomPath + '/state', undefined, created.invite)).status, 403);
  const selected = await request(roomPath + '/command', { action: 'media', media }, created.credential);
  assert.equal(selected.status, 200); const mediaId = selected.data.state.media.id;
  app.advance(100);
  const play = await request(roomPath + '/command', { action: 'play', mediaId, position: 25, observedAt: app.now() }, created.credential);
  assert.equal(play.data.state.effectiveAt, app.now() + 600); assert.equal(play.data.state.paused, false);
  app.advance(1600);
  const paused = await request(roomPath + '/command', { action: 'pause', mediaId, position: 26, observedAt: app.now() }, created.credential);
  assert.equal(paused.data.state.position, 26.6); assert.equal(paused.data.state.paused, true);
  app.advance(1000);
  const seek = await request(roomPath + '/command', { action: 'seek', mediaId, position: 180 }, created.credential);
  assert.equal(seek.data.state.position, 180); assert.equal(seek.data.state.paused, true);
  await app.waitUntil(() => viewer.packets.some(packet => packet.state.revision === seek.data.state.revision));
  assert.deepEqual(viewer.packets.at(-1).state, app.leader.packets.at(-1).state);
  const publicState = await request(roomPath + '/state', undefined, guest.credential);
  const serialized = JSON.stringify(publicState.data);
  assert.equal(publicState.data.invite, undefined);
  assert.equal(serialized.includes(created.credential), false); assert.equal(serialized.includes(created.invite), false);
});
test('leader disconnect pauses followers and reconnect preserves leadership and position', async t => {
  const app = await fixture(t), { request, created, roomPath } = app;
  const guest = (await request(roomPath + '/join', { invite: created.invite, name: 'Viewer' })).data;
  const viewer = await app.subscribe(guest.credential);
  const selected = await request(roomPath + '/command', { action: 'media', media }, created.credential);
  app.advance(100);
  await request(roomPath + '/command', { action: 'play', mediaId: selected.data.state.media.id, position: 10 }, created.credential);
  app.advance(5600); app.leader.abort();
  await app.waitUntil(() => viewer.packets.some(packet => !packet.hostOnline && packet.state.paused));
  const frozen = viewer.packets.at(-1).state.position;
  assert.equal(frozen, 15);
  const restored = await app.subscribe(created.credential);
  await app.waitUntil(() => restored.packets.length);
  assert.equal(restored.packets.at(-1).state.position, frozen); assert.equal(restored.packets.at(-1).state.paused, true);
  assert.equal((await request(roomPath + '/state', undefined, created.credential)).data.role, 'host');
});
test('validates source, stale media commands, invitation, CORS and non-public files', async t => {
  const app = await fixture(t), { request, created, roomPath } = app;
  assert.equal((await request(roomPath + '/join', { invite: 'wrong' })).status, 403);
  for (const url of ['javascript:alert(1)', 'http://video.example/a.mp4', 'https://user:pass@video.example/a.mp4']) {
    assert.equal((await request(roomPath + '/command', { action: 'media', media: { ...media, url } }, created.credential)).status, 400);
  }
  await request(roomPath + '/command', { action: 'media', media }, created.credential); app.advance(100);
  assert.equal((await request(roomPath + '/command', { action: 'play', mediaId: 'stale', position: 0 }, created.credential)).status, 409);
  assert.equal((await request('/clock', undefined, null, 'https://evil.example')).status, 403);
  const cors = await request('/clock', undefined, null, 'https://duckflix42.netlify.app');
  assert.equal(cors.status, 200); assert.equal(cors.response.headers.get('Access-Control-Allow-Origin'), 'https://duckflix42.netlify.app');
  for (const file of ['/together-server.js', '/package.json', '/.env', '/tests/together-server.test.js', '/%2e%2e/package.json']) assert.equal((await fetch(app.base + file)).status, 404);
  for (const file of ['/', '/together.html', '/together-sync.js', '/site.css']) assert.equal((await fetch(app.base + file)).status, 200);
});
