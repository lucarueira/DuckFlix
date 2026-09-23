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

  /* ========================
     MODO LIVRE (+18 FILTRO)
  ======================== */
  const safety = window.DuckFlixSafety;
  let historyRender = 0, catalogRender = 0;
  function updateBtnModoLivre() { safety?.updateSwitch(); }

  /* ========================
     GERENCIAMENTO DA MINHA LISTA
  ======================== */
  const getStorage = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch {}
    return null;
  };
  function getWatchlist() {
    try {
      const storage = getStorage();
      const raw = storage ? storage.getItem('duckflix.extensoes.watchlist') : null;
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }
  function saveWatchlist(list) {
    try {
      const storage = getStorage();
      if (storage) storage.setItem('duckflix.extensoes.watchlist', JSON.stringify(list));
      updateWatchlistBadge();
    } catch {}
  }
  function isWatchlisted(id) {
    return getWatchlist().some(item => item.id === id);
  }
  function toggleWatchlist(item) {
    let list = getWatchlist();
    const idx = list.findIndex(e => e.id === item.id);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.unshift(item);
    }
    saveWatchlist(list);
    if (category === 'watchlist') {
      items = list;
      render();
    } else {
      render();
    }
  }
  function updateWatchlistBadge() {
    const countEl = $('watchlist-count');
    if (!countEl) return;
    const len = getWatchlist().length;
    countEl.textContent = String(len);
    countEl.hidden = len === 0;
  }

  /* ========================
     GERENCIAMENTO DE CONTINUAR ASSISTINDO
  ======================== */
  function getHistory() {
    try {
      const storage = getStorage();
      const raw = storage ? storage.getItem('duckflix.extensoes.history') : null;
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }
  function removeFromHistory(id) {
    try {
      const storage = getStorage();
      const list = getHistory().filter(e => e.id !== id);
      if (storage) storage.setItem('duckflix.extensoes.history', JSON.stringify(list));
      renderContinuarAssistindo();
    } catch {}
  }
  function clearHistory() {
    try {
      const storage = getStorage();
      if (storage) storage.removeItem('duckflix.extensoes.history');
      renderContinuarAssistindo();
    } catch {}
  }
  async function renderContinuarAssistindo() {
    const renderId = ++historyRender;
    const section = $('continuar-section');
    const carousel = $('continuar-carousel');
    if (!section || !carousel) return;
    carousel.replaceChildren(); section.hidden = true;
    let history;
    try { history = safety ? await safety.filter(getHistory()) : getHistory(); } catch { return; }
    if (renderId !== historyRender) return;
    if (!history.length) {
      section.hidden = true;
      carousel.replaceChildren();
      return;
    }
    section.hidden = false;
    carousel.replaceChildren();
    for (const entry of history) {
      const card = node('div', undefined, 'continuar-card');
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Continuar assistindo ${entry.name}`);

      const poster = node('div', undefined, 'continuar-poster');
      if (entry.poster) {
        const img = node('img');
        img.src = entry.poster;
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        poster.append(img);
      }
      const playBadge = node('span', undefined, 'continuar-play-badge');
      const playIcon = node('img');
      playIcon.src = 'img/icons/icon_play.png';
      playIcon.alt = '';
      playBadge.append(playIcon);
      poster.append(playBadge);

      const progressTrack = node('div', undefined, 'progress-bar-track');
      const progressFill = node('div', undefined, 'progress-bar-fill');
      progressFill.style.width = `${Math.min(100, Math.max(5, entry.progressPct || 0))}%`;
      progressTrack.append(progressFill);
      poster.append(progressTrack);

      const removeBtn = node('button', '✕', 'continuar-remove-btn');
      removeBtn.type = 'button';
      removeBtn.title = 'Remover do histórico';
      removeBtn.addEventListener('click', e => {
        e.stopPropagation();
        removeFromHistory(entry.id);
      });
      poster.append(removeBtn);

      const info = node('div', undefined, 'continuar-info');
      info.append(node('strong', entry.name));
      const sub = entry.type === 'series' && entry.season !== undefined
        ? `T${entry.season} · E${entry.episode}`
        : `${Math.round(entry.progressPct || 0)}% concluído`;
      info.append(node('small', sub));

      card.append(poster, info);
      const startResume = () => {
        player.open(entry, {
          startAt: entry.currentTime,
          season: entry.season,
          episode: entry.episode
        });
      };
      card.addEventListener('click', startResume);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startResume();
        }
      });

      carousel.append(card);
    }
  }

  const player = window.DuckFlixPlayer.create({ document,
    async getDetails(item, signal) {
      if (safety && !await safety.allowed(item, { signal })) throw new Error('Título indisponível com o Modo Livre ativo.');
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

  async function render() {
    const renderId = ++catalogRender;
    $('catalog-grid').replaceChildren();
    let visible;
    try { visible = safety ? await safety.filter(items) : items; } catch { return; }
    if (renderId !== catalogRender) return;
    for (const item of visible) {
      const card = node('button', undefined, 'poster-card'); card.type = 'button'; card.setAttribute('aria-label', `Assistir ${item.name}`);
      const poster = node('span', '▶', 'poster');
      if (item.poster) {
        const img = node('img'); img.src = item.poster; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => poster.replaceChildren(document.createTextNode('▶')), { once: true }); poster.replaceChildren(img);
      }
      const kind = item.type === 'movie' ? 'Filme' : item.genres?.includes(16) && item.originalLanguage === 'ja' ? 'Anime' : 'Série';

      const fav = isWatchlisted(item.id);
      const favBtn = node('button', fav ? '♥' : '♡', `poster-fav-btn ${fav ? 'is-fav' : ''}`);
      favBtn.type = 'button';
      favBtn.title = fav ? 'Remover da Minha Lista' : 'Salvar na Minha Lista';
      favBtn.addEventListener('click', e => {
        e.stopPropagation();
        toggleWatchlist(item);
      });
      poster.append(favBtn);

      card.append(poster, node('strong', item.name), node('small', [kind, item.releaseInfo].filter(Boolean).join(' · ')));
      card.addEventListener('click', () => player.open(item)); $('catalog-grid').append(card);
    }
    $('catalog-status').textContent = visible.length
      ? `${visible.length} ${visible.length === 1 ? 'título para explorar' : 'títulos para explorar'}`
      : category === 'watchlist'
        ? 'Sua lista está vazia. Adicione filmes e séries clicando no coração dos títulos.'
        : 'Nenhum título encontrado. Tente outro nome.';
    $('load-more').hidden = category === 'watchlist' || !hasMore;
  }

  async function loadCatalog(more = false) {
    clearTimeout(searchTimer); catalogAbort?.abort(); catalogRender++;
    const controller = new AbortController(); catalogAbort = controller;
    const query = $('catalog-search').value.trim();

    if (!more) { page = 0; items = []; hasMore = false; $('catalog-grid').replaceChildren(); }
    $('load-more').hidden = true;

    if (category === 'watchlist' && !query) {
      document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === 'watchlist')));
      $('catalog-title').textContent = 'Minha Lista de Favoritos';
      items = getWatchlist();
      $('catalog-grid').setAttribute('aria-busy', 'false');
      render();
      return;
    }

    $('catalog-grid').setAttribute('aria-busy', 'true');
    $('catalog-title').textContent = query ? `Resultados para “${query}”` : { movie: 'Filmes para a sua sessão', series: 'Séries para maratonar', anime: 'Seu próximo universo', watchlist: 'Minha Lista de Favoritos' }[category];
    document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(!query && button.dataset.category === category)));
    $('catalog-status').textContent = query ? 'Pesquisando…' : 'Carregando títulos…';
    try {
      const type = category === 'movie' ? 'movie' : 'tv';
      const path = query ? 'search/multi' : category === 'anime' ? 'discover/tv' : `${type}/popular`;
      const known = new Set(items.map(item => `${item.type}:${item.id}`));
      const targetCount = (!more && !query) ? 42 : (items.length + 20);
      let currentPage = page + 1;
      let totalPages = 500;

      const lastPage = currentPage + 5;
      while (items.length < targetCount && currentPage <= totalPages && currentPage <= lastPage) {
        const params = {
          page: currentPage,
          include_adult: false,
          ...(query ? { query } : category === 'anime' ? { with_genres: 16, with_original_language: 'ja', sort_by: 'popularity.desc' } : {})
        };
        const data = await tmdb(path, params, controller.signal);
        if (controller.signal.aborted) return;
        if (!Array.isArray(data.results)) throw new Error('Não foi possível carregar os títulos.');
        totalPages = Math.min(Number(data.total_pages) || 0, 500);

        for (const item of api.tmdbItems(data.results, query ? undefined : type)) {
          const key = `${item.type}:${item.id}`;
          if (known.has(key)) continue;
          known.add(key);
          items.push(item);
          if (!query && !more && items.length === 42) break;
        }
        currentPage++;
        if (query || data.results.length === 0) break;
      }
      page = currentPage - 1;
      hasMore = page < totalPages;
      render();
    } catch (error) {
      if (!controller.signal.aborted) { $('catalog-status').textContent = `${error.message} Tente atualizar.`; $('load-more').hidden = !more; }
    } finally { if (!controller.signal.aborted) $('catalog-grid').setAttribute('aria-busy', 'false'); }
  }

  $('search-form').addEventListener('submit', event => { event.preventDefault(); loadCatalog(); });
  $('catalog-search').addEventListener('input', () => {
    clearTimeout(searchTimer); catalogAbort?.abort(); $('catalog-grid').replaceChildren(); $('load-more').hidden = true;
    $('catalog-grid').setAttribute('aria-busy', 'true'); $('catalog-status').textContent = 'Pesquisando…'; searchTimer = setTimeout(() => loadCatalog(), 350);
  });
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
    category = button.dataset.category;
    $('catalog-search').value = '';
    loadCatalog();
  }));
  $('nav-watchlist')?.addEventListener('click', () => {
    category = 'watchlist';
    $('catalog-search').value = '';
    loadCatalog();
  });
  window.addEventListener('duckflix:modechange', () => {
    catalogRender++; player.close(); renderContinuarAssistindo(); loadCatalog();
  });
  $('clear-history')?.addEventListener('click', clearHistory);
  $('reload-catalog').addEventListener('click', () => loadCatalog());
  $('load-more').addEventListener('click', () => loadCatalog(true));
  window.addEventListener('pagehide', () => { clearTimeout(searchTimer); catalogAbort?.abort(); player.close(); });
  window.addEventListener('duckflix:history-updated', () => renderContinuarAssistindo());

  // Inicialização
  updateWatchlistBadge();
  updateBtnModoLivre();
  renderContinuarAssistindo();
  loadCatalog();
})();
