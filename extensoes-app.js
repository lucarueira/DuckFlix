(function () {
  'use strict';
  const api = window.DuckFlixExtensions;
  const $ = id => document.getElementById(id);
  let category = 'movie', page = 0, items = [], hasMore = false, catalogAbort, searchTimer;
  const addons = new Map(), identityCache = new Map();
  function node(tag, text, cls) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; }
  function tmdb(path, params, signal) {
    const key = window.DuckFlixTMDB?.apiKey;
    if (!key) throw new Error('A pesquisa não carregou. Recarregue a página.');
    return api.requestJSON(api.tmdbURL(path, params, key), signal);
  }
  const addonsReady = Promise.allSettled(api.FIXED_ADDONS.map(async (addon, priority) => {
    const manifest = api.validateManifest(await api.requestJSON(addon.url));
    if (!manifest.behaviorHints?.configurationRequired) addons.set(addon.url, { ...addon, priority, manifest });
  }));
  const player = window.DuckFlixPlayer.create({ document,
    async getDetails(item, signal) {
      let resolved = { ...item };
      if (item.tmdbId) {
        const key = `${item.type}:${item.tmdbId}`;
        let id = identityCache.get(key);
        if (!id) {
          const data = await tmdb(`${item.type === 'series' ? 'tv' : 'movie'}/${item.tmdbId}/external_ids`, {}, signal);
          id = /^tt\d+$/.test(data.imdb_id) ? data.imdb_id : item.id;
          identityCache.set(key, id);
        }
        resolved.id = id;
      }
      if (resolved.type === 'series') {
        if (!/^tt\d+$/.test(resolved.id)) throw new Error('Os episódios deste título ainda não estão disponíveis.');
        const data = await api.requestJSON(api.resourceURL(api.CINEMETA, 'meta', 'series', resolved.id), signal);
        resolved.videos = data.meta?.videos || [];
      }
      return resolved;
    },
    async getStreams(id, type, signal, onBatch) {
      await addonsReady;
      if (signal.aborted) return;
      await Promise.allSettled([...addons.values()].filter(addon => api.supports(addon.manifest, 'stream', type, id)).map(async addon => {
        const data = await api.requestJSON(api.resourceURL(addon.url, 'stream', type, id), signal);
        if (!signal.aborted && Array.isArray(data.streams)) onBatch(data.streams.map(stream => ({ ...stream, priority: addon.priority })));
      }));
    }
  });
  function render() {
    $('catalog-grid').replaceChildren();
    for (const item of items) {
      const card = node('button', undefined, 'poster-card'); card.type = 'button'; card.setAttribute('aria-label', `Assistir ${item.name}`);
      const poster = node('span', '▶', 'poster');
      if (item.poster) {
        const img = node('img'); img.src = item.poster; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => poster.replaceChildren(document.createTextNode('▶')), { once: true }); poster.replaceChildren(img);
      }
      const kind = item.type === 'movie' ? 'Filme' : item.genres.includes(16) && item.originalLanguage === 'ja' ? 'Anime' : 'Série';
      card.append(poster, node('strong', item.name), node('small', [kind, item.releaseInfo].filter(Boolean).join(' · ')));
      card.addEventListener('click', () => player.open(item)); $('catalog-grid').append(card);
    }
    $('catalog-status').textContent = items.length ? `${items.length} ${items.length === 1 ? 'título para explorar' : 'títulos para explorar'}` : 'Nenhum título encontrado. Tente outro nome.';
    $('load-more').hidden = !hasMore;
  }
  async function loadCatalog(more = false) {
    clearTimeout(searchTimer); catalogAbort?.abort();
    const controller = new AbortController(); catalogAbort = controller;
    const query = $('catalog-search').value.trim();
    if (!more) { page = 0; items = []; hasMore = false; $('catalog-grid').replaceChildren(); }
    $('load-more').hidden = true; $('catalog-grid').setAttribute('aria-busy', 'true');
    $('catalog-title').textContent = query ? `Resultados para “${query}”` : { movie: 'Filmes para a sua sessão', series: 'Séries para maratonar', anime: 'Seu próximo universo' }[category];
    document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(!query && button.dataset.category === category)));
    $('catalog-status').textContent = query ? 'Pesquisando…' : 'Carregando títulos…';
    try {
      const type = category === 'movie' ? 'movie' : 'tv';
      const path = query ? 'search/multi' : category === 'anime' ? 'discover/tv' : `${type}/popular`;
      const params = { page: page + 1, include_adult: false, ...(query ? { query } : category === 'anime' ? { with_genres: 16, with_original_language: 'ja', sort_by: 'popularity.desc' } : {}) };
      const data = await tmdb(path, params, controller.signal);
      if (controller.signal.aborted) return;
      if (!Array.isArray(data.results)) throw new Error('Não foi possível carregar os títulos.');
      const known = new Set(items.map(item => `${item.type}:${item.id}`));
      for (const item of api.tmdbItems(data.results, query ? undefined : type)) {
        const key = `${item.type}:${item.id}`; if (known.has(key)) continue; known.add(key); items.push(item);
      }
      page++; hasMore = page < Math.min(Number(data.total_pages) || 0, 500); render();
    } catch (error) {
      if (!controller.signal.aborted) { $('catalog-status').textContent = `${error.message} Tente atualizar.`; $('load-more').hidden = !more; }
    } finally { if (!controller.signal.aborted) $('catalog-grid').setAttribute('aria-busy', 'false'); }
  }
  $('search-form').addEventListener('submit', event => { event.preventDefault(); loadCatalog(); });
  $('catalog-search').addEventListener('input', () => {
    clearTimeout(searchTimer); catalogAbort?.abort(); $('catalog-grid').replaceChildren(); $('load-more').hidden = true;
    $('catalog-grid').setAttribute('aria-busy', 'true'); $('catalog-status').textContent = 'Pesquisando…'; searchTimer = setTimeout(() => loadCatalog(), 350);
  });
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { category = button.dataset.category; $('catalog-search').value = ''; loadCatalog(); }));
  $('reload-catalog').addEventListener('click', () => loadCatalog());
  $('load-more').addEventListener('click', () => loadCatalog(true));
  window.addEventListener('pagehide', () => { clearTimeout(searchTimer); catalogAbort?.abort(); player.close(); });
  loadCatalog();
})();
