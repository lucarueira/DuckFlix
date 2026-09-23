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
  clearTimeout(debounceTimer);
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

  player.innerHTML = `
    <iframe src="${url}" allowfullscreen loading="lazy"
      allow="fullscreen; picture-in-picture"></iframe>
  `;
}

async function atualizarEpInfo() {
  numTemporada.textContent = currentSeason;
  numEpisodio.textContent  = currentEp;

  const inputTemp   = document.getElementById("inputTemp");
  const inputEp     = document.getElementById("inputEp");
  const totalTempEl = document.getElementById("totalTemporadas");
  const totalEpEl   = document.getElementById("totalEpisodios");

  if (inputTemp) inputTemp.value = currentSeason;
  if (inputEp)   inputEp.value   = currentEp;

  if (currentItem && currentItem.type === "serie") {
    const detalhes = await carregarDetalhesSerie(currentItem.id);
    if (detalhes) {
      const maxSeasons = detalhes.number_of_seasons || 1;
      const sInfo = (detalhes.seasons || []).find(s => s.season_number === currentSeason);
      const maxEps = sInfo ? sInfo.episode_count : 24;

      if (totalTempEl) totalTempEl.textContent = `(de ${maxSeasons})`;
      if (totalEpEl)   totalEpEl.textContent   = `(de ${maxEps})`;

      if (inputTemp) {
        inputTemp.max = maxSeasons;
        inputTemp.min = 1;
      }
      if (inputEp) {
        inputEp.max = maxEps;
        inputEp.min = 1;
      }
    }
  } else {
    if (totalTempEl) totalTempEl.textContent = "";
    if (totalEpEl)   totalEpEl.textContent   = "";
  }
}

// Limita digitação manual dos inputs em tempo real
const inputTempEl = document.getElementById("inputTemp");
const inputEpEl   = document.getElementById("inputEp");

if (inputTempEl) {
  inputTempEl.addEventListener("input", () => {
    const max = parseInt(inputTempEl.max) || 99;
    if (parseInt(inputTempEl.value) > max) inputTempEl.value = max;
    if (parseInt(inputTempEl.value) < 1) inputTempEl.value = 1;
  });
}
if (inputEpEl) {
  inputEpEl.addEventListener("input", () => {
    const max = parseInt(inputEpEl.max) || 99;
    if (parseInt(inputEpEl.value) > max) inputEpEl.value = max;
    if (parseInt(inputEpEl.value) < 1) inputEpEl.value = 1;
  });
}

/* ========================
   BOTÕES EPISÓDIO COM VALIDAÇÃO DE LIMITES REAIS
======================== */
document.getElementById("btnEpMais").onclick = async () => {
  if (!currentItem || currentItem.type !== "serie") return;
  const detalhes = await carregarDetalhesSerie(currentItem.id);
  const maxSeasons = detalhes ? (detalhes.number_of_seasons || 1) : 99;
  const sInfo = detalhes ? (detalhes.seasons || []).find(s => s.season_number === currentSeason) : null;
  const maxEps = sInfo ? sInfo.episode_count : 99;

  if (currentEp < maxEps) {
    currentEp++;
    atualizarEpInfo();
    carregarPlayer();
    salvarProgresso(currentItem.id, currentSeason, currentEp);
    showToast(`Episódio ${currentEp} — Temporada ${currentSeason}`);
  } else if (currentSeason < maxSeasons) {
    currentSeason++;
    currentEp = 1;
    atualizarEpInfo();
    carregarPlayer();
    salvarProgresso(currentItem.id, currentSeason, currentEp);
    showToast(`Avançando para a Temporada ${currentSeason}`);
  } else {
    showToast(`Você já está no último episódio da série! (T${currentSeason} E${currentEp})`);
  }
};

document.getElementById("btnEpMenos").onclick = async () => {
  if (!currentItem || currentItem.type !== "serie") return;
  if (currentEp > 1) {
    currentEp--;
    atualizarEpInfo();
    carregarPlayer();
    salvarProgresso(currentItem.id, currentSeason, currentEp);
    showToast(`Episódio ${currentEp} — Temporada ${currentSeason}`);
  } else if (currentSeason > 1) {
    currentSeason--;
    const detalhes = await carregarDetalhesSerie(currentItem.id);
    const sInfo = detalhes ? (detalhes.seasons || []).find(s => s.season_number === currentSeason) : null;
    currentEp = sInfo ? sInfo.episode_count : 1;
    atualizarEpInfo();
    carregarPlayer();
    salvarProgresso(currentItem.id, currentSeason, currentEp);
    showToast(`Voltando para a Temporada ${currentSeason}`);
  } else {
    showToast("Este é o primeiro episódio da série!");
  }
};

document.getElementById("btnTemporadaMais").onclick = async () => {
  if (!currentItem || currentItem.type !== "serie") return;
  const detalhes = await carregarDetalhesSerie(currentItem.id);
  const maxSeasons = detalhes ? (detalhes.number_of_seasons || 1) : 99;

  if (currentSeason < maxSeasons) {
    currentSeason++;
    currentEp = 1;
    atualizarEpInfo();
    carregarPlayer();
    salvarProgresso(currentItem.id, currentSeason, currentEp);
    showToast(`Temporada ${currentSeason}`);
  } else {
    showToast(`A série tem no máximo ${maxSeasons} temporada(s)!`);
  }
};

