
const apiKey = "c6f8a018e59af4ea6ea6f3bdd409c65d";

let favs = JSON.parse(localStorage.getItem("favs")) || [];

/* ELEMENTOS */
const playerArea = document.getElementById("playerArea");
const player = document.getElementById("player");
const tituloPlayer = document.getElementById("tituloPlayer");

const favPage = document.getElementById("favPage");
const favList = document.getElementById("favList");

const searchPage = document.getElementById("searchPage");
const searchList = document.getElementById("searchList");

/* SALVAR */
function saveFavs() {
localStorage.setItem("favs", JSON.stringify(favs));
}

/* FAVORITOS */
function addFav(item) {
if (!favs.find(f => f.id === item.id)) {
favs.push(item);
saveFavs();
}
}

function removeFav(id) {
favs = favs.filter(f => f.id !== id);
saveFavs();
renderFavs();
}

function renderFavs() {
favList.innerHTML = "";

favs.forEach(f => {
const div = document.createElement("div");
div.classList.add("card");

div.innerHTML = `
<img src="https://image.tmdb.org/t/p/w300${f.poster}">
<p>${f.title}</p>
<button onclick="removeFav(${f.id})">❌</button>
`;

favList.appendChild(div);
});
}

/* ABRIR/FECHAR FAVORITOS */
document.getElementById("btnFav").onclick = () => {
favPage.classList.remove("hidden");
renderFavs();
};

document.getElementById("closeFav").onclick = () => {
favPage.classList.add("hidden");
};

/* FECHAR PLAYER */
document.getElementById("fecharPlayer").onclick = () => {
playerArea.classList.add("hidden");
player.innerHTML = "";
};

/* CARD */
function card(container, item) {

const div = document.createElement("div");
div.classList.add("card");

div.innerHTML = `
<img src="https://image.tmdb.org/t/p/w300${item.poster_path}">
<p>${item.title || item.name}</p>
<button class="fav-btn">⭐</button>
`;

div.onclick = () => {
playerArea.classList.remove("hidden");

tituloPlayer.innerText = item.title || item.name;

const type = item.title ? "filme" : "serie";

player.innerHTML = `
<iframe src="https://myembed.biz/${type}/${item.id}" allowfullscreen></iframe>
`;
};

div.querySelector(".fav-btn").onclick = (e) => {
e.stopPropagation();

addFav({
id: item.id,
title: item.title || item.name,
poster: item.poster_path
});
};

container.appendChild(div);
}

/* SCROLL */
function scrollLeft(id) {
document.getElementById(id).scrollBy({ left: -300, behavior: "smooth" });
}

function scrollRight(id) {
document.getElementById(id).scrollBy({ left: 300, behavior: "smooth" });
}

/* BUSCA (PÁGINA NOVA) */
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

/* FILMES */
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