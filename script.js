const apiKey = window.DuckFlixTMDB.apiKey;

/* ========================
   GÊNEROS TMDB COM ÍCONES
======================== */
const generosFilme = {
  28: { nome: "Ação", icon: "💥" },
  12: { nome: "Aventura", icon: "🏕️" },
  16: { nome: "Animação", icon: "🎨" },
  35: { nome: "Comédia", icon: "😂" },
  80: { nome: "Crime", icon: "🕵️" },
  99: { nome: "Documentário", icon: "📜" },
  18: { nome: "Drama", icon: "🎭" },
  10751: { nome: "Família", icon: "👨‍👩‍👧" },
  14: { nome: "Fantasia", icon: "🪄" },
  36: { nome: "História", icon: "🏛️" },
  27: { nome: "Terror", icon: "😱" },
  9648: { nome: "Mistério", icon: "🔍" },
  10749: { nome: "Romance", icon: "💖" },
  878: { nome: "Ficção Científica", icon: "🚀" },
  53: { nome: "Thriller", icon: "🍿" },
  10752: { nome: "Guerra", icon: "⚔️" },
  37: { nome: "Faroeste", icon: "🤠" }
};

const generosSerie = {
  10759: { nome: "Ação & Aventura", icon: "💥" },
  16: { nome: "Animação", icon: "🎨" },
  35: { nome: "Comédia", icon: "😂" },
  80: { nome: "Crime", icon: "🕵️" },
  99: { nome: "Documentário", icon: "📜" },
  18: { nome: "Drama", icon: "🎭" },
  10751: { nome: "Família", icon: "👨‍👩‍👧" },
  10762: { nome: "Infantil", icon: "🎈" },
  9648: { nome: "Mistério", icon: "🔍" },
  10765: { nome: "Ficção Científica", icon: "🚀" },
  10766: { nome: "Novela", icon: "📺" },
  37: { nome: "Faroeste", icon: "🤠" }
};

const listaGenerosChips = [
  { id: "all", nome: "Todos", icon: "🌐" },
  { id: 28, nome: "Ação", icon: "💥" },
  { id: 12, nome: "Aventura", icon: "🏕️" },
  { id: 16, nome: "Animação", icon: "🎨" },
  { id: 35, nome: "Comédia", icon: "😂" },
  { id: 80, nome: "Crime", icon: "🕵️" },
  { id: 18, nome: "Drama", icon: "🎭" },
  { id: 14, nome: "Fantasia", icon: "🪄" },
  { id: 27, nome: "Terror", icon: "😱" },
  { id: 9648, nome: "Mistério", icon: "🔍" },
  { id: 10749, nome: "Romance", icon: "💖" },
  { id: 878, nome: "Ficção Científica", icon: "🚀" },
  { id: 53, nome: "Thriller", icon: "🍿" },
  { id: 99, nome: "Documentário", icon: "📜" }
];

/* ========================
   ESTADO
======================== */
let favs      = JSON.parse(localStorage.getItem("favs"))      || {};
let historico = JSON.parse(localStorage.getItem("historico")) || {};
const safety = window.DuckFlixSafety;
let kidsMode = safety.enabled();

let currentItem   = null;
let currentSeason = 1;
let currentEp     = 1;

// Item sorteado na roleta
let roletaItemSelecionado = null;

/* ========================
   ELEMENTOS
======================== */
const playerArea          = document.getElementById("playerArea");
const player              = document.getElementById("player");
const tituloPlayer        = document.getElementById("tituloPlayer");
const episodeControls     = document.getElementById("episodeControls");
const numTemporada        = document.getElementById("numTemporada");
const numEpisodio         = document.getElementById("numEpisodio");
const seasonSelect        = document.getElementById("seasonSelect");
const homeEpisodeList     = document.getElementById("homeEpisodeList");
const episodeCount        = document.getElementById("episodeCount");
const overlay             = document.getElementById("overlay");
const favPage             = document.getElementById("favPage");
const favList             = document.getElementById("favList");
const searchPage          = document.getElementById("searchPage");
const searchList          = document.getElementById("searchList");
const genrePage           = document.getElementById("genrePage");
const genreList           = document.getElementById("genreList");
const genreTitle          = document.getElementById("genreTitle");
const closeGenre          = document.getElementById("closeGenre");
const genreChipsContainer = document.getElementById("genreChips");
const mainCategories      = document.getElementById("mainCategories");
const btnKids             = document.getElementById("btnKids");
const btnModoLivre        = document.getElementById("btnModoLivre");

/* ========================
   MODO KIDS & FILTRO ADULTO
======================== */
// Classification filtering is shared with search, saved lists and the extensions page.
function isHentaiOuAdultoExtremo(item) { return safety.explicit(item); }

const kidsBanner    = document.getElementById("kidsBanner");
const desativarKids = document.getElementById("desativarKids");

