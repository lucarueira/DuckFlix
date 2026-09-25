# Integrações verificadas em 24/09/2026

## Revisão após o teste bem-sucedido da extensão HTTP

- **BestCine**: preservada a entrada existente nas Extensões, sem duplicar ou trocar FenixFlix, Zeus e FrostStream. Manifesto 12.6.0 disponível. Na amostra `tt0133093`, o endpoint HTTP respondeu `video/mp4`; isso não é suportado pela extensão HLS 0.1.0. O catálogo de TV retornou 908 entradas, e uma amostra de canal respondeu HTTPS HLS (HTTP 200). BestCine TV foi acrescentado ao DUCKTV quando a extensão está conectada; só canais que passam na prova de imagem aparecem.
- **Mico-Leão Dublado**: manifesto disponível; seis fontes da amostra retornaram `infoHash`, sem vídeo HTTP. Não incluído porque depende de torrent.
- **Skyflix**: o endereço anunciado `https://skyflix.onrender.com/manifest.json` retornou HTTP 404. Não incluído como fonte operacional.
- **M3U/EPG TV Addon**: o manifesto configurado anunciado no catálogo respondeu HTTP 200. A configuração pública aponta para `https://iptv-org.github.io/iptv/index.m3u`, já utilizada pelo DUCKTV, com EPG desativado. Para não duplicar os canais nem criar dependência de mais um servidor, mantivemos a leitura direta dessa lista e liberamos suas entradas HTTP `.m3u8` somente com a extensão conectada. Não foi adicionada uma grade EPG; ela exigiria uma fonte XMLTV.
- **Compatibilidade adicional nas Extensões**: fontes HLS identificadas por MIME também podem usar HTTP pela extensão mesmo sem `.m3u8` no caminho. Consultas de addons fixos que falhem na rede podem ser repetidas pela extensão, com permissão do usuário; consultas diretas bem-sucedidas e TMDB não mudam.

Links avaliados: [BestCine](https://stremio-addons.net/addons/bestcine), [Mico-Leão](https://stremio-addons.net/addons/mico-leao-dublado), [Skyflix](https://stremio-addons.net/addons/skyflix), [M3U/EPG](https://stremio-addons.net/addons/m3uepg-tv-addon). Respostas HTTP e amostras de mídia não equivalem a garantia de reprodução de todo o catálogo. A extensão continua na versão 0.1.0, sem necessidade de reinstalação para essas mudanças do site.

## Verificações anteriores

- **Zeus**: atualizada a configuração fixa para `v1-p64f-q3j-a3-mb-c3`, correspondente ao link enviado. Manifesto e consulta de exemplo de filme responderam HTTP 200, com três fontes HTTPS e CORS liberado.
- **FrostStream**: já estava integrado, sem duplicação. Manifesto disponível em `https://froststream.cloutteam.com/manifest.json`. A consulta de exemplo retornou quatro fontes HTTP; uma delas respondeu HTTP 206 com vídeo MP4 ao tentar HTTPS no mesmo endereço. Outra tentativa expirou. A verificação de imagem existente decide quais opções aparecem no navegador; não se presume que todas funcionem.
- **FrostView TV**: adicionado ao DUCKTV via `tv-addons.js`. Catálogo paginado retornou 768 canais nesta verificação. Uma amostra retornou três fontes HTTPS e o manifesto HLS respondeu HTTP 200 com CORS liberado. Os canais são resolvidos sob demanda em lotes, com até dois decodificadores simultâneos, alternativas de fonte e descarte de falhas. Só aparecem após decodificar imagem no navegador do visitante. Nomes dos provedores não são exibidos na interface.
- **Minha TV**: manifesto e catálogo responderam, mas a amostra de transmissão retornou HTTP, sem relay HTTPS. Agora é carregado experimentalmente no DUCKTV apenas quando a extensão DuckFlix HTTP está conectada. A autorização do servidor e a decodificação de imagem continuam obrigatórias. Sem a extensão, permanece fora da seleção.
- **Brazuca Torrents**: manifesto declara `p2p: true` e fontes torrent. Não incluído no player HTML5 atual, que não possui serviço de torrent. Uma URL de addon HTTPS não transforma torrent em vídeo HTTPS.

Consultas de filmes usaram `tt0133093` como amostra. As verificações de rede não substituem reprodução com imagem e áudio em navegador real; não houve navegador conectado nesta sessão. Disponibilidade, CORS, codecs e URLs podem mudar. O Modo Livre continua filtrando filmes e séries; canais ao vivo ficam ocultos nesse modo por não terem classificação confiável por programa.

Fontes: [Zeus](https://398fe185fed6-zeus.baby-beamup.club/v1-p64f-q3j-a3-mb-c3/configure), [FrostStream](https://stremio-addons.net/addons/froststream), [FrostView](https://stremio-addons.net/addons/frostview), [Minha TV](https://stremio-addons.net/addons/minha-tv), [Brazuca Torrents](https://stremio-addons.net/addons/brazuca-torrents). Os endereços dos manifestos foram obtidos desses cadastros e consultados diretamente.
