/* Site-side HLS loader; extension permissions remain controlled by the user. */
(() => {
  let connected = false, lastError = '';
  const pending = new Map();
  function request(type, payload = {}, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
      const id = crypto.randomUUID();
      const abort = () => {
        window.postMessage({ channel: 'duckflix-http-request', id, type: 'cancel' }, location.origin);
        finish(new DOMException('Aborted', 'AbortError'));
      };
      const finish = (error, result) => { clearTimeout(timer); pending.delete(id); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(result); };
      const timer = setTimeout(() => { abort(); }, type === 'ping' ? 1500 : 25000);
      pending.set(id, finish); signal?.addEventListener('abort', abort, { once: true });
      window.postMessage({ channel: 'duckflix-http-request', id, type, ...payload }, location.origin);
    });
  }
  function setStatus(text) { document.querySelectorAll('[data-extension-status]').forEach(node => { node.textContent = text; if (connected) node.hidden = false; }); }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'duckflix-http-response') return;
    const result = event.data;
    const finish = pending.get(result.id); if (!finish) return;
    if (result.permission) setStatus('Abra a extensão DuckFlix, autorize o servidor e recarregue esta página.');
    const message = result.permission ? `Autorize ${result.permission} no ícone da extensão DuckFlix e tente novamente.` : result.error || 'Extensão indisponível.';
    finish(result.ok ? null : new Error(message), result);
  });
  function loader(Hls) {
    const Default = Hls.DefaultConfig.loader;
    return class ExtensionLoader {
      constructor(config) {
        this.fallback = new Default(config);
        this.stats = this.fallback.stats;
        this.context = null; this.controller = null;
      }
      load(context, config, callbacks) {
        this.context = context;
        // All resources in an HTTP HLS session use the bridge, including HTTPS keys/segments.
        this.controller = new AbortController();
        const controller = this.controller;
        const start = performance.now();
        this.stats = { aborted: false, loaded: 0, total: 0, retry: 0, chunkCount: 0, bwEstimate: 0, loading: { start, first: 0, end: 0 }, parsing: { start: 0, end: 0 }, buffering: { start: 0, first: 0, end: 0 } };
        const rangeStart = context.rangeStart || 0;
        // hls.js uses start=0/end=0 for a complete segment, not a byte range.
        const range = Number.isSafeInteger(rangeStart) && rangeStart >= 0 && Number.isSafeInteger(context.rangeEnd) && context.rangeEnd > rangeStart
          ? `bytes=${rangeStart}-${context.rangeEnd - 1}` : undefined;
        request('fetch', { url: context.url, range }, this.controller.signal).then(result => {
          if (this.controller !== controller || this.stats.aborted) return;
          const bytes = Uint8Array.from(atob(result.data), character => character.charCodeAt(0));
          this.stats.loaded = this.stats.total = bytes.length;
          this.stats.loading.first = this.stats.loading.end = performance.now();
          const data = context.responseType === 'arraybuffer' ? bytes.buffer : new TextDecoder().decode(bytes);
          callbacks.onSuccess({ url: result.url, data, code: result.status }, this.stats, context, null);
        }).catch(error => {
          if (this.controller === controller && !this.stats.aborted) {
            lastError = error.message;
            callbacks.onError({ code: 0, text: error.message }, context, null, this.stats);
          }
        });
      }
      abort() { this.stats.aborted = true; this.controller?.abort(); }
      destroy() { this.abort(); this.fallback.destroy(); }
      getCacheAge() { return null; }
      getResponseHeader() { return null; }
    };
  }
  async function fetchJSON(url, { signal } = {}) {
    const result = await request('fetch', { url }, signal);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const bytes = Uint8Array.from(atob(result.data), character => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch { throw new Error('O addon retornou uma resposta inválida em vez do catálogo. Tente novamente mais tarde.'); }
  }
  const api = { get connected() { return connected; }, get lastError() { return lastError; }, clearError() { lastError = ''; }, request, loader, fetchJSON,
    hlsConfig(url, Hls) { return connected && /^http:\/\//i.test(url) ? { loader: loader(Hls) } : {}; }
  };
  window.DuckFlixExtension = api;
  async function detect() {
    try {
      const result = await request('ping'); connected = true;
      setStatus(`Extensão conectada · ${result.version} · HTTP HLS disponível`);
      window.dispatchEvent(new CustomEvent('duckflix:extensionready'));
    } catch { setStatus('Extensão não conectada. Instalação manual disponível para Chrome e Edge no computador.'); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', detect, { once: true }); else detect();
  window.addEventListener('pagehide', () => { for (const finish of [...pending.values()]) finish(new Error('Página encerrada.')); });
})();
