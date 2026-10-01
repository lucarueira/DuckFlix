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
  const playlistPanel = document.querySelector('.playlist-panel');
  const playlistForm = document.getElementById('playlist-create');
  const playlistNameInput = document.getElementById('playlist-new-name');
  const playlistList = document.getElementById('playlist-list');
  const playlistCurrentName = document.getElementById('playlist-current-name');
  const playlistCount = document.getElementById('playlist-count');
  const playlistTracks = document.getElementById('playlist-tracks');
  const playlistStatus = document.getElementById('playlist-status');
  const playlistPlay = document.getElementById('playlist-play');
  const playlistPrevious = document.getElementById('playlist-previous');
  const playlistNext = document.getElementById('playlist-next');
  const playlistDelete = document.getElementById('playlist-delete');
  const playlistStorageKey = 'duckmusic-playlists-v1';
  let currentRequest;
  let ytPlayer;
  let ytPlayerReady = false;
  let currentTrack;
  let currentAutoplay = false;
  let playableTracks = [];
  let fallbackCount = 0;
  const unavailable = new Set();
  let playlists = [];
  let selectedPlaylistId = null;
  let queue = null;

  function cleanTrack(value) {
    const id = String(value?.id || '');
    const title = String(value?.title || '').trim().slice(0, 160);
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) || !title) return null;
    return { id, title, artist: String(value.artist || 'Artista desconhecido').slice(0, 180),
      kind: value.kind === 'video' ? 'video' : 'song' };
  }

  function loadPlaylists() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(playlistStorageKey) || '{}'); } catch { return; }
    if (!saved || !Array.isArray(saved.playlists)) return;
    const seen = new Set();
    playlists = saved.playlists.slice(0, 30).flatMap(item => {
      const id = String(item?.id || '').slice(0, 80);
      const name = String(item?.name || '').trim().slice(0, 60);
      if (!id || !name || seen.has(id)) return [];
      seen.add(id);
      const trackIds = new Set();
      const tracks = (Array.isArray(item.tracks) ? item.tracks : []).slice(0, 300).flatMap(value => {
        const track = cleanTrack(value);
        if (!track || trackIds.has(track.id)) return [];
        trackIds.add(track.id);
        return [track];
      });
      return [{ id, name, tracks }];
    });
    selectedPlaylistId = playlists.some(item => item.id === saved.selectedId) ? saved.selectedId : playlists[0]?.id || null;
  }

  function savePlaylists() {
    try {
      localStorage.setItem(playlistStorageKey, JSON.stringify({ playlists, selectedId: selectedPlaylistId }));
      return true;
    } catch {
      playlistStatus.textContent = 'Não foi possível guardar a playlist neste navegador.';
      return false;
    }
  }

  function selectedPlaylist() {
    return playlists.find(item => item.id === selectedPlaylistId);
  }

  function renderPlaylists() {
    playlistList.replaceChildren();
    playlists.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${item.name} · ${item.tracks.length}`;
      button.setAttribute('aria-current', String(item.id === selectedPlaylistId));
      button.addEventListener('click', () => {
        selectedPlaylistId = item.id;
        playlistStatus.textContent = '';
        savePlaylists();
        renderPlaylists();
      });
      playlistList.append(button);
    });
    const active = selectedPlaylist();
    playlistCurrentName.textContent = active?.name || 'Escolha uma playlist';
    playlistCount.textContent = active ? `${active.tracks.length} ${active.tracks.length === 1 ? 'música' : 'músicas'}` : '';
    playlistPlay.disabled = !active?.tracks.length;
    playlistDelete.disabled = !active;
    const queuedHere = !!queue && queue.playlistId === active?.id;
    playlistPrevious.disabled = !queuedHere || queue.index <= 0;
    playlistNext.disabled = !queuedHere || queue.index >= active.tracks.length - 1;
    playlistTracks.replaceChildren();
    if (!active?.tracks.length) {
      const message = document.createElement('p');
      message.className = 'playlist-empty';
      message.textContent = active ? 'Use + Playlist nos resultados da busca para adicionar músicas.' : 'Crie uma playlist para começar.';
      playlistTracks.append(message);
      return;
    }
    active.tracks.forEach((track, index) => {
      const row = document.createElement('div');
      row.className = 'track-row';
      if (queuedHere && queue.index === index) row.classList.add('is-playing');
      const number = document.createElement('span'); number.className = 'track-number'; number.textContent = String(index + 1).padStart(2, '0');
      const info = document.createElement('div'); info.className = 'track-info';
      const name = document.createElement('strong'); name.textContent = track.title;
      const artist = document.createElement('small'); artist.textContent = track.artist;
      info.append(name, artist);
      const actions = document.createElement('div'); actions.className = 'track-actions';
      const play = document.createElement('button'); play.type = 'button'; play.textContent = 'Ouvir'; play.setAttribute('aria-label', `Ouvir ${track.title} da playlist`);
      play.addEventListener('click', () => playPlaylistAt(active.id, index));
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remover'; remove.setAttribute('aria-label', `Remover ${track.title} da playlist`);
      remove.addEventListener('click', () => removePlaylistTrack(active.id, track.id));
      actions.append(play, remove); row.append(number, info, actions); playlistTracks.append(row);
    });
  }

  function addToPlaylist(track) {
    const active = selectedPlaylist();
    if (!active) {
      playlistStatus.textContent = 'Crie uma playlist antes de adicionar músicas.';
      playlistPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      playlistNameInput.focus();
      return;
    }
    if (active.tracks.some(item => item.id === track.id)) {
      playlistStatus.textContent = 'Esta música já está na playlist.';
      return;
    }
    if (active.tracks.length >= 300) {
      playlistStatus.textContent = 'Esta playlist já tem 300 músicas.';
      return;
    }
    active.tracks.push(cleanTrack(track));
    const saved = savePlaylists();
    renderPlaylists();
    if (saved) playlistStatus.textContent = `“${track.title}” adicionada à playlist “${active.name}”.`;
  }

  function removePlaylistTrack(playlistId, trackId) {
    const item = playlists.find(value => value.id === playlistId);
    if (!item) return;
    const index = item.tracks.findIndex(track => track.id === trackId);
    if (index < 0) return;
    item.tracks.splice(index, 1);
    if (queue?.playlistId === playlistId) {
      if (queue.index === index) queue = null;
      else if (index < queue.index) queue.index--;
    }
    const saved = savePlaylists();
    renderPlaylists();
    if (saved) playlistStatus.textContent = 'Música removida da playlist.';
  }

  function playPlaylistAt(playlistId, index) {
    const item = playlists.find(value => value.id === playlistId);
    const track = item?.tracks[index];
    if (!track) return false;
    queue = { playlistId, index };
    chooseTrack(track, { keepQueue: true });
    renderPlaylists();
    return true;
  }

  function advancePlaylist(direction = 1) {
    if (!queue) return false;
    const item = playlists.find(value => value.id === queue.playlistId);
    const index = queue.index + direction;
    if (!item?.tracks[index]) {
      if (direction > 0) {
        queue = null;
        playerStatus.textContent = 'Fim da playlist.';
        renderPlaylists();
      }
      return false;
    }
    return playPlaylistAt(item.id, index);
  }

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
          if (event.data === window.YT.PlayerState.ENDED && queue) advancePlaylist();
        },
        onError(event) {
          if (!currentTrack) return;
          if (event.data === 153) {
            playerStatus.textContent = 'O YouTube não aceitou este player nesta página. Use “Abrir no YouTube”.';
            return;
          }
          if (![5, 100, 101, 150].includes(event.data) || unavailable.has(currentTrack.id)) return;
          unavailable.add(currentTrack.id);
          if (queue) {
            const next = advancePlaylist();
            if (next) playerStatus.textContent = 'Esta faixa não abriu aqui. Pulando para a próxima da playlist…';
            else playerStatus.textContent = 'Esta faixa não abriu aqui. Escolha outra ou abra no YouTube.';
            return;
          }
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

  function chooseTrack(track, { scroll = true, autoplay = true, resetFallback = true, keepQueue = false } = {}) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(track.id)) return;
    if (!keepQueue && queue) {
      queue = null;
      renderPlaylists();
    }
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
      const add = document.createElement('button'); add.type = 'button'; add.textContent = '+ Playlist'; add.setAttribute('aria-label', `Adicionar ${track.title} à playlist selecionada`);
      add.addEventListener('click', () => addToPlaylist(track));
      actions.append(play, add); row.append(number, info, actions); fragment.append(row);
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
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      status.textContent = firstTrack ? `${data.tracks.length} músicas encontradas. Clique em Ouvir ou adicione à playlist.` : 'Nenhuma música encontrada.';
    } catch (cause) {
      if (request.signal.aborted) return;
      status.textContent = cause.message;
      empty('Busca indisponível', cause.message);
    } finally {
      if (currentRequest === request) form.querySelector('button').disabled = false;
    }
  });

  playlistForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = playlistNameInput.value.trim().slice(0, 60);
    if (!name) {
      playlistStatus.textContent = 'Digite um nome para a playlist.';
      return;
    }
    if (playlists.length >= 30) {
      playlistStatus.textContent = 'Você já tem 30 playlists neste navegador.';
      return;
    }
    if (playlists.some(item => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
      playlistStatus.textContent = 'Já existe uma playlist com esse nome.';
      return;
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    playlists.push({ id, name, tracks: [] });
    selectedPlaylistId = id;
    playlistNameInput.value = '';
    const saved = savePlaylists();
    renderPlaylists();
    if (saved) playlistStatus.textContent = `Playlist “${name}” criada. Use + Playlist nos resultados da busca.`;
  });

  playlistPlay.addEventListener('click', () => {
    const active = selectedPlaylist();
    if (active?.tracks.length) playPlaylistAt(active.id, 0);
  });
  playlistPrevious.addEventListener('click', () => advancePlaylist(-1));
  playlistNext.addEventListener('click', () => advancePlaylist(1));
  playlistDelete.addEventListener('click', () => {
    const active = selectedPlaylist();
    if (!active || !window.confirm(`Excluir a playlist “${active.name}”?`)) return;
    playlists = playlists.filter(item => item.id !== active.id);
    if (queue?.playlistId === active.id) queue = null;
    selectedPlaylistId = playlists[0]?.id || null;
    const saved = savePlaylists();
    renderPlaylists();
    if (saved) playlistStatus.textContent = 'Playlist excluída.';
  });

  loadPlaylists();
  renderPlaylists();
})();
