(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const blocked = byId('adult-blocked'), gate = byId('adult-gate'), app = byId('adult-app');
  const consent = byId('adult-confirm'), enter = byId('adult-enter'), status = byId('adult-status');
  const catalogsNode = byId('adult-catalogs'), resultsNode = byId('adult-results');
  const sourceTabs = [...document.querySelectorAll('[data-source]')];
  const video = byId('adult-video'), playerSection = byId('adult-player-section');
  const ADDONS = Object.freeze({
    onlyporn: {
      name: 'OnlyPorn', base: 'https://07b88951aaab-jaxxx-v2.baby-beamup.club',
      catalogs: new Set(['eporner', 'xhamster.hd+', 'xhamster.4k', 'porntrex.top-rated', 'spankbang', 'missav'])
    },
    midnight: {
      name: 'Midnight', base: 'https://midnight.stravo.site/default',
      adultCatalog: /(?:\b(?:porn|hentai)\b|18\+)/i
    }
  });
  const state = { enabled: false, confirmed: false, selectedSource: 'onlyporn', manifests: new Map(), catalogs: [], items: [], request: null, playback: null, epoch: 0 };
  const noop = () => {};
  const safeModeOn = () => window.DuckFlixSafety?.enabled?.() ?? (() => {
    try { return localStorage.getItem('duckflix.modoLivre') === 'true' || localStorage.getItem('kidsMode') === 'true'; }
    catch { return true; }
  })();
  function clearPlayer() {
    state.playback?.dispose(); state.playback = null;
    video.pause(); video.removeAttribute('src'); video.load();
    byId('adult-streams').replaceChildren(); playerSection.hidden = true;
  }
  function clearContent() {
    state.request?.abort(); state.request = null;
    clearPlayer(); state.catalogs = []; state.items = [];
    catalogsNode.replaceChildren(); resultsNode.replaceChildren();
    byId('adult-filter').value = ''; byId('adult-catalog-title').textContent = 'Escolha um catálogo';
    byId('adult-result-count').textContent = '';
    for (const [key] of state.manifests) state.manifests.delete(key);
  }
  function showState() {
    const mode = safeModeOn();
    if (mode) {
      state.enabled = false; state.confirmed = false; state.epoch++;
      consent.checked = false; enter.disabled = true;
      clearContent(); gate.hidden = true; app.hidden = true; blocked.hidden = false;
      return;
    }
    blocked.hidden = true;
    state.enabled = true;
    gate.hidden = state.confirmed; app.hidden = !state.confirmed;
  }
  function makeRequest() {
    state.request?.abort();
    const controller = new AbortController(); state.request = controller;
    return controller;
  }
  async function json(url, signal) {
    const parsed = new URL(url);
    const base = Object.values(ADDONS).find(addon => parsed.origin === new URL(addon.base).origin);
    if (!base || parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Endereço de addon bloqueado.');
    if (base.name === 'Midnight') {
      const extension = window.DuckFlixExtension;
      if (!extension?.connected || !extension.fetchJSON) throw new Error('Midnight precisa da extensão DuckFlix conectada e autorizada para este domínio.');
      return extension.fetchJSON(url, { signal });
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal.aborted) throw new DOMException('Consulta cancelada.', 'AbortError');
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 12000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  }
  function catalogURL(addon, catalog) {
    return `${addon.base}/catalog/${encodeURIComponent(catalog.type)}/${encodeURIComponent(catalog.id)}.json`;
  }
  function supports(manifest, resourceName) {
    return manifest.resources.some(resource => resource === resourceName || resource?.name === resourceName);
  }
  function resourceURL(addon, resource, type, id) {
    // Midnight redirects series streams to a movie route; use its canonical endpoint
    // directly because the extension intentionally rejects HTTP redirects.
    if (addon.name === 'Midnight' && resource === 'stream' && type === 'series') type = 'movie';
    return `${addon.base}/${resource}/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
  }
  function validMeta(meta) {
    return Boolean(meta && typeof meta.id === 'string' && meta.id && typeof (meta.name || meta.title) === 'string' && (meta.name || meta.title).trim());
  }
  async function loadManifest(source, signal) {
    const addon = ADDONS[source];
    const manifest = await json(`${addon.base}/manifest.json`, signal);
    if (!manifest || manifest.name !== addon.name || !Array.isArray(manifest.catalogs) || !Array.isArray(manifest.resources) || !supports(manifest, 'catalog') || !supports(manifest, 'stream')) {
      throw new Error(`${addon.name}: manifesto inesperado.`);
    }
    const catalogs = manifest.catalogs.filter(catalog => {
      if (!catalog || typeof catalog.id !== 'string' || typeof catalog.name !== 'string' || !['movie', 'series'].includes(catalog.type)) return false;
      if (source === 'onlyporn') return addon.catalogs.has(catalog.id);
      return addon.adultCatalog.test(catalog.name);
    });
    return { manifest, catalogs };
  }
  function drawCatalogs() {
    catalogsNode.replaceChildren();
    if (!state.catalogs.length) {
      const message = document.createElement('p'); message.className = 'adult-empty';
      message.textContent = 'Este addon não publicou catálogos adultos disponíveis.'; catalogsNode.append(message); return;
    }
    for (const catalog of state.catalogs) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = catalog.name;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => loadCatalog(catalog)); catalogsNode.append(button);
    }
  }
  async function selectSource(source) {
    if (!state.confirmed || !state.enabled || safeModeOn()) return;
    state.selectedSource = source; state.epoch++;
    const epoch = state.epoch, controller = makeRequest(); clearPlayer();
    state.items = []; resultsNode.replaceChildren(); catalogsNode.replaceChildren();
    byId('adult-filter').value = ''; byId('adult-catalog-title').textContent = 'Catálogos';
    byId('adult-result-count').textContent = '';
    sourceTabs.forEach(tab => { const active = tab.dataset.source === source; tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', String(active)); });
    byId('midnight-extension-note').hidden = source !== 'midnight';
    status.textContent = `Carregando ${ADDONS[source].name}…`;
    try {
      const result = state.manifests.get(source) || await loadManifest(source, controller.signal);
      if (controller.signal.aborted || epoch !== state.epoch || safeModeOn()) return;
      state.manifests.set(source, result); state.catalogs = result.catalogs; drawCatalogs();
      status.textContent = `${ADDONS[source].name}: ${result.catalogs.length} catálogos adultos.`;
    } catch (error) {
      if (!controller.signal.aborted && epoch === state.epoch) status.textContent = `${ADDONS[source].name} indisponível agora (${error.message}).`;
    }
  }
  function drawItems() {
    resultsNode.replaceChildren();
    const query = byId('adult-filter').value.trim().toLocaleLowerCase('pt-BR');
    const items = state.items.filter(item => (item.name || item.title).toLocaleLowerCase('pt-BR').includes(query));
    byId('adult-result-count').textContent = items.length ? `${items.length} resultados` : '';
    if (!items.length) {
      const message = document.createElement('p'); message.className = 'adult-empty';
      message.textContent = state.items.length ? 'Nenhum resultado corresponde ao filtro.' : 'Este catálogo não retornou títulos agora.';
      resultsNode.append(message); return;
    }
    const source = ADDONS[state.selectedSource];
    for (const item of items) {
      const card = document.createElement('article'); card.className = 'adult-card';
      const button = document.createElement('button'); button.type = 'button';
      const poster = item.poster || item.logo;
      if (typeof poster === 'string' && /^https:\/\//i.test(poster)) {
        const image = document.createElement('img'); image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.src = poster; image.alt = ''; button.append(image);
      }
      const title = document.createElement('strong'); title.textContent = item.name || item.title; button.append(title);
      button.addEventListener('click', () => loadStreams(source, item)); card.append(button); resultsNode.append(card);
    }
  }
  async function loadCatalog(catalog) {
    if (!state.confirmed || !state.enabled || safeModeOn()) return;
    const epoch = ++state.epoch, controller = makeRequest(); clearPlayer(); state.items = [];
    byId('adult-catalog-title').textContent = catalog.name;
    byId('adult-result-count').textContent = ''; resultsNode.replaceChildren();
    for (const button of catalogsNode.querySelectorAll('button')) {
      const active = button.textContent === catalog.name; button.setAttribute('aria-pressed', String(active));
    }
    status.textContent = `Carregando catálogo ${catalog.name}…`;
    try {
      const addon = ADDONS[state.selectedSource], data = await json(catalogURL(addon, catalog), controller.signal);
      if (controller.signal.aborted || epoch !== state.epoch || safeModeOn()) return;
      state.items = (Array.isArray(data?.metas) ? data.metas : []).filter(validMeta).slice(0, 100).map(item => ({ ...item, type: catalog.type }));
      drawItems();
      status.textContent = `${addon.name}: catálogo carregado.`;
    } catch (error) {
      if (!controller.signal.aborted && epoch === state.epoch) status.textContent = `Não foi possível carregar este catálogo (${error.message}).`;
    }
  }
  function directStream(stream) {
    if (!stream || stream.infoHash || stream.externalUrl || stream.behaviorHints?.proxyHeaders) return null;
    let url;
    try { url = new URL(stream.url); } catch { return null; }
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const mediaType = String(stream.mimeType || stream.type || '').toLowerCase();
    const path = url.pathname.toLowerCase();
    const isHls = /\.m3u8$/.test(path) || mediaType.includes('mpegurl');
    const isVideo = /\.(mp4|m4v|webm|ogv)$/.test(path) || mediaType.startsWith('video/');
    if (!isHls && !isVideo) return null;
    return { url: url.href, mode: isHls ? 'hls' : 'auto', quality: stream.name || 'Reproduzir' };
  }
  async function loadStreams(addon, item) {
    if (!state.confirmed || !state.enabled || safeModeOn()) return;
    const epoch = ++state.epoch, controller = makeRequest(); clearPlayer();
    byId('adult-player-title').textContent = item.name || item.title;
    byId('adult-player-status').textContent = `Buscando streams no ${addon.name}…`;
    playerSection.hidden = false; playerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try {
      const data = await json(resourceURL(addon, 'stream', item.type || 'movie', item.id), controller.signal);
      if (controller.signal.aborted || epoch !== state.epoch || safeModeOn()) return;
      const candidates = (Array.isArray(data?.streams) ? data.streams : []).map(directStream).filter(Boolean).slice(0, 8);
      if (!candidates.length) {
        byId('adult-player-status').textContent = 'Este título não retornou um stream HTTPS direto compatível com o player. Torrent e links externos ficam ocultos.';
        return;
      }
      byId('adult-player-status').textContent = 'Escolha um stream. Alguns provedores podem estar temporariamente indisponíveis.';
      const list = byId('adult-streams');
      for (const source of candidates) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = source.quality;
        button.addEventListener('click', () => playSource(source)); list.append(button);
      }
    } catch (error) {
      if (!controller.signal.aborted && epoch === state.epoch) byId('adult-player-status').textContent = `O addon não entregou streams agora (${error.message}).`;
    }
  }
  function playSource(source) {
    state.playback?.dispose(); state.playback = null;
    const media = window.DuckFlixMedia;
    if (!media || safeModeOn() || !state.confirmed) return;
    byId('adult-player-status').textContent = 'Conferindo reprodução…';
    state.playback = media.connect(video, source, {
      timeoutMs: 18000,
      onReady: () => { byId('adult-player-status').textContent = 'Stream carregado. Use os controles do vídeo para reproduzir.'; },
      onError: () => { byId('adult-player-status').textContent = 'Este stream não abriu no navegador. Tente outra opção.'; },
      onBlocked: noop
    });
  }
  function enterAdult() {
    if (!consent.checked || safeModeOn()) return;
    state.confirmed = true; showState(); selectSource(state.selectedSource);
  }
  consent.addEventListener('change', () => { enter.disabled = !consent.checked; });
  enter.addEventListener('click', enterAdult);
  sourceTabs.forEach(tab => tab.addEventListener('click', () => selectSource(tab.dataset.source)));
  byId('adult-filter').addEventListener('input', drawItems);
  byId('adult-player-close').addEventListener('click', clearPlayer);
  window.addEventListener('duckflix:modechange', showState);
  window.addEventListener('storage', event => { if (!event.key || ['duckflix.modoLivre', 'kidsMode'].includes(event.key)) showState(); });
  showState();
})();