function atualizarBtnKids() {
  safety.updateSwitch();

  if (btnKids) {
    btnKids.textContent = kidsMode ? "Modo Kids: ON" : "Modo Kids: OFF";
    btnKids.classList.toggle("ativo", kidsMode);
  }

  if (kidsBanner) kidsBanner.classList.toggle("hidden", !kidsMode);

  const secAdult = document.getElementById("sec-animacoes-adultas");
  const tabAdult = document.querySelector('.tab-btn[data-target="sec-animacoes-adultas"]');
  if (secAdult) secAdult.style.display = kidsMode ? "none" : "";
  if (tabAdult) tabAdult.style.display = kidsMode ? "none" : "";

  renderGenreChips();
}

if (desativarKids) desativarKids.onclick = () => safety.setEnabled(false);
if (btnKids) btnKids.onclick = () => safety.setEnabled(!safety.enabled());
window.addEventListener('duckflix:modechange', () => {
  kidsMode = safety.enabled();
  const searching = !searchPage.classList.contains('hidden');
  document.getElementById('sugestoes').replaceChildren();
  document.getElementById('sugestoes').classList.add('hidden');
  searchList.replaceChildren(); favList.replaceChildren();
  document.getElementById('historico').replaceChildren();
  fecharPlayer();
  document.getElementById('fecharTrailer').click();
  document.getElementById('modalRoleta').classList.add('hidden');
  roletaItemSelecionado = null;
  atualizarBtnKids();
  renderHistorico(); renderFavs(); recarrregarConteudoHome();
  if (searching) buscar();
  showToast(kidsMode ? 'Modo Livre ativo: +18 e títulos sem classificação ocultos.' : 'Modo Livre desativado');
});

/* ========================
   TOAST
======================== */
function showToast(msg, dur = 2500) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._tmr);
  t._tmr = setTimeout(() => t.classList.remove("show"), dur);
}

/* ========================
   LOGO → HOME
======================== */
document.querySelector(".logo").onclick = () => location.reload();

/* ========================
   VOLTAR AO TOPO
======================== */
const btnTopo = document.getElementById("btnTopo");
window.addEventListener("scroll", () => {
  btnTopo.classList.toggle("visivel", window.scrollY > 300);
});
btnTopo.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });

/* ========================
   OVERLAY
======================== */
overlay.onclick = () => fecharPlayer();

/* ========================
   FAVORITOS
======================== */
function saveFavs() { localStorage.setItem("favs", JSON.stringify(favs)); }
function isFav(id)  { return !!favs[id]; }

function toggleFav(item, btn) {
  if (isFav(item.id)) {
    delete favs[item.id];
    saveFavs();
    atualizarBtnFav(btn, false);
    showToast("Removido da Minha Lista");
  } else {
    favs[item.id] = item;
    saveFavs();
    atualizarBtnFav(btn, true);
    showToast("Salvo na Minha Lista!");
  }
}

function atualizarBtnFav(btn, fav) {
  btn.innerHTML = fav ? "♥" : "♡";
  btn.title = fav ? "Remover da Minha Lista" : "Salvar na Minha Lista";
  fav ? btn.classList.add("favoritado") : btn.classList.remove("favoritado");
}

/* ========================
   HISTÓRICO
======================== */
function saveHistorico() { localStorage.setItem("historico", JSON.stringify(historico)); }

function addHistorico(item) {
  historico[item.id] = { ...item, visto: Date.now() };
  saveHistorico();
  renderHistorico();
}

let historyRender = 0, favoritesRender = 0, homeRender = 0, playerRequest = 0;
async function renderHistorico() {
  const renderId = ++historyRender;
  const sec  = document.getElementById("historicoSection");
  const row  = document.getElementById("historico");
  row.replaceChildren();
  let lista;
  try { lista = await safety.filter(Object.values(historico).sort((a, b) => b.visto - a.visto)); } catch { return; }
  if (renderId !== historyRender) return;

  if (lista.length === 0) {
    sec.classList.add("hidden");
    return;
  }
  sec.classList.remove("hidden");
  row.innerHTML = "";
  lista.forEach(item => {
    const div = document.createElement("div");
    div.classList.add("card", "continuar-card-home");
    const prog = carregarProgresso(item.id);
    const sub = item.type === "serie"
      ? `T${prog.season || 1} · E${prog.episode || 1}`
      : "Filme";
    div.innerHTML = `
      <div class="continuar-poster-wrap">
        <img src="https://image.tmdb.org/t/p/w300${item.poster}" alt="${item.title}">
        <span class="continuar-play-badge">▶</span>
        <button class="continuar-remove-btn" title="Remover do histórico" aria-label="Remover">✕</button>
        <div class="progress-bar-track"><div class="progress-bar-fill"></div></div>
      </div>
      <div class="continuar-info-home">
        <strong>${item.title}</strong>
        <small>${sub}</small>
      </div>
    `;
    div.onclick = () => {
      fecharTodasSecoes();
      abrirPlayer(item);
    };
    const remBtn = div.querySelector(".continuar-remove-btn");
    if (remBtn) {
      remBtn.onclick = (e) => {
        e.stopPropagation();
        delete historico[item.id];
        saveHistorico();
        renderHistorico();
        showToast("Removido do histórico");
      };
    }
    row.appendChild(div);
  });
}

