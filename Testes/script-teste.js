const apiKey = "c6f8a018e59af4ea6ea6f3bdd409c65d";

/* =========================
   ESTADO GLOBAL
========================= */
let favs           = JSON.parse(localStorage.getItem("favs")) || {};
let currentItem    = null;
let currentSeason  = 1;
let currentEpisode = 1;

// Timer auto-próximo
let timerInterval  = null;
let timerSegundos  = 0;

/* =========================
   ELEMENTOS
========================= */
const playerArea      = document.getElementById("playerArea");
const player          = document.getElementById("player");
const tituloPlayer    = document.getElementById("tituloPlayer");
const episodeControls = document.getElementById("episodeControls");
const numTemporada    = document.getElementById("numTemporada");
const numEpisodio     = document.getElementById("numEpisodio");
const timerDisplay    = document.getElementById("timerDisplay");
const timerCount      = document.getElementById("timerCount");
const overlay         = document.getElementById("overlay");

const favPage   = document.getElementById("favPage");
const favList   = document.getElementById("favList");
const searchPage = document.getElementById("searchPage");
const searchList = document.getElementById("searchList");

/* =========================
   TOAST
========================= */
function showToast(msg, duracao = 2500) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), duracao);
}

/* =========================
   LOGO → HOME
========================= */
document.querySelector(".logo").onclick = () => location.reload();

/* =========================
   FAVORITOS — estrutura:
   { [id]: { id, title, poster, type } }
========================= */
function saveFavs() {
  localStorage.setItem("favs", JSON.stringify(favs));
}

function isFav(id) {
  return !!favs[id];
}

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

function atualizarBtnFav(btn, favoritado) {
  btn.textContent = favoritado ? "💛" : "⭐";
  btn.title       = favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos";
  favoritado ? btn.classList.add("favoritado") : btn.classList.remove("favoritado");
}

/* =========================
   PROGRESSO DAS SÉRIES
   Salva { season, episode } por id
========================= */
function salvarProgresso(id, season, episode) {
  const prog = JSON.parse(localStorage.getItem("progresso")) || {};
  prog[id] = { season, episode };
  localStorage.setItem("progresso", JSON.stringify(prog));
}

function carregarProgresso(id) {
  const prog = JSON.parse(localStorage.getItem("progresso")) || {};
  return prog[id] || { season: 1, episode: 1 };
}

/* =========================
   OVERLAY
========================= */
function mostrarOverlay() {
  overlay.classList.remove("hidden");
}
function esconderOverlay() {
  overlay.classList.add("hidden");
}

// Clica no overlay → fecha player
overlay.onclick = () => {
  fecharPlayer();
};

/* =========================
   VOLTAR AO TOPO
========================= */
const btnTopo = document.getElementById("btnTopo");

window.addEventListener("scroll", () => {
  if (window.scrollY > 300) {
    btnTopo.classList.add("visivel");
  } else {
    btnTopo.classList.remove("visivel");
  }
});

btnTopo.onclick = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

/* =========================
   TIMER AUTO-PRÓXIMO
========================= */
function iniciarTimer(minutos) {
  pararTimer();
  if (minutos === 0) return;

  timerSegundos = minutos * 60;
  atualizarDisplayTimer();
  timerDisplay.classList.remove("hidden");

  timerInterval = setInterval(() => {
    timerSegundos--;
    atualizarDisplayTimer();

    if (timerSegundos <= 0) {
      pararTimer();
      proximoEpisodio();
      showToast("⏭️ Pulando para o próximo episódio...", 3000);
    }
  }, 1000);
}

function pararTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerDisplay.classList.add("hidden");
}

function atualizarDisplayTimer() {
  const m = String(Math.floor(timerSegundos / 60)).padStart(2, "0");
  const s = String(timerSegundos % 60).padStart(2, "0");
  timerCount.textContent = `${m}:${s}`;
}

// Botões do timer
document.querySelectorAll(".timer-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".timer-btn").forEach(b => b.classList.remove("ativo"));
    btn.classList.add("ativo");
    const min = parseInt(btn.dataset.min);
    iniciarTimer(min);
    if (min > 0) showToast(`⏱️ Auto-pular ativado: ${min} minutos`);
    else showToast("⏱️ Auto-pular desativado");
  };
});

