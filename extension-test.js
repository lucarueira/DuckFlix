(() => {
  let hls, lookup;
  const video = document.getElementById('test-video'), status = document.getElementById('test-status');
  const addonButton = document.getElementById('test-minhatv');
  const stop = () => { lookup?.abort(); lookup = null; addonButton.disabled = false; hls?.destroy(); hls = null; video.pause(); video.removeAttribute('src'); video.load(); };
  document.getElementById('test-stop').onclick = () => { stop(); status.textContent = 'Teste encerrado.'; };
  function play() {
    stop();
    if (!window.DuckFlixExtension?.connected) { status.textContent = 'Instale a extensão e recarregue esta página.'; return; }
    const url = document.getElementById('test-url').value.trim();
    if (!/^http:\/\//i.test(url) || !/\.m3u8(?:$|[?#])/i.test(url)) { status.textContent = 'Use uma URL HTTP terminada em .m3u8 (pode conter parâmetros).'; return; }
    if (!window.Hls?.isSupported()) { status.textContent = 'HLS não está disponível neste navegador.'; return; }
    status.textContent = 'Conectando…';
    hls = new Hls({ ...window.DuckFlixExtension.hlsConfig(url, Hls), maxBufferLength: 15 });
    hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) { status.textContent = 'Falha na fonte. Confira as autorizações na extensão e tente novamente. O endereço pode estar indisponível ou usar um formato incompatível.'; stop(); } });
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => { status.textContent = 'Transmissão carregada. Toque em play.'; }));
    hls.loadSource(url); hls.attachMedia(video);
    return true;
  }
  document.getElementById('test-form').onsubmit = event => { event.preventDefault(); play(); };
  addonButton.onclick = async () => {
    stop();
    if (!window.DuckFlixExtension?.connected) { status.textContent = 'Ative a extensão e recarregue esta página antes de testar.'; return; }
    const controller = new AbortController(); lookup = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    addonButton.disabled = true; status.textContent = 'Buscando um canal HTTP no Minha TV…';
    const base = 'https://da5f663b4690-minhatv.baby-beamup.club';
    const get = async path => {
      const response = await fetch(base + path, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    };
    try {
      const catalog = await get('/catalog/tv/minhatv_channels.json');
      const channels = (catalog.metas || []).filter(item => !item.adult && typeof item.id === 'string' && /^(record(?:tv)?\s*sp|tv\s*brasil|tv\s*cultura)(?:\s|$)/i.test(item.name || '')).slice(0, 3);
      for (const channel of channels) {
        const data = await get(`/stream/tv/${encodeURIComponent(channel.id)}.json`);
        const stream = (data.streams || []).find(item => {
          try { const url = new URL(item.url); return url.protocol === 'http:' && !url.username && !url.password && /\.m3u8$/i.test(url.pathname) && !item.infoHash && !item.behaviorHints?.proxyHeaders; } catch { return false; }
        });
        if (!stream) continue;
        if (lookup !== controller || controller.signal.aborted) return;
        document.getElementById('test-url').value = stream.url;
        if (play()) status.textContent = `Testando ${channel.name}. Se precisar, abra a extensão, autorize o servidor e clique em “Testar transmissão” novamente.`;
        return;
      }
      throw new Error('Nenhum canal aberto com fonte HTTP HLS foi encontrado agora.');
    } catch (error) {
      if (lookup === controller) status.textContent = controller.signal.aborted ? 'O Minha TV demorou para responder. Tente novamente.' : `Não foi possível carregar o Minha TV: ${error.message}`;
    } finally {
      clearTimeout(timeout);
      if (lookup === controller) { lookup = null; addonButton.disabled = false; }
    }
  };
  video.addEventListener('playing', () => { status.textContent = 'Reproduzindo pelo suporte HTTP da extensão.'; });
  window.addEventListener('pagehide', stop);
})();
