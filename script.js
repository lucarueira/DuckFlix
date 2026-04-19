const apiKey = "c6f8a018e59af4ea6ea6f3bdd409c65d";

/* ========================
   GÊNEROS TMDB
======================== */
const generosFilme = {
  28:"Ação",12:"Aventura",16:"Animação",35:"Comédia",80:"Crime",
  99:"Documentário",18:"Drama",10751:"Família",14:"Fantasia",
  36:"História",27:"Terror",9648:"Mistério",10749:"Romance",
  878:"Ficção Científica",53:"Thriller",10752:"Guerra",37:"Faroeste"
};
const generosSerie = {
  10759:"Ação/Aventura",16:"Animação",35:"Comédia",80:"Crime",
  99:"Documentário",18:"Drama",10751:"Família",10762:"Infantil",
  9648:"Mistério",10765:"Ficção Científica",10766:"Novela",37:"Faroeste"
};

/* ========================
   ESTADO
======================== */
let favs          = JSON.parse(localStorage.getItem("favs"))      || {};
let historico     = JSON.parse(localStorage.getItem("historico")) || {};

let currentItem   = null;
let currentSeason = 1;
let currentEp     = 1;

// Listas carregadas (para roleta)
let listaFilmes   = [];
let listaSeries   = [];
let listaAnimes   = [];
let listaDesenhos = [];

// Timer auto-pular
let timerInterval  = null;
let timerSegundos  = 0;

// Banner próximo ep
let nextEpInterval = null;
let nextEpCancelled = false;

// Item sorteado na roleta
let roletaItemSelecionado = null;

/* ========================
   ELEMENTOS
======================== */
const playerArea      = document.getElementById("playerArea");
const player          = document.getElementById("player");
const tituloPlayer    = document.getElementById("tituloPlayer");
const episodeControls = document.getElementById("episodeControls");
const numTemporada    = document.getElementById("numTemporada");
const numEpisodio     = document.getElementById("numEpisodio");
const timerDisplay    = document.getElementById("timerDisplay");
const timerCount      = document.getElementById("timerCount");
const overlay         = document.getElementById("overlay");
const nextEpBanner    = document.getElementById("nextEpBanner");
const nextEpCount     = document.getElementById("nextEpCount");
const nextEpProgress  = document.getElementById("nextEpProgress");

const favPage    = document.getElementById("favPage");
const favList    = document.getElementById("favList");
const searchPage = document.getElementById("searchPage");
const searchList = document.getElementById("searchList");

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
    showToast("❌ Removido dos favoritos");
  } else {
    favs[item.id] = item;
    saveFavs();
    atualizarBtnFav(btn, true);
    showToast("⭐ Adicionado aos favoritos!");
  }
}

function atualizarBtnFav(btn, fav) {
  btn.textContent = fav ? "💛" : "⭐";
  btn.title       = fav ? "Remover dos favoritos" : "Adicionar aos favoritos";
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

function renderHistorico() {
  const sec  = document.getElementById("historicoSection");
  const row  = document.getElementById("historico");
  const lista = Object.values(historico).sort((a, b) => b.visto - a.visto);

  if (lista.length === 0) {
    sec.classList.add("hidden");
    return;
  }
  sec.classList.remove("hidden");
  row.innerHTML = "";
  lista.forEach(item => {
    const div = document.createElement("div");
    div.classList.add("card");
    const prog = carregarProgresso(item.id);
    div.innerHTML = `
      <img src="https://image.tmdb.org/t/p/w300${item.poster}" alt="${item.title}">
      ${item.type === "serie" ? `<div class="badge-assistindo">T${prog.season} E${prog.episode}</div>` : ""}
      <p>${item.title}</p>
    `;
    div.onclick = () => {
      fecharTodasSecoes();
      abrirPlayer(item);
    };
    row.appendChild(div);
  });
}

document.getElementById("limparHistorico").onclick = () => {
  historico = {};
  saveHistorico();
  renderHistorico();
  showToast("🗑️ Histórico limpo");
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
   TIMER AUTO-PULAR
======================== */
function iniciarTimer(min) {
  pararTimer();
  if (min === 0) return;
  timerSegundos = min * 60;
  atualizarTimerDisplay();
  timerDisplay.classList.remove("hidden");

  timerInterval = setInterval(() => {
    timerSegundos--;
    atualizarTimerDisplay();
    if (timerSegundos <= 0) {
      pararTimer();
      iniciarBannerProximoEp();
    }
  }, 1000);
}
function pararTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerDisplay.classList.add("hidden");
}
function atualizarTimerDisplay() {
  const m = String(Math.floor(timerSegundos / 60)).padStart(2, "0");
  const s = String(timerSegundos % 60).padStart(2, "0");
  timerCount.textContent = `${m}:${s}`;
}

document.querySelectorAll(".timer-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".timer-btn").forEach(b => b.classList.remove("ativo"));
    btn.classList.add("ativo");
    const min = parseInt(btn.dataset.min);
    iniciarTimer(min);
    showToast(min > 0 ? `⏱️ Auto-pular em ${min} minutos` : "⏱️ Auto-pular desativado");
  };
});

