const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Pluto TV and Desenhos are cleanly retired from DUCKTV page as requested', () => {
  const tvHtml = fs.readFileSync(path.join(__dirname, '../tv.html'), 'utf8');
  assert.equal(tvHtml.includes('pluto-section'), false, 'A seção Pluto TV deve ser removida de tv.html');
  assert.equal(tvHtml.includes('pluto.js'), false, 'O script pluto.js deve ser removido de tv.html');
  assert.equal(tvHtml.includes('animation-section'), false, 'A seção DuckTv Desenhos deve ser removida de tv.html');
  assert.match(tvHtml, /Mamute/, 'O rodapé deve conter a assinatura do Mamute');
  assert.match(tvHtml, /2\.5/, 'A versão deve ser 2.5');
});
