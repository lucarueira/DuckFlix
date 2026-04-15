const apiKey = "c6f8a018e59af4ea6ea6f3bdd409c65d";

const filmesContainer = document.getElementById("filmes");
const seriesContainer = document.getElementById("series");
const animesContainer = document.getElementById("animes");
const desenhosContainer = document.getElementById("desenhos");

const busca = document.getElementById("busca");
const btnBusca = document.getElementById("btnBusca");
const logo = document.getElementById("logo");

const playerArea = document.getElementById("area-player");
const player = document.getElementById("player");
const tituloPlayer = document.getElementById("tituloPlayer");
const infoFilme = document.getElementById("infoFilme");
const fecharPlayer = document.getElementById("fecharPlayer");

// INICIO
carregarInicio();

function carregarInicio() {
  limpar();
  buscarFilmes("popular");
  buscarSeries("popular");
  buscarAnimes();
  buscarDesenhos();
}

function limpar() {
  filmesContainer.innerHTML = "";
  seriesContainer.innerHTML = "";
  animesContainer.innerHTML = "";
  desenhosContainer.innerHTML = "";
}

// CARD
function criarCard(container, titulo, poster, acao) {
  const card = document.createElement("div");
  card.classList.add("card");

  card.innerHTML = `
    <img src="https://image.tmdb.org/t/p/w500${poster}">
    <p>${titulo}</p>
  `;

  card.onclick = acao;
  container.appendChild(card);
}

// FILMES
function buscarFilmes(query) {
  const url = query === "popular"
    ? `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=pt-BR`
    : `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=pt-BR&query=${query}`;

  fetch(url)
    .then(r => r.json())
    .then(d => {
      filmesContainer.innerHTML = "";
      d.results.forEach(f => {
        if (!f.poster_path) return;
        criarCard(filmesContainer, f.title, f.poster_path, () => abrirFilme(f));
      });
    });
}

// SERIES
function buscarSeries(query) {
  const url = query === "popular"
    ? `https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&language=pt-BR`
    : `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=pt-BR&query=${query}`;

  fetch(url)
    .then(r => r.json())
    .then(d => {
      seriesContainer.innerHTML = "";
      d.results.forEach(s => {
        if (!s.poster_path) return;
        criarCard(seriesContainer, s.name, s.poster_path, () => abrirSerie(s));
      });
    });
}

// ANIME
function buscarAnimes() {
  fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_original_language=ja`)
    .then(r => r.json())
    .then(d => {
      d.results.forEach(a => {
        if (!a.poster_path) return;
        criarCard(animesContainer, a.name, a.poster_path, () => abrirSerie(a));
      });
    });
}

// DESENHOS
function buscarDesenhos() {
  fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=16`)
    .then(r => r.json())
    .then(d => {
      d.results.forEach(x => {
        if (!x.poster_path) return;
        criarCard(desenhosContainer, x.name, x.poster_path, () => abrirSerie(x));
      });
    });
}

// PLAYER FILME
function abrirFilme(f) {
  playerArea.style.display = "block";

  player.innerHTML = `<iframe src="https://myembed.biz/filme/${f.id}" allowfullscreen></iframe>`;

  fetch(`https://api.themoviedb.org/3/movie/${f.id}?api_key=${apiKey}&language=pt-BR`)
    .then(r => r.json())
    .then(d => {
      tituloPlayer.innerText = d.title;

      infoFilme.innerHTML = `
        <img src="https://image.tmdb.org/t/p/w300${d.poster_path}">
        <div class="info-texto">
          <h3>${d.title}</h3>
          <p>⭐ ${d.vote_average}</p>
          <p>📅 ${d.release_date?.split("-")[0]}</p>
        </div>
      `;
    });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// PLAYER SERIE
function abrirSerie(s) {
  playerArea.style.display = "block";

  player.innerHTML = `<iframe src="https://myembed.biz/serie/${s.id}" allowfullscreen></iframe>`;

  fetch(`https://api.themoviedb.org/3/tv/${s.id}?api_key=${apiKey}&language=pt-BR`)
    .then(r => r.json())
    .then(d => {
      tituloPlayer.innerText = d.name;

      infoFilme.innerHTML = `
        <img src="https://image.tmdb.org/t/p/w300${d.poster_path}">
        <div class="info-texto">
          <h3>${d.name}</h3>
          <p>⭐ ${d.vote_average}</p>
          <p>📅 ${d.first_air_date?.split("-")[0]}</p>
        </div>
      `;
    });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// FECHAR
fecharPlayer.onclick = () => {
  playerArea.style.display = "none";
  player.innerHTML = "";
};

// BUSCA
btnBusca.onclick = executarBusca;

busca.addEventListener("keydown", e => {
  if (e.key === "Enter") executarBusca();
});

function executarBusca() {
  const valor = busca.value.trim();

  if (valor.length < 2) {
    carregarInicio();
    return;
  }

  limpar();
  buscarFilmes(valor);
  buscarSeries(valor);
}

// RESET
logo.onclick = () => {
  busca.value = "";
  playerArea.style.display = "none";
  carregarInicio();
};