document.getElementById("limparHistorico").onclick = () => {
  historico = {};
  saveHistorico();
  renderHistorico();
  showToast("Histórico limpo");
};

/* ========================
   PROGRESSO DE SÉRIES
======================== */
function salvarProgresso(id, season, episode) {
  const p = JSON.parse(localStorage.getItem("progresso")) || {};
  p[id] = { season, episode };
  localStorage.setItem("progresso", JSON.stringify(p));
}
function carregarProgresso(id) {
  const p = JSON.parse(localStorage.getItem("progresso")) || {};
  return p[id] || { season: 1, episode: 1 };
}



/* ========================
   CACHE E DETALHES DAS SÉRIES
======================== */
const seriesCache = {};

async function carregarDetalhesSerie(serieId) {
  if (seriesCache[serieId]) return seriesCache[serieId];
  try {
    const res = await safety.fetch(`https://api.themoviedb.org/3/tv/${serieId}?api_key=${apiKey}&language=pt-BR`);
    const data = await res.json();
    seriesCache[serieId] = data;
    return data;
  } catch (e) {
    return null;
  }
}

/* ========================
   ABRIR PLAYER
======================== */
async function abrirPlayer(item) {
  const request = ++playerRequest, epoch = safety.revision();
  try { if (!await safety.allowed(item)) { showToast('Título indisponível com o filtro atual.'); return; } } catch { return; }
  if (request !== playerRequest || epoch !== safety.revision()) return;
  currentItem = item;
  const ehSerie = item.type === "serie";

  if (ehSerie) {
    const prog    = carregarProgresso(item.id);
    currentSeason = prog.season;
    currentEp     = prog.episode;
    episodeControls.classList.remove("hidden");
    
    // Valida com dados reais da série do TMDB
    const detalhes = await carregarDetalhesSerie(item.id);
    if (detalhes) {
      const maxSeasons = detalhes.number_of_seasons || 1;
      if (currentSeason > maxSeasons) currentSeason = maxSeasons;

      const sInfo = (detalhes.seasons || []).find(s => s.season_number === currentSeason);
      const maxEps = sInfo ? sInfo.episode_count : 24;
      if (currentEp > maxEps) currentEp = maxEps;
    }
    atualizarEpInfo();
  } else {
    episodeControls.classList.add("hidden");
  }

  if (request !== playerRequest || epoch !== safety.revision()) return;
  tituloPlayer.innerText = item.title;
  playerArea.classList.remove("hidden");
  overlay.classList.remove("hidden");
  carregarPlayer();
  addHistorico(item);

  setTimeout(() => playerArea.scrollIntoView({ behavior: "smooth" }), 100);
}

/* ========================
   FECHAR PLAYER
======================== */
function fecharPlayer() {
  playerRequest++;
  playerArea.classList.add("hidden");
  episodeControls.classList.add("hidden");
  player.innerHTML = "";
  overlay.classList.add("hidden");
  currentItem = null;
}
document.getElementById("fecharPlayer").onclick = fecharPlayer;

/* ========================
   FECHAR TUDO
======================== */
function fecharTodasSecoes() {
  fecharPlayer();
  homeSearch.reset();
  favPage.classList.add("hidden");
  searchPage.classList.add("hidden");
  if (genrePage) genrePage.classList.add("hidden");
}

/* ========================
   CARREGAR PLAYER (normal, sem autoplay)
   Usado ao abrir manualmente um item
   ou navegar entre episódios via botões
======================== */
/* ========================
   CARREGAR PLAYER (sem autoplay)
======================== */
function carregarPlayer() {
  if (!currentItem) return;
  const url = currentItem.type === "filme"
    ? `https://myembed.biz/filme/${currentItem.id}`
    : `https://myembed.biz/serie/${currentItem.id}/${currentSeason}/${currentEp}`;

  player.replaceChildren();
  const loading = document.createElement("div");
  loading.className = "home-player-loading";
  loading.setAttribute("role", "status");
  loading.innerHTML = '<span class="home-player-spinner" aria-hidden="true"></span><strong>Preparando reprodução…</strong><small>O tempo depende da fonte selecionada.</small>';
  const frame = document.createElement("iframe");
  frame.src = url;
  frame.title = currentItem.type === "filme"
    ? `Player de ${currentItem.title}`
    : `Player de ${currentItem.title}, temporada ${currentSeason}, episódio ${currentEp}`;
  frame.allowFullscreen = true;
  frame.loading = "eager";
  frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
  frame.addEventListener("load", () => loading.classList.add("is-ready"), { once: true });
  player.append(loading, frame);
}

