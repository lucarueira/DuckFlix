(function () {
  'use strict';
  const form = document.getElementById('music-search');
  const query = document.getElementById('music-query');
  const results = document.getElementById('music-results');
  const status = document.getElementById('music-status');
  const player = document.getElementById('music-player');
  const placeholder = document.getElementById('player-placeholder');
  const title = document.getElementById('playing-title');
  const artist = document.getElementById('playing-artist');
  const source = document.getElementById('music-source');
  const playerStatus = document.getElementById('player-status');
  let currentRequest;
  let ytPlayer;
  let ytPlayerReady = false;
  let currentTrack;
  let currentAutoplay = false;
  let playableTracks = [];
  let fallbackCount = 0;
  const unavailable = new Set();

  function attachPlayer() {
    if (!window.YT?.Player || ytPlayer || !player.src) return;
    ytPlayer = new window.YT.Player('music-player', {
      events: {
        onReady(event) {
          ytPlayerReady = true;
          if (currentAutoplay) event.target.playVideo();
        },
        onStateChange(event) {
          if (event.data === window.YT.PlayerState.PLAYING) playerStatus.textContent = '';
        },
        onError(event) {
          if (!currentTrack) return;
          if (event.data === 153) {
            playerStatus.textContent = 'O YouTube não aceitou este player nesta página. Use “Abrir no YouTube”.';
            return;
          }
          if (![5, 100, 101, 150].includes(event.data) || unavailable.has(currentTrack.id)) return;
          unavailable.add(currentTrack.id);
          const next = playableTracks.find(track => track.kind === 'video' && !unavailable.has(track.id)) ||
            playableTracks.find(track => !unavailable.has(track.id));
          if (next && fallbackCount < 3) {
            fallbackCount++;
            chooseTrack(next, { scroll: false, autoplay: currentAutoplay, resetFallback: false });
            playerStatus.textContent = 'Este vídeo não pode tocar aqui. Tentando outra versão…';
          } else {
            playerStatus.textContent = 'Este vídeo não pode tocar aqui. Escolha outro resultado ou abra no YouTube.';
          }
        },
        onAutoplayBlocked() {
          playerStatus.textContent = 'O navegador bloqueou a reprodução automática. Toque em Play no player.';
        }
      }
    });
  }

  function ensurePlayerApi() {
    if (window.YT?.Player) return attachPlayer();
    if (document.getElementById('youtube-iframe-api')) return;
    window.onYouTubeIframeAPIReady = attachPlayer;
    const script = document.createElement('script');
    script.id = 'youtube-iframe-api';
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => { playerStatus.textContent = 'Não foi possível carregar os controles do player. Use “Abrir no YouTube”.'; };
    document.head.append(script);
  }

  function empty(heading, message) {
    results.replaceChildren();
    const box = document.createElement('div'); box.className = 'empty-state';
    const icon = document.createElement('span'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = '♫';
    const h = document.createElement('h3'); h.textContent = heading;
    const p = document.createElement('p'); p.textContent = message;
    box.append(icon, h, p);
    results.append(box);
  }

  async function catalogRequest(term, signal) {
    const path = `?q=${encodeURIComponent(term)}`;
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const preview = local && location.port !== '3000';
    const first = preview ? `http://${location.hostname}:3000/api/music/search${path}`
      : local ? `/api/music/search${path}` : `/.netlify/functions/music-search${path}`;
    let response;
    try { response = await fetch(first, { signal, credentials: 'omit' }); }
    catch (cause) {
      if (signal.aborted) throw cause;
      throw new Error(preview ? 'Servidor de busca desligado. Execute node together-server.js para usar a busca nesta prévia.' : 'Não foi possível conectar ao servidor de busca.');
    }
    if (!local && response.status === 404) response = await fetch(`/api/music/search${path}`, { signal, credentials: 'omit' });
    let data;
    try { data = await response.json(); } catch { throw new Error('A busca ainda não está disponível neste servidor.'); }
    if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o catálogo.');
    return data;
  }

  function chooseTrack(track, { scroll = true, autoplay = true, resetFallback = true } = {}) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(track.id)) return;
    if (resetFallback) {
      fallbackCount = 0;
      unavailable.delete(track.id);
    }
    currentTrack = track;
    currentAutoplay = autoplay;
    playerStatus.textContent = '';
    player.hidden = false;
    placeholder.hidden = true;
    player.title = `Player de música: ${track.title}`;
    title.textContent = track.title;
    artist.textContent = track.artist;
    source.href = `https://www.youtube.com/watch?v=${track.id}`;
    source.hidden = false;
    if (ytPlayerReady) {
      if (autoplay) ytPlayer.loadVideoById(track.id);
      else ytPlayer.cueVideoById(track.id);
    } else {
      const origin = encodeURIComponent(location.origin);
      player.src = `https://www.youtube.com/embed/${track.id}?enablejsapi=1&origin=${origin}&autoplay=${autoplay ? 1 : 0}&rel=0`;
      ensurePlayerApi();
    }
    if (scroll) player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function render(tracks) {
    results.replaceChildren();
    const playable = Array.isArray(tracks) ? tracks.filter(track => /^[A-Za-z0-9_-]{11}$/.test(String(track.id))) : [];
    playableTracks = playable;
    unavailable.clear();
    if (!playable.length) {
      empty('Nenhuma faixa encontrada', 'Tente o nome de outro artista ou música.');
      return null;
    }
    const fragment = document.createDocumentFragment();
    playable.forEach((track, index) => {
      const row = document.createElement('div'); row.className = 'track-row';
      const number = document.createElement('span'); number.className = 'track-number'; number.textContent = String(index + 1).padStart(2, '0');
      const info = document.createElement('div'); info.className = 'track-info';
      const name = document.createElement('strong'); name.textContent = track.title;
      const artist = document.createElement('small'); artist.textContent = track.artist;
      info.append(name, artist);
      const actions = document.createElement('div'); actions.className = 'track-actions';
      const play = document.createElement('button'); play.type = 'button'; play.textContent = 'Ouvir'; play.setAttribute('aria-label', `Ouvir ${track.title}`);
      play.addEventListener('click', () => chooseTrack(track));
      actions.append(play); row.append(number, info, actions); fragment.append(row);
    });
    results.append(fragment);
    return playable[0];
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const term = query.value.trim();
    if (term.length < 2) { status.textContent = 'Digite pelo menos 2 caracteres.'; return; }
    currentRequest?.abort();
    const request = new AbortController(); currentRequest = request;
    form.querySelector('button').disabled = true;
    status.textContent = `Buscando “${term}”…`;
    empty('Buscando músicas', 'Aguarde um instante.');
    try {
      const data = await catalogRequest(term, request.signal);
      if (request.signal.aborted) return;
      const firstTrack = render(data.tracks);
      if (firstTrack) {
        chooseTrack(firstTrack, { scroll: false, autoplay: false });
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      status.textContent = firstTrack ? `${data.tracks.length} músicas encontradas. A primeira já está no player.` : 'Nenhuma música encontrada.';
    } catch (cause) {
      if (request.signal.aborted) return;
      status.textContent = cause.message;
      empty('Busca indisponível', cause.message);
    } finally {
      if (currentRequest === request) form.querySelector('button').disabled = false;
    }
  });
})();