/* =========================
   postMessage — captura sinal
   de fim de vídeo do embed
========================= */
window.addEventListener("message", (event) => {
  if (!currentItem || currentItem.type === "filme") return;

  const data = event.data;

  // Tenta capturar sinais comuns de "ended" de players externos
  const ended =
    data === "ended" ||
    data?.event === "ended" ||
    data?.type === "ended" ||
    data?.status === "ended" ||
    data?.action === "ended" ||
    data?.event === "video:ended" ||
    data?.event === "complete";

  if (ended) {
    proximoEpisodio();
    showToast("⏭️ Episódio terminado — pulando para o próximo!", 3000);
  }
});

/* =========================
   PRÓXIMO EPISÓDIO
========================= */
function proximoEpisodio() {
  currentEpisode++;
  atualizarEpInfo();
  carregarPlayer();
  salvarProgresso(currentItem.id, currentSeason, currentEpisode);

  // Reinicia timer se ativo
  const timerAtivo = document.querySelector(".timer-btn.ativo");
  if (timerAtivo) {
    const min = parseInt(timerAtivo.dataset.min);
    if (min > 0) iniciarTimer(min);
  }
}

/* =========================
   ABRIR PLAYER
========================= */
function abrirPlayer(item) {
  currentItem = item;

  const ehSerie = item.type === "serie";

  if (ehSerie) {
    // Carrega progresso salvo
    const prog = carregarProgresso(item.id);
    currentSeason  = prog.season;
    currentEpisode = prog.episode;
    episodeControls.classList.remove("hidden");
    atualizarEpInfo();
    // Atualiza inputs "ir para"
    document.getElementById("inputTemp").value = currentSeason;
    document.getElementById("inputEp").value   = currentEpisode;
  } else {
    episodeControls.classList.add("hidden");
    pararTimer();
  }

  tituloPlayer.innerText = item.title;
  playerArea.classList.remove("hidden");
  mostrarOverlay();
  carregarPlayer();

  setTimeout(() => {
    playerArea.scrollIntoView({ behavior: "smooth" });
  }, 100);
}

/* =========================
   FECHAR PLAYER
========================= */
function fecharPlayer() {
  playerArea.classList.add("hidden");
  episodeControls.classList.add("hidden");
  player.innerHTML = "";
  esconderOverlay();
  pararTimer();
  // Remove seleção de timer
  document.querySelectorAll(".timer-btn").forEach(b => b.classList.remove("ativo"));
  currentItem = null;
}

document.getElementById("fecharPlayer").onclick = fecharPlayer;

/* =========================
   FECHAR TODAS AS SEÇÕES
========================= */
function fecharTodasSecoes() {
  fecharPlayer();
  favPage.classList.add("hidden");
  searchPage.classList.add("hidden");
}

/* =========================
   CARREGAR IFRAME
========================= */
function carregarPlayer() {
  if (!currentItem) return;

  let url = "";

  if (currentItem.type === "filme") {
    url = `https://myembed.biz/filme/${currentItem.id}`;
  } else {
    url = `https://myembed.biz/serie/${currentItem.id}/${currentSeason}/${currentEpisode}`;
  }

  player.innerHTML = `
    <iframe
      src="${url}"
      allowfullscreen
      loading="lazy"
      allow="autoplay; fullscreen">
    </iframe>
  `;
}

/* =========================
   ATUALIZAR INFO EPISÓDIO
========================= */
function atualizarEpInfo() {
  numTemporada.textContent = currentSeason;
  numEpisodio.textContent  = currentEpisode;
  document.getElementById("inputTemp").value = currentSeason;
  document.getElementById("inputEp").value   = currentEpisode;
}

/* =========================
   BOTÕES EPISÓDIO
========================= */
document.getElementById("btnEpMais").onclick = () => {
  proximoEpisodio();
};

document.getElementById("btnEpMenos").onclick = () => {
  if (currentEpisode > 1) {
    currentEpisode--;
    atualizarEpInfo();
    carregarPlayer();
    salvarProgresso(currentItem.id, currentSeason, currentEpisode);
  } else {
    showToast("⚠️ Você já está no primeiro episódio!");
  }
};