async function atualizarEpInfo() {
  numTemporada.textContent = currentSeason;
  numEpisodio.textContent  = currentEp;

  if (!currentItem || currentItem.type !== "serie") return;
  const itemId = currentItem.id;
  const detalhes = await carregarDetalhesSerie(itemId);
  if (!currentItem || currentItem.id !== itemId || !detalhes) return;

  const seasons = (detalhes.seasons || [])
    .filter(s => Number(s.season_number) > 0 && Number(s.episode_count) > 0)
    .sort((a, b) => Number(a.season_number) - Number(b.season_number));
  let selectedSeason = seasons.find(s => Number(s.season_number) === currentSeason);
  if (!selectedSeason && seasons.length) {
    selectedSeason = seasons[0];
    currentSeason = Number(selectedSeason.season_number);
    currentEp = 1;
    numTemporada.textContent = currentSeason;
  }
  const maxEps = Number(selectedSeason?.episode_count) || 1;
  currentEp = Math.max(1, Math.min(currentEp, maxEps));
  numEpisodio.textContent = currentEp;

  seasonSelect.replaceChildren();
  for (const season of seasons) {
    const option = document.createElement("option");
    option.value = String(season.season_number);
    option.textContent = `Temporada ${season.season_number}`;
    seasonSelect.append(option);
  }
  seasonSelect.value = String(currentSeason);
  episodeCount.textContent = `${maxEps} ${maxEps === 1 ? "episódio" : "episódios"}`;
  homeEpisodeList.replaceChildren();
  for (let episode = 1; episode <= maxEps; episode++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "episode-card";
    button.setAttribute("aria-current", String(episode === currentEp));
    button.innerHTML = `<span>${String(episode).padStart(2, "0")}</span><div><strong>Episódio ${episode}</strong><small>Temporada ${currentSeason} · Episódio ${episode}</small></div>`;
    button.addEventListener("click", () => selecionarEpisodio(currentSeason, episode));
    homeEpisodeList.append(button);
  }
  document.getElementById("btnEpMenos").disabled = currentSeason === Number(seasons[0]?.season_number || 1) && currentEp === 1;
  const lastSeason = seasons[seasons.length - 1];
  document.getElementById("btnEpMais").disabled = currentSeason === Number(lastSeason?.season_number || currentSeason) && currentEp >= maxEps;
  homeEpisodeList.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
}

async function selecionarEpisodio(season, episode) {
  if (!currentItem || currentItem.type !== "serie") return;
  const itemId = currentItem.id;
  const detalhes = await carregarDetalhesSerie(itemId);
  if (!currentItem || currentItem.id !== itemId) return;
  const seasons = (detalhes?.seasons || []).filter(s => Number(s.season_number) > 0 && Number(s.episode_count) > 0);
  const selectedSeason = seasons.find(s => Number(s.season_number) === Number(season));
  if (!selectedSeason) return;
  currentSeason = Number(selectedSeason.season_number);
  currentEp = Math.max(1, Math.min(Number(episode) || 1, Number(selectedSeason.episode_count) || 1));
  salvarProgresso(currentItem.id, currentSeason, currentEp);
  await atualizarEpInfo();
  carregarPlayer();
  showToast(`Temporada ${currentSeason} — Episódio ${currentEp}`);
}

/* ========================
   BOTÕES EPISÓDIO COM VALIDAÇÃO DE LIMITES REAIS
======================== */
document.getElementById("btnEpMais").onclick = async () => {
  if (!currentItem || currentItem.type !== "serie") return;
  const detalhes = await carregarDetalhesSerie(currentItem.id);
  const seasons = (detalhes?.seasons || []).filter(s => Number(s.season_number) > 0 && Number(s.episode_count) > 0);
  const position = seasons.findIndex(s => Number(s.season_number) === currentSeason);
  const maxEps = Number(seasons[position]?.episode_count) || 1;
  if (currentEp < maxEps) return selecionarEpisodio(currentSeason, currentEp + 1);
  if (position >= 0 && position + 1 < seasons.length) return selecionarEpisodio(Number(seasons[position + 1].season_number), 1);
  showToast(`Você já está no último episódio da série! (T${currentSeason} E${currentEp})`);
};

document.getElementById("btnEpMenos").onclick = async () => {
  if (!currentItem || currentItem.type !== "serie") return;
  const detalhes = await carregarDetalhesSerie(currentItem.id);
  const seasons = (detalhes?.seasons || []).filter(s => Number(s.season_number) > 0 && Number(s.episode_count) > 0);
  const position = seasons.findIndex(s => Number(s.season_number) === currentSeason);
  if (currentEp > 1) return selecionarEpisodio(currentSeason, currentEp - 1);
  if (position > 0) {
    const previous = seasons[position - 1];
    return selecionarEpisodio(Number(previous.season_number), Number(previous.episode_count) || 1);
  }
  showToast("Este é o primeiro episódio da série!");
};

seasonSelect.addEventListener("change", () => selecionarEpisodio(Number(seasonSelect.value), 1));

