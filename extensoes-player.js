(function () {
  'use strict';
  function timeLabel(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const value = Math.floor(seconds), hours = Math.floor(value / 3600), minutes = Math.floor(value % 3600 / 60), rest = String(value % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
  }
  function create({ document, getDetails, getStreams, media = globalThis.DuckFlixMedia }) {
    const $ = id => document.getElementById(id), video = $('extension-video'), dialog = $('watch-dialog');
    let item, episodes = [], episodeIndex = -1, detailAbort, scanAbort, scanState, connection, currentSource, verified = [], sourceNumber = 0, playbackVersion = 0, stallTimer;
    let resumeAt = 0, lastPosition = 0, detailsReady = false;
    const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
    const status = (id, text) => { $(id).textContent = text; };
    function placeholder(text) { $('player-placeholder').hidden = false; status('play-status', text); }
    function stopPlayback() {
      playbackVersion++; clearTimeout(stallTimer); connection?.dispose(); connection = null; currentSource = null;
      $('start-video').hidden = true; $('video-controls').hidden = true;
      $('video-seek').value = '0'; $('video-seek').disabled = true; status('video-time', '0:00 / 0:00');
    }
    function close() {
      detailAbort?.abort(); scanAbort?.abort(); stopPlayback();
      if (dialog.open) dialog.close();
    }
    function drawSources() {
      $('stream-list').replaceChildren();
      for (const source of verified) {
        const button = node('button', `${source.language} · ${source.quality} · Opção ${source.number}`, 'stream-option');
        button.type = 'button'; button.setAttribute('aria-pressed', String(source === currentSource));
        button.addEventListener('click', () => playSource(source, Number(video.currentTime) || 0));
        $('stream-list').append(button);
      }
    }
    function updateScanStatus(state) {
      if (state !== scanState || state.controller.signal.aborted) return;
      const busy = !state.fetched || state.active > 0;
      const remaining = state.queue.length > 0;
      $('scan-more').hidden = busy || !remaining;
      status('stream-status', busy ? `Verificando reprodução… ${verified.length ? `${verified.length} opções disponíveis.` : ''}` : verified.length ? `${verified.length} ${verified.length === 1 ? 'opção pronta' : 'opções prontas'} para assistir.` : 'Nenhuma opção reproduziu imagem neste navegador.');
      if (!busy && !remaining && !verified.length) placeholder('Não encontramos uma opção funcionando agora. Tente verificar novamente mais tarde.');
      else if (!busy && !verified.length) placeholder('As primeiras opções não responderam. Use “Verificar mais opções” para continuar.');
    }
    function failedSource(source, at) {
      verified = verified.filter(entry => entry !== source);
      resumeAt = at;
      stopPlayback(); drawSources();
      status('play-message', 'A reprodução falhou. Tentando outra opção…');
      if (verified.length) playSource(verified[0], at);
      else if (scanState && !scanState.controller.signal.aborted) {
        scanState.limit = Math.max(scanState.limit, scanState.attempted + 8);
        scanState.target = 3; pump(scanState); updateScanStatus(scanState);
      }
    }
    function playSource(source, at = 0) {
      stopPlayback(); lastPosition = at; currentSource = source; const version = playbackVersion;
      placeholder('Abrindo vídeo…'); drawSources();
      status('play-message', '');
      connection = media.connect(video, source, {
        mode: source.mode, autoplay: true, startAt: at,
        onReady: () => {
          if (version !== playbackVersion) return;
          $('player-placeholder').hidden = true; $('video-controls').hidden = false;
          updateTime();
        },
        onBlocked: () => {
          if (version !== playbackVersion) return;
          $('start-video').hidden = false; status('play-message', 'Toque em continuar para iniciar o vídeo.');
        },
        onError: () => { if (version === playbackVersion) failedSource(source, Math.max(at, lastPosition)); }
      });
    }
    function pump(state) {
      if (state !== scanState || state.controller.signal.aborted) return;
      while (state.active < 2 && state.queue.length && state.attempted < state.limit && verified.length < state.target) {
        const source = state.queue.shift(); state.active++; state.attempted++;
        media.probe(source, { signal: state.controller.signal }).then(result => {
          if (state !== scanState || state.controller.signal.aborted) return;
          if (result?.ok) {
            const ready = { ...source, mode: result.mode, number: ++sourceNumber };
            verified.push(ready); drawSources();
            if (!currentSource) playSource(ready, resumeAt);
          }
        }).catch(() => {}).finally(() => {
          state.active--;
          if (state === scanState && !state.controller.signal.aborted) { pump(state); updateScanStatus(state); }
        });
      }
      updateScanStatus(state);
    }
    async function loadStreams() {
      scanAbort?.abort(); stopPlayback(); verified = []; sourceNumber = 0; resumeAt = 0; drawSources();
      $('scan-more').hidden = true; status('play-message', ''); placeholder('Encontrando a melhor reprodução para você…');
      const controller = new AbortController(); scanAbort = controller;
      const state = { controller, queue: [], seen: new Set(), active: 0, attempted: 0, limit: 12, target: 3, fetched: false }; scanState = state;
      status('stream-status', 'Procurando vídeos…');
      const id = episodes.length ? episodes[episodeIndex].id : item.id;
      try {
        await getStreams(id, item.type, controller.signal, streams => {
          if (controller.signal.aborted) return;
          for (const stream of streams) {
            const source = media.candidate(stream);
            if (!source || state.seen.has(source.url)) continue;
            state.seen.add(source.url); state.queue.push({ ...source, priority: stream.priority || 0 });
          }
          const score = source => source.priority * 10 + (/4K|2160/.test(source.quality) ? 2 : /CAM/.test(source.quality) ? 4 : 0);
          state.queue.sort((a, b) => score(a) - score(b)); pump(state);
        });
      } catch { /* O estado vazio oferece uma nova verificação. */ }
      finally { if (!controller.signal.aborted) { state.fetched = true; pump(state); updateScanStatus(state); } }
    }
    function drawEpisodes() {
      $('episode-list').replaceChildren();
      if (!episodes.length) return;
      const season = Number($('season-select').value);
      episodes.forEach((ep, index) => {
        if (Number(ep.season) !== season) return;
        const button = node('button', undefined, 'episode-card'); button.type = 'button';
        button.setAttribute('aria-current', String(index === episodeIndex));
        const copy = node('div'); copy.append(node('strong', ep.title || ep.name || `Episódio ${ep.episode}`), node('small', `Temporada ${ep.season} · Episódio ${ep.episode}`));
        button.append(node('span', String(ep.episode).padStart(2, '0')), copy);
        button.addEventListener('click', () => chooseEpisode(index)); $('episode-list').append(button);
      });
      $('prev-episode').disabled = episodeIndex <= 0; $('next-episode').disabled = episodeIndex >= episodes.length - 1;
    }
    function chooseEpisode(index) {
      if (index < 0 || index >= episodes.length) return;
      episodeIndex = index; const ep = episodes[index];
      $('season-select').value = String(ep.season); drawEpisodes();
      status('episode-caption', `TEMPORADA ${ep.season} · EPISÓDIO ${ep.episode}`);
      loadStreams();
    }
    async function open(selected) {
      detailAbort?.abort(); scanAbort?.abort(); stopPlayback();
      const controller = new AbortController(); detailAbort = controller;
      item = selected; detailsReady = false; episodes = []; episodeIndex = -1; verified = []; scanState = null; drawSources();
      $('episode-panel').hidden = true; $('scan-more').hidden = true;
      status('watch-title', item.name); status('watch-description', item.description || ''); status('episode-caption', item.type === 'movie' ? 'FILME' : 'SÉRIE');
      status('stream-status', 'Preparando sua sessão…'); status('play-message', ''); placeholder('Carregando título…');
      if (!dialog.open) dialog.showModal();
      try {
        const details = await getDetails(selected, controller.signal);
        if (controller.signal.aborted) return;
        item = details;
        if (item.type === 'series') {
          episodes = media.orderedEpisodes(item.videos);
          if (!episodes.length) throw new Error('Ainda não há episódios disponíveis para este título.');
          $('episode-panel').hidden = false; $('season-select').replaceChildren();
          for (const season of [...new Set(episodes.map(ep => Number(ep.season)))]) {
            const option = node('option', season === 0 ? 'Especiais' : `Temporada ${season}`); option.value = String(season); $('season-select').append(option);
          }
          status('episode-count', `${episodes.length} episódios`);
          detailsReady = true;
          chooseEpisode(Math.max(0, episodes.findIndex(ep => Number(ep.season) > 0)));
        } else { detailsReady = true; loadStreams(); }
      } catch (error) { if (!controller.signal.aborted) { placeholder(error.message); status('stream-status', 'Não foi possível abrir este título.'); } }
    }
    function updateTime() {
      const duration = Number(video.duration), current = Number(video.currentTime) || 0;
      if (currentSource && current > 0) lastPosition = current;
      status('video-time', `${timeLabel(current)} / ${timeLabel(duration)}`);
      $('video-seek').disabled = !Number.isFinite(duration) || duration <= 0;
      if (!$('video-seek').disabled) $('video-seek').value = String(Math.round(current / duration * 1000));
    }
    function togglePlay() { if (!connection) return; if (video.paused) connection.play(); else video.pause(); }
    function seek(delta) { if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta)); }
    function fullscreen() {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else if ($('player-shell').requestFullscreen) $('player-shell').requestFullscreen().catch(() => status('play-message', 'Tela cheia indisponível neste navegador.'));
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    }
    $('close-player').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('close', () => { detailAbort?.abort(); scanAbort?.abort(); stopPlayback(); });
    $('retry-streams').addEventListener('click', () => { if (detailsReady) loadStreams(); else open(item); });
    $('scan-more').addEventListener('click', () => { if (scanState) { scanState.limit += 12; scanState.target = verified.length + 3; pump(scanState); } });
    $('season-select').addEventListener('change', drawEpisodes);
    $('prev-episode').addEventListener('click', () => chooseEpisode(episodeIndex - 1));
    $('next-episode').addEventListener('click', () => chooseEpisode(episodeIndex + 1));
    $('autoplay-next').addEventListener('change', () => { try { localStorage.setItem('duckflix.autoplay-next', String($('autoplay-next').checked)); } catch {} });
    try { $('autoplay-next').checked = localStorage.getItem('duckflix.autoplay-next') !== 'false'; } catch {}
    video.addEventListener('ended', () => {
      if (!connection || !episodes.length) return;
      if ($('autoplay-next').checked && episodeIndex + 1 < episodes.length) chooseEpisode(episodeIndex + 1);
      else status('play-message', episodeIndex + 1 === episodes.length ? 'Você chegou ao último episódio disponível.' : 'Episódio concluído. O próximo está ao lado.');
    });
    video.addEventListener('timeupdate', () => { clearTimeout(stallTimer); updateTime(); });
    video.addEventListener('durationchange', updateTime);
    video.addEventListener('playing', () => { clearTimeout(stallTimer); $('start-video').hidden = true; status('play-message', ''); });
    video.addEventListener('waiting', () => {
      clearTimeout(stallTimer); const source = currentSource, version = playbackVersion;
      if (source && connection) stallTimer = setTimeout(() => { if (source === currentSource && version === playbackVersion && !video.paused) failedSource(source, Number(video.currentTime) || 0); }, 25000);
    });
    for (const event of ['play', 'pause']) video.addEventListener(event, () => { $('toggle-play').textContent = video.paused ? '▶' : 'Ⅱ'; $('toggle-play').setAttribute('aria-label', video.paused ? 'Reproduzir' : 'Pausar'); });
    $('toggle-play').addEventListener('click', togglePlay); $('start-video').addEventListener('click', () => connection?.play());
    $('skip-back').addEventListener('click', () => seek(-10)); $('skip-forward').addEventListener('click', () => seek(10));
    $('video-seek').addEventListener('input', () => { if (Number.isFinite(video.duration)) video.currentTime = Number($('video-seek').value) / 1000 * video.duration; });
    $('video-volume').addEventListener('input', () => { video.volume = Number($('video-volume').value); video.muted = video.volume === 0; });
    $('toggle-mute').addEventListener('click', () => { video.muted = !video.muted; });
    video.addEventListener('volumechange', () => { $('toggle-mute').textContent = video.muted ? '×♪' : '♪'; $('toggle-mute').setAttribute('aria-label', video.muted ? 'Ativar som' : 'Silenciar'); });
    $('video-speed').addEventListener('change', () => { video.playbackRate = Number($('video-speed').value); });
    $('fullscreen').addEventListener('click', fullscreen);
    $('player-shell').addEventListener('keydown', event => {
      if (['INPUT', 'SELECT', 'BUTTON'].includes(event.target.tagName)) return;
      if ([' ', 'ArrowLeft', 'ArrowRight', 'f'].includes(event.key)) event.preventDefault();
      if (event.key === ' ') togglePlay(); else if (event.key === 'ArrowLeft') seek(-10); else if (event.key === 'ArrowRight') seek(10); else if (event.key === 'f') fullscreen();
    });
    video.controls = false;
    return { open, close };
  }
  const api = { create, timeLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.DuckFlixPlayer = api;
})();