document.getElementById("btnTemporadaMenos").onclick = () => {
  if (!currentItem || currentItem.type !== "serie") return;
  if (currentSeason > 1) {
    currentSeason--;
    currentEp = 1;
    atualizarEpInfo();
    carregarPlayer();
    salvarProgresso(currentItem.id, currentSeason, currentEp);
    showToast(`Temporada ${currentSeason}`);
  } else {
    showToast("Primeira temporada!");
  }
};

document.getElementById("btnGoTo").onclick = async () => {
  if (!currentItem || currentItem.type !== "serie") return;
  let t = parseInt(document.getElementById("inputTemp").value) || 1;
  let e = parseInt(document.getElementById("inputEp").value)   || 1;

  const detalhes = await carregarDetalhesSerie(currentItem.id);
  if (detalhes) {
    const maxSeasons = detalhes.number_of_seasons || 1;
    if (t > maxSeasons) {
      t = maxSeasons;
      showToast(`Temporada ajustada para o máximo (${maxSeasons})`);
    }
    if (t < 1) t = 1;

    const sInfo = (detalhes.seasons || []).find(s => s.season_number === t);
    const maxEps = sInfo ? sInfo.episode_count : 24;
    if (e > maxEps) {
      e = maxEps;
      showToast(`Episódio ajustado para o máximo na T${t} (E${maxEps})`);
    }
    if (e < 1) e = 1;
  }

  currentSeason = t;
  currentEp     = e;
  atualizarEpInfo();
  carregarPlayer();
  salvarProgresso(currentItem.id, currentSeason, currentEp);
  showToast(`Temporada ${currentSeason} — Episódio ${currentEp}`);
};

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
   BUSCA COM SUGESTÕES
======================== */
let debounceTimer = null;

document.getElementById("busca").addEventListener("input", (e) => {
  const q = e.target.value.trim();
  clearTimeout(debounceTimer);
  const sug = document.getElementById("sugestoes");

  if (q.length < 2) {
    sug.classList.add("hidden");
    sug.innerHTML = "";
    return;
  }

  debounceTimer = setTimeout(() => {
    safety.fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=pt-BR&query=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => {
        if (document.getElementById("busca").value.trim() !== q) return;
        sug.innerHTML = "";
        const res = d.results?.filter(i => i.poster_path).slice(0, 6) || [];
        if (res.length === 0) { sug.classList.add("hidden"); return; }

        res.forEach(item => {
          const tipo  = item.title ? "Filme" : "Série";
          const title = item.title || item.name;
          const div   = document.createElement("div");
          div.classList.add("sug-item");
          div.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w92${item.poster_path}" alt="${title}">
            <span>${title}</span>
            <span class="sug-tipo">${tipo}</span>
          `;
          div.onclick = () => {
            sug.classList.add("hidden");
            document.getElementById("busca").value = title;
            fecharTodasSecoes();
            abrirPlayer({
              id:     item.id,
              title,
              type:   item.title ? "filme" : "serie",
              poster: item.poster_path
            });
          };
          sug.appendChild(div);
        });
        sug.classList.remove("hidden");
      })
      .catch(() => {});
  }, 350);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".busca-wrap")) {
    document.getElementById("sugestoes").classList.add("hidden");
  }
});

document.getElementById("btnBusca").onclick = buscar;
document.getElementById("busca").addEventListener("keydown", (e) => {
  if (e.key === "Enter") buscar();
});

function buscar() {
  const q = document.getElementById("busca").value.trim();
  if (!q) return;
  document.getElementById("sugestoes").classList.add("hidden");
  fecharTodasSecoes();

  safety.fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=pt-BR&query=${encodeURIComponent(q)}`)
    .then(r => r.json())
    .then(d => {
      if (document.getElementById("busca").value.trim() !== q) return;
      searchList.innerHTML = "";
      const res = d.results?.filter(i => i.poster_path) || [];
      if (res.length === 0) {
        searchList.innerHTML = `<p style="color:#aaa;padding:20px;">Nenhum resultado para "<strong>${q}</strong>".</p>`;
      } else {
        res.forEach(item => criarCard(searchList, item));
      }
      searchPage.classList.remove("hidden");
      searchPage.scrollIntoView({ behavior: "smooth" });
    })
    .catch(error => { if (error.name !== "AbortError") showToast("Erro na busca"); });
}
document.getElementById("closeSearch").onclick = () => searchPage.classList.add("hidden");

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
  const nota = item.vote_average ? `${item.vote_average.toFixed(1)}` : "";
  const ano = (item.release_date || item.first_air_date || "").slice(0, 4);
  const tipoLabel = type === "filme" ? "Filme" : (item.genre_ids?.includes(16) && item.original_language === 'ja' ? "Anime" : "Série");
  const subInfo = [tipoLabel, ano].filter(Boolean).join(" · ");

  card.innerHTML = `
    <span class="poster">
      ${nota ? `<span class="badge-nota">${nota}</span>` : ""}
      <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${title}" loading="lazy">
      <button type="button" class="poster-fav-btn fav-btn ${favoritado ? "favoritado is-fav" : ""}" title="${favoritado ? "Remover da Minha Lista" : "Salvar na Minha Lista"}">
        ${favoritado ? "♥" : "♡"}
      </button>
    </span>
    <strong>${title}</strong>
    <small>${subInfo}</small>
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
