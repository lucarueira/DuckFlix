const apiKey = "c6f8a018e59af4ea6ea6f3bdd409c65d";

/* =========================
   ESTADO
========================= */
let favs = JSON.parse(localStorage.getItem("favs")) || [];

// Estado do episódio atual
let currentItem = null; // { id, title, type }
let currentSeason = 1;
let currentEpisode = 1;

/* =========================
   ELEMENTOS
========================= */
const playerArea       = document.getElementById("playerArea");
const player           = document.getElementById("player");
const tituloPlayer     = document.getElementById("tituloPlayer");
const episodeControls  = document.getElementById("episodeControls");
const numTemporada     = document.getElementById("numTemporada");
const numEpisodio      = document.getElementById("numEpisodio");

const favPage  = document.getElementById("favPage");
const favList  = document.getElementById("favList");

const searchPage = document.getElementById("searchPage");
const searchList = document.getElementById("searchList");

/* =========================
   TOAST
========================= */
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2500);
}

/* =========================
   LOGO → HOME
========================= */
document.querySelector(".logo").onclick = () => location.reload();

/* =========================
   SALVAR FAVORITOS
========================= */
function saveFavs() {
  localStorage.setItem("favs", JSON.stringify(favs));
}

/* =========================
   VERIFICAR SE É FAVORITO
========================= */
function isFav(id) {
  return !!favs.find(f => f.id === id);
}

/* =========================
   TOGGLE FAVORITO
========================= */
function toggleFav(item, btn) {
  if (isFav(item.id)) {
    // Remover
    favs = favs.filter(f => f.id !== item.id);
    saveFavs();
    atualizarBtnFav(btn, false);
    showToast("❌ Removido dos favoritos");
  } else {
    // Adicionar
    favs.push(item);
    saveFavs();
    atualizarBtnFav(btn, true);
    showToast("⭐ Adicionado aos favoritos!");
  }
}

/* =========================
   ATUALIZAR VISUAL DO BTN
========================= */
function atualizarBtnFav(btn, favoritado) {
  if (favoritado) {
    btn.textContent = "💛";
    btn.title = "Remover dos favoritos";
    btn.classList.add("favoritado");
  } else {
    btn.textContent = "⭐";
    btn.title = "Adicionar aos favoritos";
    btn.classList.remove("favoritado");
  }
}

/* =========================
   REMOVER FAVORITO (da tela de favs)
========================= */
function removeFav(id) {
  favs = favs.filter(f => f.id !== id);
  saveFavs();
  renderFavs();
  showToast("❌ Removido dos favoritos");
}

/* =========================
   RENDERIZAR FAVORITOS
========================= */
function renderFavs() {
  favList.innerHTML = "";

  if (favs.length === 0) {
    favList.innerHTML = `<p style="color:#aaa;padding:20px;">Nenhum favorito ainda. Adicione filmes com ⭐!</p>`;
    return;
  }

  favs.forEach(f => {
    const div = document.createElement("div");
    div.classList.add("card");

    div.innerHTML = `
      <img src="https://image.tmdb.org/t/p/w300${f.poster}" alt="${f.title}">
      <p>${f.title}</p>
      <button class="fav-btn favoritado" title="Remover dos favoritos">💛</button>
    `;

    /* ABRIR PLAYER */
    div.onclick = () => {
      if (!f.id || !f.type) return;
      fecharTodasSecoes();
      abrirPlayer({ id: f.id, title: f.title, type: f.type });
    };

    /* REMOVER */
    div.querySelector(".fav-btn").onclick = (e) => {
      e.stopPropagation();
      removeFav(f.id);
    };

    favList.appendChild(div);
  });
}

/* =========================
   ABRIR / FECHAR FAVORITOS
========================= */
document.getElementById("btnFav").onclick = () => {
  fecharTodasSecoes();
  favPage.classList.remove("hidden");
  renderFavs();
};

document.getElementById("closeFav").onclick = () => {
  favPage.classList.add("hidden");
};

/* =========================
   FECHAR PLAYER
========================= */
document.getElementById("fecharPlayer").onclick = () => {
  playerArea.classList.add("hidden");
  episodeControls.classList.add("hidden");
  player.innerHTML = "";
  currentItem = null;
};

/* =========================
   FECHAR TODAS AS SEÇÕES
========================= */
function fecharTodasSecoes() {
  playerArea.classList.add("hidden");
  episodeControls.classList.add("hidden");
  player.innerHTML = "";
  favPage.classList.add("hidden");
  searchPage.classList.add("hidden");
  currentItem = null;
}

/* =========================
   ABRIR PLAYER
========================= */
function abrirPlayer(item) {
  currentItem = item;

  const ehSerie = item.type === "serie";

  if (ehSerie) {
    // Só reseta temporada/episodio se for novo conteúdo
    currentSeason = 1;
    currentEpisode = 1;
    episodeControls.classList.remove("hidden");
    atualizarEpInfo();
  } else {
    episodeControls.classList.add("hidden");
  }

  tituloPlayer.innerText = item.title;
  playerArea.classList.remove("hidden");
  carregarPlayer();

  // Rola até o player suavemente
  setTimeout(() => {
    playerArea.scrollIntoView({ behavior: "smooth" });
  }, 100);
}

