# DuckMusic

O DuckMusic busca músicas no catálogo público do YouTube Music pelo servidor e abre o resultado no player incorporado oficial do YouTube. Não exige conta nem chave de API para a busca. O botão **Ouvir** inicia a reprodução. Se um vídeo não permitir incorporação, o player tenta outra versão dos resultados; o botão **Abrir no YouTube** continua disponível. A reprodução pode incluir anúncios.

## Uso local

Execute `node together-server.js` e abra `http://127.0.0.1:3000/music.html`.

Se preferir o Live Server em `http://127.0.0.1:5500/music.html`, mantenha o servidor Node ligado na porta 3000. A página da porta 5500 consulta essa API automaticamente.

## Playlists

Use **Minhas playlists** para criar uma lista com nome. Em cada resultado da busca, **+ Playlist** adiciona a música à lista selecionada. É possível remover músicas, reproduzir a lista em sequência e passar para a anterior ou próxima. As listas são salvas no armazenamento local do navegador e ficam vinculadas ao endereço usado (`127.0.0.1:5500` e `127.0.0.1:3000` guardam listas separadas).

## Hospedagem

No servidor Node, a rota é `/api/music/search`. No Netlify, a função é `/.netlify/functions/music-search`. Não são necessárias credenciais. A biblioteca `youtubei.js` consulta a API interna do YouTube Music, que não é oficial e pode mudar; a reprodução usa o player incorporado do YouTube.
