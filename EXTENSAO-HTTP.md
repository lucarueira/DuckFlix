# DuckFlix HTTP 0.1.0 — teste manual

Pacote: `downloads/duckflix-http-0.1.0.zip`. Tutorial público: `instalar-extensao.html`.

O ZIP é gerado com `npm run package:extension` a partir de `chrome-extension/`. Não contém chaves, dependências, arquivos do projeto ou servidor. Não foi publicado na Chrome Web Store. Para usar no Netlify, é necessário publicar também os arquivos de integração do site; apenas instalar a extensão não modifica uma versão antiga do player.

## Teste local

1. Execute `npm start` (no PowerShell, se necessário, `npm.cmd start`). Abra `http://localhost:3000/instalar-extensao.html`.
2. Extraia o ZIP e carregue a pasta `duckflix-http` sem compactação em `chrome://extensions` ou `edge://extensions`, com Modo do desenvolvedor ativo.
3. Recarregue a página. Deve aparecer “Extensão conectada”.
4. Use o formulário com uma transmissão HTTP HLS disponível. A primeira tentativa pode falhar por falta de permissão. Abra o popup da extensão, autorize o servidor e teste novamente. Outros servidores de segmentos também precisam de autorização.
5. Confira imagem, áudio, pausa, retomada e encerramento. Depois teste pelo catálogo do DUCKTV, pesquisando canais do Minha TV. Fontes só aparecem após a verificação de imagem; falhas não se tornam opções reproduzíveis.
6. Remova uma permissão e confirme a solicitação após recarregar. Desative a extensão, recarregue e confira que as fontes HTTPS continuam funcionando.

## Implementação e limites

- Manifest V3, permissões opcionais solicitadas por origem no popup. A lista ampla de permissões opcionais no manifesto permite descobrir fornecedores em tempo de execução; não concede acesso automático a todos os sites.
- O content script só conecta o DuckFlix de produção e localhost. O worker confere origem e frame principal novamente. Nenhum `externally_connectable` e nenhuma execução de código remoto na extensão.
- O loader HLS recebe playlists, segmentos e chaves pela extensão. Transferência em base64 (mensagens Chrome usam JSON), GET sem cookies, máximo de 24 MB por resposta, 20 segundos por requisição e 12 requisições simultâneas no worker. Redirecionamentos são recusados. O HLS permanece responsável pela seleção de qualidade e reprodução.
- Endereços locais literais, protocolos não HTTP(S), credenciais de URL e portas fora de 80/443/8080 são recusados. Essa validação não faz resolução DNS nem promete proteção contra DNS rebinding; o usuário deve autorizar apenas servidores de mídia conhecidos.
- A extensão não fornece DRM, torrents, transcodificação, MP4 HTTP completo, codecs adicionais ou suporte ao Chrome móvel. O HTTP entre computador e fornecedor permanece sem criptografia.
- O popup armazena somente as origens que aguardam autorização na sessão do navegador, sem URLs completas ou parâmetros de transmissão. Não há telemetria.

## Validação feita

Testes automatizados de origem/permissões, rejeição de destinos locais, byte ranges, fidelidade binária, cancelamento, limite de tamanho, comunicação site → content script → worker → loader e correspondência do ZIP com os fontes. Esses testes usam APIs Chrome simuladas e não substituem carregamento de uma extensão real. Não havia navegador conectado para validar instalação, layout ou decodificação audiovisual nesta sessão.

Referências: [requisições de extensões](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [permissões opcionais](https://developer.chrome.com/docs/extensions/reference/api/permissions), [loader HLS](https://hlsjs.video-dev.org/api-docs/hls.js.loader).
