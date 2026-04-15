
const apiKey = "c6f8a018e59af4ea6ea6f3bdd409c65d";

/* =========================
   ESTADO
========================= */
let favs = JSON.parse(localStorage.getItem("favs")) || [];

/* =========================
   ELEMENTOS
========================= */
const playerArea = document.getElementById("playerArea");
const player = document.getElementById("player");
const tituloPlayer = document.getElementById("tituloPlayer");

const favPage = document.getElementById("favPage");
const favList = document.getElementById("favList");

const searchPage = document.getElementById("searchPage");
const searchList = document.getElementById("searchList");

/* =========================
   RESET (LOGO -> HOME)
========================= */
document.querySelector(".logo").onclick = () => {
  location.reload(); // 🔥 reset simples
};

/* =========================
   SALVAR FAVORITOS
========================= */
function saveFavs() {
  localStorage.setItem("favs", JSON.stringify(favs));
}

/* =========================
   ADD FAVORITO (CORRIGIDO)
========================= */
function addFav(item) {
  if (!favs.find(f => f.id === item.id)) {
    favs.push(item);
    saveFavs();
  }
}

/* =========================
   REMOVER FAVORITO
========================= */
function removeFav(id) {
  favs = favs.filter(f => f.id !== id);
  saveFavs();
  renderFavs();
}

/* =========================
   FAVORITOS
========================= */
function renderFavs() {
  favList.innerHTML = "";

  favs.forEach(f => {
    const div = document.createElement("div");
    div.classList.add("card");

    div.innerHTML = `
      <img src="https://image.tmdb.org/t/p/w300${f.poster}">
      <p>${f.title}</p>
      <button class="remove">❌</button>
    `;

    /* ABRIR PLAYER */
    div.onclick = () => {

      if (!f.id || !f.type) return;

      favPage.classList.add("hidden");
      playerArea.classList.remove("hidden");

      tituloPlayer.innerText = f.title;

      player.innerHTML = `
        <iframe 
          src="https://myembed.biz/${f.type}/${f.id}" 
          allowfullscreen
          loading="lazy">
        </iframe>
      `;
    };

    /* REMOVER */
    div.querySelector(".remove").onclick = (e) => {
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
  player.innerHTML = "";
};

/* =========================
   CARD (PRINCIPAL)
========================= */
function card(container, item) {

  const div = document.createElement("div");
  div.classList.add("card");

  const type = item.title ? "filme" : "serie";

  div.innerHTML = `
    <img src="https://image.tmdb.org/t/p/w300${item.poster_path}">
    <p>${item.title || item.name}</p>
    <button class="fav-btn">⭐</button>
  `;

  /* PLAYER */
  div.onclick = () => {

    playerArea.classList.remove("hidden");

    tituloPlayer.innerText = item.title || item.name;

    player.innerHTML = `
      <iframe 
        src="https://myembed.biz/${type}/${item.id}" 
        allowfullscreen
        loading="lazy">
      </iframe>
    `;
  };

  /* FAVORITO */
  div.querySelector(".fav-btn").onclick = (e) => {
    e.stopPropagation();

    addFav({
      id: item.id,
      title: item.title || item.name,
      poster: item.poster_path,
      type: type
    });
  };

  container.appendChild(div);
}

/* =========================
   SCROLL
========================= */



function scrollRight(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const maxScroll = el.scrollWidth - el.clientWidth;

  // se chegou no final → volta pro começo
  if (el.scrollLeft >= maxScroll - 10) {
    el.scrollTo({ left: 0, behavior: "smooth" });
  } else {
    el.scrollBy({ left: 300, behavior: "smooth" });
  }
}

function scrollLeft(id) {
  const el = document.getElementById(id);
  if (!el) return;

  // se está no começo → vai pro final
  if (el.scrollLeft <= 0) {
    el.scrollTo({
      left: el.scrollWidth,
      behavior: "smooth"
    });
  } else {
    el.scrollBy({ left: -300, behavior: "smooth" });
  }
}

/* =========================
   BUSCA (PÁGINA)
========================= */
document.getElementById("btnBusca").onclick = () => {

  const q = document.getElementById("busca").value;
  if (!q) return;

  fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=pt-BR&query=${q}`)
    .then(r => r.json())
    .then(d => {

      searchList.innerHTML = "";

      d.results.forEach(item => {
        if (!item.poster_path) return;
        card(searchList, item);
      });

      searchPage.classList.remove("hidden");
    });
};

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