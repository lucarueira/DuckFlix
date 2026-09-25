/* Fixed HTTP TV sources. Catalog entries become visible only after decoding a frame. */
(() => {
  const SOURCES = Object.freeze([
    { base: 'https://frostview.cloutteam.com', type: 'channel', catalog: 'froststream-channels', paginated: true }
  ]);
  const HTTP_SOURCE = { base: 'https://da5f663b4690-minhatv.baby-beamup.club', type: 'tv', catalog: 'minhatv_channels' };
  const BESTCINE_TV = { base: 'https://bestcine.dpdns.org', type: 'tv', catalog: 'bestcine_tv_catalog' };
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function secure(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
  }
  async function json(url, signal, fetcher = fetch) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 8000);
    try {
      const extension = globalThis.DuckFlixExtension;
      if (extension?.connected && extension.fetchJSON && new URL(url).origin === HTTP_SOURCE.base) {
        return await extension.fetchJSON(url, { signal: controller.signal });
      }
      let response;
      try {
        response = await fetcher(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      } catch (error) {
        if (!controller.signal.aborted && error instanceof TypeError && extension?.connected && extension.fetchJSON && new URL(url).origin === BESTCINE_TV.base) {
          return await extension.fetchJSON(url, { signal: controller.signal });
        }
        throw error;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  async function load(signal, fetcher = fetch) {
    const sources = globalThis.DuckFlixExtension?.connected ? [...SOURCES, HTTP_SOURCE, BESTCINE_TV] : SOURCES;
    const settled = await Promise.allSettled(sources.map(async source => {
      const entries = new Map();
      for (let page = 0; page < 12; page++) {
        if (signal?.aborted) break;
        const suffix = page ? `/skip=${page * 100}` : '';
        let data;
        try { data = await json(`${source.base}/catalog/${source.type}/${source.catalog}${suffix}.json`, signal, fetcher); }
        catch { break; }
        const before = entries.size;
        for (const meta of data.metas || []) {
          if (!meta.id || !meta.name || meta.adult) continue;
          const endpoint = `${source.base}/stream/${source.type}/${encodeURIComponent(meta.id)}.json`;
          const categories = (meta.genre || meta.genres || []).filter(value => typeof value === 'string');
          entries.set(meta.id, { name: String(meta.name), logo: secure(meta.poster) || '', categories: categories.length ? categories : ['Undefined'], search: normalize(String(meta.name)), url: endpoint, addonEndpoint: endpoint });
        }
        if (!source.paginated || (data.metas?.length || 0) < 100 || entries.size === before) break;
      }
      return [...entries.values()];
    }));
    return settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  }
  async function probe(channel, { signal, probeChannel, fetcher = fetch }) {
    try {
      const data = await json(channel.addonEndpoint, signal, fetcher);
      const urls = [...new Set((data.streams || []).filter(stream => !stream.infoHash && !stream.behaviorHints?.proxyHeaders && !stream.externalUrl).map(stream => {
        if (globalThis.DuckFlixExtension?.connected && /^http:\/\//.test(stream.url || '') && /\.m3u8(?:$|[?#])/i.test(stream.url)) {
          try { const url = new URL(stream.url); if (!url.username && !url.password) return url.href; } catch {}
        }
        return secure(stream.url);
      }).filter(Boolean))];
      for (const url of urls.slice(0, 4)) {
        if (signal.aborted) return null;
        const result = await probeChannel(url, { signal });
        if (signal.aborted) return null;
        if (result?.ok) { channel.url = url; return result; }
      }
    } catch { if (signal.aborted) return null; }
    return { ok: false, checkedAt: Date.now() };
  }
  const api = { SOURCES, load, probe, secure };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.DuckTVAddons = api;
})();