document.getElementById("btnTemporadaMais").onclick = () => {
  currentSeason++;
  currentEpisode = 1;
  atualizarEpInfo();
  carregarPlayer();
  salvarProgresso(currentItem.id, currentSeason, currentEpisode);
  showToast(`📺 Temporada ${currentSeason}`);
};

document.getElementById("btnTemporadaMenos").onclick = () => {
  if (currentSeason > 1) {
    currentSeason--;
    currentEpisode = 1;
    atualizarEpInfo();
    carregarPlayer();
    salvarProgresso(currentItem.id, currentSeason, currentEpisode);
    showToast(`📺 Temporada ${currentSeason}`);
  } else {
    showToast("⚠️ Você já está na primeira temporada!");
  }
};

/* IR PARA EPISÓDIO ESPECÍFICO */
document.getElementById("btnGoTo").onclick = () => {
  const t = parseInt(document.getElementById("inputTemp").value) || 1;
  const e = parseInt(document.getElementById("inputEp").value)   || 1;
  currentSeason  = Math.max(1, t);
  currentEpisode = Math.max(1, e);
  atualizarEpInfo();
  carregarPlayer();
  salvarProgresso(currentItem.id, currentSeason, currentEpisode);
  showToast(`▶ Temp. ${currentSeason} — Ep. ${currentEpisode}`);
};

/* =========================
   FAVORITOS — renderizar
========================= */
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
      <button class="fav-btn favoritado" title="Remover dos favoritos">💛</button>
    `;

    div.onclick = () => {
      fecharTodasSecoes();
      abrirPlayer(f);
    };

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

document.getElementById("closeFav").onclick = () => {
  favPage.classList.add("hidden");
};

/* =========================
   BUSCA
========================= */
document.getElementById("btnBusca").onclick = buscar;
document.getElementById("busca").addEventListener("keydown", (e) => {
  if (e.key === "Enter") buscar();
});

function buscar() {
  const q = document.getElementById("busca").value.trim();
  if (!q) return;

  fecharTodasSecoes();

  fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=pt-BR&query=${encodeURIComponent(q)}`)
    .then(r => r.json())
    .then(d => {
      searchList.innerHTML = "";
      const resultados = d.results.filter(i => i.poster_path);

      if (resultados.length === 0) {
        searchList.innerHTML = `<p style="color:#aaa;padding:20px;">Nenhum resultado para "<strong>${q}</strong>".</p>`;
      } else {
        resultados.forEach(item => card(searchList, item));
      }

      searchPage.classList.remove("hidden");
      searchPage.scrollIntoView({ behavior: "smooth" });
    });
}

document.getElementById("closeSearch").onclick = () => {
  searchPage.classList.add("hidden");
};

/* =========================
   CARD
========================= */
function card(container, item) {
  const div   = document.createElement("div");
  div.classList.add("card");

  const type      = item.title ? "filme" : "serie";
  const title     = item.title || item.name;
  const favoritado = isFav(item.id);

  div.innerHTML = `
    <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${title}">
    <p>${title}</p>
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

/* =========================
   SCROLL
========================= */
function rolarDireita(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const max = el.scrollWidth - el.clientWidth;
  if (el.scrollLeft >= max - 10) {
    el.scrollTo({ left: 0, behavior: "smooth" });
  } else {
    el.scrollBy({ left: 300, behavior: "smooth" });
  }
}

function rolarEsquerda(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.scrollLeft <= 0) {
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  } else {
    el.scrollBy({ left: -300, behavior: "smooth" });
  }
}

/* =========================
   CARREGAR CONTEÚDO
========================= */
fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=pt-BR`)
  .then(r => r.json())
  .then(d => d.results.forEach(m => card(document.getElementById("filmes"), m)));

fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&language=pt-BR`)
  .then(r => r.json())
  .then(d => d.results.forEach(s => card(document.getElementById("series"), s)));

fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_original_language=ja&language=pt-BR`)
  .then(r => r.json())
  .then(d => d.results.forEach(a => card(document.getElementById("animes"), a)));

fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=16&language=pt-BR`)
  .then(r => r.json())
  .then(d => d.results.forEach(x => card(document.getElementById("desenhos"), x)));
