# DuckMusic

O DuckMusic busca músicas no catálogo público do YouTube Music pelo servidor e abre o resultado no player incorporado oficial do YouTube. Não exige conta nem chave de API para a busca. O botão **Ouvir** inicia a reprodução. Se um vídeo não permitir incorporação, o player tenta outra versão dos resultados; o botão **Abrir no YouTube** continua disponível. A reprodução pode incluir anúncios.

## Uso local

Execute `node together-server.js` e abra `http://127.0.0.1:3000/music.html`.

Se preferir o Live Server em `http://127.0.0.1:5500/music.html`, mantenha o servidor Node ligado na porta 3000. A página da porta 5500 consulta essa API automaticamente.

## Hospedagem

No servidor Node, a rota é `/api/music/search`. No Netlify, a função é `/.netlify/functions/music-search`. Não são necessárias credenciais. A biblioteca `youtubei.js` consulta a API interna do YouTube Music, que não é oficial e pode mudar; a reprodução usa o player incorporado do YouTube.