/* ========================
   BANNER PRÓXIMO EPISÓDIO
   (estilo Netflix — 10s)
======================== */
function iniciarBannerProximoEp() {
  if (!currentItem || currentItem.type === "filme") return;

  nextEpCancelled = false;
  let seg = 10;
  nextEpCount.textContent = seg;
  nextEpProgress.style.transition = "none";
  nextEpProgress.style.width = "100%";
  nextEpBanner.classList.remove("hidden");

  // Anima a barra regressiva
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      nextEpProgress.style.transition = `width ${seg}s linear`;
      nextEpProgress.style.width = "0%";
    });
  });

  nextEpInterval = setInterval(() => {
    seg--;
    nextEpCount.textContent = seg;
    if (seg <= 0) {
      fecharBannerProximoEp();
      if (!nextEpCancelled) proximoEpisodio();
    }
  }, 1000);
}

function fecharBannerProximoEp() {
  clearInterval(nextEpInterval);
  nextEpInterval = null;
  nextEpBanner.classList.add("hidden");
}

document.getElementById("nextEpNow").onclick = () => {
  fecharBannerProximoEp();
  proximoEpisodio();
};
document.getElementById("nextEpCancel").onclick = () => {
  nextEpCancelled = true;
  fecharBannerProximoEp();
  showToast("⏸️ Auto-play cancelado");
};

/* ========================
   postMessage — fim de vídeo
======================== */
window.addEventListener("message", (e) => {
  if (!currentItem || currentItem.type === "filme") return;
  const d = e.data;
  const ended =
    d === "ended" || d?.event === "ended" || d?.type === "ended" ||
    d?.status === "ended" || d?.event === "video:ended" || d?.event === "complete";
  if (ended) iniciarBannerProximoEp();
});

/* ========================
   PRÓXIMO EPISÓDIO (progressivo)
======================== */
function proximoEpisodio() {
  currentEp++;
  atualizarEpInfo();
  carregarPlayer();
  salvarProgresso(currentItem.id, currentSeason, currentEp);
  showToast(`▶ Episódio ${currentEp} — Temporada ${currentSeason}`);

  // Reinicia timer se ativo
  const timerAtivo = document.querySelector(".timer-btn.ativo");
  if (timerAtivo) {
    const min = parseInt(timerAtivo.dataset.min);
    if (min > 0) iniciarTimer(min);
  }
}

/* ========================
   ABRIR PLAYER
======================== */
function abrirPlayer(item) {
  currentItem = item;
  const ehSerie = item.type === "serie";

  if (ehSerie) {
    const prog   = carregarProgresso(item.id);
    currentSeason = prog.season;
    currentEp     = prog.episode;
    episodeControls.classList.remove("hidden");
    atualizarEpInfo();
  } else {
    episodeControls.classList.add("hidden");
    pararTimer();
  }

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
  playerArea.classList.add("hidden");
  episodeControls.classList.add("hidden");
  player.innerHTML = "";
  overlay.classList.add("hidden");
  pararTimer();
  fecharBannerProximoEp();
  document.querySelectorAll(".timer-btn").forEach(b => b.classList.remove("ativo"));
  document.querySelector('.timer-btn[data-min="0"]').classList.add("ativo");
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
}

/* ========================
   CARREGAR IFRAME
======================== */
function carregarPlayer() {
  if (!currentItem) return;
  const url = currentItem.type === "filme"
    ? `https://myembed.biz/filme/${currentItem.id}`
    : `https://myembed.biz/serie/${currentItem.id}/${currentSeason}/${currentEp}`;

  player.innerHTML = `
    <iframe src="${url}" allowfullscreen loading="lazy" allow="autoplay; fullscreen"></iframe>
  `;
}

function atualizarEpInfo() {
  numTemporada.textContent = currentSeason;
  numEpisodio.textContent  = currentEp;
  document.getElementById("inputTemp").value = currentSeason;
  document.getElementById("inputEp").value   = currentEp;
}

/* ========================
   BOTÕES EPISÓDIO
======================== */
document.getElementById("btnEpMais").onclick = () => proximoEpisodio();

document.getElementById("btnEpMenos").onclick = () => {
  if (currentEp > 1) {
    currentEp--;
    atualizarEpInfo();
    carregarPlayer();
    salvarProgresso(currentItem.id, currentSeason, currentEp);
  } else showToast("⚠️ Primeiro episódio da temporada!");
};

