const test = require('node:test');
const assert = require('node:assert/strict');
const { create, clock, position } = require('../together-sync');
const { readEvents } = require('../together-client');
const state = (extra = {}) => ({ media: { id: 'movie' }, position: 100, paused: false, rate: 1, effectiveAt: 10000, revision: 1, ...extra });
function player(start = 10000) {
  let time = start, id = 0;
  const timers = new Map();
  const video = { currentTime: 0, duration: 7200, paused: true, playbackRate: 1, play() { this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } };
  const engine = create({ video, now: () => time, setTimeout: (fn, ms) => { timers.set(++id, { fn, at: time + ms }); return id; }, clearTimeout: id => timers.delete(id) });
  engine.ready(true); engine.connected(true);
  return { video, engine, advance(to) { if (!video.paused) video.currentTime += (to - time) / 1000 * video.playbackRate; time = to; for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.fn(); } engine.tick(); } };
}
test('early and late participants apply the same server timeline despite delivery delay', () => {
  const leader = player(10000), guest = player(11250);
  leader.engine.receive(state()); guest.engine.receive(state());
  assert.equal(leader.video.currentTime, 100); assert.equal(guest.video.currentTime, 101.25);
  leader.advance(12000); guest.advance(12000);
  assert.equal(leader.video.currentTime, guest.video.currentTime);
  assert.equal(position(state({ rate: 1.5 }), 12000), 103);
});
test('scheduled pause holds the exact shared position and old packets cannot undo it', () => {
  const a = player(), b = player(10050);
  a.engine.receive(state()); b.engine.receive(state());
  const pause = state({ paused: true, position: 103.6, effectiveAt: 10600, revision: 2 });
  a.engine.receive(pause); b.engine.receive(pause);
  assert.equal(a.video.paused, false);
  a.advance(10600); b.advance(10900);
  assert.equal(a.video.paused, true); assert.equal(b.video.paused, true);
  assert.equal(a.video.currentTime, 103.6); assert.equal(b.video.currentTime, 103.6);
  a.engine.receive(state()); a.advance(15000);
  assert.equal(a.video.currentTime, 103.6);
});
test('seek while paused, late media readiness and reconnect restore room position', () => {
  const p = player(); p.engine.ready(false);
  p.engine.receive(state({ paused: true, position: 400 }));
  assert.equal(p.video.currentTime, 0);
  p.engine.ready(true); assert.equal(p.video.currentTime, 400);
  p.engine.receive(state({ revision: 2, position: 400 })); p.engine.connected(false);
  assert.equal(p.video.paused, true);
  p.advance(18000); p.engine.connected(true);
  assert.equal(p.video.currentTime, 408);
});
test('small drift changes playback rate gently and changing rooms accepts revision zero', () => {
  const p = player(); p.engine.receive(state());
  p.video.currentTime = 99.7; p.engine.tick(); assert.equal(p.video.playbackRate, 1.03);
  p.video.currentTime = 100.4; p.engine.tick(); assert.equal(p.video.playbackRate, 0.97);
  p.engine.reset(); p.engine.receive(state({ revision: 0, position: 0, paused: true })); p.engine.ready(true); p.engine.connected(true);
  assert.equal(p.video.currentTime, 0); assert.equal(p.video.paused, true);
});
test('autoplay denial waits for activation rather than retrying indefinitely', async () => {
  let calls = 0, notices = 0;
  const video = { currentTime: 0, duration: 1000, paused: true, pause() {}, play() { calls++; return Promise.reject(Object.assign(new Error('Gesture needed'), { name: 'NotAllowedError' })); } };
  const engine = create({ video, now: () => 10000, onBlocked: () => notices++ });
  engine.ready(true); engine.connected(true); engine.receive(state());
  await new Promise(resolve => setImmediate(resolve)); engine.tick(); engine.tick();
  assert.equal(calls, 1); assert.equal(notices, 1);
  video.play = () => { calls++; video.paused = false; return Promise.resolve(); };
  engine.unlock(); assert.equal(calls, 2); assert.equal(video.paused, false);
});
test('clock uses round trip midpoint and prefers the lowest latency sample', () => {
  const c = clock(() => 1000);
  c.sample(100, 200, 650); assert.equal(c.now(), 1500);
  c.sample(200, 800, 1500); assert.equal(c.now(), 1500);
  c.sample(100, 120, 620); assert.equal(c.now(), 1510);
});
test('SSE reader handles split UTF-8, multiple packets, comments and closes the stream', async () => {
  const data = new TextEncoder().encode(': ping\n\ndata: {"name":"João"}\n\ndata: {"revision":2}\n\n');
  const body = new ReadableStream({ start(controller) { for (const byte of data) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
  const packets = []; await readEvents(new Response(body), packet => packets.push(packet));
  assert.deepEqual(packets, [{ name: 'João' }, { revision: 2 }]);
});
