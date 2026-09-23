(function (root) {
  'use strict';
  const nativeFetch = root.fetch.bind(root), cache = new Map(), queue = [];
  let active = 0, revision = 0;
  function read() {
    try { return (root.localStorage.getItem('duckflix.modoLivre') ?? root.localStorage.getItem('kidsMode')) === 'true'; }
    catch { return false; }
  }
  let enabled = read();
  const stale = () => new DOMException('A seleção mudou.', 'AbortError');
  function explicit(item) {
    const text = `${item.title || item.name || ''} ${item.overview || item.description || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return item.adult === true || /\b(hentai|porn(?:o|ografia)?|xxx|nsfw|softcore|erotic[oa]?)\b/i.test(text);
  }
  function identity(item, type) {
    const id = String(item.tmdbId || item.id || '').replace(/^tmdb:/, '');
    const kind = item.media_type || item.type || type || (item.title ? 'movie' : 'tv');
    return /^\d+$/.test(id) && kind !== 'person' ? { id, type: ['movie', 'filme'].includes(kind) ? 'movie' : 'tv' } : null;
  }
  function certification(data, type) {
    const br = (data.results || []).filter(row => row.iso_3166_1 === 'BR');
    const values = br.flatMap(row => type === 'movie' ? (row.release_dates || []).map(r => r.certification) : [row.rating]);
    const ages = values.map(v => String(v || '').trim().toUpperCase()).map(v => v === 'L' || v === 'LIVRE' ? 0 : /^(10|12|14|16|18)$/.test(v) ? Number(v) : null).filter(v => v !== null);
    return ages.length ? Math.max(...ages) : null;
  }
  async function limited(task) {
    await new Promise(resolve => { queue.push(resolve); pump(); });
    try { return await task(); } finally { active--; pump(); }
  }
  function pump() { while (active < 6 && queue.length) { active++; queue.shift()(); } }
  function rating(item, type, epoch) {
    const key = `${type}:${item.id}`;
    const previous = cache.get(key);
    if (previous && previous.expires > Date.now() && (previous.complete || previous.epoch === epoch)) return previous.promise;
    const entry = { expires: Date.now() + 300000, epoch, complete: false };
    entry.promise = limited(async () => {
      if (epoch !== revision) throw stale();
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6500);
      try {
        const url = new URL(`https://api.themoviedb.org/3/${type}/${item.id}/${type === 'movie' ? 'release_dates' : 'content_ratings'}`);
        url.searchParams.set('api_key', root.DuckFlixTMDB?.apiKey || '');
        const response = await nativeFetch(url.href, { signal: controller.signal, credentials: 'omit' });
        if (!response.ok) throw new Error('Classificação indisponível');
        const age = certification(await response.json(), type);
        entry.complete = true;
        return age;
      } catch (error) { if (cache.get(key) === entry) cache.delete(key); return null; }
      finally { clearTimeout(timer); }
    }).catch(error => { if (cache.get(key) === entry) cache.delete(key); throw error; });
    cache.set(key, entry);
    return entry.promise;
  }
  async function allowed(item, { type, signal } = {}) {
    const epoch = revision;
    if (explicit(item) || item.media_type === 'person') return false;
    if (!enabled) return true;
    const ident = identity(item, type);
    if (!ident) return false;
    const age = await rating(ident, ident.type, epoch);
    if (signal?.aborted || epoch !== revision) throw stale();
    return age !== null && age < 18;
  }
  async function filter(items, options) {
    const epoch = revision;
    const accepted = await Promise.all(items.map(item => allowed(item, options)));
    if (epoch !== revision || options?.signal?.aborted) throw stale();
    return items.filter((_, i) => accepted[i]);
  }
  async function safeFetch(input, options = {}) {
    const url = new URL(input), epoch = revision;
    const catalog = url.hostname === 'api.themoviedb.org' && /^\/3\/(search\/(multi|movie|tv)|discover\/(movie|tv)|(movie|tv)\/(popular|top_rated|now_playing|on_the_air))$/.test(url.pathname);
    if (catalog) url.searchParams.set('include_adult', 'false');
    const response = await nativeFetch(url.href, options);
    if (url.hostname !== 'api.themoviedb.org') return response;
    const json = response.json.bind(response);
    response.json = async () => {
      const data = await json();
      if (epoch !== revision) throw stale();
      if (catalog && Array.isArray(data.results)) data.results = await filter(data.results, { type: url.pathname.includes('movie') ? 'movie' : url.pathname.includes('tv') ? 'tv' : undefined, signal: options.signal });
      return data;
    };
    return response;
  }
  function updateSwitch() {
    const button = root.document?.getElementById('btnModoLivre');
    if (!button) return;
    button.textContent = 'Modo Livre';
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', String(enabled));
    button.setAttribute('aria-label', 'Modo Livre: ocultar +18 e títulos sem classificação brasileira confirmada');
    button.title = 'Oculta +18 e títulos sem classificação brasileira confirmada. TV ao vivo fica indisponível porque a classificação muda por programa.';
    button.classList.toggle('ativo', enabled);
    root.document.documentElement.dataset.safeMode = String(enabled);
  }
  function change(value) {
    enabled = Boolean(value); revision++;
    updateSwitch();
    root.dispatchEvent(new CustomEvent('duckflix:modechange', { detail: { enabled, revision } }));
  }
  root.DuckFlixSafety = {
    enabled: () => enabled, revision: () => revision, explicit, allowed, filter, fetch: safeFetch, certification, updateSwitch,
    // Live channels have no reliable per-program age classification: fail closed.
    channelAllowed: () => !enabled,
    setEnabled(value) {
      try { root.localStorage.setItem('duckflix.modoLivre', String(Boolean(value))); root.localStorage.setItem('kidsMode', String(Boolean(value))); } catch {}
      change(value);
    }
  };
  root.addEventListener('storage', event => { if (!event.key || ['duckflix.modoLivre', 'kidsMode'].includes(event.key)) change(read()); });
  function init() { updateSwitch(); root.document?.getElementById('btnModoLivre')?.addEventListener('click', () => root.DuckFlixSafety.setEnabled(!enabled)); }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init); else init();
})(window);
