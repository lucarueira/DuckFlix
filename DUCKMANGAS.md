# DuckMangás

O DuckMangás foi inspirado no fluxo de busca e leitura do [MangaBR Hub](https://github.com/felippe-flutter-dev/mangabrhub). A implementação usa a API pública do [MangaDex](https://api.mangadex.org/docs/) diretamente no servidor do DuckFlix, sem incorporar o aplicativo React/Firebase do projeto original.

## Uso local

Execute `node together-server.js` e abra `http://127.0.0.1:3000/mangas.html`. A página também funciona pelo Live Server em `http://127.0.0.1:5500/mangas.html` se o servidor Node estiver ligado na porta 3000.

## Publicação

No Netlify, a página usa as funções `manga-catalog` e `manga-image`. Em outro provedor, as rotas Node são `/api/manga/catalog` e `/api/manga/image`. A API fornece obras com capítulos em português do Brasil, classificação `safe` e páginas compactadas. Capas e páginas são entregues pelo proxy do DuckFlix, conforme as [regras do MangaDex](https://api.mangadex.org/docs/2-limitations/). Grupos de tradução são identificados na lista e no leitor.

Favoritos e progresso ficam no `localStorage` do navegador para o endereço usado. A página **Minha leitura** reúne favoritos e capítulos iniciados, permite continuar da última página, baixar um backup JSON e restaurá-lo em outro endereço ou navegador. O modo cascata também registra a página alcançada durante a rolagem.

A disponibilidade de capítulos e páginas depende do MangaDex. A lista usa paginação de 100 registros e permite selecionar português, inglês, espanhol ou todos os idiomas. Ela mostra os capítulos internos que têm páginas. Capítulos externos do MANGA Plus abrem na editora; outros capítulos externos abrem pela página do MangaDex. Registros removidos ou sem páginas nem link externo não aparecem como leitura, e a página informa quantos registros foram omitidos.

## MANGA Plus

O [MANGA Plus by SHUEISHA](https://mangaplus.shueisha.co.jp/updates) é uma fonte oficial separada do MangaDex. O DuckMangás oferece links para lançamentos, busca no site da editora e a obra enviada pelo usuário. A leitura ocorre no MANGA Plus; as páginas e imagens não são copiadas para o DuckMangás. Os [termos do MANGA Plus](https://mangaplus.shueisha.co.jp/terms_web/eng/) restringem a republicação de conteúdo.

## MangaFlix (padrão)

A fonte padrão é o MangaFlix, portada da extensão Keiyoushi (`mangaflix-catalog.cjs`): API JSON pública com capítulos em português. Obras adultas são sempre filtradas. A fonte MangaDex continua disponível no seletor da busca. O Mangá Livre da Keiyoushi não foi portado porque exige verificação humana no leitor.

## Extensões do Tachiyomi/Mihon

O [guia do Tachimanga](https://tachimanga.app/help/guides/extensions_guide.html) e o [repositório Keiyoushi](https://github.com/keiyoushi/extensions) descrevem extensões Kotlin compiladas para aplicativos Android. Elas não são plugins JavaScript instaláveis no navegador. O formato pode servir de referência para futuros adaptadores de fonte do DuckMangás, desde que cada site permita o acesso e a integração seja implementada separadamente.
