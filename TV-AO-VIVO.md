# DUCKTV

Abra `tv.html` pelo link “DUCKTV · Ao vivo” na navegação da página inicial.
A página usa `tv.css`, `tv-health.js` e `tv.js`; não carrega `script.js`, não acessa
o armazenamento dos filmes e não muda favoritos, histórico ou o player existente.

## Publicação

Publique `tv.html`, `tv.css`, `tv-health.js` e `tv.js` junto com as versões atualizadas de
`index.html` e `style.css`, mantendo a pasta `img`. Funciona em hospedagem
estática, inclusive GitHub Pages, sem chave de API ou servidor adicional.

Fontes:
- Brasil (seleção inicial): https://iptv-org.github.io/iptv/countries/br.m3u
- Todos os países: https://iptv-org.github.io/iptv/index.m3u
- Carrossel de animação: https://iptv-org.github.io/iptv/categories/animation.m3u
- Documentação: https://github.com/iptv-org/iptv

Os canais são carregados ao abrir a página e ao mudar ou atualizar a lista.
A busca e o filtro de categoria são locais e priorizam os próximos testes.
O carrossel de animação é independente desses filtros e inclui canais de outros
países; os canais classificados como animação na lista atual são testados primeiro.
Os resultados da lista aparecem em lotes de 48.

## Filtragem de disponibilidade

O link HTTPS sozinho não basta. Um player temporário e silencioso tenta carregar
imagem de cada candidato no próprio navegador do visitante. Só aprova após
`loadeddata`, `readyState >= 2` e largura de vídeo maior que zero. Erros de CORS,
decodificação, falhas fatais do HLS e timeout de 12 segundos deixam o canal fora
da seleção. Timeout significa que ele não passou no teste naquele navegador,
não que esteja necessariamente fora do ar para todos.

Há no máximo dois testes simultâneos, em lotes de até 20 animações e 24 canais.
O player de teste usa a variante inicial de menor qualidade e um buffer curto.
Cada teste é encerrado após o resultado. A verificação pausa ao assistir ou
deixar a aba em segundo plano. A página continua com novos lotes periodicamente
quando está visível e sem reprodução; “Verificar mais canais” antecipa outro lote.
“Verificar novamente” descarta os resultados e recarrega as fontes.

Resultados ficam apenas em memória e valem por cinco minutos; a interface
remove resultados vencidos na próxima atualização (no máximo um minuto na aba
ativa). Uma falha no player remove imediatamente o canal da seleção. O horário
do último teste aparece no título do card. Não há promessa de disponibilidade
contínua: um sinal pode cair depois do teste. Redes lentas/economia de dados podem
fazer canais reproduzíveis não passarem no prazo.

## Reprodução e limites

O player usa HLS nativo quando disponível e hls.js 1.7.3 nos navegadores
compatíveis. A biblioteca vem do jsDelivr com versão fixa e verificação de
integridade (SRI). Ao atualizar a versão, atualize também o hash.

Somente URLs HTTPS sem credenciais são aceitas. Metadados são exibidos como
texto, sem executar HTML da playlist. Trocar de canal encerra a conexão anterior.
Nenhum canal toca com som automaticamente. As sondagens baixam uma pequena
parte da transmissão para verificar imagem, portanto consomem dados.

A inclusão na playlist não garante reprodução: os servidores externos precisam
permitir acesso pelo navegador (CORS para hls.js) e fornecer mídia compatível.
Links HTTP, restrições geográficas, redirecionamentos inseguros, indisponibilidade
e formatos não suportados podem impedir a reprodução. Não há proxy para
contornar essas restrições. A página oferece nova tentativa e troca de canal.
As categorias vêm da fonte e não constituem um controle parental.

## Verificação

Execute `node --test tests/tv*.test.js`, `node --check tv.js` e `node --check tv-health.js`.
Os testes cobrem leitura M3U, categorias, caracteres acentuados, metadados com
vírgulas, URLs inseguras, duplicatas e entradas malformadas, além de imagem
decodificada, erros, timeout, expiração, cancelamento e limite de concorrência.

Para validar no navegador, sirva a pasta por HTTP local ou use a hospedagem:
abra “TV ao vivo”, busque um canal, altere a categoria e a lista, carregue mais
resultados e selecione canais diferentes. Confira também a visualização móvel,
o botão de nova tentativa e a navegação de volta aos filmes.