/* ========================
   TRAILER
======================== */
document.getElementById("btnTrailer").onclick = () => {
  if (!currentItem) return;
  const tipo = currentItem.type === "filme" ? "movie" : "tv";

  safety.fetch(`https://api.themoviedb.org/3/${tipo}/${currentItem.id}/videos?api_key=${apiKey}&language=pt-BR`)
    .then(r => r.json())
    .then(d => {
      let trailer = d.results?.find(v => v.type === "Trailer" && v.site === "YouTube");
      if (!trailer) {
        return safety.fetch(`https://api.themoviedb.org/3/${tipo}/${currentItem.id}/videos?api_key=${apiKey}`)
          .then(r => r.json())
          .then(d2 => {
            trailer = d2.results?.find(v => v.type === "Trailer" && v.site === "YouTube");
            if (trailer) abrirTrailer(trailer.key, currentItem.title);
            else showToast("Trailer não encontrado");
          });
      }
      abrirTrailer(trailer.key, currentItem.title);
    })
    .catch(() => showToast("Erro ao buscar trailer"));
};

function abrirTrailer(key, titulo) {
  document.getElementById("trailerTitulo").textContent = `Trailer — ${titulo}`;
  document.getElementById("trailerFrame").src = `https://www.youtube.com/embed/${key}?autoplay=1`;
  document.getElementById("modalTrailer").classList.remove("hidden");
}

document.getElementById("fecharTrailer").onclick = () => {
  document.getElementById("modalTrailer").classList.add("hidden");
  document.getElementById("trailerFrame").src = "";
};

/* ========================
   FAVORITOS — página
======================== */
async function renderFavs() {
  const renderId = ++favoritesRender;
  favList.innerHTML = "";
  let lista;
  try { lista = await safety.filter(Object.values(favs)); } catch { return; }
  if (renderId !== favoritesRender) return;
  if (lista.length === 0) {
    favList.innerHTML = `<p style="color:#aaa;padding:24px;text-align:center;width:100%;">Sua lista está vazia. Adicione filmes e séries clicando no coração dos títulos.</p>`;
    return;
  }
  lista.forEach(f => {
    const card = document.createElement("button");
    card.className = "poster-card card";
    card.type = "button";
    card.setAttribute("aria-label", `Assistir ${f.title}`);
    const tipoLabel = f.type === "filme" ? "Filme" : "Série";
    card.innerHTML = `
      <span class="poster">
        <img src="https://image.tmdb.org/t/p/w300${f.poster}" alt="${f.title}" loading="lazy">
        <button type="button" class="poster-fav-btn fav-btn favoritado is-fav" title="Remover da Minha Lista">♥</button>
      </span>
      <strong>${f.title}</strong>
      <small>${tipoLabel}</small>
    `;
    card.onclick = () => { fecharTodasSecoes(); abrirPlayer(f); };
    card.querySelector(".fav-btn").onclick = (e) => {
      e.stopPropagation();
      delete favs[f.id];
      saveFavs();
      showToast("Removido da Minha Lista");
      renderFavs();
    };
    favList.appendChild(card);
  });
}

const btnFavEl = document.getElementById("btnFav");
if (btnFavEl) {
  btnFavEl.onclick = () => {
    fecharTodasSecoes();
    favPage.classList.remove("hidden");
    renderFavs();
  };
}
const closeFavEl = document.getElementById("closeFav");
if (closeFavEl) closeFavEl.onclick = () => favPage.classList.add("hidden");

/* ========================
   BUSCA COM RESULTADOS E PAGINAÇÃO
======================== */
const homeMain = document.querySelector('.home-main');
const homeSearch = window.DuckFlixSearch.create({
  input: document.getElementById('busca'), button: document.getElementById('btnBusca'),
  more: document.getElementById('searchMore'), status: document.getElementById('searchStatus'), list: searchList,
  fetchPage: async (query, page, signal) => {
    const response = await safety.fetch('https://api.themoviedb.org/3/search/multi?' + new URLSearchParams({ api_key: apiKey, language: 'pt-BR', include_adult: 'false', query, page }), { signal });
    if (!response.ok) throw new Error('Search HTTP ' + response.status);
    return response.json();
  },
  render: item => criarCard(searchList, item, item.media_type === 'tv' ? 'serie' : 'filme'),
  open: () => {
    document.getElementById('sugestoes').classList.add('hidden');
    favPage.classList.add('hidden');
    if (genrePage) genrePage.classList.add('hidden');
    homeMain.classList.add('hidden'); searchPage.classList.remove('hidden');
  },
  close: () => { searchPage.classList.add('hidden'); homeMain.classList.remove('hidden'); }
});
function buscar() { return homeSearch.search(); }
document.getElementById('closeSearch').onclick = () => { document.getElementById('busca').value = ''; homeSearch.reset(); };

