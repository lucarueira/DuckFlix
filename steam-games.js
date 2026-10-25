// Catálogo do DuckSteam. Para adicionar um jogo, copie um bloco e troque os dados.
// "repo" (dono/nome no GitHub) faz o site buscar a versão mais recente e o link direto do download.
// Se o jogo não tiver releases no GitHub, use "downloads": [{ name, url, size }] com link direto.
window.DUCKSTEAM_GAMES = [
  {
    id: 'bloodborne-pc',
    name: 'Bloodborne for Windows',
    repo: 'Supermedo/bloodborne_pc',
    author: 'Supermedo',
    license: 'GPL-2.0',
    tagline: 'Port nativo de Bloodborne para Windows 10/11, feito pela comunidade.',
    tags: ['Ação', 'RPG', 'Souls-like', 'Port da comunidade'],
    cover: 'https://opengraph.githubassets.com/1/Supermedo/bloodborne_pc',
    links: [
      { label: 'Repositório no GitHub', url: 'https://github.com/Supermedo/bloodborne_pc' },
      { label: 'Discord', url: 'https://discord.gg/yTMG8c4Bqm' },
      { label: 'X (Twitter)', url: 'https://x.com/SuperMedoPorts' },
      { label: 'Outros ports', url: 'https://nativeretro.com/' }
    ],
    description: [
      'Versão nativa de Bloodborne para Windows 10/11. O jogo roda direto no seu PC, com os gráficos traduzidos para Vulkan, sem janela de emulador e sem scripts de instalação.',
      'Inclui um launcher com 13 idiomas, assistente de primeira execução, upscaling (DLSS, FSR 3.1/4), taxa de quadros liberada, cheats, mods, suporte a DLC e controle/teclado.',
      'Importante: nenhum arquivo do jogo vem junto. Você precisa fornecer o seu próprio dump do Bloodborne (CUSA03173). Para usar os patches da comunidade é preciso a versão 1.09 do jogo.'
    ],
    features: ['Beta online (conta shadNet)', 'Launcher em 13 idiomas', 'DLSS e FSR 3.1/4', 'Taxa de quadros liberada', 'Cheats e mods', 'Suporte a DLC', 'Controle e teclado'],
    requirements: [
      ['Sistema', 'Windows 10 (1903 ou mais novo) ou Windows 11, 64 bits'],
      ['Processador', 'Intel 4ª geração (Haswell) ou mais novo, ou AMD Ryzen. Processadores sem AVX não são compatíveis'],
      ['Placa de vídeo', 'Compatível com Vulkan 1.3 e driver atualizado'],
      ['Memória', 'Cerca de 6 GB de RAM + arquivo de paginação (10 GB para saída em 1440p/4K)'],
      ['DLSS', 'Exige NVIDIA RTX série 20 ou mais nova']
    ],
    steps: [
      'Baixe o arquivo .zip pelo botão "Baixar" desta página.',
      'Extraia o .zip em qualquer pasta do seu PC.',
      'Abra o Bloodborne.exe. Na primeira execução, um guia verifica a pasta do seu jogo (a que contém o eboot.bin) e o seu PC, e já ajusta as opções gráficas.',
      'Clique em PLAY.',
      'Para DLC, indique a pasta de DLC nas configurações ou use a estrutura user\\addcont\\<id do título>\\.'
    ],
    online: 'Jogo online (beta): crie uma conta shadNet, digite o login e a senha no launcher e use o botão de testar conexão.',
    issues: 'Algumas placas AMD podem travar ao carregar o mundo, e o modo online ainda é novo. Para relatar problemas, use o Discord ou as issues do GitHub e anexe o arquivo user\\last_run.log.'
  }
];
