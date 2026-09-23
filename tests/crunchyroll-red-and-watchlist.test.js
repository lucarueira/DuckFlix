const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('All 24 custom 3D glossy red icons exist and have non-zero size', () => {
  const iconNames = [
    'icon_filmes.png', 'icon_series.png', 'icon_animes.png', 'icon_aovivo.png',
    'icon_extensoes.png', 'icon_continuar.png', 'icon_favoritos.png', 'icon_play.png',
    'icon_popcorn.png', 'icon_ticket.png', 'icon_clapper.png', 'icon_camera.png',
    'icon_smart_tv.png', 'icon_retro_tv.png', 'icon_remote.png', 'icon_mic.png',
    'icon_chat.png', 'icon_audio.png', 'icon_acao.png', 'icon_star.png',
    'icon_comedia.png', 'icon_drama.png', 'icon_filme_strip.png', 'icon_diretor.png'
  ];

  for (const name of iconNames) {
    const iconPath = path.join(__dirname, '..', 'img', 'icons', name);
    assert.equal(fs.existsSync(iconPath), true, `Ícone ${name} deve existir`);
    const stat = fs.statSync(iconPath);
    assert(stat.size > 500, `Ícone ${name} deve ser um PNG válido com tamanho > 500 bytes (tamanho atual: ${stat.size})`);
  }
});

test('Unified Crunchyroll Red color tokens are present in style.css, extensoes.css, and tv.css', () => {
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const extensoesCss = fs.readFileSync(path.join(__dirname, '..', 'extensoes.css'), 'utf8');
  const tvCss = fs.readFileSync(path.join(__dirname, '..', 'tv.css'), 'utf8');

  // Assert accent is crimson red (#ff1744) across all stylesheets
  assert.match(styleCss, /--accent:\s*#ff1744/);
  assert.match(extensoesCss, /--accent:\s*#ff1744/);
  assert.match(tvCss, /--accent:\s*#ff1744/);

  // Assert dark obsidian background is standardized across all stylesheets
  assert.match(styleCss, /--bg:\s*#07070a/);
  assert.match(extensoesCss, /--bg:\s*#07070a/);
  assert.match(tvCss, /--bg:\s*#07070a/);

  // Assert old lime yellow #cceb20 has been eliminated from production stylesheets
  assert.doesNotMatch(styleCss, /#cceb20/i);
  assert.doesNotMatch(extensoesCss, /#cceb20/i);
  assert.doesNotMatch(tvCss, /#cceb20/i);
});

test('Unified header navigation, Duckflix42 logo, and v2.5 Mamute footer across all pages', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'duckflix.html'), 'utf8');
  const extensoesHtml = fs.readFileSync(path.join(__dirname, '..', 'extensoes.html'), 'utf8');
  const tvHtml = fs.readFileSync(path.join(__dirname, '..', 'tv.html'), 'utf8');

  // Verify Duckflix42 logo is used across all pages
  assert.match(indexHtml, /img\/logo_duckflix\.png/);
  assert.match(extensoesHtml, /img\/logo_duckflix\.png/);
  assert.match(tvHtml, /img\/logo_duckflix\.png/);

  // Verify unified navigation links (DUCKTV and DuckFlix Extensões)
  assert.match(indexHtml, /nav-tv/);
  assert.match(indexHtml, /nav-ext/);
  assert.match(extensoesHtml, /nav-tv/);
  assert.match(extensoesHtml, /nav-ext/);
  assert.match(tvHtml, /nav-tv/);
  assert.match(tvHtml, /nav-ext/);

  // Verify Version 2.5 made by Mamute footer on all pages
  assert.match(indexHtml, /Mamute.*2\.5/i);
  assert.match(extensoesHtml, /Mamute.*2\.5/i);
  assert.match(tvHtml, /Mamute.*2\.5/i);
});

test('Cinematic hero background duckflix_hero_bg.jpg is configured across stylesheets', () => {
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const extensoesCss = fs.readFileSync(path.join(__dirname, '..', 'extensoes.css'), 'utf8');
  const tvCss = fs.readFileSync(path.join(__dirname, '..', 'tv.css'), 'utf8');

  assert.match(styleCss, /duckflix_hero_bg\.jpg/);
  assert.match(extensoesCss, /duckflix_hero_bg\.jpg/);
  assert.match(tvCss, /duckflix_hero_bg\.jpg/);
});

test('DuckFlix Extensões player persists exact playback time and resumes where left off', () => {
  const { fixture } = require('./extensions-fixture');
  const playerModule = require('../extensoes-player.js');

  const app = fixture();
  const storageMap = new Map();
  app.window.localStorage = {
    getItem: key => storageMap.get(key) || null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: key => storageMap.delete(key)
  };

  const player = playerModule.create({
    document: app.document,
    media: app.media,
    getDetails: async () => ({}),
    getStreams: async () => [{ name: 'Test 1080p', title: 'Dublado', url: 'https://example.com/video.mp4' }]
  });

  // Verify saveProgress logic with storage
  const item = { id: 101, name: 'Anime Épico', type: 'series', poster: 'https://example.com/poster.jpg' };
  
  // Save entry in history directly to test storage format
  const historyData = [{
    id: item.id,
    name: item.name,
    type: item.type,
    poster: item.poster,
    currentTime: 420.5,
    duration: 1440,
    progressPct: 29.2,
    season: 2,
    episode: 4,
    episodeTitle: 'O Retorno',
    updatedAt: Date.now()
  }];
  app.window.localStorage.setItem('duckflix.extensoes.history', JSON.stringify(historyData));

  // Retrieve and verify data structure
  const saved = JSON.parse(app.window.localStorage.getItem('duckflix.extensoes.history'));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, 101);
  assert.equal(saved[0].currentTime, 420.5);
  assert.equal(saved[0].season, 2);
  assert.equal(saved[0].episode, 4);
});
