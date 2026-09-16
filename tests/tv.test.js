const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePlaylist, normalize } = require('../tv.js');

test('reads BOM, CRLF, quoted commas, categories and stream directives', () => {
  const result = parsePlaylist('\uFEFF#EXTM3U\r\n#EXTINF:-1 tvg-id="a" tvg-logo="https://example.com/a,b.png" group-title="News;General",Notícias, Brasil\r\n#EXTVLCOPT:http-referrer=https://example.com\r\nhttps://example.com/live.m3u8?token=a,b\r\n');
  assert.equal(result.channels.length, 1);
  assert.equal(result.channels[0].name, 'Notícias, Brasil');
  assert.deepEqual(result.channels[0].categories, ['News', 'General']);
  assert.equal(result.channels[0].search, 'noticias, brasil');
  assert.equal(result.channels[0].url, 'https://example.com/live.m3u8?token=a,b');
});

test('rejects unsafe protocols and credentials, deduplicates stream URLs', () => {
  const urls = ['http://example.com/live', 'javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com/live', 'not-a-url', 'https://example.com/live', 'https://example.com/live'];
  const result = parsePlaylist('#EXTM3U\n' + urls.map(url => `#EXTINF:-1,Canal\n${url}`).join('\n'));
  assert.equal(result.channels.length, 1);
  assert.equal(result.skipped, 5);
});

test('does not reuse metadata for orphan or malformed entries', () => {
  const result = parsePlaylist('#EXTM3U\nhttps://example.com/orphan\n#EXTINF:-1,Valid\n#EXTINF:-1 malformed\nhttps://example.com/wrong\n#EXTINF:-1,Final\nhttps://example.com/final');
  assert.equal(result.channels.length, 1);
  assert.equal(result.channels[0].name, 'Final');
  assert.deepEqual(result.channels[0].categories, ['Undefined']);
});

test('rejects non-playlist responses and supports accent-insensitive search', () => {
  assert.throws(() => parsePlaylist('<html>Service unavailable</html>'), /Invalid M3U/);
  assert.equal(normalize('São Paulo — NOTÍCIAS'), 'sao paulo — noticias');
});

test('preserves untrusted names as plain text', () => {
  const result = parsePlaylist('#EXTM3U\n#EXTINF:-1,<img src=x onerror=alert(1)>\nhttps://example.com/live');
  assert.equal(result.channels[0].name, '<img src=x onerror=alert(1)>');
});
