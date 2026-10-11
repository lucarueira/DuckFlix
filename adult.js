(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const blocked = byId('adult-blocked'), login = byId('adult-login'), gate = byId('adult-gate'), app = byId('adult-app');
  const consent = byId('adult-confirm'), enter = byId('adult-enter'), status = byId('adult-status');
  const catalogsNode = byId('adult-catalogs'), resultsNode = byId('adult-results');
  const sourceTabs = [...document.querySelectorAll('[data-source]')];
  const video = byId('adult-video'), playerSection = byId('adult-player-section');
  const embed = byId('adult-embed'), embedFallback = byId('adult-embed-fallback'), encryptedSection = byId('adult-encrypted');
  const encryptedResults = byId('adult-encrypted-results'), keyStatus = byId('adult-key-status');
  const ADDONS = Object.freeze({
    notxo: {
      name: 'Notxo', base: 'https://notxo.vercel.app',
      catalogTypes: new Set(['movie'])
    },
    animeShorts: {
      name: 'Adult Anime & Shorts', base: 'https://stremio-addon-olive.vercel.app',
      catalogTypes: new Set(['movie'])
    }
  });
  const ADULT_PASSWORD = 'duck42';
  let authenticated = false;
  try { authenticated = sessionStorage.getItem('duckflix.adult.auth') === 'true'; } catch {}
  const state = { enabled: false, confirmed: false, selectedSource: 'encrypted', extraKey: '', manifests: new Map(), catalogs: [], items: [], visibleCount: 100, request: null, playback: null, epoch: 0 };
  const noop = () => {};
  const safeModeOn = () => window.DuckFlixSafety?.enabled?.() ?? (() => {
    try { return localStorage.getItem('duckflix.modoLivre') === 'true' || localStorage.getItem('kidsMode') === 'true'; }
    catch { return true; }
  })();
  function clearPlayer() {
    state.playback?.dispose(); state.playback = null;
    video.pause(); video.removeAttribute('src'); video.load();
    video.hidden = false; embed.removeAttribute('src'); embed.hidden = true;
    embedFallback.hidden = true; embedFallback.removeAttribute('href');
    byId('adult-play-button').hidden = true;
    byId('adult-streams').replaceChildren(); playerSection.hidden = true;
  }
  function clearContent() {
    state.request?.abort(); state.request = null;
    clearPlayer(); state.catalogs = []; state.items = []; state.visibleCount = 100; byId('adult-load-more').hidden = true;
    catalogsNode.replaceChildren(); resultsNode.replaceChildren();
    byId('adult-filter').value = ''; byId('adult-catalog-title').textContent = 'Escolha um catálogo';
    byId('adult-result-count').textContent = '';
    encryptedResults.replaceChildren(); state.extraKey = ''; byId('adult-key').value = ''; byId('adult-key-form').hidden = true;
    keyStatus.textContent = 'Carregando vídeos…';
    for (const [key] of state.manifests) state.manifests.delete(key);
  }
  function showState() {
    const mode = safeModeOn();
    if (mode) {
      state.enabled = false; state.confirmed = false; state.epoch++;
      authenticated = false;
      try { sessionStorage.removeItem('duckflix.adult.auth'); } catch {}
      consent.checked = false; enter.disabled = true;
      clearContent(); login.hidden = true; gate.hidden = true; app.hidden = true; blocked.hidden = false;
      return;
    }
    blocked.hidden = true;
    state.enabled = true;
    login.hidden = authenticated;
    gate.hidden = !authenticated || state.confirmed;
    app.hidden = !state.confirmed;
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
      if (!catalog || typeof catalog.id !== 'string' || typeof catalog.name !== 'string') return false;
      return addon.catalogTypes.has(catalog.type);
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
    state.items = []; state.visibleCount = 100; byId('adult-load-more').hidden = true; resultsNode.replaceChildren(); catalogsNode.replaceChildren();
    byId('adult-filter').value = ''; byId('adult-catalog-title').textContent = 'Catálogos';
    byId('adult-result-count').textContent = '';
    sourceTabs.forEach(tab => { const active = tab.dataset.source === source; tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', String(active)); });
    const encrypted = source === 'encrypted';
    byId('adult-browser').hidden = encrypted; encryptedSection.hidden = !encrypted;
    if (encrypted) { loadEncrypted(epoch, controller.signal); return; }
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
  async function decryptInvertexto(code, password) {
    if (!/^[A-Za-z0-9_-]{22,2048}$/.test(code) || !window.crypto?.subtle) throw new Error('Código inválido.');
    const raw = atob(code.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(code.length / 4) * 4, '='));
    if (!raw.length || raw.length % 16) throw new Error('Código inválido.');
    const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
    const keyBytes = new Uint8Array(16);
    keyBytes.set(new TextEncoder().encode(password).subarray(0, 16));
    const key = await window.crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['encrypt', 'decrypt']);
    const iv = new Uint8Array(16), output = new Uint8Array(bytes.length);
    // Web Crypto não expõe AES-ECB. Cada bloco ECB é decifrado como o primeiro
    // bloco CBC; o segundo bloco construído garante padding válido.
    for (let offset = 0; offset < bytes.length; offset += 16) {
      const paddingInput = bytes.slice(offset, offset + 16).map(byte => byte ^ 16);
      const paddingCipher = new Uint8Array(await window.crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, paddingInput));
      const pair = new Uint8Array(32);
      pair.set(bytes.subarray(offset, offset + 16)); pair.set(paddingCipher.subarray(0, 16), 16);
      const plain = new Uint8Array(await window.crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, pair));
      output.set(plain, offset);
    }
    let length = output.length;
    while (length && output[length - 1] === 0) length--;
    return new TextDecoder('utf-8', { fatal: true }).decode(output.subarray(0, length));
  }
  function xhamsterEmbed(value) {
    let url;
    try { url = new URL(value); } catch { return null; }
    if (url.protocol !== 'https:' || !['xhamster.com', 'www.xhamster.com'].includes(url.hostname) || url.port || url.username || url.password) return null;
    const match = url.pathname.match(/^\/videos\/[a-z0-9-]+-([a-z0-9]+)\/?$/i) || url.pathname.match(/^\/embed\/([a-z0-9]+)\/?$/i);
    return match ? `https://xhamster.com/embed/${match[1]}` : null;
  }
  function videoTitle(value, index) {
    const match = new URL(value).pathname.match(/^\/videos\/(.+)-[a-z0-9]+\/?$/i);
    const name = match?.[1].replace(/-/g, ' ').trim();
    return name ? name.charAt(0).toLocaleUpperCase('pt-BR') + name.slice(1, 119) : `Vídeo ${index}`;
  }
  function playEmbed(item) {
    if (!state.confirmed || !state.enabled || safeModeOn() || state.selectedSource !== 'encrypted') return;
    clearPlayer(); video.hidden = true; embed.hidden = false;
    byId('adult-player-title').textContent = item.title;
    byId('adult-player-status').textContent = 'Player do site de origem. Se não iniciar, o próprio site pode estar bloqueando a incorporação.';
    embedFallback.href = item.original; embedFallback.hidden = false;
    playerSection.hidden = false; embed.src = item.url;
    playerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  async function loadEncrypted(epoch, signal) {
    encryptedResults.replaceChildren();
    status.textContent = 'Abrindo vídeos incorporados…'; keyStatus.textContent = 'Lendo códigos criptografados…';
    try {
      const response = await fetch('adult-videos.txt', { signal, credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('Arquivo de vídeos indisponível.');
      const text = await response.text();
      if (text.length > 100000) throw new Error('Arquivo de vídeos muito grande.');
      const codes = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')).slice(0, 100);
      const items = [], seen = new Set();
      let skipped = 0;
      const passwords = ['', ADULT_PASSWORD];
      if (state.extraKey) passwords.push(state.extraKey);
      for (const code of codes) {
        let opened = false;
        for (const password of passwords) {
          try {
            const original = await decryptInvertexto(code, password);
            const url = xhamsterEmbed(original);
            if (!url) continue;
            if (!seen.has(url)) { seen.add(url); items.push({ url, original, title: videoTitle(original, items.length + 1) }); }
            opened = true; break;
          } catch {}
        }
        if (!opened) skipped++;
      }
      if (signal.aborted || epoch !== state.epoch || safeModeOn()) return;
      byId('adult-key-form').hidden = skipped === 0;
      if (!items.length) { status.textContent = 'Vídeos do arquivo'; keyStatus.textContent = 'Nenhum vídeo pôde ser aberto. Confira os códigos do arquivo.'; return; }
      for (const item of items) {
        const card = document.createElement('article'); card.className = 'adult-card';
        const button = document.createElement('button'); button.type = 'button';
        const title = document.createElement('strong'); title.textContent = item.title;
        button.append(title); button.addEventListener('click', () => playEmbed(item));
        card.append(button); encryptedResults.append(card);
      }
      status.textContent = 'Vídeos do arquivo';
      keyStatus.textContent = `${items.length} vídeo(s) disponível(is). Escolha um para carregar o player.${skipped ? ` ${skipped} código(s) restante(s) precisam de outra chave.` : ''}`;
    } catch (error) {
      if (!signal.aborted && epoch === state.epoch) { status.textContent = 'Vídeos do arquivo'; keyStatus.textContent = error.message || 'Não foi possível abrir a lista.'; }
    }
  }
  function drawItems() {
    resultsNode.replaceChildren();
    const query = byId('adult-filter').value.trim().toLocaleLowerCase('pt-BR');
    const items = state.items.filter(item => [item.name, item.title, item.id, item.description, ...(Array.isArray(item.genres) ? item.genres : [])]
      .filter(value => typeof value === 'string').join(' ').toLocaleLowerCase('pt-BR').includes(query));
    const shownItems = items.slice(0, state.visibleCount);
    byId('adult-result-count').textContent = items.length
      ? (shownItems.length < items.length ? `Mostrando ${shownItems.length} de ${items.length}` : `${items.length} resultados`)
      : '';
    const loadMore = byId('adult-load-more');
    loadMore.hidden = shownItems.length >= items.length;
    if (!loadMore.hidden) loadMore.textContent = `Mostrar mais ${Math.min(100, items.length - shownItems.length)} resultados`;
    if (!items.length) {
      const message = document.createElement('p'); message.className = 'adult-empty';
      message.textContent = state.items.length ? 'Nenhum resultado corresponde ao filtro.' : 'Este catálogo não retornou títulos agora.';
      resultsNode.append(message); return;
    }
    const source = ADDONS[state.selectedSource];
    for (const item of shownItems) {
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
    const epoch = ++state.epoch, controller = makeRequest(); clearPlayer(); state.items = []; state.visibleCount = 100; byId('adult-load-more').hidden = true;
    byId('adult-catalog-title').textContent = catalog.name;
    byId('adult-result-count').textContent = ''; resultsNode.replaceChildren();
    for (const button of catalogsNode.querySelectorAll('button')) {
      const active = button.textContent === catalog.name; button.setAttribute('aria-pressed', String(active));
    }
    status.textContent = `Carregando catálogo ${catalog.name}…`;
    try {
      const addon = ADDONS[state.selectedSource], data = await json(catalogURL(addon, catalog), controller.signal);
      if (controller.signal.aborted || epoch !== state.epoch || safeModeOn()) return;
      state.items = (Array.isArray(data?.metas) ? data.metas : []).filter(validMeta).map(item => ({ ...item, type: typeof item.type === 'string' ? item.type : catalog.type }));
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
      byId('adult-player-status').textContent = 'Iniciando a primeira fonte. Se ela falhar, tente outra opção.';
      const list = byId('adult-streams');
      for (const source of candidates) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = source.quality;
        button.addEventListener('click', () => playSource(source)); list.append(button);
      }
      playSource(candidates[0]);
    } catch (error) {
      if (!controller.signal.aborted && epoch === state.epoch) byId('adult-player-status').textContent = `O addon não entregou streams agora (${error.message}).`;
    }
  }
  function playSource(source) {
    state.playback?.dispose(); state.playback = null;
    const media = window.DuckFlixMedia;
    if (!media || safeModeOn() || !state.confirmed) return;
    embed.removeAttribute('src'); embed.hidden = true; video.hidden = false;
    byId('adult-play-button').hidden = true;
    byId('adult-player-status').textContent = 'Carregando e conferindo a fonte…';
    state.playback = media.connect(video, source, {
      timeoutMs: 12000,
      onReady: () => {
        byId('adult-play-button').hidden = false;
        byId('adult-player-status').textContent = 'Fonte carregada. Toque em Reproduzir para começar.';
      },
      onError: () => { byId('adult-play-button').hidden = true; byId('adult-player-status').textContent = 'A fonte não iniciou em 12 segundos. Tente outra opção da lista.'; },
      onBlocked: noop
    });
  }
  byId('adult-play-button').addEventListener('click', () => {
    video.play().then(() => { byId('adult-play-button').hidden = true; }).catch(() => {
      byId('adult-player-status').textContent = 'O navegador bloqueou a reprodução. Toque no botão de play dentro do vídeo.';
    });
  });
  byId('adult-login-form').addEventListener('submit', event => {
    event.preventDefault();
    if (safeModeOn()) { showState(); return; }
    if (byId('adult-user').value.trim().toLowerCase() !== 'duckflix' || byId('adult-password').value !== ADULT_PASSWORD) {
      byId('adult-login-status').textContent = 'Login ou senha incorretos.';
      byId('adult-password').select(); return;
    }
    authenticated = true;
    byId('adult-login-status').textContent = '';
    byId('adult-user').value = '';
    byId('adult-password').value = '';
    try { sessionStorage.setItem('duckflix.adult.auth', 'true'); } catch {}
    showState();
  });
  function enterAdult() {
    if (!consent.checked || safeModeOn()) return;
    state.confirmed = true; showState(); selectSource(state.selectedSource);
  }
  consent.addEventListener('change', () => { enter.disabled = !consent.checked; });
  enter.addEventListener('click', enterAdult);
  sourceTabs.forEach(tab => tab.addEventListener('click', () => selectSource(tab.dataset.source)));
  byId('adult-key-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!state.confirmed || !state.enabled || safeModeOn() || state.selectedSource !== 'encrypted') return;
    state.extraKey = byId('adult-key').value;
    byId('adult-key').value = '';
    const epoch = ++state.epoch, controller = makeRequest();
    clearPlayer(); loadEncrypted(epoch, controller.signal);
  });
  byId('adult-filter').addEventListener('input', () => { state.visibleCount = 100; drawItems(); });
  byId('adult-load-more').addEventListener('click', () => { state.visibleCount += 100; drawItems(); });
  byId('adult-player-close').addEventListener('click', clearPlayer);
  window.addEventListener('duckflix:modechange', showState);
  window.addEventListener('storage', event => { if (!event.key || ['duckflix.modoLivre', 'kidsMode'].includes(event.key)) showState(); });
  showState();
})();