document.getElementById("btnTemporadaMais").onclick = () => {
  currentSeason++;
  currentEp = 1;
  atualizarEpInfo();
  carregarPlayer();
  salvarProgresso(currentItem.id, currentSeason, currentEp);
  showToast(`📺 Temporada ${currentSeason}`);
};

document.getElementById("btnTemporadaMenos").onclick = () => {
  if (currentSeason > 1) {
    currentSeason--;
    currentEp = 1;
    atualizarEpInfo();
    carregarPlayer();
    salvarProgresso(currentItem.id, currentSeason, currentEp);
    showToast(`📺 Temporada ${currentSeason}`);
  } else showToast("⚠️ Primeira temporada!");
};

document.getElementById("btnGoTo").onclick = () => {
  const t = Math.max(1, parseInt(document.getElementById("inputTemp").value) || 1);
  const e = Math.max(1, parseInt(document.getElementById("inputEp").value)   || 1);
  currentSeason = t;
  currentEp     = e;
  atualizarEpInfo();
  carregarPlayer();
  salvarProgresso(currentItem.id, currentSeason, currentEp);
  showToast(`▶ T${currentSeason} E${currentEp}`);
};

/* ========================
   TRAILER
======================== */
document.getElementById("btnTrailer").onclick = () => {
  if (!currentItem) return;
  const tipo = currentItem.type === "filme" ? "movie" : "tv";
  fetch(`https://api.themoviedb.org/3/${tipo}/${currentItem.id}/videos?api_key=${apiKey}&language=pt-BR`)
    .then(r => r.json())
    .then(d => {
      let trailer = d.results?.find(v => v.type === "Trailer" && v.site === "YouTube");
      if (!trailer) {
        // Tenta em inglês
        return fetch(`https://api.themoviedb.org/3/${tipo}/${currentItem.id}/videos?api_key=${apiKey}`)
          .then(r => r.json())
          .then(d2 => {
            trailer = d2.results?.find(v => v.type === "Trailer" && v.site === "YouTube");
            if (trailer) abrirTrailer(trailer.key, currentItem.title);
            else showToast("😕 Trailer não encontrado");
          });
      }
      abrirTrailer(trailer.key, currentItem.title);
    });
};

function abrirTrailer(key, titulo) {
  document.getElementById("trailerTitulo").textContent = `🎬 Trailer — ${titulo}`;
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
function renderFavs() {
  favList.innerHTML = "";
  const lista = Object.values(favs);
  if (lista.length === 0) {
    favList.innerHTML = `<p style="color:#aaa;padding:20px;">Nenhum favorito ainda. Adicione com ⭐!</p>`;
    return;
  }
  lista.forEach(f => {
    const div = document.createElement("div");
    div.classList.add("card");
    div.innerHTML = `
      <img src="https://image.tmdb.org/t/p/w300${f.poster}" alt="${f.title}">
      <p>${f.title}</p>
      <button class="fav-btn favoritado" title="Remover">💛</button>
    `;
    div.onclick = () => { fecharTodasSecoes(); abrirPlayer(f); };
    div.querySelector(".fav-btn").onclick = (e) => {
      e.stopPropagation();
      delete favs[f.id];
      saveFavs();
      showToast("❌ Removido dos favoritos");
      renderFavs();
    };
    favList.appendChild(div);
  });
}

document.getElementById("btnFav").onclick = () => {
  fecharTodasSecoes();
  favPage.classList.remove("hidden");
  renderFavs();
};
document.getElementById("closeFav").onclick = () => favPage.classList.add("hidden");

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
    fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=pt-BR&query=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => {
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
              id: item.id,
              title,
              type: item.title ? "filme" : "serie",
              poster: item.poster_path
            });
          };
          sug.appendChild(div);
        });
        sug.classList.remove("hidden");
      });
  }, 350);
});

// Fecha sugestões ao clicar fora
document.addEventListener("click", (e) => {
  if (!e.target.closest(".busca-wrap")) {
    document.getElementById("sugestoes").classList.add("hidden");
  }
});

// Busca principal (Enter ou botão)
document.getElementById("btnBusca").onclick = buscar;
document.getElementById("busca").addEventListener("keydown", (e) => {
  if (e.key === "Enter") buscar();
});

