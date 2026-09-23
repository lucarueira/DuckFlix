const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseHTML } = require('linkedom');
test('landing has exactly three working destinations and loads no catalog or player scripts', () => {
  const { document } = parseHTML(fs.readFileSync('index.html', 'utf8'));
  const links = [...document.querySelectorAll('.destinations a')];
  assert.deepEqual(links.map(link => link.getAttribute('href')), ['duckflix.html', 'tv.html', 'extensoes.html']);
  assert.equal(document.querySelectorAll('script').length, 0);
  for (const link of links) {
    const { document: page } = parseHTML(fs.readFileSync(link.getAttribute('href'), 'utf8'));
    assert.equal(page.querySelector('.brand').getAttribute('href'), 'index.html');
    assert.equal(page.querySelector('.main-nav a').getAttribute('href'), 'duckflix.html');
    for (const asset of page.querySelectorAll('script[src], link[rel="stylesheet"]')) {
      const src = asset.getAttribute('src') || asset.getAttribute('href');
      if (!src.startsWith('https://')) assert.equal(fs.existsSync(src), true, `${src} exists`);
    }
  }
});
