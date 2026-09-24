(function () {
  'use strict';
  const $ = id => document.getElementById(id), api = window.DuckFlixExtensions, media = window.DuckFlixMedia, safety = window.DuckFlixSafety;
  const video = $('together-video'), clock = window.DuckTogetherSync.clock();
  let session, roomState, online = false, loadedId, connection, mediaAbort, mediaVersion = 0, mediaReady = false, commandBusy = false, presenceState;
  let pickerAbort, selected, episodes = [], disposed = false, mediaBlocked = false;
  const status = text => { $('together-status').textContent = text; };
  const node = (tag, text, cls) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (cls) element.className = cls; return element; };
  const time = seconds => { const value = Math.max(0, Math.floor(Number(seconds) || 0)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; };
  const host = () => session?.role === 'host';
  const engine = window.DuckTogetherSync.create({ video, now: clock.now,
    onBlocked: () => { $('enable-playback').hidden = false; $('sync-status').textContent = 'Toque para ativar o vídeo neste aparelho e alcançar a sala.'; presence('blocked'); },
    onError: () => playbackError()
  });
  const client = window.DuckTogetherClient.create({ baseUrl: window.DuckTogetherConfig?.serverUrl || '', clock,
    onSnapshot: receive,
    onConnection(connected) {
      online = connected; engine.connected(connected); updateControls();
      if (session) status(connected ? host() ? 'Você é o líder. Seus comandos valem para toda a sala.' : 'Você está na sala. O líder controla a reprodução.' : 'Reconectando à sala… A reprodução fica pausada até a conexão voltar.');
    },
    onExpired: () => { leave(false); status('Sala encerrada ou sessão expirada. Entre novamente pelo convite.'); }
  });
  function storeSession(value) { try { if (value) sessionStorage.setItem('duckflix.together.session', JSON.stringify(value)); else sessionStorage.removeItem('duckflix.together.session'); } catch {} }
  function invitation(value) {
    const parsed = new URL(value, location.href), params = new URLSearchParams(parsed.hash.slice(1));
    const roomId = params.get('room'), invite = params.get('invite');
    if (!/^[A-Za-z0-9_-]{16}$/.test(roomId || '') || !/^[A-Za-z0-9_-]{32}$/.test(invite || '')) throw new Error('Cole o link de convite completo.');
    return { roomId, invite };
  }
  function inviteLink(roomId, invite) { const url = new URL('together.html', location.href); url.hash = new URLSearchParams({ room: roomId, invite }); return url.href; }
  function presence(value) { if (presenceState === value || !session) return; presenceState = value; client.presence(value); }
  function placeholder(text) { $('together-placeholder').hidden = false; $('media-status').textContent = text; }
  function updateControls() {
    const canControl = host() && online && !!roomState?.media && mediaReady && !commandBusy;
    $('room-play').disabled = !canControl; $('room-speed').disabled = !canControl;
    $('together-seek').disabled = !canControl || !Number.isFinite(video.duration);
    $('room-play').textContent = roomState?.paused !== false ? '▶ Play' : 'Ⅱ Pausar';
    if (roomState) $('room-speed').value = String(roomState.rate);
  }
  async function command(action, extra = {}) {
    if (!host() || !online || commandBusy || !roomState?.media) return;
    commandBusy = true; updateControls();
    try { receive(await client.command({ action, mediaId: roomState.media.id, position: Number(video.currentTime) || 0, observedAt: clock.now(), ...extra })); }
    catch (error) { status(error.message); }
    finally { commandBusy = false; updateControls(); }
  }
  function receive(packet) {
    if (!session || !packet.state) return;
    if (roomState && packet.state.revision < roomState.revision) return;
    roomState = packet.state;
    const list = $('room-members'); list.replaceChildren();
    const labels = { ready: 'Pronto para assistir', loading: 'Carregando vídeo', blocked: 'Aguardando ativar o vídeo', error: 'Vídeo indisponível' };
    for (const member of packet.members) {
      const row = node('li'); row.append(node('strong', member.name), node('small', `${member.host ? 'Líder · ' : ''}${labels[member.status] || 'Na sala'}`)); list.append(row);
    }
    $('member-count').textContent = String(packet.members.length);
    if (!packet.hostOnline) $('sync-status').textContent = 'O líder desconectou. A sala está pausada.';
    else if (!mediaBlocked) $('sync-status').textContent = host() ? 'Play, pausa, avanço e velocidade são compartilhados.' : 'Sincronizado com o líder. O atraso é corrigido automaticamente.';
    if ((roomState.media?.id || null) !== loadedId) loadMedia(roomState.media);
    engine.receive(roomState); updateControls();
  }
  async function loadMedia(item, force = false) {
    if (!force && loadedId === (item?.id || null)) return;
    const generation = ++mediaVersion;
    mediaAbort?.abort(); mediaAbort = new AbortController();
    engine.ready(false); mediaReady = false; mediaBlocked = false; connection?.dispose(); connection = null;
    loadedId = item?.id || null; $('enable-playback').hidden = true; $('retry-media').hidden = true; $('together-title').textContent = 'Sua sessão em companhia.';
    updateControls();
    if (!item) { placeholder('O líder vai escolher o que assistir.'); return; }
    placeholder('Preparando o vídeo da sala…'); presence('loading');
    try {
      const allowed = await safety.allowed({ ...item, id: item.tmdbId }, { signal: mediaAbort.signal });
      if (generation !== mediaVersion || !session) return;
      if (!allowed) {
        mediaBlocked = true; placeholder('Este título está oculto pelo Modo Livre neste aparelho.'); $('sync-status').textContent = 'O filtro deste aparelho foi mantido.'; presence('error');
        if (host()) command('pause', { buffering: true });
        return;
      }
      $('together-title').textContent = [item.name, item.episode].filter(Boolean).join(' · ');
      connection = media.connect(video, { url: item.url, mode: item.mode }, {
        mode: item.mode, autoplay: false,
        onReady() {
          if (generation !== mediaVersion) return;
          mediaReady = true; $('together-placeholder').hidden = true; $('retry-media').hidden = true;
          presence('ready'); engine.ready(true); updateControls();
        },
        onError() { if (generation === mediaVersion) playbackError(); }
      });
    } catch (error) { if (generation === mediaVersion && error.name !== 'AbortError') playbackError(); }
  }
  function playbackError() {
    engine.ready(false); mediaReady = false; presence('error'); updateControls();
    placeholder(host() ? 'Esta opção não carregou. Tente novamente ou escolha outra abaixo.' : 'O vídeo não carregou neste aparelho. Tente novamente ou peça outra opção ao líder.');
    $('retry-media').hidden = false;
    if (host() && roomState && !roomState.paused) command('pause', { buffering: true });
  }
  async function enter(value, invite) {
    engine.reset();
    session = value; roomState = null; loadedId = undefined; presenceState = null;
    storeSession(value);
    $('room-entry').hidden = true; $('room').hidden = false; $('host-picker').hidden = !host();
    $('room-role').textContent = host() ? 'VOCÊ COMANDA A SESSÃO' : 'ASSISTINDO COM A SALA';
    $('invite-link').value = invite ? inviteLink(value.roomId, invite) : '';
    if (invite) history.replaceState(null, '', '#' + new URLSearchParams({ room: value.roomId, invite }));
    client.connect(value);
  }
  function leave(notify = true) {
    if (notify) client.leave(); else client.disconnect();
    session = null; roomState = null; loadedId = undefined; mediaVersion++; mediaAbort?.abort(); pickerAbort?.abort();
    engine.connected(false); engine.ready(false); connection?.dispose(); connection = null; mediaReady = false; storeSession(null);
    $('room').hidden = true; $('room-entry').hidden = false; $('together-results').replaceChildren(); $('together-sources').replaceChildren();
    history.replaceState(null, '', location.pathname); updateControls();
    status('Você saiu da sala. Pode criar outra ou entrar com um convite.');
  }
  $('create-room').addEventListener('click', async () => {
    $('create-room').disabled = true;
    try { const value = await client.createRoom($('member-name').value); await enter({ roomId: value.roomId, credential: value.credential, role: value.role }, value.invite); }
    catch (error) { status(error.message); } finally { $('create-room').disabled = false; }
  });
  $('join-form').addEventListener('submit', async event => {
    event.preventDefault(); $('join-room').disabled = true;
    try { const { roomId, invite } = invitation($('room-invite').value); await enter(await client.joinRoom(roomId, invite, $('member-name').value), invite); }
    catch (error) { status(error.message); } finally { $('join-room').disabled = false; }
  });
  $('leave-room').addEventListener('click', () => leave());
  $('copy-invite').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('invite-link').value); status('Convite copiado. Envie para quem vai assistir com você.'); }
    catch { $('invite-link').select(); status('Selecione e copie o link do convite.'); }
  });
  $('room-play').addEventListener('click', () => command(roomState?.paused ? 'play' : 'pause'));
  $('together-seek').addEventListener('change', () => { if (Number.isFinite(video.duration)) command('seek', { position: Number($('together-seek').value) / 1000 * video.duration }); });
  $('room-speed').addEventListener('change', () => command('rate', { rate: Number($('room-speed').value) }));
  $('room-mute').addEventListener('click', () => { video.muted = !video.muted; $('room-mute').textContent = video.muted ? 'Som desligado' : 'Som ligado'; });
  $('enable-playback').addEventListener('click', () => {
    $('enable-playback').hidden = true;
    // Gesture unlock must happen before yielding to network or timers.
    video.play().then(() => { engine.unlock(); if (roomState?.paused) video.pause(); presence('ready'); }).catch(() => { $('enable-playback').hidden = false; });
  });
  $('retry-media').addEventListener('click', () => loadMedia(roomState?.media, true));
  video.addEventListener('ended', () => { if (host()) command('pause', { buffering: true }); });
  video.addEventListener('waiting', () => {
    if (!mediaReady) return;
    presence('loading');
    if (host() && !roomState?.paused) { command('pause', { buffering: true }); $('sync-status').textContent = 'O vídeo está carregando. A sala foi pausada; retome quando estiver pronto.'; }
  });
  video.addEventListener('playing', () => { if (mediaReady) presence('ready'); });
  video.addEventListener('canplay', () => { if (mediaReady) { engine.tick(); presence('ready'); } });
  video.addEventListener('timeupdate', () => {
    $('together-time').textContent = `${time(video.currentTime)} / ${time(video.duration)}`;
    if (document.activeElement !== $('together-seek') && Number.isFinite(video.duration) && video.duration > 0) $('together-seek').value = String(video.currentTime / video.duration * 1000);
  });
  const tmdb = (path, params, signal) => api.requestJSON(api.tmdbURL(path, params, window.DuckFlixTMDB.apiKey), signal);
  let addonsPromise;
  function addons() {
    if (!addonsPromise) addonsPromise = Promise.all(api.FIXED_ADDONS.map(async addon => {
      try { return { ...addon, manifest: api.validateManifest(await api.requestJSON(addon.url)) }; } catch { return null; }
    })).then(list => list.filter(Boolean));
    return addonsPromise;
  }
  function newPicker() { pickerAbort?.abort(); pickerAbort = new AbortController(); return pickerAbort.signal; }
  $('together-search-form').addEventListener('submit', async event => {
    event.preventDefault(); if (!host()) return;
    const signal = newPicker(); selected = null; episodes = [];
    $('together-results').replaceChildren(); $('together-sources').replaceChildren(); $('together-episodes').hidden = true;
    $('picker-status').textContent = 'Buscando títulos…';
    try {
      const data = await tmdb('search/multi', { query: $('together-search').value.trim(), include_adult: false }, signal);
      if (signal.aborted) return;
      const items = api.tmdbItems(data.results || []);
      for (const item of items) {
        const button = node('button', undefined, 'poster-card'); button.type = 'button';
        const poster = node('span', '▶', 'poster');
        if (item.poster) { const img = node('img'); img.src = item.poster; img.alt = ''; img.loading = 'lazy'; poster.replaceChildren(img); }
        button.append(poster, node('strong', item.name), node('small', item.type === 'movie' ? 'Filme' : 'Série'));
        button.addEventListener('click', () => selectTitle(item)); $('together-results').append(button);
      }
      $('picker-status').textContent = items.length ? 'Escolha o título para a sala.' : 'Nenhum título disponível com os filtros atuais.';
    } catch (error) { if (!signal.aborted) $('picker-status').textContent = error.message; }
  });
  async function selectTitle(item) {
    if (!host()) return;
    const signal = newPicker(); selected = null; $('together-sources').replaceChildren(); $('together-episodes').hidden = true;
    $('picker-status').textContent = 'Preparando título…';
    try {
      if (!await safety.allowed(item, { signal })) throw new Error('Título oculto pelo Modo Livre.');
      const identity = await tmdb(`${item.type === 'movie' ? 'movie' : 'tv'}/${item.tmdbId}/external_ids`, {}, signal);
      if (signal.aborted) return;
      selected = { ...item, id: /^tt\d+$/.test(identity.imdb_id) ? identity.imdb_id : item.id };
      if (item.type === 'movie') return findSources(selected.id, signal);
      const data = await api.requestJSON(api.resourceURL(api.CINEMETA, 'meta', 'series', selected.id), signal);
      if (signal.aborted) return;
      episodes = media.orderedEpisodes(data.meta?.videos);
      if (!episodes.length) throw new Error('Não encontramos episódios para esta série.');
      $('together-season').replaceChildren();
      for (const season of new Set(episodes.map(ep => ep.season))) { const option = node('option', `Temporada ${season}`); option.value = String(season); $('together-season').append(option); }
      $('together-season').value = String(episodes[0].season); drawEpisodes(); $('together-episodes').hidden = false;
      $('picker-status').textContent = 'Escolha um episódio.';
    } catch (error) { if (!signal.aborted) $('picker-status').textContent = error.message; }
  }
  function drawEpisodes() {
    $('together-episode').replaceChildren();
    for (const ep of episodes.filter(ep => String(ep.season) === $('together-season').value)) { const option = node('option', `${ep.episode}. ${ep.title || ep.name || 'Episódio'}`); option.value = ep.id; $('together-episode').append(option); }
  }
  $('together-season').addEventListener('change', drawEpisodes);
  $('find-episode').addEventListener('click', () => { if (selected && host()) findSources($('together-episode').value, newPicker()); });
  async function findSources(id, signal) {
    const title = { ...selected }, ep = episodes.find(ep => ep.id === id);
    $('together-sources').replaceChildren(); $('picker-status').textContent = 'Conferindo opções de reprodução…';
    try {
      const providers = await addons();
      const responses = await Promise.all(providers.filter(addon => api.supports(addon.manifest, 'stream', title.type, id)).map(async addon => {
        try { return (await api.requestJSON(api.resourceURL(addon.url, 'stream', title.type, id), signal)).streams || []; } catch { return []; }
      }));
      if (signal.aborted) return;
      const seen = new Set(), candidates = responses.flat().map(media.candidate).filter(source => source && !seen.has(source.url) && seen.add(source.url)).slice(0, 16);
      let cursor = 0, count = 0;
      async function worker() {
        while (cursor < candidates.length && !signal.aborted && count < 4) {
          const source = candidates[cursor++], result = await media.probe(source, { signal });
          if (signal.aborted || !result?.ok) continue;
          const button = node('button', `${source.language} · ${source.quality} · Opção ${++count}`, 'secondary'); button.type = 'button';
          button.addEventListener('click', async () => {
            if (!host() || !online) return;
            button.disabled = true;
            try {
              if (!await safety.allowed(title)) throw new Error('Título oculto pelo Modo Livre.');
              if (signal.aborted || !session) return;
              receive(await client.command({ action: 'media', media: { url: source.url, mode: result.mode, tmdbId: title.tmdbId, type: title.type, name: title.name, episode: ep ? `T${ep.season} · E${ep.episode}` : '' } }));
              status('Vídeo enviado à sala. Aguarde seus amigos carregarem e dê play.');
              $('together-screen').scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (error) { status(error.message); } finally { button.disabled = false; }
          });
          $('together-sources').append(button);
        }
      }
      await Promise.all([worker(), worker()]);
      if (!signal.aborted) $('picker-status').textContent = count ? 'Selecione uma opção. Todos recebem o mesmo vídeo para manter o mesmo corte e duração.' : 'Nenhuma opção carregou imagem. Tente outro título ou episódio.';
    } catch (error) { if (!signal.aborted) $('picker-status').textContent = error.message; }
  }
  window.addEventListener('duckflix:modechange', () => {
    pickerAbort?.abort(); $('together-results').replaceChildren(); $('together-sources').replaceChildren(); $('together-episodes').hidden = true;
    if (roomState?.media) loadMedia(roomState.media, true);
  });
  const syncTimer = setInterval(() => engine.tick(), 500);
  const clockTimer = setInterval(() => { if (session && online) client.calibrate().catch(() => {}); }, 30000);
  window.addEventListener('pagehide', () => { disposed = true; client.disconnect(); mediaAbort?.abort(); pickerAbort?.abort(); engine.destroy(); connection?.dispose(); clearInterval(syncTimer); clearInterval(clockTimer); });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  async function init() {
    $('retry-service').hidden = true;
    if (location.hash) { try { invitation(location.href); $('room-invite').value = location.href; } catch {} }
    try {
      await client.calibrate(); if (disposed) return;
      $('create-room').disabled = false; $('join-room').disabled = false;
      status('Tudo pronto. Crie uma sala ou entre pelo convite.');
      let saved;
      try { saved = JSON.parse(sessionStorage.getItem('duckflix.together.session')); } catch {}
      let link; try { link = invitation(location.href); } catch {}
      if (saved && (!link || link.roomId === saved.roomId)) {
        try { const packet = await client.state(saved); await enter({ ...saved, role: packet.role }, packet.invite || link?.invite); }
        catch { storeSession(null); status('Sua sala anterior expirou. Crie outra ou entre com um convite.'); }
      }
    } catch {
      status(window.DuckTogetherConfig?.serverUrl ? 'Não conseguimos conectar à sala agora. Aguarde um pouco e tente novamente.' : 'O Duck Together está aguardando a ativação do serviço de salas. As outras páginas continuam disponíveis.');
      $('retry-service').hidden = false;
    }
  }
  $('retry-service').addEventListener('click', init);
  init();
})();
