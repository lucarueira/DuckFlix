# DuckFlix Extensões

Abra `extensoes.html` pelo menu do DuckFlix. A página é estática e pode ser hospedada em HTTPS sem backend. Para desenvolvimento local, sirva a pasta com `python -m http.server 8080` e abra `http://localhost:8080/extensoes.html`.

## Pesquisa e organização

A pesquisa anterior filtrava somente os títulos carregados do FenixFlix, que não anuncia busca em seu manifesto. Agora qualquer pesquisa consulta `search/multi` do TMDB, com idioma `pt-BR`, páginas e exclusão de pessoas. Funciona ao digitar, pressionar Enter ou clicar em Buscar. Limpar a pesquisa restaura o catálogo selecionado. Respostas antigas são canceladas e não sobrescrevem a consulta mais recente.

O início oferece filmes e séries populares do TMDB. Os catálogos dos addons continuam no seletor de exploração. A pesquisa por texto é global, independentemente do catálogo selecionado. Encontrar um título no TMDB não significa que os addons tenham fontes disponíveis.

`tmdb-config.js` centraliza a configuração TMDB que já existia em `script.js`; ambas as páginas carregam esse arquivo antes de seus scripts. Ao abrir um resultado, `external_ids` converte o ID TMDB para IMDb antes de consultar os addons. Filmes sem ID IMDb mantêm o identificador `tmdb:ID`. Séries IMDb usam episódios do Cinemeta; séries sem IMDb precisam de metadados do catálogo de origem.

## Addons fixos

Somente os addons de `FIXED_ADDONS`, em `extensoes.js`, são carregados:

- FenixFlix: `https://fenixflix.fenixhub.online/manifest.json`.
- Flix Streams: `https://flixnest.app/flix-streams/e30/manifest.json`.

Não existe interface de instalação/remoção e a antiga seleção em `localStorage` é ignorada. Para alterar a seleção do site, edite `FIXED_ADDONS`. Falhas dos addons não bloqueiam a pesquisa no TMDB.

O manifesto simples do Flix Streams responde, mas seu endpoint de fontes sem configuração retornou HTTP 400. O configurador oficial gera URLs com JSON em base64url: `e30` representa `{}`, usando os padrões públicos do serviço, sem credenciais ou acesso pago. Esse endpoint respondeu HTTP 200 com CORS. No filme consultado, retornou somente um link de assinatura, sem vídeo. Avisos e links externos sem `url`/`infoHash` não aparecem como fontes. Isso não garante disponibilidade para outros títulos ou planos.

## Reprodução

O player usa vídeo HTML5 e Hls.js. URLs `.m3u8` usam HLS nativo quando disponível ou Hls.js. URLs opacas são tentadas diretamente no player nativo. HTTP, torrents e fontes que exigem cabeçalhos personalizados ficam indisponíveis para reprodução. Não há proxy, transcodificação ou servidor de torrents.

A disponibilidade depende do fornecedor, dos codecs e das permissões de acesso/CORS. A página só anuncia “Reproduzindo” após o evento `playing`. Fechar o modal ou trocar episódio/fonte encerra o player e invalida solicitações pendentes. Textos externos são inseridos como texto, e URLs são validadas.

## Validação

`npm.cmd test` executa a suíte existente e testes de pesquisa remota, paginação, Enter/debounce, cancelamento de pesquisas antigas, recuperação de falhas, IDs IMDb, episódios, ambos os addons e encerramento do player. Os testes de vídeo usam um elemento simulado.

Consultas reais ao TMDB retornaram resultados em português com CORS. Uma execução da página em DOM simulado, com requisições reais, encontrou “Harry Potter e a Ordem da Fênix”, converteu seu ID e exibiu cinco fontes do FenixFlix. Flix Streams respondeu sem vídeos para esse título. Os 34 testes passaram. Na sessão anterior, os controles de navegador/computador não estavam operacionais; reprodução com imagem e áudio e inspeção visual permanecem sem confirmação neste ambiente.

## Referências

- [Busca TMDB](https://developer.themoviedb.org/reference/search-multi)
- [IDs externos TMDB](https://developer.themoviedb.org/reference/movie-external-ids)
- [Protocolo Stremio](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/protocol.md)
- [Configurador oficial Flix Streams](https://flixnest.app/flix-streams/configure)
- [Logo e atribuição TMDB](https://www.themoviedb.org/about/logos-attribution)

A API do Nuvio gerencia conta e biblioteca, não arquivos de vídeo. Login/sincronização Nuvio não fazem parte desta página.