function buscar() {
  const q = document.getElementById("busca").value.trim();
  if (!q) return;
  document.getElementById("sugestoes").classList.add("hidden");
  fecharTodasSecoes();

  fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=pt-BR&query=${encodeURIComponent(q)}`)
    .then(r => r.json())
    .then(d => {
      searchList.innerHTML = "";
      const res = d.results?.filter(i => i.poster_path) || [];
      if (res.length === 0) {
        searchList.innerHTML = `<p style="color:#aaa;padding:20px;">Nenhum resultado para "<strong>${q}</strong>".</p>`;
      } else {
        res.forEach(item => card(searchList, item));
      }
      searchPage.classList.remove("hidden");
      searchPage.scrollIntoView({ behavior: "smooth" });
    });
}
document.getElementById("closeSearch").onclick = () => searchPage.classList.add("hidden");

/* ========================
   CARD (com nota e gênero)
======================== */
function card(container, item, tipoForcado) {
  const div   = document.createElement("div");
  div.classList.add("card");

  const type      = tipoForcado || (item.title ? "filme" : "serie");
  const title     = item.title || item.name;
  const favoritado = isFav(item.id);
  const nota      = item.vote_average ? `⭐ ${item.vote_average.toFixed(1)}` : "";
  const genMap    = type === "filme" ? generosFilme : generosSerie;
  const genero    = item.genre_ids?.[0] ? (genMap[item.genre_ids[0]] || "") : "";

  div.innerHTML = `
    ${nota ? `<span class="badge-nota">${nota}</span>` : ""}
    <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${title}">
    <p>${title}</p>
    ${genero ? `<span class="badge-genero">${genero}</span>` : ""}
    <button class="fav-btn ${favoritado ? "favoritado" : ""}" title="${favoritado ? "Remover" : "Favoritar"}">
      ${favoritado ? "💛" : "⭐"}
    </button>
  `;

  const favBtn = div.querySelector(".fav-btn");

  div.onclick = () => {
    fecharTodasSecoes();
    abrirPlayer({ id: item.id, title, type, poster: item.poster_path });
  };
  favBtn.onclick = (e) => {
    e.stopPropagation();
    toggleFav({ id: item.id, title, poster: item.poster_path, type }, favBtn);
  };

  container.appendChild(div);
}

/* ========================
   SCROLL
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

/* ========================
   ROLETA
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

function sortear(cat) {
  const listas = {
    filmes:   listaFilmes,
    series:   listaSeries,
    animes:   listaAnimes,
    desenhos: listaDesenhos
  };
  const lista = listas[cat]?.filter(i => i.poster_path);
  if (!lista || lista.length === 0) { showToast("⏳ Carregando lista..."); return; }

  const display = document.getElementById("roletaDisplay");
  const img     = document.getElementById("roletaImg");
  const titulo  = document.getElementById("roletaTitulo");
  const nota    = document.getElementById("roletaNota");
  const btnAss  = document.getElementById("btnAssistirRoleta");
  const btnNov  = document.getElementById("btnSortearNovamente");

  display.classList.remove("hidden");
  btnAss.classList.add("hidden");
  btnNov.classList.add("hidden");
  img.classList.add("girando");

  // Anima por 2s trocando rápido
  let loops = 0;
  const spin = setInterval(() => {
    const rand = lista[Math.floor(Math.random() * lista.length)];
    img.src = `https://image.tmdb.org/t/p/w300${rand.poster_path}`;
    titulo.textContent = rand.title || rand.name;
    loops++;
    if (loops >= 16) {
      clearInterval(spin);
      img.classList.remove("girando");

      // Resultado final
      const escolhido = lista[Math.floor(Math.random() * lista.length)];
      img.src = `https://image.tmdb.org/t/p/w300${escolhido.poster_path}`;
      titulo.textContent = escolhido.title || escolhido.name;
      nota.textContent   = escolhido.vote_average ? `⭐ ${escolhido.vote_average.toFixed(1)}` : "";

      roletaItemSelecionado = {
        id:     escolhido.id,
        title:  escolhido.title || escolhido.name,
        type:   cat === "filmes" ? "filme" : "serie",
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
   CARREGAR CONTEÚDO
======================== */
fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=pt-BR`)
  .then(r => r.json()).then(d => {
    listaFilmes = d.results;
    listaFilmes.forEach(m => card(document.getElementById("filmes"), m, "filme"));
  });

fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&language=pt-BR`)
  .then(r => r.json()).then(d => {
    listaSeries = d.results;
    listaSeries.forEach(s => card(document.getElementById("series"), s, "serie"));
  });

fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_original_language=ja&language=pt-BR`)
  .then(r => r.json()).then(d => {
    listaAnimes = d.results;
    listaAnimes.forEach(a => card(document.getElementById("animes"), a, "serie"));
  });

fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=16&language=pt-BR`)
  .then(r => r.json()).then(d => {
    listaDesenhos = d.results;
    listaDesenhos.forEach(x => card(document.getElementById("desenhos"), x, "serie"));
  });

/* ========================
   INIT — renderiza histórico
======================== */
renderHistorico();