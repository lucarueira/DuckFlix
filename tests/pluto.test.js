const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

function setup() {
  const { window, document } = parseHTML(fs.readFileSync(path.join(__dirname, '../tv.html'), 'utf8'));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pluto.js'), 'utf8'), { window, document });
  return { window, document, button: document.getElementById('pluto-embed'), close: document.getElementById('pluto-close'), viewer: document.getElementById('pluto-viewer') };
}

test('Pluto only loads on request and preserves the official external fallback', () => {
  const { document, button, viewer } = setup();
  assert.equal(viewer.children.length, 0);
  assert.equal(button.hidden, false);
  const link = document.querySelector('.pluto-open');
  assert.equal(link.getAttribute('href'), 'https://pluto.tv/br/home/');
  assert.equal(link.getAttribute('target'), '_blank');
  button.click();
  button.click();
  assert.equal(viewer.children.length, 1);
  assert.equal(viewer.firstElementChild.src, link.getAttribute('href'));
  assert.equal(viewer.hidden, false);
  assert.equal(link.isConnected, true);
  assert.match(document.getElementById('pluto-status').textContent, /Se o vídeo não aparecer/);
});

test('Closing or leaving removes the Pluto frame and allows a fresh session', () => {
  const { window, button, close, viewer } = setup();
  button.click();
  const firstFrame = viewer.firstElementChild;
  close.click();
  assert.equal(firstFrame.isConnected, false);
  assert.equal(viewer.hidden, true);
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  button.click();
  assert.notEqual(viewer.firstElementChild, firstFrame);
  window.dispatchEvent(new window.Event('pagehide'));
  assert.equal(viewer.children.length, 0);
});
