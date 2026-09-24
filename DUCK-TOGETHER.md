# Duck Together

Página: `together.html`. Temporariamente oculta da entrada e dos menus, a pedido do proprietário. O código foi preservado para retomar a configuração depois; o endereço direto continua existindo.

O líder cria uma sala, copia o convite, escolhe um filme ou episódio e seleciona uma opção de reprodução. Os convidados abrem o link, informam o nome e entram. Quando todos carregarem, o líder dá play. O serviço aceita até 12 pessoas por sala.

## O que está implementado

- Play, pausa, posição e velocidade controlados pelo líder, com autorização conferida no servidor.
- Mesma URL de vídeo para todos, evitando cortes ou durações diferentes.
- Relógio do servidor, compensação do tempo de ida e volta e comandos agendados com 600 ms de antecedência. Pequenos desvios são corrigidos pela velocidade; desvios maiores reposicionam o vídeo.
- Entrada tardia, reconexão e pausa da sala quando o líder desconecta. Ao recarregar a aba original, a credencial em `sessionStorage` mantém o papel de líder.
- Som e tela cheia individuais. Quando o navegador bloquear autoplay, cada participante toca uma vez para ativar a reprodução.
- Filtro Modo Livre individual: um título bloqueado não abre naquele aparelho. Se for o aparelho do líder, a sala é pausada.
- Filmes e séries pesquisados no TMDB, episódios pelo Cinemeta e fontes dos addons já fixados no site. Não há retransmissão nem proxy de vídeo pelo serviço de salas.

Sincronização não é exatidão quadro a quadro: rede, decodificação, abas em segundo plano e buffering podem criar diferenças temporárias. A pausa usa a mesma posição para todos. Se um convidado perder dados, o player alcança a posição atual da sala ao recuperar. Se o líder estiver carregando, ele pausa a sala e pode retomar com Play.

## Ativação com o site atual no Netlify

O frontend permanece em **https://duckflix42.netlify.app**. O arquivo `render.yaml` já permite essa origem no serviço de salas. Não há conta Render conectada nesta sessão nem endereço de servidor publicado configurado ainda.

1. Envie os arquivos deste projeto ao GitHub.
2. No [Render](https://dashboard.render.com/), crie um **Blueprint** a partir desse mesmo repositório. Ele lê o `render.yaml`. Alternativamente, crie um **Web Service** Node: build `npm ci --omit=dev`, início `npm start`, variáveis `HOST=0.0.0.0` e `ALLOWED_ORIGINS=https://duckflix42.netlify.app`.
3. Copie o endereço HTTPS que o Render gerar para o serviço.
4. Em `together-config.js`, preencha `serverUrl` com esse endereço completo, sem `/api/together`. Exemplo de formato: `https://NOME-DO-SERVICO.onrender.com`. Esse é um endereço público, não uma chave secreta.
5. Envie a alteração ao GitHub; o Netlify atualizará o frontend. Abra `/together.html` e teste com duas pessoas.

O blueprint usa a modalidade Free para começar. Instâncias gratuitas podem dormir ou reiniciar; a primeira conexão pode demorar. Use “Tentar conectar novamente” se necessário. Consulte as [limitações atuais do Render](https://render.com/docs/free) e o [guia oficial de publicação de Node](https://render.com/docs/deploy-node-express-app).

O processo Node precisa ficar ativo para manter as salas. Este serviço não é uma função isolada do Netlify. Funções têm limites de execução; consulte a [documentação do Netlify](https://docs.netlify.com/build/functions/api/).

## Testar no computador

Com Node 24 instalado, execute `npm.cmd start` e abra `http://localhost:3000/together.html` em duas janelas. `serverUrl` vazio usa o mesmo servidor da página. Para executar em outra porta, configure a variável `PORT`. Por padrão o servidor local escuta apenas `127.0.0.1`; `HOST=0.0.0.0` é usado pela hospedagem.

`npm.cmd test` executa testes de dois clientes HTTP reais conectados por SSE, autorização do líder, pausa por desconexão, reconexão, CORS, controles de interface com DOM simulado, relógios e política de autoplay. Esses testes não substituem reprodução audiovisual real em dois aparelhos.

## Operação e limites

As salas são temporárias e ficam em memória: reiniciar/publicar o servidor encerra as salas existentes. Salas sem conexão expiram após seis horas. Mantenha uma única instância; múltiplas instâncias exigem armazenamento/coordenação compartilhados. O frontend não recebe a credencial do líder pelo convite: o convite só concede acesso como participante. Trate o convite como acesso à sala.

Não há chat, contas, transferência de liderança, fila automática compartilhada ou sincronização do iframe antigo. O Duck Together usa o player HTML5 compatível com as fontes das Extensões. Nem toda fonte permite acesso simultâneo por redes diferentes; caso alguém não consiga carregar, o líder pode escolher outra opção. Nenhum servidor de terceiros é configurado automaticamente no navegador.

Arquivos principais: `together-server.js` (salas e API), `together-client.js` (transporte/reconexão), `together-sync.js` (relógio e correção), `together.js` (interface/player), `together-config.js` (endereço público do serviço).
