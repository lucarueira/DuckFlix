# DuckFlix Extensões

Abra `extensoes.html` pelo menu do DuckFlix. A página é estática e pode ser hospedada em HTTPS sem backend.

`index.html` é a entrada minimalista, com links para `duckflix.html` (catálogo original), `tv.html` e `extensoes.html`. O logo das páginas volta para essa entrada.

## Pesquisa e organização

Catálogo e pesquisa usam o TMDB em português, com categorias de filmes, séries, animes e Minha Lista. Buscar funciona ao digitar, pressionar Enter ou clicar no botão. Limpar a pesquisa restaura a categoria selecionada. Respostas antigas são canceladas.

`tmdb-config.js` centraliza a configuração. Ao abrir um título, `external_ids` converte o ID TMDB em IMDb antes de consultar as fontes; os episódios vêm do Cinemeta. Encontrar um título não garante a disponibilidade de vídeo.

## Addons fixos

`FIXED_ADDONS`, em `extensoes.js`, contém FenixFlix, BestCine, Zeus e FrostStream. Não há interface de instalação, seleção de provedor ou links de assinatura. Flix Streams foi removido porque a resposta pública consultada retornou somente assinatura. Falhas dos addons não bloqueiam a pesquisa.

## Reprodução

O player utiliza vídeo HTML5 e Hls.js. Cada fonte precisa decodificar uma imagem antes de aparecer como opção. Links HTTP são candidatos a HTTPS no mesmo host e passam pelo mesmo teste. Torrents, credenciais e cabeçalhos personalizados não são suportados. Não há proxy ou transcodificação.

O player tem controles de reprodução, volume, velocidade, tela cheia, temporadas, episódios e avanço automático opcional. O progresso é salvo. Fechar o player ou trocar episódio encerra conexões e invalida solicitações pendentes. A disponibilidade depende do fornecedor, codecs e permissões CORS.

## Lista de reprodução de filmes

O botão “+ Na fila” adiciona filmes à lista, separada dos favoritos. É possível reordenar, remover e limpar. A lista fica salva em `duckflix.extensoes.movieQueue`; recarregar a página não inicia reprodução sozinho. Clique em “Reproduzir lista” para começar.

`extensoes-queue.js` controla uma sessão finita, sem repetir filmes automaticamente. Ao terminar um filme, abre o próximo; se falhar, tenta fontes alternativas e então pula. Na sequência, são verificadas até 36 fontes por filme, com limite de 90 segundos sem conseguir iniciar/recuperar o vídeo. Filmes bloqueados pelo Modo Livre são pulados, mantendo os dados salvos. Bloqueio de autoplay solicita um toque em “Continuar reprodução”, sem pular o filme.

“Pular filme” avança manualmente. “Parar sequência” mantém o filme atual tocando e desliga o avanço. Fechar o player, iniciar um título fora da lista ou trocar o Modo Livre encerra a sequência. Identificadores de sessão impedem que eventos atrasados avancem a lista errada.

## Visual e Modo Livre

As três páginas carregam `site.css` por último: navegação, cores, cartões, busca, espaçamentos, controles e regras para celular vêm da mesma base. `site.js` fornece aviso de modo ativo e tela cheia. Os controles internos do iframe da página inicial pertencem ao fornecedor; o contêiner e a navegação de episódios foram ampliados.

`content-policy.js` centraliza a preferência `duckflix.modoLivre` e sincroniza abas. Quando ativo, só exibe títulos com classificação brasileira TMDB conhecida e inferior a 18. Sem classificação ou com falha de consulta, o título fica oculto. Usa `movie/{id}/release_dates` e `tv/{id}/content_ratings`, seis consultas simultâneas e cache de cinco minutos por tipo/ID. Gênero não define idade. Conteúdo explicitamente adulto continua excluído mesmo com a chave desligada.

O filtro cobre catálogo, busca, sugestões, sorteio, favoritos, histórico e abertura do player. Trocar o modo encerra a reprodução e invalida respostas anteriores, sem apagar dados salvos. A TV ao vivo fica indisponível enquanto o modo está ativo: não há classificação confiável por programa. O filtro depende de metadados externos; não analisa os vídeos e não tem PIN de controle parental.

## Validação

`npm.cmd test` verifica pesquisa, paginação, cancelamento, classificação indicativa, recuperação de falhas, listas salvas, episódios e reprodução simulada. Os testes usam DOM e mídia simulados; não substituem a conferência visual e de áudio/vídeo em aparelhos reais. Nesta sessão não havia navegador conectado para essa conferência.

## Referências

- [Busca TMDB](https://developer.themoviedb.org/reference/search-multi)
- [Classificações de filmes](https://developer.themoviedb.org/reference/movie-release-dates)
- [Classificações de séries](https://developer.themoviedb.org/reference/tv-series-content-ratings)
- [Protocolo Stremio](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/protocol.md)

A API do Nuvio gerencia conta e biblioteca, não arquivos de vídeo. Login e sincronização Nuvio não fazem parte desta página.
