importScripts('policy.js');
const running = new Map();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!DuckPolicy.allowedSender(sender)) return false;
  const key = `${sender.tab.id}:${sender.documentId}:${message?.id}`;
  if (message?.type === 'ping') { respond({ ok: true, version: chrome.runtime.getManifest().version }); return false; }
  if (message?.type === 'cancel') { running.get(key)?.abort(); respond({ ok: true }); return false; }
  if (message?.type !== 'fetch' || typeof message.id !== 'string' || message.id.length > 100) return false;
  (async () => {
    const controller = new AbortController();
    let timer;
    try {
      if (running.size >= 12 || running.has(key)) throw new Error('Muitas requisições simultâneas.');
      running.set(key, controller);
      const { url, origin } = DuckPolicy.target(message.url);
      if (!await chrome.permissions.contains({ origins: [origin] })) {
        await chrome.storage.session.set({ [origin]: true });
        await chrome.action.setBadgeText({ text: '!' });
        respond({ ok: false, error: 'Abra a extensão DuckFlix e autorize o servidor. Depois recarregue a página.', permission: origin }); return;
      }
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      timer = setTimeout(() => controller.abort(), 20000);
      const headers = {};
      if (message.range) {
        if (!/^bytes=\d+-\d*$/.test(message.range)) throw new Error('Intervalo inválido.');
        headers.Range = message.range;
      }
      const response = await fetch(url, { headers, signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' });
      if (!response.ok) throw new Error(`Fonte respondeu HTTP ${response.status}.`);
      if (message.range && response.status !== 206) throw new Error('A fonte não respeita pedidos parciais de vídeo.');
      const reader = response.body.getReader();
      const chunks = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 24 * 1024 * 1024) { await reader.cancel(); throw new Error('Segmento excede 24 MB. MP4 completo não é suportado nesta versão.'); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let binary = '';
      for (let i = 0; i < size; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      respond({ ok: true, data: btoa(binary), url, status: response.status });
    } catch (error) { respond({ ok: false, error: error.name === 'AbortError' ? 'Requisição cancelada ou sem resposta.' : error.message }); }
    finally { clearTimeout(timer); if (running.get(key) === controller) running.delete(key); }
  })();
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => {
  for (const [key, controller] of running) if (key.startsWith(`${tabId}:`)) controller.abort();
});
