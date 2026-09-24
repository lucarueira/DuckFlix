/* Cliente do protocolo Stremio: não executa código recebido dos addons. */
(function () {
  'use strict';
  const FENIX = 'https://fenixflix.fenixhub.online/manifest.json';
  const FIXED_ADDONS = Object.freeze([
    { name: 'FenixFlix', url: FENIX },
    { name: 'BestCine', url: 'https://bestcine.dpdns.org/manifest.json' },
    { name: 'Zeus', url: 'https://398fe185fed6-zeus.baby-beamup.club/v1-p64f-q3j-a3-mb-c3/manifest.json' },
    { name: 'FrostStream', url: 'https://froststream.cloutteam.com/manifest.json' }
  ]);
  const CINEMETA = 'https://v3-cinemeta.strem.io/manifest.json';
  function tmdbURL(path, params = {}, key) {
    const url = new URL('https://api.themoviedb.org/3/' + path);
    url.search = new URLSearchParams({ api_key: key, language: 'pt-BR', ...params }).toString();
    return url.href;
  }
  function tmdbItems(results, type) {
    return results.flatMap(item => {
      const media = item.media_type || type;
      if (!['movie', 'tv'].includes(media) || !Number.isInteger(item.id) || item.adult) return [];
      return [{ id: `tmdb:${item.id}`, tmdbId: item.id, type: media === 'tv' ? 'series' : 'movie',
        name: item.title || item.name || 'Sem título', description: item.overview || '',
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
        releaseInfo: (item.release_date || item.first_air_date || '').slice(0, 4),
        genres: item.genre_ids || [], originalLanguage: item.original_language }];
    });
  }
  function secureURL(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function manifestURL(value) {
    const url = secureURL(String(value).trim().replace(/^stremio:\/\//i, 'https://'));
    if (!url || !new URL(url).pathname.endsWith('/manifest.json') || new URL(url).hash) {
      throw new Error('Use o link HTTPS ou stremio:// que termina em /manifest.json.');
    }
    return url;
  }
  function resourceURL(manifest, resource, type, id, extra = {}) {
    const url = new URL(manifestURL(manifest));
    const suffix = Object.entries(extra).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
    url.pathname = url.pathname.slice(0, -'manifest.json'.length) +
      [resource, type, id].map(encodeURIComponent).join('/') + (suffix ? '/' + suffix : '') + '.json';
    return url.href;
  }
  function validateManifest(data) {
    if (!data || typeof data.id !== 'string' || typeof data.name !== 'string' || !Array.isArray(data.resources) || !Array.isArray(data.catalogs)) {
      throw new Error('O endereço não retornou um manifesto de addon válido.');
    }
    return data;
  }
  function supports(manifest, resource, type, id) {
    return manifest.resources.some(entry => {
      const spec = typeof entry === 'string' ? { name: entry } : entry;
      const types = spec?.types || manifest.types;
      const prefixes = spec?.idPrefixes || manifest.idPrefixes;
      return spec?.name === resource && (!types || (Array.isArray(types) && types.includes(type))) &&
        (!prefixes || (Array.isArray(prefixes) && prefixes.some(prefix => typeof prefix === 'string' && id.startsWith(prefix))));
    });
  }
  function streamCompatibility(stream) {
    if (stream.infoHash) return { playable: false, reason: 'Torrent: exige um aplicativo compatível.' };
    if (!secureURL(stream.url)) return { playable: false, reason: 'Sem link HTTPS direto compatível.' };
    if (Object.keys(stream.behaviorHints?.proxyHeaders?.request || {}).length) return { playable: false, reason: 'Exige cabeçalhos de um aplicativo ou servidor.' };
    return { playable: true, reason: stream.behaviorHints?.notWebReady ? 'Compatibilidade limitada. Tentar no navegador.' : 'Tentar reproduzir no navegador.' };
  }
  async function requestJSON(url, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 18000);
    try {
      const response = await (globalThis.DuckFlixSafety?.fetch || fetch)(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(`O servidor respondeu HTTP ${response.status}.`);
      return await response.json();
    } catch (error) {
      if (signal?.aborted) throw error;
      if (controller.signal.aborted) throw new Error('O servidor demorou para responder. Tente novamente.');
      if (error instanceof TypeError) throw new Error('Não foi possível acessar o servidor. Ele pode estar indisponível ou bloquear o navegador (CORS).');
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
  const api = { FENIX, FIXED_ADDONS, CINEMETA, manifestURL, resourceURL, validateManifest, supports, streamCompatibility, tmdbURL, tmdbItems, requestJSON };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  window.DuckFlixExtensions = api;
})();
