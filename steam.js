(function () {
  'use strict';
  const GAMES = window.DUCKSTEAM_GAMES || [];
  const view = document.getElementById('st-view');
  const desktop = window.DuckFlixDesktop?.downloads || null;
  const STORE_KEY = 'duckSteam.library';
  const downloads = new Map(); // id -> { id, gameId, name, file, state, received, total, speed, eta }

  function readLibrary() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
  function writeLibrary(data) { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* armazenamento indisponível */ } }
  function remember(gameId, info) { const lib = readLibrary(); lib[gameId] = { ...lib[gameId], ...info, at: Date.now() }; writeLibrary(lib); }

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
  function formatBytes(bytes) {
    if (!bytes || bytes < 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** i).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
  }
  function formatEta(seconds) {
    if (seconds == null || !isFinite(seconds)) return 'calculando…';
    const s = Math.round(seconds);
    if (s < 60) return `${s} s`;
    if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
    return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  }
  function formatDate(iso) { try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return ''; } }
  const gameById = id => GAMES.find(game => game.id === id);

  // Release mais recente pelo GitHub (link direto do arquivo). Guardado por 10 min para não estourar o limite da API.
  async function loadRelease(game) {
    if (!game.repo) return { assets: (game.downloads || []).map(d => ({ name: d.name, size: d.size || 0, url: d.url })) };
    const key = `duckSteam.release.${game.repo}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(key));
      if (cached && Date.now() - cached.at < 600000) return cached.data;
    } catch { /* sem cache */ }
    const response = await fetch(`https://api.github.com/repos/${game.repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(response.status === 403 ? 'O GitHub limitou as consultas por agora. Tente novamente em alguns minutos.' : 'Nenhuma versão publicada foi encontrada.');
    const json = await response.json();
    const data = {
      tag: json.tag_name, title: json.name, published: json.published_at, page: json.html_url,
      assets: (json.assets || []).map(a => ({ name: a.name, size: a.size, url: a.browser_download_url, count: a.download_count }))
    };
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* sem cache */ }
    return data;
  }

  // ---- downloads ----
  async function startDownload(game, asset) {
    const id = `${game.id}:${asset.name}`;
    const existing = downloads.get(id);
    if (existing && ['progressing', 'paused'].includes(existing.state)) { location.hash = '#/downloads'; return; }
    const entry = { id, gameId: game.id, name: game.name, file: asset.name, state: desktop ? 'progressing' : 'browser', received: 0, total: asset.size || 0, speed: 0, eta: null };
    downloads.set(id, entry);
    remember(game.id, { started: true, file: asset.name });
    if (desktop) {
      try { await desktop.start(id, asset.url); }
      catch (error) { entry.state = 'error'; entry.message = error.message; }
    } else {
      const link = document.createElement('a');
      link.href = asset.url; link.rel = 'noopener'; link.download = asset.name;
      document.body.append(link); link.click(); link.remove();
    }
    refreshChrome();
    location.hash = '#/downloads';
  }

  if (desktop) {
    desktop.onEvent(event => {
      const entry = downloads.get(event.id);
      if (!entry) return;
      Object.assign(entry, { state: event.state, received: event.received, total: event.total || entry.total, speed: event.speed, eta: event.eta, file: event.filename || entry.file });
      if (event.state === 'completed') remember(entry.gameId, { installed: true, file: entry.file });
      refreshChrome();
      if (currentTab() === 'downloads') updateDownloadRows();
    });
  }

  function active() { return [...downloads.values()].filter(d => ['progressing', 'paused'].includes(d.state)); }
  function percent(d) { return d.total ? Math.min(100, (d.received / d.total) * 100) : 0; }

  function refreshChrome() {
    const running = active();
    const badge = document.getElementById('st-badge');
    badge.hidden = !running.length; badge.textContent = running.length;
    const bar = document.getElementById('st-bar');
    const current = running[0];
    bar.hidden = !current || currentTab() === 'downloads';
    if (current) {
      document.getElementById('st-bar-name').textContent = current.name;
      document.getElementById('st-bar-detail').textContent = `${percent(current).toFixed(0)}% · ${formatBytes(current.speed)}/s · faltam ${formatEta(current.eta)}`;
      document.getElementById('st-bar-fill').style.width = `${percent(current)}%`;
    }
  }

  // ---- views ----
  function currentTab() {
    const hash = location.hash;
    if (hash.startsWith('#/downloads')) return 'downloads';
    if (hash.startsWith('#/biblioteca')) return 'library';
    return 'store';
  }
  function cover(game) { return `<img src="${esc(game.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`; }

  function renderStore(query = '') {
    const q = query.trim().toLowerCase();
    const list = GAMES.filter(g => !q || `${g.name} ${g.tags.join(' ')} ${g.tagline}`.toLowerCase().includes(q));
    const featured = GAMES[0];
    view.innerHTML = `
      ${featured && !q ? `<a class="st-featured" href="#/jogo/${esc(featured.id)}">
        <div class="st-featured-art">${cover(featured)}</div>
        <div class="st-featured-copy"><p class="st-eyebrow">EM DESTAQUE</p><h1>${esc(featured.name)}</h1><p>${esc(featured.tagline)}</p>
        <div class="st-tags">${featured.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div><span class="st-cta">Ver página do jogo →</span></div></a>` : `<h1 class="st-title">DuckSteam</h1>`}
      <form class="st-search" role="search"><label class="st-sr" for="st-q">Buscar jogos</label>
        <input id="st-q" type="search" placeholder="Buscar jogos" value="${esc(query)}" autocomplete="off"></form>
      <h2 class="st-section">${q ? 'Resultados' : 'Jogos da comunidade'}</h2>
      <div class="st-grid">${list.map(g => `<a class="st-card" href="#/jogo/${esc(g.id)}"><div class="st-card-art">${cover(g)}</div>
        <div class="st-card-body"><strong>${esc(g.name)}</strong><small>${esc(g.tagline)}</small><div class="st-tags">${g.tags.slice(0, 3).map(t => `<span>${esc(t)}</span>`).join('')}</div></div></a>`).join('')
        || '<p class="st-empty">Nenhum jogo encontrado.</p>'}</div>`;
    const input = document.getElementById('st-q');
    input.addEventListener('input', () => {
      const pos = input.selectionStart; renderStore(input.value);
      const next = document.getElementById('st-q'); next.focus(); next.setSelectionRange(pos, pos);
    });
    input.closest('form').addEventListener('submit', e => e.preventDefault());
  }

  async function renderGame(id) {
    const game = gameById(id);
    if (!game) { view.innerHTML = '<p class="st-empty">Jogo não encontrado. <a href="#/">Voltar à loja</a></p>'; return; }
    view.innerHTML = `
      <a class="st-crumb" href="#/">← Loja</a>
      <section class="st-game">
        <div class="st-game-head"><h1>${esc(game.name)}</h1></div>
        <div class="st-game-top">
          <div class="st-game-art">${cover(game)}</div>
          <div class="st-game-side">
            <p>${esc(game.tagline)}</p>
            <dl><dt>Desenvolvedor</dt><dd>${esc(game.author)}</dd><dt>Licença</dt><dd>${esc(game.license || '—')}</dd></dl>
            <div class="st-tags">${game.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
          </div>
        </div>
        <div class="st-buy" id="st-buy"><p class="st-muted">Buscando a versão mais recente…</p></div>
        <div class="st-cols">
          <div>
            <h2>Sobre o jogo</h2>${game.description.map(p => `<p>${esc(p)}</p>`).join('')}
            <h2>Recursos</h2><ul class="st-list">${game.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
            <h2>Como instalar</h2><ol class="st-steps">${game.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
            ${game.online ? `<h2>Jogar online</h2><p>${esc(game.online)}</p>` : ''}
            ${game.issues ? `<h2>Problemas conhecidos</h2><p>${esc(game.issues)}</p>` : ''}
          </div>
          <aside>
            <h2>Requisitos do sistema</h2>
            <dl class="st-req">${game.requirements.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
            <h2>Links</h2><ul class="st-links">${game.links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a></li>`).join('')}</ul>
          </aside>
        </div>
      </section>`;
    const buy = document.getElementById('st-buy');
    try {
      const release = await loadRelease(game);
      if (location.hash !== `#/jogo/${id}`) return;
      if (!release.assets.length) throw new Error('Esta versão não tem arquivos para baixar.');
      buy.innerHTML = `<div class="st-buy-head"><strong>Baixar ${esc(game.name)}</strong>${release.tag ? `<small>Versão ${esc(release.tag)} · ${esc(formatDate(release.published))}</small>` : ''}</div>
        ${release.assets.map((a, i) => `<div class="st-asset"><div><b>${esc(a.name)}</b><small>${formatBytes(a.size)}${a.count ? ` · ${a.count.toLocaleString('pt-BR')} downloads` : ''}</small></div>
          <button type="button" data-asset="${i}">Baixar</button></div>`).join('')}
        <p class="st-note">${desktop ? 'O download acontece dentro do DuckFlix, com progresso, velocidade e tempo restante. O arquivo vai para a pasta Downloads\\DuckSteam.' : 'O download usa o gerenciador do seu navegador. Para acompanhar progresso e tempo restante aqui no site, use o DuckFlix para Windows.'}</p>`;
      buy.querySelectorAll('[data-asset]').forEach(btn => btn.addEventListener('click', () => startDownload(game, release.assets[Number(btn.dataset.asset)])));
    } catch (error) {
      buy.innerHTML = `<p class="st-error">${esc(error.message)}</p>${game.repo ? `<a class="st-fallback" href="https://github.com/${esc(game.repo)}/releases" target="_blank" rel="noopener noreferrer">Abrir página de downloads no GitHub ↗</a>` : ''}`;
    }
  }

  function renderLibrary() {
    const lib = readLibrary();
    const owned = GAMES.filter(g => lib[g.id]);
    view.innerHTML = `<h1 class="st-title">Biblioteca</h1>${owned.length ? `<div class="st-grid">${owned.map(g => `<a class="st-card" href="#/jogo/${esc(g.id)}"><div class="st-card-art">${cover(g)}</div>
      <div class="st-card-body"><strong>${esc(g.name)}</strong><small>${lib[g.id].installed ? 'Baixado pelo DuckFlix' : 'Download iniciado'} · ${esc(formatDate(lib[g.id].at))}</small></div></a>`).join('')}</div>`
      : '<p class="st-empty">Sua biblioteca está vazia. Baixe um jogo na <a href="#/">loja</a>.</p>'}`;
  }

  const STATE_LABEL = { progressing: 'Baixando', paused: 'Pausado', completed: 'Concluído', cancelled: 'Cancelado', interrupted: 'Interrompido', error: 'Erro', browser: 'Iniciado no navegador' };
  function rowHtml(d) {
    const live = ['progressing', 'paused'].includes(d.state);
    return `<div class="st-dl" data-id="${esc(d.id)}">
      <div class="st-dl-head"><div><strong>${esc(d.name)}</strong><small>${esc(d.file)}</small></div><span class="st-state st-${esc(d.state)}">${STATE_LABEL[d.state] || esc(d.state)}</span></div>
      ${d.state === 'browser' ? '<p class="st-muted">O navegador está cuidando deste download. Veja o progresso na barra de downloads dele.</p>'
        : d.state === 'error' ? `<p class="st-error">${esc(d.message || 'Não foi possível baixar.')}</p>`
        : `<div class="st-progress big"><span style="width:${percent(d).toFixed(1)}%"></span></div>
           <div class="st-stats"><span>${formatBytes(d.received)} de ${formatBytes(d.total)} (${percent(d).toFixed(0)}%)</span>
           ${live ? `<span>${d.state === 'paused' ? 'Pausado' : `${formatBytes(d.speed)}/s`}</span><span>Faltam ${d.state === 'paused' ? '—' : formatEta(d.eta)}</span>` : ''}</div>`}
      <div class="st-dl-actions">
        ${d.state === 'progressing' ? '<button data-act="pause">Pausar</button>' : ''}
        ${d.state === 'paused' ? '<button data-act="resume">Continuar</button>' : ''}
        ${live ? '<button data-act="cancel">Cancelar</button>' : ''}
        ${d.state === 'completed' ? '<button data-act="show">Mostrar na pasta</button>' : ''}
        ${!live ? '<button data-act="remove">Remover da lista</button>' : ''}
      </div></div>`;
  }
  function renderDownloads() {
    const list = [...downloads.values()].reverse();
    view.innerHTML = `<h1 class="st-title">Downloads</h1><div id="st-dl-list">${list.length ? list.map(rowHtml).join('') : '<p class="st-empty">Nenhum download nesta sessão. Escolha um jogo na <a href="#/">loja</a>.</p>'}</div>`;
  }
  function updateDownloadRows() {
    // Atualiza só os números para não perder o foco dos botões a cada evento de progresso.
    const container = document.getElementById('st-dl-list');
    if (!container) return;
    for (const d of downloads.values()) {
      const row = [...container.querySelectorAll('.st-dl')].find(r => r.dataset.id === d.id);
      const stateChanged = !row || row.querySelector('.st-state')?.textContent !== (STATE_LABEL[d.state] || d.state);
      if (stateChanged) { renderDownloads(); return; }
      row.querySelector('.st-progress span').style.width = `${percent(d).toFixed(1)}%`;
      const stats = row.querySelectorAll('.st-stats span');
      if (stats[0]) stats[0].textContent = `${formatBytes(d.received)} de ${formatBytes(d.total)} (${percent(d).toFixed(0)}%)`;
      if (stats[1]) stats[1].textContent = `${formatBytes(d.speed)}/s`;
      if (stats[2]) stats[2].textContent = `Faltam ${formatEta(d.eta)}`;
    }
  }
  view.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const id = button.closest('.st-dl').dataset.id;
    const act = button.dataset.act;
    if (act === 'remove') { downloads.delete(id); renderDownloads(); refreshChrome(); }
    else if (act === 'show') desktop?.show(id);
    else desktop?.control(id, act);
  });

  function route() {
    const hash = location.hash;
    document.querySelectorAll('.st-tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === currentTab()));
    window.scrollTo(0, 0);
    if (hash.startsWith('#/jogo/')) renderGame(decodeURIComponent(hash.slice(7)));
    else if (hash.startsWith('#/biblioteca')) renderLibrary();
    else if (hash.startsWith('#/downloads')) renderDownloads();
    else renderStore();
    refreshChrome();
  }
  window.addEventListener('hashchange', route);
  route();
})();