/* =========================
   CARREGAR IFRAME DO PLAYER
========================= */
function carregarPlayer() {
  if (!currentItem) return;

  let url = "";

  if (currentItem.type === "filme") {
    url = `https://myembed.biz/filme/${currentItem.id}`;
  } else {
    // serie, anime, desenho
    url = `https://myembed.biz/serie/${currentItem.id}/${currentSeason}/${currentEpisode}`;
  }

  player.innerHTML = `
    <iframe
      src="${url}"
      allowfullscreen
      loading="lazy">
    </iframe>
  `;
}

/* =========================
   ATUALIZAR INFO EPISÓDIO
========================= */
function atualizarEpInfo() {
  numTemporada.textContent = currentSeason;
  numEpisodio.textContent = currentEpisode;
}

/* =========================
   CONTROLES DE EPISÓDIO
========================= */
document.getElementById("btnEpMais").onclick = () => {
  currentEpisode++;
  atualizarEpInfo();
  carregarPlayer();
};

document.getElementById("btnEpMenos").onclick = () => {
  if (currentEpisode > 1) {
    currentEpisode--;
    atualizarEpInfo();
    carregarPlayer();
  } else {
    showToast("⚠️ Você já está no primeiro episódio!");
  }
};

document.getElementById("btnTemporadaMais").onclick = () => {
  currentSeason++;
  currentEpisode = 1;
  atualizarEpInfo();
  carregarPlayer();
  showToast(`📺 Temporada ${currentSeason}`);
};

document.getElementById("btnTemporadaMenos").onclick = () => {
  if (currentSeason > 1) {
    currentSeason--;
    currentEpisode = 1;
    atualizarEpInfo();
    carregarPlayer();
    showToast(`📺 Temporada ${currentSeason}`);
  } else {
    showToast("⚠️ Você já está na primeira temporada!");
  }
};

/* =========================
   CARD (PRINCIPAL)
========================= */
function card(container, item) {
  const div = document.createElement("div");
  div.classList.add("card");

  const type = item.title ? "filme" : "serie";
  const title = item.title || item.name;
  const favoritado = isFav(item.id);

  div.innerHTML = `
    <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${title}">
    <p>${title}</p>
    <button class="fav-btn ${favoritado ? "favoritado" : ""}" title="${favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}">
      ${favoritado ? "💛" : "⭐"}
    </button>
  `;

  const favBtn = div.querySelector(".fav-btn");

  /* PLAYER */
  div.onclick = () => {
    fecharTodasSecoes();
    abrirPlayer({
      id: item.id,
      title,
      type,
      poster: item.poster_path
    });
  };

  /* TOGGLE FAVORITO */
  favBtn.onclick = (e) => {
    e.stopPropagation();
    toggleFav({
      id: item.id,
      title,
      poster: item.poster_path,
      type
    }, favBtn);
  };

  container.appendChild(div);
}

/* =========================
   SCROLL (nomes corrigidos para
   evitar conflito com DOM nativo)
========================= */
function rolarDireita(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const maxScroll = el.scrollWidth - el.clientWidth;
  if (el.scrollLeft >= maxScroll - 10) {
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
   BUSCA
========================= */
document.getElementById("btnBusca").onclick = buscar;

// ENTER na busca
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

      const resultados = d.results.filter(item => item.poster_path);

      if (resultados.length === 0) {
        searchList.innerHTML = `<p style="color:#aaa;padding:20px;">Nenhum resultado encontrado para "<strong>${q}</strong>".</p>`;
      } else {
        resultados.forEach(item => card(searchList, item));
      }

      searchPage.classList.remove("hidden");
      searchPage.scrollIntoView({ behavior: "smooth" });
    });
}

/* FECHAR BUSCA */
document.getElementById("closeSearch").onclick = () => {
  searchPage.classList.add("hidden");
};

/* =========================
   LOAD FILMES
========================= */
fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=pt-BR`)
  .then(r => r.json())
  .then(d => {
    const c = document.getElementById("filmes");
    d.results.forEach(m => card(c, m));
  });

/* SERIES */
fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&language=pt-BR`)
  .then(r => r.json())
  .then(d => {
    const c = document.getElementById("series");
    d.results.forEach(s => card(c, s));
  });

/* ANIMES */
fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_original_language=ja&language=pt-BR`)
  .then(r => r.json())
  .then(d => {
    const c = document.getElementById("animes");
    d.results.forEach(a => card(c, a));
  });

/* DESENHOS */
fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=16&language=pt-BR`)
  .then(r => r.json())
  .then(d => {
    const c = document.getElementById("desenhos");
    d.results.forEach(x => card(c, x));
  });
