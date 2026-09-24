(() => {
  const sites = ['https://duckflix42.netlify.app', 'http://localhost:3000'];
  function allowedSender(sender) {
    try { return sender.frameId === 0 && sites.includes(new URL(sender.url).origin); } catch { return false; }
  }
  function target(value) {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || value.length > 8192) throw new Error('Endereço não permitido.');
    if (!host.includes('.') || host.endsWith('.') || /(?:^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host) || host.includes(':') || host.endsWith('.localhost')) throw new Error('Endereços locais não são permitidos.');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a,b] = host.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18,19].includes(b))) throw new Error('Rede privada não permitida.');
    }
    if (url.port && !['80', '443', '8080'].includes(url.port)) throw new Error('Porta não permitida.');
    return { url: url.href, origin: `${url.protocol}//${host}/*` };
  }
  const api = { allowedSender, target };
  if (typeof module !== 'undefined') module.exports = api; else globalThis.DuckPolicy = api;
})();