/* ========================
   CRIAR CARD
======================== */
function criarCard(container, item, tipoForcado = null) {
  if (!container || !item || !item.poster_path) return;

  // BANIMENTO GLOBAL ABSOLUTO DE HENTAI E CONTEÚDO EXPLÍCITO (Nunca aparece no site!)
  if (isHentaiOuAdultoExtremo(item)) {
    return;
  }


  const card = document.createElement("button");
  card.className = "poster-card card";
  card.type = "button";

  const type = tipoForcado || (item.title ? "filme" : "serie");
  const title = item.title || item.name;
  card.setAttribute("aria-label", `Assistir ${title}`);

  const favoritado = isFav(item.id);
  const nota = Number.isFinite(item.vote_average) ? item.vote_average.toFixed(1) : "";
  const ano = (item.release_date || item.first_air_date || "").slice(0, 4);
  const tipoLabel = type === "filme" ? "Filme" : (item.genre_ids?.includes(16) && item.original_language === 'ja' ? "Anime" : "Série");
  const subInfo = [tipoLabel, ano].filter(Boolean).join(" · ");

  const escapeMarkup = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  card.innerHTML = `
    <span class="poster">
      ${nota ? `<span class="badge-nota">${nota}</span>` : ""}
      <img src="https://image.tmdb.org/t/p/w300${escapeMarkup(item.poster_path)}" alt="${escapeMarkup(title)}" loading="lazy">
      <button type="button" class="poster-fav-btn fav-btn ${favoritado ? "favoritado is-fav" : ""}" title="${favoritado ? "Remover da Minha Lista" : "Salvar na Minha Lista"}">
        ${favoritado ? "♥" : "♡"}
      </button>
    </span>
    <strong>${escapeMarkup(title)}</strong>
    <small>${escapeMarkup(subInfo)}</small>
  `;

  const favBtn = card.querySelector(".fav-btn");
  card.onclick = () => {
    fecharTodasSecoes();
    abrirPlayer({ id: item.id, title, type, poster: item.poster_path });
  };
  favBtn.onclick = (e) => {
    e.stopPropagation();
    toggleFav({ id: item.id, title, poster: item.poster_path, type }, favBtn);
  };

  container.appendChild(card);
}

/* ========================
   SISTEMA DE FILTRO DE GÊNEROS & ABAS
======================== */
function renderGenreChips() {
  if (!genreChipsContainer) return;
  genreChipsContainer.innerHTML = "";
  listaGenerosChips.forEach(g => {

    const btn = document.createElement("button");
    btn.className = `chip ${g.id === "all" ? "active" : ""}`;
    btn.dataset.genreId = g.id;
    btn.innerHTML = `${g.icon} ${g.nome}`;
    btn.onclick = () => {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      if (g.id === "all") {
        limparFiltroGenero();
      } else {
        filtrarPorGenero(g.id, g.nome, g.icon);
      }
    };
    genreChipsContainer.appendChild(btn);
  });
}

async function filtrarPorGenero(genreId, genreNome, genreIcon = "🏷️") {
  fecharTodasSecoes();
  
  // Atualizar visual do chip ativo
  document.querySelectorAll(".chip").forEach(c => {
    c.classList.toggle("active", c.dataset.genreId == genreId);
  });

  genreTitle.innerHTML = `${genreIcon} Filmes e Séries — ${genreNome}`;
  const countBadge = document.getElementById("genreCountBadge");
  if (countBadge) countBadge.textContent = "Buscando...";
  genreList.innerHTML = `<div class="roleta-loading"><div class="roleta-spinner-icon"></div><span>Carregando títulos de ${genreNome}...</span></div>`;
  
  genrePage.classList.remove("hidden");
  if (mainCategories) mainCategories.classList.add("hidden");

  try {
    const kidsQuery = "";
    const [resFilmes, resSeries] = await Promise.all([
      safety.fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=pt-BR&sort_by=popularity.desc&with_genres=${genreId}${kidsQuery}`).then(r => r.json()),
      safety.fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=pt-BR&sort_by=popularity.desc&with_genres=${genreId}${kidsQuery}`).then(r => r.json())
    ]);

    const filmes = (resFilmes.results || []).filter(i => i.poster_path).slice(0, 14);
    const series = (resSeries.results || []).filter(i => i.poster_path).slice(0, 14);

    const todosResultados = [...filmes.map(f => ({ ...f, _tipo: "filme" })), ...series.map(s => ({ ...s, _tipo: "serie" }))];

    genreList.innerHTML = "";
    if (todosResultados.length === 0) {
      if (countBadge) countBadge.textContent = "0 títulos";
      genreList.innerHTML = `<p style="color:#aaa;padding:20px;">Nenhum título encontrado para o gênero <strong>${genreNome}</strong>.</p>`;
      return;
    }

    todosResultados.forEach(item => {
      criarCard(genreList, item, item._tipo);
    });

    const totalExibidos = genreList.children.length;
    if (countBadge) countBadge.textContent = `${totalExibidos} títulos`;

    setTimeout(() => {
      const yOffset = -90; 
      const y = genrePage.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }, 60);

  } catch (e) {
    if (countBadge) countBadge.textContent = "Erro";
    genreList.innerHTML = `<p style="color:#e74c3c;padding:20px;">Erro ao carregar gênero.</p>`;
  }
}

