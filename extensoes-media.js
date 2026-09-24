/* O mesmo decodificador é usado na verificação e na reprodução. */
(function () {
  'use strict';
  function candidate(stream) {
    if (!stream || stream.infoHash || Object.keys(stream.behaviorHints?.proxyHeaders?.request || {}).length) return null;
    let url;
    try { url = new URL(stream.url); } catch { return null; }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    // Tenta o endpoint TLS do próprio fornecedor; só entra na lista após decodificar imagem.
    const extensionHLS = globalThis.DuckFlixExtension?.connected && /\.m3u8(?:$|[?#])/i.test(url.href);
    if (url.protocol === 'http:' && !extensionHLS) { url.protocol = 'https:'; if (url.port === '80') url.port = ''; }
    const text = [stream.name, stream.title, stream.description].join(' ');
    const quality = text.match(/\b(2160p|1080p|720p|480p|360p|4K|FHD|HD|CAM)\b/i)?.[1].toUpperCase() || 'Auto';
    const language = /dublad|portugu[eê]s|pt-br|🇧🇷/i.test(text) ? 'Dublado' : /legendad/i.test(text) ? 'Legendado' : 'Áudio original';
    return { url: url.href, quality, language, mode: /\.m3u8(?:$|[?#])/i.test(url.href) || /mpegurl/i.test(stream.mimeType || '') ? 'hls' : 'auto' };
  }
  function connect(video, source, { Hls = globalThis.Hls, onReady = () => {}, onError = () => {}, onBlocked = () => {}, timeoutMs = 14000, autoplay = false, startAt = 0, mode = source.mode } = {}) {
    let disposed = false, ready = false, hls, timer, stageTimer, triedHLS = false;
    let engine = 'native';
    const clearMedia = () => {
      hls?.destroy(); hls = null;
      video.pause(); video.removeAttribute('src'); video.load();
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true; clearTimeout(timer); clearTimeout(stageTimer);
      video.removeEventListener('loadeddata', loaded);
      video.removeEventListener('error', failed);
      clearMedia();
    };
    const fail = () => { if (!disposed) { dispose(); onError(); } };
    const play = () => {
      try {
        Promise.resolve(video.play()).catch(error => {
          if (disposed) return;
          if (error.name === 'NotAllowedError') onBlocked();
          else if (error.name !== 'AbortError') fail();
        });
      } catch { fail(); }
    };
    const loaded = () => {
      if (disposed || ready || video.readyState < 2 || !video.videoWidth) return;
      ready = true; clearTimeout(timer); clearTimeout(stageTimer);
      if (startAt > 0 && Number.isFinite(video.duration) && startAt < video.duration - 1) video.currentTime = startAt;
      onReady({ mode: engine });
      if (autoplay && !disposed) play();
    };
    const startHLS = () => {
      if (disposed || triedHLS || !Hls?.isSupported()) return false;
      triedHLS = true; engine = 'hls'; clearTimeout(stageTimer);
      clearMedia();
      hls = new Hls({ startLevel: -1, maxBufferLength: 20, backBufferLength: 30, capLevelToPlayerSize: true, ...globalThis.DuckFlixExtension?.hlsConfig(source.url, Hls) });
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) fail(); });
      hls.loadSource(source.url); hls.attachMedia(video);
      return true;
    };
    const failed = () => { if (!disposed && !ready && mode === 'auto' && startHLS()) return; fail(); };
    video.addEventListener('loadeddata', loaded);
    video.addEventListener('error', failed);
    video.preload = 'auto'; video.playsInline = true;
    timer = setTimeout(fail, timeoutMs);
    try {
      if (mode === 'hls' && (!video.canPlayType('application/vnd.apple.mpegurl') || source.url.startsWith('http:'))) {
        if (!startHLS()) fail();
      } else {
        video.src = source.url; video.load();
        if (mode === 'auto' && Hls?.isSupported()) stageTimer = setTimeout(() => { if (!ready) startHLS(); }, Math.floor(timeoutMs / 2));
      }
    } catch { fail(); }
    return { dispose, play, get hls() { return hls; } };
  }
  function probe(source, { signal, createVideo = () => document.createElement('video'), Hls = globalThis.Hls, timeoutMs = 14000 } = {}) {
    if (signal?.aborted) return Promise.resolve(null);
    return new Promise(resolve => {
      const video = createVideo(); video.muted = true;
      let connection, done = false;
      const finish = result => {
        if (done) return;
        done = true; signal?.removeEventListener('abort', aborted);
        connection?.dispose(); resolve(result);
      };
      const aborted = () => finish(null);
      signal?.addEventListener('abort', aborted, { once: true });
      connection = connect(video, source, { Hls, timeoutMs, onReady: result => finish({ ...result, ok: true }), onError: () => finish({ ok: false }) });
      if (done) connection.dispose();
    });
  }
  function orderedEpisodes(videos, now = Date.now()) {
    const ids = new Set();
    return (Array.isArray(videos) ? videos : []).filter(ep => {
      if (!ep || typeof ep.id !== 'string' || ids.has(ep.id) || !Number.isFinite(Number(ep.season)) || !Number.isFinite(Number(ep.episode))) return false;
      if (ep.released && Date.parse(ep.released) > now) return false;
      ids.add(ep.id); return true;
    }).sort((a, b) => Number(a.season) - Number(b.season) || Number(a.episode) - Number(b.episode));
  }
  const api = { candidate, connect, probe, orderedEpisodes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.DuckFlixMedia = api;
})();
