(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const views = { catalog: $('catalog-view'), detail: $('detail-view'), reader: $('reader-view'), library: $('library-view') };
  const results = $('manga-results'), chapters = $('chapter-list'), libraryResults = $('library-results');
  const storageKey = 'duckmangas-library-v1';
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const preview = local && location.port !== '3000';
  const api = kind => preview ? `http://${location.hostname}:3000/api/manga/${kind}` : local ? `/api/manga/${kind}` : `/.netlify/functions/manga-${kind}`;
  let source = 'mangaflix', query = '', searchOffset = 0, searchTotal = 0, chapterOffset = 0, chapterTotal = 0, chapterHidden = 0;
  let currentManga = null, currentChapter = null, page = 0, pageTotal = 0, pageInfo = null, cascade = false, requestNumber = 0, mangaRequestNumber = 0;
  let cascadeTrackingReady = false, cascadeScrollScheduled = false;
  let library = readLibrary();

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }
  function saveLibrary() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(library));
      if (!views.catalog.hidden || !views.library.hidden) renderSavedSections();
    }
    catch { $('catalog-status').textContent = 'Não foi possível salvar sua leitura neste navegador.'; }
  }
  const isFlix = id => String(id).startsWith('mf-');
  const idPattern = /^(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|mf-[0-9a-f]{24})$/i;
  function show(view) {
    Object.entries(views).forEach(([name, element]) => { element.hidden = name !== view; });
    if (view === 'catalog' || view === 'library') renderSavedSections();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function text(tag, content, className) {
    const node = document.createElement(tag);
    node.textContent = content;
    if (className) node.className = className;
    return node;
  }
  function button(label, className, click) {
    const node = text('button', label, className);
    node.type = 'button'; node.addEventListener('click', click); return node;
  }
  function coverElement(manga) {
    if (!manga.cover) return text('div', '▣', 'manga-cover');
    const img = document.createElement('img');
    img.className = 'manga-cover'; img.alt = `Capa de ${manga.title}`; img.loading = 'lazy';
    img.src = manga.cover.path ? `${api('image')}?kind=mf&path=${encodeURIComponent(manga.cover.path)}`
      : `${api('image')}?kind=cover&id=${encodeURIComponent(manga.cover.id)}&file=${encodeURIComponent(manga.cover.file)}`;
    return img;
  }
  function card(manga, subtitle) {
    const node = button('', 'manga-card', () => openManga(manga.id));
    const info = text('span', '', 'card-info');
    info.append(text('strong', manga.title), text('small', subtitle || manga.originalTitle || 'Mangá'));
    node.append(coverElement(manga), info);
    return node;
  }
  async function get(action, params = {}) {
    const search = new URLSearchParams({ action, ...params });
    let response;
    try { response = await fetch(`${api('catalog')}?${search}`, { credentials: 'omit' }); }
    catch { throw new Error(preview ? 'Servidor desligado. Execute node together-server.js para usar o DuckMangás nesta prévia.' : 'Não foi possível conectar ao catálogo.'); }
    let body;
    try { body = await response.json(); } catch { throw new Error('Resposta inválida do catálogo.'); }
    if (!response.ok) throw new Error(body.error || 'Consulta indisponível.');
    return body;
  }
  async function searchMangas(more = false) {
    const serial = ++requestNumber;
    if (!more) {
      searchOffset = 0; results.replaceChildren(); $('results-title').textContent = query ? `Resultados para “${query}”` : 'Mangás populares';
      $('mangaplus-search').href = query ? `https://mangaplus.shueisha.co.jp/search_result?keyword=${encodeURIComponent(query)}` : 'https://mangaplus.shueisha.co.jp/updates';
      $('mangaplus-search').textContent = query ? 'Buscar também no MANGA Plus ↗' : 'Ver lançamentos ↗';
    }
    $('catalog-status').textContent = 'Buscando mangás…'; $('more-results').hidden = true;
    try {
      const data = await get('search', { q: query, offset: searchOffset, source });
      if (serial !== requestNumber) return;
      data.items.forEach(manga => results.append(card(manga)));
      searchTotal = data.total; searchOffset += data.items.length;
      $('result-count').textContent = `${data.total.toLocaleString('pt-BR')} obras`;
      $('catalog-status').textContent = data.items.length || more ? '' : 'Nenhum mangá encontrado. Tente outro nome.';
      $('more-results').hidden = searchOffset >= searchTotal || !data.items.length;
    } catch (cause) { if (serial === requestNumber) $('catalog-status').textContent = cause.message; }
  }
  function renderDetail(manga) {
    const hero = text('div', '', 'detail-hero');
    hero.append(coverElement(manga));
    const info = document.createElement('div');
    info.append(text('p', 'MANGÁ EM PORTUGUÊS', 'eyebrow'), text('h1', manga.title));
    if (manga.originalTitle && manga.originalTitle !== manga.title) info.append(text('p', manga.originalTitle, 'detail-meta'));
    const meta = [manga.year, manga.status === 'completed' ? 'Concluído' : manga.status === 'ongoing' ? 'Em andamento' : '', ...manga.tags].filter(Boolean);
    info.append(text('p', meta.join(' · '), 'detail-meta'));
    const actions = text('div', '', 'detail-actions');
    const favorite = button(library[manga.id]?.favorite ? '★ Nos favoritos' : '☆ Adicionar aos favoritos', 'secondary-button', () => {
      const wasFavorite = !!library[manga.id]?.favorite;
      library[manga.id] = { ...library[manga.id], id: manga.id, title: manga.title, cover: manga.cover, originalTitle: manga.originalTitle, favorite: !wasFavorite, updatedAt: Date.now() };
      if (!library[manga.id].favorite && !library[manga.id].lastChapter) delete library[manga.id];
      saveLibrary(); favorite.textContent = !wasFavorite ? '★ Nos favoritos' : '☆ Adicionar aos favoritos';
    });
    actions.append(favorite);
    const saved = library[manga.id];
    if (saved?.lastChapter) actions.append(button('Continuar leitura', 'primary-button', () => openChapter(saved.lastChapter)));
    info.append(actions);
    const description = text('p', manga.description || 'Sinopse não disponível.', 'detail-description');
    const sourceLink = text('a', `Ver obra no ${isFlix(manga.id) ? 'MangaFlix' : 'MangaDex'} ↗`, 'source-link');
    sourceLink.href = manga.url; sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer';
    hero.append(info, description, sourceLink);
    $('manga-detail').replaceChildren(hero);
  }
  async function openManga(id) {
    const serial = ++mangaRequestNumber;
    show('detail'); chapters.replaceChildren(); $('chapter-status').textContent = 'Carregando capítulos…';
    $('more-chapters').hidden = true; currentManga = null;
    try {
      const manga = await get('detail', { id });
      if (serial !== mangaRequestNumber) return;
      currentManga = manga; renderDetail(manga);
      chapterOffset = 0; chapterHidden = 0; await loadChapters();
    } catch (cause) { if (serial === mangaRequestNumber) $('chapter-status').textContent = cause.message; }
  }
  async function loadChapters() {
    if (!currentManga) return;
    const mangaId = currentManga.id;
    $('chapter-status').textContent = 'Carregando capítulos…'; $('more-chapters').hidden = true;
    try {
      const language = $('chapter-language').value;
      const data = await get('chapters', { id: mangaId, offset: chapterOffset, language });
      if (currentManga?.id !== mangaId || $('chapter-language').value !== language) return;
      chapterTotal = data.total; chapterOffset = data.limit ? chapterOffset + data.limit : chapterTotal; chapterHidden += data.hiddenCount || 0;
      for (const item of data.items) {
        const label = `Capítulo ${item.number || 'extra'}${item.title ? ` · ${item.title}` : ''}`;
        const node = item.externalUrl ? text('a', '', 'chapter-item') : button('', 'chapter-item', () => openChapter(item));
        if (item.externalUrl) { node.href = item.externalUrl; node.target = '_blank'; node.rel = 'noopener noreferrer'; }
        const languageLabel = ({ 'pt-br': 'Português', en: 'Inglês', es: 'Espanhol' })[item.language] || item.language.toUpperCase();
        const left = document.createElement('span'); left.append(text('strong', label), text('small', item.externalUrl ? `${languageLabel} · abrir em ${item.externalLabel} · ${item.group}` : `${languageLabel} · ${item.group} · ${item.pages} páginas`));
        node.append(left);
        if (item.externalUrl) node.append(text('em', 'Abrir ↗'));
        else if (library[mangaId]?.lastChapter?.id === item.id) node.append(text('em', 'Continuar'));
        chapters.append(node);
      }
      $('chapter-count').textContent = `${chapters.childElementCount.toLocaleString('pt-BR')} disponíveis · ${chapterTotal.toLocaleString('pt-BR')} registros`;
      $('chapter-status').textContent = chapterHidden ? `${chapterHidden} registro(s) consultados não têm leitura disponível aqui. O catálogo da fonte pode limitar ou remover capítulos.`
        : chapters.childElementCount ? '' : 'Nenhum capítulo em português disponível para leitura aqui.';
      $('more-chapters').hidden = chapterOffset >= chapterTotal;
    } catch (cause) { $('chapter-status').textContent = cause.message; }
  }
  function updateProgress() {
    if (!currentManga || !currentChapter) return;
    library[currentManga.id] = { ...library[currentManga.id], id: currentManga.id, title: currentManga.title, cover: currentManga.cover, originalTitle: currentManga.originalTitle,
      lastChapter: currentChapter, page, updatedAt: Date.now() };
    saveLibrary();
  }
  async function openChapter(chapter) {
    if (!currentManga || !chapter?.id) return;
    currentChapter = chapter; cascadeTrackingReady = false; show('reader');
    $('reader-title').textContent = `${currentManga.title} · Capítulo ${chapter.number || 'extra'}`;
    $('reader-credit').textContent = `Tradução: ${chapter.group || 'Grupo não informado'}`;
    $('chapter-source').href = isFlix(chapter.id) ? currentManga.url : `https://mangadex.org/chapter/${chapter.id}`;
    $('chapter-source').textContent = `Abrir obra no ${isFlix(chapter.id) ? 'MangaFlix' : 'MangaDex'} ↗`;
    $('reader-status').textContent = 'Carregando páginas…'; $('reader-pages').replaceChildren(); pageInfo = null;
    try {
      const data = await get('pages', { id: chapter.id });
      if (currentChapter?.id !== chapter.id) return;
      pageInfo = data; pageTotal = data.pages;
      page = library[currentManga.id]?.lastChapter?.id === chapter.id ? Math.min(library[currentManga.id].page || 0, pageTotal - 1) : 0;
      if (page < 0) page = 0;
      updateProgress(); renderPages();
    } catch (cause) { $('reader-status').textContent = cause.message; }
  }
  function renderPages() {
    const container = $('reader-pages'); container.replaceChildren(); container.classList.toggle('cascade', cascade);
    if (!pageTotal) { $('reader-status').textContent = 'Nenhuma página disponível.'; return; }
    const indices = cascade ? Array.from({ length: pageTotal }, (_, i) => i) : [page];
    for (const index of indices) {
      const img = document.createElement('img');
      img.dataset.page = String(index);
      img.alt = `Página ${index + 1} de ${pageTotal}`;
      img.loading = cascade && index > 1 ? 'lazy' : 'eager';
      img.src = pageUrl(index);
      img.addEventListener('error', () => { $('reader-status').textContent = 'Uma página não carregou. Tente abrir a obra na fonte pelo link abaixo.'; });
      container.append(img);
    }
    $('reader-status').textContent = '';
    $('reader-mode').textContent = cascade ? 'Modo página' : 'Modo cascata';
    $('prev-page').hidden = cascade; $('next-page').hidden = cascade; $('page-count').hidden = false;
    $('prev-page').disabled = page === 0; $('next-page').disabled = page >= pageTotal - 1;
    $('page-count').textContent = `${page + 1} / ${pageTotal}`;
  }
  function pageUrl(index) {
    if (pageInfo.source === 'mangaflix') return `${api('image')}?${new URLSearchParams({ kind: 'mf', path: pageInfo.files[index] })}`;
    const params = new URLSearchParams({ kind: 'page', base: pageInfo.baseUrl, hash: pageInfo.hash, quality: pageInfo.quality, file: pageInfo.files[index] });
    return `${api('image')}?${params}`;
  }
  function turnPage(delta) {
    if (cascade || !pageTotal) return;
    page = Math.max(0, Math.min(pageTotal - 1, page + delta));
    updateProgress(); renderPages(); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function updateCascadePosition() {
    cascadeScrollScheduled = false;
    if (!cascadeTrackingReady || !cascade || views.reader.hidden || !pageTotal) return;
    const marker = window.innerHeight * 0.35;
    let visiblePage = 0;
    for (const img of $('reader-pages').querySelectorAll('img')) {
      if (img.getBoundingClientRect().top > marker) break;
      visiblePage = Number(img.dataset.page);
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 100) visiblePage = pageTotal - 1;
    if (visiblePage !== page) {
      page = visiblePage; $('page-count').textContent = `${page + 1} / ${pageTotal}`; updateProgress();
    }
  }
  function savedEntries() {
    return Object.entries(library).filter(([id, item]) => idPattern.test(id) && item && typeof item === 'object')
      .map(([id, item]) => ({ ...item, id })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  async function resumeReading(item) {
    await openManga(item.id);
    if (currentManga?.id === item.id && item.lastChapter?.id) openChapter(item.lastChapter);
  }
  function readingCard(item) {
    const node = text('article', '', 'reading-card');
    node.append(coverElement(item));
    const info = text('div', '', 'reading-card-info');
    info.append(text('strong', item.title || 'Mangá'), text('small', `Capítulo ${item.lastChapter?.number || 'extra'} · página ${(item.page || 0) + 1}`),
      button('Continuar lendo →', '', () => resumeReading(item)));
    node.append(info); return node;
  }
  function renderSavedSections() {
    const entries = savedEntries();
    const recent = entries.filter(item => item.lastChapter?.id);
    const favorites = entries.filter(item => item.favorite);
    const quick = $('continue-results'); quick.replaceChildren();
    recent.slice(0, 4).forEach(item => quick.append(readingCard(item)));
    $('continue-section').hidden = recent.length === 0;
    libraryResults.replaceChildren();
    if (recent.length) {
      const group = text('section', '', 'library-group'); group.append(text('h3', 'Continuar lendo'));
      const grid = text('div', '', 'reading-grid'); recent.forEach(item => grid.append(readingCard(item))); group.append(grid); libraryResults.append(group);
    }
    if (favorites.length) {
      const group = text('section', '', 'library-group'); group.append(text('h3', 'Favoritos'));
      const grid = text('div', '', 'manga-grid'); favorites.forEach(item => grid.append(card(item, item.originalTitle || 'Favorito'))); group.append(grid); libraryResults.append(group);
    }
    if (!recent.length && !favorites.length) libraryResults.append(text('p', 'Sua lista está vazia. Abra um mangá e adicione aos favoritos.'));
  }
  function openLibrary() {
    renderSavedSections();
    show('library');
  }
  function exportLibrary() {
    const blob = new Blob([JSON.stringify({ version: 1, library }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'duckmangas-biblioteca.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('library-status').textContent = 'Backup da biblioteca baixado.';
  }
  async function importLibrary(file) {
    if (!file) return;
    if (file.size > 1000000) { $('library-status').textContent = 'Arquivo muito grande para importar.'; return; }
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.version !== 1 || !parsed.library || typeof parsed.library !== 'object' || Array.isArray(parsed.library)) throw new Error('Arquivo inválido.');
      const imported = {};
      for (const [id, item] of Object.entries(parsed.library).slice(0, 500)) {
        if (!idPattern.test(id) || !item || typeof item !== 'object') continue;
        const lastChapter = idPattern.test(item.lastChapter?.id || '') ? {
          id: item.lastChapter.id, number: String(item.lastChapter.number || '').slice(0, 30), title: String(item.lastChapter.title || '').slice(0, 160),
          group: String(item.lastChapter.group || '').slice(0, 120)
        } : null;
        const cover = item.cover?.id !== id ? null : /^[a-zA-Z0-9-]+\.(?:jpg|jpeg|png|webp|gif)$/.test(item.cover.file || '') ? { id, file: item.cover.file }
          : isFlix(id) && /^\/[A-Za-z0-9/_.-]{1,300}\.(?:jpg|jpeg|png|webp|gif)$/i.test(item.cover.path || '') ? { id, path: item.cover.path } : null;
        imported[id] = { id, title: String(item.title || 'Mangá').slice(0, 160), originalTitle: String(item.originalTitle || '').slice(0, 160), cover,
          favorite: !!item.favorite, lastChapter, page: Number.isInteger(item.page) && item.page >= 0 ? Math.min(item.page, 500) : 0,
          updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now() };
      }
      library = { ...library, ...imported }; saveLibrary();
      $('library-status').textContent = `${Object.keys(imported).length} mangá(s) restaurado(s).`;
    } catch { $('library-status').textContent = 'Não foi possível importar este backup.'; }
  }
  $('search-form').addEventListener('submit', event => { event.preventDefault(); query = $('search-input').value.trim(); searchMangas(); });
  $('manga-source').addEventListener('change', () => { source = $('manga-source').value; searchMangas(); });
  $('more-results').addEventListener('click', () => searchMangas(true));
  $('more-chapters').addEventListener('click', loadChapters);
  $('chapter-language').addEventListener('change', () => { chapterOffset = 0; chapterTotal = 0; chapterHidden = 0; chapters.replaceChildren(); loadChapters(); });
  $('back-to-catalog').addEventListener('click', () => show('catalog'));
  $('back-to-detail').addEventListener('click', () => show('detail'));
  $('back-from-library').addEventListener('click', () => show('catalog'));
  $('library-nav').addEventListener('click', openLibrary);
  $('library-export').addEventListener('click', exportLibrary);
  $('library-import').addEventListener('change', event => { importLibrary(event.target.files?.[0]); event.target.value = ''; });
  $('reader-mode').addEventListener('click', () => { cascade = !cascade; cascadeTrackingReady = false; renderPages(); });
  $('prev-page').addEventListener('click', () => turnPage(-1));
  $('next-page').addEventListener('click', () => turnPage(1));
  document.addEventListener('keydown', event => { if (views.reader.hidden || cascade || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return; if (event.key === 'ArrowRight') turnPage(1); if (event.key === 'ArrowLeft') turnPage(-1); });
  window.addEventListener('wheel', () => { if (cascade && !views.reader.hidden) cascadeTrackingReady = true; }, { passive: true });
  window.addEventListener('touchmove', () => { if (cascade && !views.reader.hidden) cascadeTrackingReady = true; }, { passive: true });
  document.addEventListener('keydown', event => { if (cascade && ['ArrowDown', 'PageDown', 'PageUp', ' ', 'End', 'Home'].includes(event.key)) cascadeTrackingReady = true; });
  window.addEventListener('scroll', () => { if (cascade && !cascadeScrollScheduled) { cascadeScrollScheduled = true; requestAnimationFrame(updateCascadePosition); } }, { passive: true });
  renderSavedSections();
  searchMangas();
})();
