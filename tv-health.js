/* Playback checks run in the visitor's browser, with the same CORS/codecs as the player. */
(() => {
  'use strict';
  const FRESH_MS = 5 * 60 * 1000;
  const isFresh = (result, now = Date.now()) => Boolean(result && now - result.checkedAt < FRESH_MS);
  const isAvailable = (result, now = Date.now()) => Boolean(result?.ok && isFresh(result, now));

  function probeChannel(url, { signal, timeoutMs = 12000, createVideo = () => document.createElement('video'), Hls = globalThis.Hls } = {}) {
    if (signal?.aborted) return Promise.resolve(null);
    return new Promise(resolve => {
      const video = createVideo();
      let hls;
      let finished = false;
      let timer;
      const finish = result => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', aborted);
        video.removeEventListener('loadeddata', loaded);
        video.removeEventListener('error', failed);
        hls?.destroy();
        video.pause();
        video.removeAttribute('src');
        video.load();
        resolve(result === null ? null : { ok: result, checkedAt: Date.now() });
      };
      const aborted = () => finish(null);
      const failed = () => finish(false);
      // A successful HTTP response or manifest alone does NOT establish availability.
      const loaded = () => { if (video.readyState >= 2 && video.videoWidth > 0) finish(true); };
      signal?.addEventListener('abort', aborted, { once: true });
      video.addEventListener('loadeddata', loaded);
      video.addEventListener('error', failed);
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      timer = setTimeout(failed, timeoutMs);
      try {
        const parsed = new URL(url);
        const extensionHTTP = parsed.protocol === 'http:' && globalThis.DuckFlixExtension?.connected;
        if ((!extensionHTTP && parsed.protocol !== 'https:') || parsed.username || parsed.password) { failed(); return; }
        if (video.canPlayType('application/vnd.apple.mpegurl') && !extensionHTTP) {
          video.src = url;
          video.load();
        } else if (Hls?.isSupported()) {
          hls = new Hls({ startLevel: 0, maxBufferLength: 1, maxMaxBufferLength: 2, backBufferLength: 0, capLevelToPlayerSize: true, ...globalThis.DuckFlixExtension?.hlsConfig(url, Hls) });
          hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) failed(); });
          hls.loadSource(url);
          hls.attachMedia(video);
        } else failed();
      } catch { failed(); }
    });
  }

  async function scanChannels(channels, { signal, onResult, probe = probeChannel, concurrency = 2 }) {
    let cursor = 0;
    async function worker() {
      while (!signal.aborted && cursor < channels.length) {
        const channel = channels[cursor++];
        const result = await probe(channel.url, { signal });
        if (signal.aborted) return;
        if (result) onResult(channel, result);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, channels.length) }, worker));
  }
  const api = { FRESH_MS, isFresh, isAvailable, probeChannel, scanChannels };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.DuckTVHealth = api;
})();
