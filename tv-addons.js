/* Fixed HTTP TV sources. Catalog entries become visible only after decoding a frame. */
(() => {
  const SOURCES = Object.freeze([
    { base: 'https://frostview.cloutteam.com', type: 'channel', catalog: 'froststream-channels', paginated: true },
    { base: 'https://dev.nebulawp.org/stremio/pluto-tv-addon', type: 'tv', catalog: 'pluto', name: 'Pluto TV' },
    { base: 'https://tvvoo.hayd.uk/cfg-it-uk-fr', type: 'tv', catalog: 'vavoo_tv_it', name: 'TvVoo · Itália' },
    { base: 'https://tvvoo.hayd.uk/cfg-it-uk-fr', type: 'tv', catalog: 'vavoo_tv_uk', name: 'TvVoo · Reino Unido' },
    { base: 'https://tvvoo.hayd.uk/cfg-it-uk-fr', type: 'tv', catalog: 'vavoo_tv_fr', name: 'TvVoo · França' }
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
        if (!controller.signal.aborted && error instanceof TypeError && extension?.connected && extension.fetchJSON && [BESTCINE_TV, ...SOURCES].some(source => new URL(source.base).origin === new URL(url).origin)) {
          return await extension.fetchJSON(url, { signal: controller.signal });
        }
        throw error;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  async function load(signal, fetcher = fetch, onStatus = () => {}) {
    const sources = globalThis.DuckFlixExtension?.connected ? [...SOURCES, HTTP_SOURCE, BESTCINE_TV] : SOURCES;
    const settled = await Promise.allSettled(sources.map(async source => {
      const entries = new Map();
      for (let page = 0; page < 12; page++) {
        if (signal?.aborted) break;
        const suffix = page ? `/skip=${page * 100}` : '';
        let data;
        try { data = await json(`${source.base}/catalog/${source.type}/${source.catalog}${suffix}.json`, signal, fetcher); }
        catch (error) {
          if (!signal?.aborted) onStatus({ source: source.base, error: error.message });
          break;
        }
        const before = entries.size;
        for (const meta of Array.isArray(data?.metas) ? data.metas : []) {
          if (!meta || typeof meta.id !== 'string' || typeof meta.name !== 'string' || !meta.id || !meta.name.trim() || meta.adult) continue;
          const endpoint = `${source.base}/stream/${source.type}/${encodeURIComponent(meta.id)}.json`;
          const genres = meta.genre || meta.genres || [];
          const categories = (Array.isArray(genres) ? genres : [genres]).filter(value => typeof value === 'string');
          if (source.name) categories.push(source.name);
          entries.set(meta.id, { name: meta.name, logo: secure(meta.logo) || secure(meta.poster) || '', categories: categories.length ? categories : ['Undefined'], search: normalize(`${meta.name} ${source.name || ''}`), url: endpoint, addonEndpoint: endpoint });
        }
        if (!source.paginated || (data.metas?.length || 0) < 100 || entries.size === before) break;
      }
      return [...entries.values()];
    }));
    // Interleave providers so the first verification batch is not monopolized by one addon.
    const lists = settled.filter(result => result.status === 'fulfilled').map(result => result.value);
    const channels = new Map();
    const length = Math.max(0, ...lists.map(list => list.length));
    for (let index = 0; index < length; index++) for (const list of lists) {
      const channel = list[index];
      if (channel && !channels.has(channel.addonEndpoint)) channels.set(channel.addonEndpoint, channel);
    }
    return [...channels.values()];
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