function limparFiltroGenero() {
  if (genrePage) genrePage.classList.add("hidden");
  if (mainCategories) mainCategories.classList.remove("hidden");
  document.querySelectorAll(".chip").forEach(c => {
    c.classList.toggle("active", c.dataset.genreId === "all");
  });
  document.querySelectorAll(".tab-btn").forEach(t => {
    t.classList.toggle("active", t.dataset.target === "all");
  });
}

if (closeGenre) closeGenre.onclick = limparFiltroGenero;

/* ========================
   ABAS DE NAVEGAÇÃO
======================== */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.target;
    document.getElementById("busca").value = "";
    homeSearch.reset();

    limparFiltroGenero();
    document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.toggle('active', tab === btn));
    favPage.classList.add('hidden');
    searchPage.classList.add('hidden');

    if (target === "all") {
      document.querySelectorAll(".cat-section").forEach(sec => sec.classList.remove("hidden"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (target === "sec-fav") {
      fecharTodasSecoes();
      favPage.classList.remove("hidden");
      renderFavs();
    } else {
      document.querySelectorAll(".cat-section").forEach(sec => {
        if (sec.id === target) {
          sec.classList.remove("hidden");
          setTimeout(() => sec.scrollIntoView({ behavior: "smooth" }), 50);
        } else {
          sec.classList.add("hidden");
        }
      });
    }
  };
});

/* ========================
   SCROLL CARROSSÉIS
======================== */
function rolarDireita(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const max = el.scrollWidth - el.clientWidth;
  el.scrollLeft >= max - 10
    ? el.scrollTo({ left: 0, behavior: "smooth" })
    : el.scrollBy({ left: 300, behavior: "smooth" });
}
function rolarEsquerda(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollLeft <= 0
    ? el.scrollTo({ left: el.scrollWidth, behavior: "smooth" })
    : el.scrollBy({ left: -300, behavior: "smooth" });
}

// Vincula botões de scroll via JS (sem onclick inline no HTML)
const scrollMap = {
  scrollEsqHistorico:   () => rolarEsquerda("historico"),
  scrollDirHistorico:   () => rolarDireita("historico"),
  scrollEsqFilmes:      () => rolarEsquerda("filmes"),
  scrollDirFilmes:      () => rolarDireita("filmes"),
  scrollEsqSeries:      () => rolarEsquerda("series"),
  scrollDirSeries:      () => rolarDireita("series"),
  scrollEsqAnimes:      () => rolarEsquerda("animes"),
  scrollDirAnimes:      () => rolarDireita("animes"),
  scrollEsqDesenhos:    () => rolarEsquerda("desenhos"),
  scrollDirDesenhos:    () => rolarDireita("desenhos"),
  scrollEsqAnimAdultas: () => rolarEsquerda("animacoesAdultas"),
  scrollDirAnimAdultas: () => rolarDireita("animacoesAdultas"),
};
Object.entries(scrollMap).forEach(([id, fn]) => {
  const el = document.getElementById(id);
  if (el) el.onclick = fn;
});

/* ========================
   ROLETA — busca múltiplas
   páginas aleatórias da API
======================== */
const modalRoleta = document.getElementById("modalRoleta");

document.getElementById("btnRoleta").onclick = () => {
  modalRoleta.classList.remove("hidden");
  document.getElementById("roletaDisplay").classList.add("hidden");
  document.getElementById("btnAssistirRoleta").classList.add("hidden");
  document.getElementById("btnSortearNovamente").classList.add("hidden");
  document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("selecionado"));
  roletaItemSelecionado = null;
};

document.getElementById("fecharRoleta").onclick = () => {
  modalRoleta.classList.add("hidden");
};

document.querySelectorAll(".cat-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("selecionado"));
    btn.classList.add("selecionado");
    sortear(btn.dataset.cat);
  };
});

// Busca 5 páginas aleatórias em paralelo → ~100 títulos por sorteio
async function buscarPaginasAleatorias(endpoint, totalPaginas = 5) {
  const paginas = new Set();
  while (paginas.size < totalPaginas) {
    paginas.add(Math.floor(Math.random() * 10) + 1);
  }

  const resultados = await Promise.all(
    [...paginas].map(pg =>
      safety.fetch(`${endpoint}&page=${pg}`)
        .then(r => r.json())
        .then(d => d.results || [])
        .catch(() => [])
    )
  );

  return resultados.flat().filter(i => i.poster_path);
}

