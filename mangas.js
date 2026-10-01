(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const views = { catalog: $('catalog-view'), detail: $('detail-view'), reader: $('reader-view'), library: $('library-view') };
  const results = $('manga-results'), chapters = $('chapter-list'), libraryResults = $('library-results');
  const storageKey = 'duckmangas-library-v1';
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const preview = local && location.port !== '3000';
  const api = kind => preview ? `http://${location.hostname}:3000/api/manga/${kind}` : local ? `/api/manga/${kind}` : `/.netlify/functions/manga-${kind}`;
  let query = '', searchOffset = 0, searchTotal = 0, chapterOffset = 0, chapterTotal = 0;
  let currentManga = null, currentChapter = null, page = 0, pageTotal = 0, pageInfo = null, cascade = false, requestNumber = 0;
  let library = readLibrary();

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }
  function saveLibrary() {
    try { localStorage.setItem(storageKey, JSON.stringify(library)); }
    catch { $('catalog-status').textContent = 'Não foi possível salvar sua leitura neste navegador.'; }
  }
  function show(view) {
    Object.entries(views).forEach(([name, element]) => { element.hidden = name !== view; });
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
    img.src = `${api('image')}?kind=cover&id=${encodeURIComponent(manga.cover.id)}&file=${encodeURIComponent(manga.cover.file)}`;
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
    if (!more) { searchOffset = 0; results.replaceChildren(); $('results-title').textContent = query ? `Resultados para “${query}”` : 'Mangás populares'; }
    $('catalog-status').textContent = 'Buscando mangás…'; $('more-results').hidden = true;
    try {
      const data = await get('search', { q: query, offset: searchOffset });
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
      library[manga.id] = { ...library[manga.id], title: manga.title, cover: manga.cover, originalTitle: manga.originalTitle, favorite: !wasFavorite };
      if (!library[manga.id].favorite && !library[manga.id].lastChapter) delete library[manga.id];
      saveLibrary(); favorite.textContent = !wasFavorite ? '★ Nos favoritos' : '☆ Adicionar aos favoritos';
    });
    actions.append(favorite);
    const saved = library[manga.id];
    if (saved?.lastChapter) actions.append(button('Continuar leitura', 'primary-button', () => openChapter(saved.lastChapter)));
    info.append(actions);
    const description = text('p', manga.description || 'Sinopse não disponível.', 'detail-description');
    const source = text('a', 'Ver obra no MangaDex ↗', 'source-link');
    source.href = manga.url; source.target = '_blank'; source.rel = 'noopener noreferrer';
    hero.append(info, description, source);
    $('manga-detail').replaceChildren(hero);
  }
  async function openManga(id) {
    show('detail'); chapters.replaceChildren(); $('chapter-status').textContent = 'Carregando capítulos…';
    $('more-chapters').hidden = true; currentManga = null;
    try {
      const manga = await get('detail', { id });
      currentManga = manga; renderDetail(manga);
      chapterOffset = 0; await loadChapters();
    } catch (cause) { $('chapter-status').textContent = cause.message; }
  }
  async function loadChapters() {
    if (!currentManga) return;
    const mangaId = currentManga.id;
    $('chapter-status').textContent = 'Carregando capítulos…'; $('more-chapters').hidden = true;
    try {
      const data = await get('chapters', { id: mangaId, offset: chapterOffset });
      if (currentManga?.id !== mangaId) return;
      chapterTotal = data.total; chapterOffset += 100;
      for (const item of data.items) {
        const label = `Capítulo ${item.number || 'extra'}${item.title ? ` · ${item.title}` : ''}`;
        const node = button('', 'chapter-item', () => openChapter(item));
        const left = document.createElement('span'); left.append(text('strong', label), text('small', `${item.group} · ${item.pages} páginas`));
        node.append(left);
        if (library[mangaId]?.lastChapter?.id === item.id) node.append(text('em', 'Continuar'));
        chapters.append(node);
      }
      $('chapter-count').textContent = `${chapterTotal.toLocaleString('pt-BR')} capítulos`;
      $('chapter-status').textContent = chapters.childElementCount ? '' : 'Nenhum capítulo em português disponível para leitura aqui.';
      $('more-chapters').hidden = chapterOffset >= chapterTotal;
    } catch (cause) { $('chapter-status').textContent = cause.message; }
  }
  function updateProgress() {
    if (!currentManga || !currentChapter) return;
    library[currentManga.id] = { ...library[currentManga.id], title: currentManga.title, cover: currentManga.cover, originalTitle: currentManga.originalTitle,
      lastChapter: currentChapter, page, updatedAt: Date.now() };
    saveLibrary();
  }
  async function openChapter(chapter) {
    if (!currentManga || !chapter?.id) return;
    currentChapter = chapter; show('reader');
    $('reader-title').textContent = `${currentManga.title} · Capítulo ${chapter.number || 'extra'}`;
    $('reader-credit').textContent = `Tradução: ${chapter.group || 'Grupo não informado'}`;
    $('chapter-source').href = `https://mangadex.org/chapter/${chapter.id}`;
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
      img.alt = `Página ${index + 1} de ${pageTotal}`;
      img.loading = cascade && index > 1 ? 'lazy' : 'eager';
      img.src = pageUrl(index);
      img.addEventListener('error', () => { $('reader-status').textContent = 'Uma página não carregou. Tente abrir o capítulo no MangaDex pelo link abaixo.'; });
      container.append(img);
    }
    $('reader-status').textContent = '';
    $('reader-mode').textContent = cascade ? 'Modo página' : 'Modo cascata';
    $('prev-page').hidden = cascade; $('next-page').hidden = cascade; $('page-count').hidden = cascade;
    $('prev-page').disabled = page === 0; $('next-page').disabled = page >= pageTotal - 1;
    $('page-count').textContent = `${page + 1} / ${pageTotal}`;
  }
  function pageUrl(index) {
    const params = new URLSearchParams({ kind: 'page', base: pageInfo.baseUrl, hash: pageInfo.hash, quality: pageInfo.quality, file: pageInfo.files[index] });
    return `${api('image')}?${params}`;
  }
  function turnPage(delta) {
    if (cascade || !pageTotal) return;
    page = Math.max(0, Math.min(pageTotal - 1, page + delta));
    updateProgress(); renderPages(); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function openLibrary() {
    libraryResults.replaceChildren();
    const items = Object.values(library).filter(item => item.favorite || item.lastChapter).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    for (const item of items) {
      const manga = { id: item.cover?.id || Object.keys(library).find(key => library[key] === item), title: item.title || 'Mangá', cover: item.cover, originalTitle: item.originalTitle };
      libraryResults.append(card(manga, item.lastChapter ? `Capítulo ${item.lastChapter.number || 'extra'}` : 'Favorito'));
    }
    if (!items.length) libraryResults.append(text('p', 'Sua lista está vazia. Abra um mangá e adicione aos favoritos.'));
    show('library');
  }
  $('search-form').addEventListener('submit', event => { event.preventDefault(); query = $('search-input').value.trim(); searchMangas(); });
  $('more-results').addEventListener('click', () => searchMangas(true));
  $('more-chapters').addEventListener('click', loadChapters);
  $('back-to-catalog').addEventListener('click', () => show('catalog'));
  $('back-to-detail').addEventListener('click', () => show('detail'));
  $('back-from-library').addEventListener('click', () => show('catalog'));
  $('library-nav').addEventListener('click', openLibrary);
  $('reader-mode').addEventListener('click', () => { cascade = !cascade; renderPages(); });
  $('prev-page').addEventListener('click', () => turnPage(-1));
  $('next-page').addEventListener('click', () => turnPage(1));
  document.addEventListener('keydown', event => { if (views.reader.hidden || cascade || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return; if (event.key === 'ArrowRight') turnPage(1); if (event.key === 'ArrowLeft') turnPage(-1); });
  searchMangas();
})();
