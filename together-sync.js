/* The room clock, not the arrival time of a message, defines the playback position. */
(function () {
  'use strict';
  function position(state, now) {
    if (!state) return 0;
    return Math.max(0, state.position + (state.paused ? 0 : Math.max(0, now - state.effectiveAt) / 1000 * state.rate));
  }
  function clock(now = Date.now) {
    let offset = 0, best = Infinity;
    return {
      now: () => now() + offset,
      sample(sent, received, serverTime) {
        const rtt = received - sent;
        if (rtt >= 0 && rtt <= best) { best = rtt; offset = serverTime - (sent + received) / 2; }
      },
      reset: () => { best = Infinity; }
    };
  }
  function create({ video, now = Date.now, setTimeout = globalThis.setTimeout, clearTimeout = globalThis.clearTimeout, onBlocked = () => {}, onError = () => {} }) {
    let state, pending, revision = -1, timer, ready = false, connected = false, playingRequest = false, blocked = false, generation = 0;
    function apply(force = false) {
      if (!ready || !connected || !state?.media) return;
      const target = Math.min(position(state, now()), Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.01) : Infinity);
      const drift = target - (Number(video.currentTime) || 0);
      if (force || state.paused || Math.abs(drift) > 0.75) {
        if (Math.abs(drift) > 0.02) { try { video.currentTime = target; } catch {} }
      }
      video.playbackRate = state.paused || Math.abs(drift) < 0.12 || Math.abs(drift) > 0.75 ? state.rate : state.rate * (drift > 0 ? 1.03 : 0.97);
      if (state.paused) { video.pause(); return; }
      if (video.paused && !playingRequest && !blocked) {
        playingRequest = true;
        const current = generation;
        try {
          Promise.resolve(video.play()).catch(error => {
            if (current !== generation) return;
            if (error.name === 'NotAllowedError') { blocked = true; onBlocked(); }
            else if (error.name !== 'AbortError') onError(error);
          }).finally(() => { if (current === generation) playingRequest = false; });
        } catch (error) { playingRequest = false; onError(error); }
      }
    }
    function commit() { if (!pending) return; state = pending; pending = null; apply(true); }
    return {
      receive(next) {
        if (!next || next.revision <= revision) return false;
        revision = next.revision; clearTimeout(timer); pending = next;
        if (next.effectiveAt <= now()) commit(); else timer = setTimeout(commit, next.effectiveAt - now());
        return true;
      },
      tick: () => apply(),
      ready(value) { ready = value; if (!value) { generation++; playingRequest = false; blocked = false; video.pause(); } else apply(true); },
      connected(value) { connected = value; if (!value) video.pause(); else apply(true); },
      unlock() { blocked = false; apply(true); },
      reset() { generation++; clearTimeout(timer); state = pending = null; revision = -1; ready = connected = playingRequest = blocked = false; video.pause(); },
      destroy() { clearTimeout(timer); ready = false; connected = false; video.pause(); }
    };
  }
  const api = { position, clock, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.DuckTogetherSync = api;
})();