async function sortear(cat) {
  const epoch = safety.revision();
  const endpoints = {
    filmes:   `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=pt-BR`,
    series:   `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&sort_by=popularity.desc&without_genres=16&language=pt-BR`,
    animes:   `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=16&with_original_language=ja&language=pt-BR`
  };
  const tipos = { filmes: "filme", series: "serie", animes: "serie" };

  const display = document.getElementById("roletaDisplay");
  const img     = document.getElementById("roletaImg");
  const titulo  = document.getElementById("roletaTitulo");
  const nota    = document.getElementById("roletaNota");
  const btnAss  = document.getElementById("btnAssistirRoleta");
  const btnNov  = document.getElementById("btnSortearNovamente");

  // Mostra loading
  display.classList.remove("hidden");
  btnAss.classList.add("hidden");
  btnNov.classList.add("hidden");
  img.src = "";
  img.style.display = "none";
  titulo.textContent = "";
  nota.textContent   = "";

  // Spinner de loading na roleta
  const loadDiv = document.createElement("div");
  loadDiv.className = "roleta-loading";
  loadDiv.id = "roletaLoadingDiv";
  loadDiv.innerHTML = `<div class="roleta-spinner-icon"></div><span>Buscando títulos...</span>`;
  display.insertBefore(loadDiv, document.getElementById("roletaSpinner"));

  const lista = await buscarPaginasAleatorias(endpoints[cat] || endpoints.filmes, 5);

  if (epoch !== safety.revision()) return;
  // Remove loading
  const ld = document.getElementById("roletaLoadingDiv");
  if (ld) ld.remove();
  img.style.display = "";

  if (!lista || lista.length === 0) {
    titulo.textContent = "Nenhum título encontrado";
    showToast("Não foi possível carregar títulos");
    return;
  }

  // Animação de roleta
  img.classList.add("girando");
  let loops = 0;
  const spin = setInterval(() => {
    if (epoch !== safety.revision()) { clearInterval(spin); return; }
    const rand = lista[Math.floor(Math.random() * lista.length)];
    img.src = `https://image.tmdb.org/t/p/w300${rand.poster_path}`;
    titulo.textContent = rand.title || rand.name;
    loops++;

    if (loops >= 16) {
      clearInterval(spin);
      img.classList.remove("girando");

      const escolhido = lista[Math.floor(Math.random() * lista.length)];
      img.src = `https://image.tmdb.org/t/p/w300${escolhido.poster_path}`;
      titulo.textContent = escolhido.title || escolhido.name;
      nota.textContent   = escolhido.vote_average
        ? `${escolhido.vote_average.toFixed(1)}`
        : "";

      roletaItemSelecionado = {
        id:     escolhido.id,
        title:  escolhido.title || escolhido.name,
        type:   tipos[cat] || "filme",
        poster: escolhido.poster_path
      };

      btnAss.classList.remove("hidden");
      btnNov.classList.remove("hidden");
    }
  }, 120);
}

document.getElementById("btnAssistirRoleta").onclick = () => {
  if (!roletaItemSelecionado) return;
  modalRoleta.classList.add("hidden");
  fecharTodasSecoes();
  abrirPlayer(roletaItemSelecionado);
};

document.getElementById("btnSortearNovamente").onclick = () => {
  const selecionado = document.querySelector(".cat-btn.selecionado");
  if (selecionado) sortear(selecionado.dataset.cat);
};

/* ========================
   CARREGAR CONTEÚDO INICIAL (42 TÍTULOS)
======================== */
async function buscar42Titulos(urlBuilder) {
  try {
    const pages = [1, 2, 3, 4];
    const results = await Promise.all(
      pages.map(pg => safety.fetch(urlBuilder(pg)).then(r => r.json()).catch(() => ({ results: [] })))
    );
    const todos = results.flatMap(p => p.results || []);
    const vistos = new Set();
    const lista42 = [];
    for (const item of todos) {
      if (item && item.id && item.poster_path && !vistos.has(item.id)) {
        if (isHentaiOuAdultoExtremo(item)) continue;
        vistos.add(item.id);
        lista42.push(item);
        if (lista42.length === 42) break;
      }
    }
    return lista42;
  } catch (e) {
    return [];
  }
}

function recarrregarConteudoHome() {
  const renderId = ++homeRender;
  const ids = ["filmes", "series", "animes"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  const semAdultoParam = "";

  // 42 Filmes Populares
  buscar42Titulos(pg => `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=pt-BR&page=${pg}`)
    .then(filmes => {
      if (renderId !== homeRender) return;
      const container = document.getElementById("filmes");
      if (container) filmes.forEach(m => criarCard(container, m, "filme"));
    })
    .catch(() => showToast("Erro ao carregar filmes"));

  // 42 Séries Live-Action (Sem animação)
  buscar42Titulos(pg => `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&sort_by=popularity.desc&without_genres=16${semAdultoParam}&language=pt-BR&page=${pg}`)
    .then(series => {
      if (renderId !== homeRender) return;
      const container = document.getElementById("series");
      if (container) series.forEach(s => criarCard(container, s, "serie"));
    })
    .catch(() => showToast("Erro ao carregar séries"));

  // 42 Animes Japoneses
  buscar42Titulos(pg => `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=16&with_original_language=ja&without_genres=10762,10751,10749${semAdultoParam}&vote_count.gte=30&sort_by=popularity.desc&language=pt-BR&page=${pg}`)
    .then(animes => {
      if (renderId !== homeRender) return;
      const container = document.getElementById("animes");
      if (container) animes.forEach(a => criarCard(container, a, "serie"));
    })
    .catch(() => showToast("Erro ao carregar animes"));
}

/* ========================
   INIT
======================== */
renderHistorico();
renderGenreChips();
recarrregarConteudoHome();
atualizarBtnKids();
