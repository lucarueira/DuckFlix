const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Index page categories strictly limited to Filmes, Séries, and Animes', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  // Verify sec-filmes, sec-series, and sec-animes exist
  assert.match(indexHtml, /id="sec-filmes"/);
  assert.match(indexHtml, /id="sec-series"/);
  assert.match(indexHtml, /id="sec-animes"/);

  // Verify sec-desenhos and sec-animacoes-adultas are completely removed
  assert.doesNotMatch(indexHtml, /id="sec-desenhos"/);
  assert.doesNotMatch(indexHtml, /id="sec-animacoes-adultas"/);
  assert.doesNotMatch(indexHtml, /Desenhos Infantis/);
  assert.doesNotMatch(indexHtml, /Animações Adultas/);
});

test('Duplicate Surpreenda-me pseudo-element is removed from style.css', () => {
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.doesNotMatch(styleCss, /#btnRoleta::after\s*\{[^}]*content:\s*"Surpreenda-me"/);
});

test('Minha Lista / Favoritos removed from top header navigation on all pages', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const tvHtml = fs.readFileSync(path.join(__dirname, '..', 'tv.html'), 'utf8');
  const extensoesHtml = fs.readFileSync(path.join(__dirname, '..', 'extensoes.html'), 'utf8');

  // In headers, only Início, DUCKTV, DuckFlix Extensões exist
  const checkHeaderNoList = (html, page) => {
    const headerMatch = html.match(/<header class="header">([\s\S]*?)<\/header>/);
    assert(headerMatch, `Header exists in ${page}`);
    const headerContent = headerMatch[1];
    assert.doesNotMatch(headerContent, /nav-watchlist/i, `No watchlist button in ${page} header`);
    assert.doesNotMatch(headerContent, />Minha Lista</i, `No Minha Lista in ${page} header`);
    assert.doesNotMatch(headerContent, />Favoritos</i, `No Favoritos in ${page} header`);
  };

  checkHeaderNoList(indexHtml, 'index.html');
  checkHeaderNoList(tvHtml, 'tv.html');
  checkHeaderNoList(extensoesHtml, 'extensoes.html');
});

test('DuckFlix Extensões layout is full-width (100% width, edge-to-edge catalog)', () => {
  const extensoesCss = fs.readFileSync(path.join(__dirname, '..', 'extensoes.css'), 'utf8');

  // Main is full width
  assert.match(extensoesCss, /main\s*\{[^}]*width:\s*100%/);
  assert.match(extensoesCss, /main\s*\{[^}]*max-width:\s*100%/);

  // Catalog grid uses auto-fill
  assert.match(extensoesCss, /\.catalog-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill/);
});

test('Navigation buttons have uniform dimensions and styling across all stylesheets', () => {
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const extensoesCss = fs.readFileSync(path.join(__dirname, '..', 'extensoes.css'), 'utf8');
  const tvCss = fs.readFileSync(path.join(__dirname, '..', 'tv.css'), 'utf8');

  for (const [name, css] of [['style.css', styleCss], ['extensoes.css', extensoesCss], ['tv.css', tvCss]]) {
    // Check nav-item min-height and padding
    assert.match(css, /\.nav-item[^}]*min-height:\s*44px/, `min-height in ${name}`);
    assert.match(css, /\.nav-item[^}]*padding:\s*10px 22px/, `padding in ${name}`);
    // Check large logo dimensions
    assert.match(css, /\.brand img[^}]*height:\s*82px/, `logo height in ${name}`);
  }
});

test('Footer is 100% unified in background, padding, and alignment across all pages', () => {
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const extensoesCss = fs.readFileSync(path.join(__dirname, '..', 'extensoes.css'), 'utf8');
  const tvCss = fs.readFileSync(path.join(__dirname, '..', 'tv.css'), 'utf8');

  for (const [name, css] of [['style.css', styleCss], ['extensoes.css', extensoesCss], ['tv.css', tvCss]]) {
    assert.match(css, /\.footer,\s*footer[^}]*background:\s*#090a0e/, `footer background in ${name}`);
    assert.match(css, /\.footer,\s*footer[^}]*text-align:\s*center/, `footer text-align in ${name}`);
    assert.match(css, /\.footer,\s*footer[^}]*padding:\s*36px 24px/, `footer padding in ${name}`);
  }
});

