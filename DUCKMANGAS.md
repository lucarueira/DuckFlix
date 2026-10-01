# DuckMangás

O DuckMangás foi inspirado no fluxo de busca e leitura do [MangaBR Hub](https://github.com/felippe-flutter-dev/mangabrhub). A implementação usa a API pública do [MangaDex](https://api.mangadex.org/docs/) diretamente no servidor do DuckFlix, sem incorporar o aplicativo React/Firebase do projeto original.

## Uso local

Execute `node together-server.js` e abra `http://127.0.0.1:3000/mangas.html`. A página também funciona pelo Live Server em `http://127.0.0.1:5500/mangas.html` se o servidor Node estiver ligado na porta 3000.

## Publicação

No Netlify, a página usa as funções `manga-catalog` e `manga-image`. Em outro provedor, as rotas Node são `/api/manga/catalog` e `/api/manga/image`. A API fornece obras com capítulos em português do Brasil, classificação `safe` e páginas compactadas. Capas e páginas são entregues pelo proxy do DuckFlix, conforme as [regras do MangaDex](https://api.mangadex.org/docs/2-limitations/). Grupos de tradução são identificados na lista e no leitor.

Favoritos e progresso ficam no `localStorage` do navegador. A disponibilidade de capítulos e páginas depende do MangaDex; capítulos externos não são exibidos para leitura interna.
