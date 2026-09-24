window.addEventListener('message', async event => {
  if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'duckflix-http-request') return;
  const { id, type, url, range } = event.data;
  if (!['ping', 'fetch', 'cancel'].includes(type) || typeof id !== 'string') return;
  try {
    const result = await chrome.runtime.sendMessage({ id, type, url, range });
    window.postMessage({ channel: 'duckflix-http-response', id, ...result }, location.origin);
  } catch {
    window.postMessage({ channel: 'duckflix-http-response', id, ok: false, error: 'Extensão desconectada. Recarregue a página.' }, location.origin);
  }
});
