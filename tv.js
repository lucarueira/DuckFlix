(() => {
  'use strict';

  const PLAYLISTS = {
    br: 'https://iptv-org.github.io/iptv/countries/br.m3u',
    world: 'https://iptv-org.github.io/iptv/index.m3u'
  };
  const CATEGORY_NAMES = {
    Animation: 'Animação', Auto: 'Automóveis', Business: 'Negócios', Classic: 'Clássicos',
    Comedy: 'Comédia', Cooking: 'Culinária', Culture: 'Cultura', Documentary: 'Documentários',
    Education: 'Educação', Entertainment: 'Entretenimento', Family: 'Família', General: 'Geral',
    Interactive: 'Interativo', Kids: 'Infantil', Legislative: 'Legislativo', Lifestyle: 'Estilo de vida',
    Movies: 'Filmes', Music: 'Música', News: 'Notícias', Outdoor: 'Ao ar livre', Public: 'Público',
    Relax: 'Relaxamento', Religious: 'Religião', Science: 'Ciência', Series: 'Séries', Shop: 'Compras',
    Sports: 'Esportes', Travel: 'Viagens', Weather: 'Clima', Undefined: 'Outros'
  };
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const categoryName = category => CATEGORY_NAMES[category] || category;

  // Playlist metadata is untrusted text; it is never inserted as HTML.
  function parsePlaylist(text, { allowHTTP = false } = {}) {
    if (!text.trimStart().startsWith('#EXTM3U')) throw new Error('Invalid M3U');
    const channels = [];
    const seen = new Set();
    let metadata = null;
    let skipped = 0;
    for (const rawLine of text.split(/[\r\n]+/)) {
      const line = rawLine.trim();
      if (line.startsWith('#EXTINF:')) {
        let quoted = false;
        let separator = -1;
        for (let i = 8; i < line.length; i++) {
          if (line[i] === '"') quoted = !quoted;
          if (line[i] === ',' && !quoted) { separator = i; break; }
        }
        metadata = null;
        if (separator < 0) continue;
        const attributes = Object.fromEntries([...line.slice(0, separator).matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
        metadata = {
          name: line.slice(separator + 1).trim() || 'Canal sem nome',
          logo: /^https:\/\//i.test(attributes['tvg-logo'] || '') ? attributes['tvg-logo'] : '',
          categories: (attributes['group-title'] || 'Undefined').split(';').map(value => value.trim()).filter(Boolean)
        };
      } else if (line && !line.startsWith('#') && metadata) {
        const channel = metadata;
        metadata = null;
        try {
          const url = new URL(line);
          // Existing HTTPS entries stay unchanged. HTTP HLS is optional and uses the extension.
          const httpHLS = allowHTTP && url.protocol === 'http:' && /\.m3u8$/i.test(url.pathname);
          if ((!httpHLS && url.protocol !== 'https:') || url.username || url.password) { skipped++; continue; }
          if (seen.has(url.href)) continue;
          seen.add(url.href);
          channels.push({ ...channel, url: url.href, search: normalize(channel.name) });
        } catch { skipped++; }
      }
    }
    return { channels, skipped };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { parsePlaylist, normalize };
  if (typeof document === 'undefined') return;

  const el = id => document.getElementById(id);
  const video = el('live-video');
  const grid = el('channel-grid');
  const search = el('channel-search');
  const category = el('category');
  const playlist = el('playlist');
  const listStatus = el('list-status');
  const playerStatus = el('player-status');
  const health = window.DuckTVHealth;
  const results = new Map();
  const animationURL = 'https://iptv-org.github.io/iptv/categories/animation.m3u';
  const carousel = el('animation-carousel');
  let animations = [];
  let scanner = null;
  let renderTimer = null;
  let searchTimer = null;
  let channels = [];
  let filtered = [];
  let visibleCount = 48;
  let selected = null;
  let hls = null;
  let request = null;
  let playbackTimer = null;
  let playbackId = 0;
  let loading = false;
  let listError = false;

  const allowedChannel = channel => !window.DuckFlixSafety || window.DuckFlixSafety.channelAllowed(channel);
  const available = channel => allowedChannel(channel) && health.isAvailable(results.get(channel.url));
  const matches = channel => allowedChannel(channel) && channel.search.includes(normalize(search.value.trim())) && (!category.value || channel.categories.includes(category.value));

  function createCard(channel, featured = false) {
    const button = document.createElement('button');
    button.className = featured ? 'channel-card animation-card' : 'channel-card';
    button.type = 'button';
    button.dataset.url = channel.url;
    button.setAttribute('aria-pressed', String(selected?.url === channel.url));
    const icon = document.createElement('span');
    icon.className = 'channel-icon';
    icon.setAttribute('aria-hidden', 'true');
    const initials = document.createElement('span');
    initials.textContent = channel.name.slice(0, 2).toUpperCase();
    icon.append(initials);
    if (channel.logo) {
      const image = document.createElement('img');
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.src = channel.logo;
      image.addEventListener('load', () => { initials.hidden = true; });
      image.addEventListener('error', () => image.remove(), { once: true });
      icon.append(image);
    }
    const copy = document.createElement('span');
    copy.className = 'channel-copy';
    const name = document.createElement('strong');
    name.className = 'channel-name';
    name.textContent = channel.name;
    const detail = document.createElement('span');
    detail.className = 'channel-category';
    detail.textContent = featured ? '▶ Assistir agora' : channel.categories.map(categoryName).join(' · ');
    const badge = document.createElement('span');
    badge.className = 'signal-badge';
    badge.textContent = '● Sinal verificado';
    copy.append(badge, name, detail);
    button.append(icon, copy);
    button.addEventListener('click', () => playChannel(channel));
    return button;
  }

  // Reuse cards during progressive checks to preserve focus and carousel position.
  function syncCards(container, items, featured = false) {
    const existing = new Map([...container.children].map(button => [button.dataset.url, button]));
    const wanted = new Set(items.map(channel => channel.url));
    for (const button of [...container.children]) if (!wanted.has(button.dataset.url)) button.remove();
    items.forEach((channel, index) => {
      const button = existing.get(channel.url) || createCard(channel, featured);
      button.setAttribute('aria-pressed', String(selected?.url === channel.url));
      button.title = `Imagem carregada às ${new Date(results.get(channel.url).checkedAt).toLocaleTimeString('pt-BR')}`;
      if (container.children[index] !== button) container.insertBefore(button, container.children[index] || null);
    });
  }

  function renderChannels() {
    filtered = channels.filter(channel => matches(channel) && available(channel));
    syncCards(grid, filtered.slice(0, visibleCount));
    if (carousel) {
      const cartoons = animations.filter(available);
      syncCards(carousel, cartoons, true);
      const emptyEl = el('animation-empty');
      if (emptyEl) emptyEl.hidden = cartoons.length > 0;
      const prevBtn = el('animation-prev');
      const nextBtn = el('animation-next');
      if (prevBtn && nextBtn) prevBtn.disabled = nextBtn.disabled = cartoons.length < 2;
      if (!cartoons.length && emptyEl) emptyEl.querySelector('p').textContent = scanner || loading
        ? 'Procurando animações com sinal disponível…'
        : 'Nenhuma animação passou no teste ainda. Use “Verificar mais canais” para continuar a busca.';
    }
    el('load-more').hidden = visibleCount >= filtered.length;
    if (loading || listError) return;
    const candidates = channels.filter(matches);
    const pending = candidates.filter(channel => !health.isFresh(results.get(channel.url))).length;
    const count = filtered.length;
    listStatus.textContent = count
      ? `${count.toLocaleString('pt-BR')} canais com imagem verificada · mostrando ${Math.min(visibleCount, count)}.`
      : !candidates.length ? 'Nenhum canal corresponde à busca nesta lista e categoria. Altere os filtros ou limpe a busca.'
        : scanner && pending ? `${candidates.length} canais encontrados. Verificando quais carregam imagem…`
          : pending ? `${candidates.length} canais encontrados; ${pending} ainda precisam de verificação. Use “Verificar mais canais”.`
            : `${candidates.length} canais encontrados, mas nenhum passou no teste de reprodução. Use “Verificar novamente” para repetir.`;
  }

  function filterChannels() {
    visibleCount = 48;
    renderChannels();
  }

  function cancelScan() {
    scanner?.abort();
    scanner = null;
    clearTimeout(renderTimer);
    renderTimer = null;
    grid.setAttribute('aria-busy', 'false');
  }

  async function scanMore({ userRequested = false } = {}) {
    cancelScan();
    if (window.DuckFlixSafety?.enabled()) { renderChannels(); return; }
    if (loading || document.hidden) return;
    const focusedSearch = Boolean(search.value.trim() || category.value);
    // Watching pauses background discovery, not an explicit search for the next channel.
    if (selected && !focusedSearch && !userRequested) {
      el('scan-status').textContent = 'Varredura automática pausada enquanto você assiste. Você pode buscar outro canal normalmente.';
      el('scan-more').hidden = true;
      renderChannels();
      return;
    }
    const capable = video.canPlayType('application/vnd.apple.mpegurl') || window.Hls?.isSupported();
    if (!capable) {
      el('scan-status').textContent = 'O player não foi carregado ou não é compatível. Recarregue a página em um navegador atualizado.';
      el('scan-more').hidden = true;
      return;
    }
    const untested = channel => !health.isFresh(results.get(channel.url));
    const cartoonQueue = focusedSearch || selected ? [] : animations.filter(untested).slice(0, 20);
    const channelQueue = channels.filter(channel => matches(channel) && untested(channel)).slice(0, 24);
    // Interleave the featured selection and directory; at most two decoders at once.
    const queue = [];
    const seen = new Set();
    for (let i = 0; i < Math.max(cartoonQueue.length, channelQueue.length); i++) {
      for (const channel of [cartoonQueue[i], channelQueue[i]]) if (channel && !seen.has(channel.url)) { seen.add(channel.url); queue.push(channel); }
    }
    el('scan-more').hidden = true;
    if (!queue.length) {
      el('scan-status').textContent = focusedSearch && !channels.some(matches)
        ? 'Busca concluída: nenhum canal corresponde aos filtros selecionados.'
        : 'Verificação em dia para esta seleção. Use “Verificar novamente” para repetir os testes.';
      renderChannels();
      return;
    }
    const controller = new AbortController();
    scanner = controller;
    grid.setAttribute('aria-busy', 'true');
    let checked = 0;
    const updateProgress = () => {
      el('scan-status').textContent = `Verificando sinais: ${checked}/${queue.length} neste lote. Somente canais com imagem entram na seleção.`;
    };
    updateProgress();
    renderChannels();
    try {
      await health.scanChannels(queue, {
        signal: controller.signal,
        concurrency: selected ? 1 : 2,
        probe: (url, options) => {
          const channel = queue.find(item => item.url === url);
          return channel?.addonEndpoint && window.DuckTVAddons
            ? window.DuckTVAddons.probe(channel, { ...options, probeChannel: health.probeChannel })
            : health.probeChannel(url, options);
        },
        onResult(channel, result) {
          if (scanner !== controller || controller.signal.aborted) return;
          results.set(channel.url, result);
          checked++;
          updateProgress();
          if (!renderTimer) renderTimer = setTimeout(() => { renderTimer = null; renderChannels(); }, 300);
        }
      });
      if (scanner !== controller) return;
      el('scan-status').textContent = `Lote concluído: ${checked} sinais testados. A verificação vale por até 5 minutos.`;
    } catch {
      if (scanner !== controller) return;
      controller.abort();
      el('scan-status').textContent = 'A verificação foi interrompida. Você pode pesquisar novamente ou clicar em “Verificar mais canais”.';
    } finally {
      if (scanner === controller) {
        scanner = null;
        grid.setAttribute('aria-busy', 'false');
        const remaining = focusedSearch || selected ? channels.filter(matches) : [...animations, ...channels.filter(matches)];
        el('scan-more').hidden = !remaining.some(untested);
        renderChannels();
      }
    }
  }

  async function fetchList(url, signal) {
    const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = parsePlaylist(await response.text(), { allowHTTP: Boolean(window.DuckFlixExtension?.connected) });
    if (!result.channels.length) throw new Error('Empty playlist');
    return result.channels;
  }

  async function loadPlaylist() {
    clearTimeout(searchTimer);
    request?.abort();
    cancelScan();
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    loading = true;
    listError = false;
    channels = [];
    animations = [];
    filtered = [];
    grid.replaceChildren();
    carousel?.replaceChildren();
    grid.setAttribute('aria-busy', 'true');
    category.replaceChildren(new Option('Todas as categorias', ''));
    category.disabled = true;
    el('load-more').hidden = true;
    listStatus.textContent = 'Carregando canais…';
    el('scan-status').textContent = 'Carregando listas para testar a reprodução…';
    el('scan-more').hidden = true;
    renderChannels();
    try {
      const [directory, cartoons, addons] = await Promise.allSettled([
        fetchList(PLAYLISTS[playlist.value], controller.signal),
        fetchList(animationURL, controller.signal),
        window.DuckFlixSafety?.enabled() ? Promise.resolve([]) : (window.DuckTVAddons?.load(controller.signal) || Promise.resolve([]))
      ]);
      if (request !== controller) return;
      channels = [...(addons.status === 'fulfilled' ? addons.value : []), ...(directory.status === 'fulfilled' ? directory.value : [])];
      const localCartoons = channels.filter(channel => channel.categories.includes('Animation'));
      animations = [...new Map([...localCartoons, ...(cartoons.status === 'fulfilled' ? cartoons.value : [])].map(channel => [channel.url, channel])).values()];
      if (!channels.length && !animations.length) throw new Error('Empty playlists');
      listError = !channels.length;
      if (listError) listStatus.textContent = 'A lista de canais não carregou. As animações continuam disponíveis; tente “Verificar novamente”.';
      if (cartoons.status === 'rejected' && el('animation-empty')) el('animation-empty').querySelector('p').textContent = 'A lista mundial de animação não carregou. Tentando os canais da lista selecionada.';
      const categories = [...new Set(channels.flatMap(channel => channel.categories))].sort((a, b) => categoryName(a).localeCompare(categoryName(b), 'pt-BR'));
      for (const value of categories) category.add(new Option(categoryName(value), value));
      loading = false;
      filterChannels();
      scanMore();
    } catch {
      if (request !== controller) return;
      listError = true;
      listStatus.textContent = 'Não foi possível carregar os canais. Verifique sua conexão e clique em “Verificar novamente”.';
      el('scan-status').textContent = 'Verificação indisponível: as listas não carregaram.';
    } finally {
      clearTimeout(timeout);
      if (request === controller) {
        loading = false;
        category.disabled = false;
        grid.setAttribute('aria-busy', String(Boolean(scanner)));
        renderChannels();
      }
    }
  }

  function stopPlayback() {
    playbackId++;
    clearTimeout(playbackTimer);
    if (hls) { hls.destroy(); hls = null; }
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  function playbackFailed(message) {
    if (selected) results.set(selected.url, { ok: false, checkedAt: Date.now() });
    stopPlayback();
    playerStatus.textContent = message;
    el('retry-stream').hidden = false;
    renderChannels();
  }

  function startVideo(id) {
    if (id !== playbackId) return;
    video.play().catch(error => {
      if (id !== playbackId || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') {
        clearTimeout(playbackTimer);
        playerStatus.textContent = 'Pressione o play no vídeo para iniciar a transmissão.';
      } else playbackFailed('Não foi possível reproduzir este canal. Tente novamente ou escolha outro.');
    });
  }

  function playChannel(channel) {
    if (!allowedChannel(channel)) return;
    clearTimeout(searchTimer);
    cancelScan();
    stopPlayback();
    selected = channel;
    el('scan-status').textContent = 'Varredura automática pausada enquanto você assiste. Você pode buscar outro canal normalmente.';
    el('scan-more').hidden = true;
    const id = playbackId;
    el('channel-title').textContent = channel.name;
    el('player-placeholder').hidden = true;
    el('retry-stream').hidden = true;
    el('stop-stream').hidden = false;
    video.hidden = false;
    playerStatus.textContent = 'Conectando à transmissão…';
    // Preserve the focused card instead of rebuilding the grid on selection.
    [...grid.children, ...(carousel ? carousel.children : [])].forEach(button => button.setAttribute('aria-pressed', String(button.dataset.url === channel.url)));
    el('watch').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    playbackTimer = setTimeout(() => {
      if (id === playbackId) playbackFailed('O canal demorou para responder. Tente novamente ou escolha outro.');
    }, 25000);
    if (video.canPlayType('application/vnd.apple.mpegurl') && !channel.url.startsWith('http:')) {
      video.src = channel.url;
      startVideo(id);
    } else if (window.Hls?.isSupported()) {
      hls = new window.Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, ...window.DuckFlixExtension?.hlsConfig(channel.url, window.Hls) });
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => startVideo(id));
      hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (id === playbackId && data.fatal) playbackFailed('Este canal está indisponível ou bloqueou a reprodução neste navegador. Tente outro canal.');
      });
      hls.loadSource(channel.url);
      hls.attachMedia(video);
    } else {
      playbackFailed('O player não pôde ser iniciado. Recarregue a página ou tente um navegador atualizado.');
    }
  }

  video.addEventListener('playing', () => {
    clearTimeout(playbackTimer);
    playerStatus.textContent = 'Reproduzindo ao vivo';
    el('retry-stream').hidden = true;
    if (selected) results.set(selected.url, { ok: true, checkedAt: Date.now() });
    renderChannels();
  });
  video.addEventListener('error', () => {
    if (selected && video.error) playbackFailed('Não foi possível reproduzir este canal. Tente novamente ou escolha outro.');
  });
  video.addEventListener('ended', () => {
    if (selected) playbackFailed('Esta transmissão terminou. Tente novamente ou escolha outro canal.');
  });
  video.addEventListener('waiting', () => {
    if (!selected || !el('retry-stream').hidden) return;
    playerStatus.textContent = 'Aguardando a transmissão…';
    clearTimeout(playbackTimer);
    playbackTimer = setTimeout(() => playbackFailed('A transmissão foi interrompida. Tente novamente ou escolha outro canal.'), 25000);
  });
  function filtersChanged() {
    cancelScan();
    clearTimeout(searchTimer);
    filterChannels();
    searchTimer = setTimeout(scanMore, 450);
  }
  search.addEventListener('input', filtersChanged);
  search.addEventListener('search', filtersChanged);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      clearTimeout(searchTimer);
      filterChannels();
      scanMore({ userRequested: true });
    }
  });
  el('clear-filters').addEventListener('click', () => {
    search.value = '';
    category.value = '';
    filtersChanged();
    search.focus();
  });
  category.addEventListener('change', filtersChanged);
  playlist.addEventListener('change', loadPlaylist);
  el('reload-list').addEventListener('click', () => { results.clear(); loadPlaylist(); });
  el('scan-more').addEventListener('click', () => scanMore({ userRequested: true }));
  el('stop-stream').addEventListener('click', () => {
    stopPlayback();
    selected = null;
    video.hidden = true;
    el('player-placeholder').hidden = false;
    el('stop-stream').hidden = el('retry-stream').hidden = true;
    el('channel-title').textContent = 'O que vamos assistir?';
    playerStatus.textContent = 'Selecione um canal com sinal verificado.';
    scanMore();
  });
  function moveCarousel(direction) {
    if (carousel) carousel.scrollBy({ left: direction * Math.max(280, carousel.clientWidth * 0.75), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  el('animation-prev')?.addEventListener('click', () => moveCarousel(-1));
  el('animation-next')?.addEventListener('click', () => moveCarousel(1));
  carousel?.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); moveCarousel(event.key === 'ArrowRight' ? 1 : -1); }
  });
  el('retry-stream').addEventListener('click', () => { if (selected) playChannel(selected); });
  el('load-more').addEventListener('click', () => {
    const firstNew = visibleCount;
    visibleCount += 48;
    renderChannels();
    grid.children[firstNew]?.focus();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelScan(); el('scan-status').textContent = 'Verificação pausada enquanto a página está em segundo plano.'; }
    else { renderChannels(); scanMore(); }
  });
  // Expired checks are removed; no persistent cache can label yesterday's signal as live.
  setInterval(() => {
    if (document.hidden) return;
    if (selected && !video.paused && video.readyState >= 2) results.set(selected.url, { ok: true, checkedAt: Date.now() });
    renderChannels();
    if (!scanner && !selected) scanMore();
  }, 60000);
  window.addEventListener('pagehide', () => { request?.abort(); cancelScan(); stopPlayback(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { selected = null; el('stop-stream').click(); loadPlaylist(); } });
  window.addEventListener('duckflix:modechange', () => {
    cancelScan(); el('stop-stream').click(); filtersChanged();
    if (!window.DuckFlixSafety?.enabled()) loadPlaylist();
  });
  window.addEventListener('duckflix:extensionready', loadPlaylist);
  loadPlaylist();
})();