test('Minha Lista tab exists on both Início and Extensões with heart favorite icons', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const extensoesHtml = fs.readFileSync(path.join(__dirname, '..', 'extensoes.html'), 'utf8');
  const scriptJs = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
  const extensoesAppJs = fs.readFileSync(path.join(__dirname, '..', 'extensoes-app.js'), 'utf8');

  // Minha Lista in category tabs
  assert.match(indexHtml, /<button class="tab-btn"[^>]*>Minha Lista<\/button>/);
  assert.match(extensoesHtml, /<button type="button" data-category="watchlist"[^>]*>Minha Lista<\/button>/);

  // Heart icons used in both scripts
  assert.match(scriptJs, /♥/);
  assert.match(scriptJs, /♡/);
  assert.match(extensoesAppJs, /♥/);
  assert.match(extensoesAppJs, /♡/);
});

test('42 titles configured for exploration on both Início and Extensões', () => {
  const scriptJs = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
  const extensoesAppJs = fs.readFileSync(path.join(__dirname, '..', 'extensoes-app.js'), 'utf8');

  // Início has 42 titles logic
  assert.match(scriptJs, /buscar42Titulos/);
  assert.match(scriptJs, /lista42\.length === 42/);

  // Extensões has 42 target count
  assert.match(extensoesAppJs, /targetCount = \(!more && !query\) \? 42/);
  assert.match(extensoesAppJs, /items\.length === 42/);
});

test('Continuar Assistindo has matching aesthetics (subtitle RECOLHA DE ONDE PAROU) across both pages', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const extensoesHtml = fs.readFileSync(path.join(__dirname, '..', 'extensoes.html'), 'utf8');
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const extensoesCss = fs.readFileSync(path.join(__dirname, '..', 'extensoes.css'), 'utf8');

  assert.match(indexHtml, /RECOLHA DE ONDE PAROU/);
  assert.match(extensoesHtml, /RECOLHA DE ONDE PAROU/);

  assert.match(styleCss, /#historicoSection[^}]*border-radius:\s*18px/);
  assert.match(extensoesCss, /\.continuar-section[^}]*border-radius:\s*18px/);
});

test('MODO LIVRE button exists and is styled on both Início and Extensões', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const extensoesHtml = fs.readFileSync(path.join(__dirname, '..', 'extensoes.html'), 'utf8');
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const extensoesCss = fs.readFileSync(path.join(__dirname, '..', 'extensoes.css'), 'utf8');

  assert.match(indexHtml, /id="btnModoLivre"\s+class="btn-modo-livre"/);
  assert.match(extensoesHtml, /id="btnModoLivre"\s+class="btn-modo-livre"/);

  assert.match(styleCss, /\.btn-modo-livre\.ativo/);
  assert.match(extensoesCss, /\.btn-modo-livre\.ativo/);
});

test('Search bar is centered properly on both Início and Extensões', () => {
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const extensoesCss = fs.readFileSync(path.join(__dirname, '..', 'extensoes.css'), 'utf8');

  assert.match(styleCss, /\.busca-wrap\s*\{[^}]*margin:\s*16px auto/);
  assert.match(extensoesCss, /#search-form\s*\{[^}]*margin:\s*18px auto/);
});

test('Watch dialog in Extensões has expansive Prime Video dimensions', () => {
  const extensoesCss = fs.readFileSync(path.join(__dirname, '..', 'extensoes.css'), 'utf8');

  assert.match(extensoesCss, /dialog\s*\{[^}]*width:\s*min\(1780px,\s*calc\(100vw - 16px\)\)/);
  assert.match(extensoesCss, /dialog\s*\{[^}]*height:\s*97vh/);
  assert.match(extensoesCss, /\.player-shell\s*\{[^}]*height:\s*min\(72vh,\s*800px\)/);
});

test('Início displays 42 titles in catalog-grid with Extensões poster-card aesthetics and ▶ ASSISTIR overlay', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const scriptJs = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

  // Início categories use catalog-grid
  assert.match(indexHtml, /<div class="catalog-grid" id="filmes"><\/div>/);
  assert.match(indexHtml, /<div class="catalog-grid" id="series"><\/div>/);
  assert.match(indexHtml, /<div class="catalog-grid" id="animes"><\/div>/);

  // Style CSS has poster-card with ▶ ASSISTIR
  assert.match(styleCss, /\.poster::after\s*\{[^}]*content:\s*'▶ ASSISTIR'/);
  assert.match(styleCss, /\.catalog-grid\s*\{[^}]*display:\s*grid/);

  // script.js builds poster-card with poster, strong, small
  assert.match(scriptJs, /card\.className = "poster-card card"/);
  assert.match(scriptJs, /<span class="poster">/);
});


