const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseHTML } = require('linkedom');
test('landing links to each viewing mode with Together hidden and loads no player scripts', () => {
  const { document } = parseHTML(fs.readFileSync('index.html', 'utf8'));
  const links = [...document.querySelectorAll('.destinations a')];
  assert.deepEqual(links.map(link => link.getAttribute('href')), ['duckflix.html', 'tv.html', 'extensoes.html']);
  assert.equal(document.querySelectorAll('script').length, 0);
  for (const link of links) {
    const { document: page } = parseHTML(fs.readFileSync(link.getAttribute('href'), 'utf8'));
    assert.equal(page.querySelector('.brand').getAttribute('href'), 'index.html');
    assert.equal(page.querySelector('.main-nav a').getAttribute('href'), 'duckflix.html');
    assert.equal(page.querySelector('a[href="together.html"]'), null);
    for (const asset of page.querySelectorAll('script[src], link[rel="stylesheet"]')) {
      const src = asset.getAttribute('src') || asset.getAttribute('href');
      if (!src.startsWith('https://')) assert.equal(fs.existsSync(src), true, `${src} exists`);
    }
  }
});
