// Catálogo do DuckSteam. Para adicionar um jogo, copie um bloco e troque os dados.
// "downloads" traz o link direto do arquivo: o botão baixa sem passar por nenhuma página do GitHub.
// "cover" é a imagem larga; "poster" é a capa vertical.
(function () {
  'use strict';
  const gh = (repo, label = 'Projeto original (créditos)') => ({ label, url: `https://github.com/${repo}` });

  window.DUCKSTEAM_GAMES = [
    {
      id: 'bloodborne-pc',
      name: 'Bloodborne for Windows',
      downloads: [{ name: 'Bloodborne-Windows.zip', size: 189268960, url: 'https://github.com/Supermedo/bloodborne_pc/releases/download/windows-v1.9.4/Bloodborne-Windows.zip' }],
    author: 'Supermedo',
      license: 'GPL-2.0',
      tagline: 'Port nativo de Bloodborne para Windows 10/11, feito pela comunidade.',
      tags: ['Ação', 'RPG', 'Souls-like', 'PlayStation 4', 'Port da comunidade'],
      cover: 'https://image.api.playstation.com/vulcan/img/rnd/202010/2614/KKLEVc2SIIgrFVjsZChZJk1d.jpg',
      poster: 'https://upload.wikimedia.org/wikipedia/pt/2/29/Bloodborne_capa.png',
      links: [
        gh('Supermedo/bloodborne_pc'),
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
    },
    {
      id: 'shadow-of-the-colossus-pc',
      name: 'Shadow of the Colossus PC',
      downloads: [{ name: 'SotC-PC.zip', size: 109065523, url: 'https://github.com/Lucas-blip-png/ShadowOfTheColossus-PC/releases/latest/download/SotC-PC.zip' }],
    author: 'Lucas-blip-png (fork de AjncSystem)',
      license: 'GPL-2.0 ou mais recente',
      tagline: 'Port nativo de Shadow of the Colossus (PS4) para Windows, com FSR 3.1 e DLSS.',
      tags: ['Aventura', 'Ação', 'PlayStation 4', 'Port da comunidade'],
      cover: 'https://gaming-cdn.com/images/news/articles/15777/cover/1000x563/shadow-of-the-colossus-celebra-o-seu-20-o-aniversario-a-historia-de-uma-obra-lendaria-cover69032f691cfc4.jpg',
      poster: 'https://m.media-amazon.com/images/M/MV5BMWE4ZjJjYWMtYjYxZC00ZjQ3LTlmMGUtOWQxZWJjYzc4M2Q2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
      links: [
        gh('Lucas-blip-png/ShadowOfTheColossus-PC'),
        { label: 'Histórico de mudanças', url: 'https://github.com/Lucas-blip-png/ShadowOfTheColossus-PC/blob/HEAD/CHANGELOG.md' },
        { label: 'Projeto original (AjncSystem)', url: 'https://github.com/AjncSystem/ShadowOfTheColossus-PC' }
      ],
      description: [
        'Port nativo de Shadow of the Colossus (PS4) para Windows. O código do próprio jogo roda direto na CPU do PC e a GPU do PS4 é traduzida para Vulkan. Não é um emulador completo, e sim um carregador com as funções de sistema de que o jogo precisa.',
        'Esta versão (v0.60.6-plus4) é um fork com melhorias: suporte a CPUs sem BMI1/LZCNT/MOVBE (Intel antigas e AMD FX), CPUs de 4 threads, tela cheia a 120 Hz, correções para placas AMD GCN (RX 470–590 e Vega, ainda em teste) e upscalers FSR 3.1 e DLSS (o caminho do DLSS ainda não foi testado com as DLLs da NVIDIA, que não vêm no repositório).',
        'Importante: nenhum arquivo do jogo ou da Sony vem junto. Você precisa do seu próprio dump (CUSA08809 EU 1.01 ou CUSA08034 US 1.00). Para ter som, são necessários dois módulos decifrados do seu console, libSceNgs2.sprx e libSceUlt.sprx, que o launcher consegue achar em uma instalação do shadPS4 ou copiar do seu próprio console.'
      ],
      features: ['Vulkan nativo', 'FSR 3.1 e DLSS', 'Geração de quadros', 'Tela cheia a 120 Hz', 'CPUs sem BMI1/LZCNT/MOVBE', 'CPUs de 4 threads', 'Importa saves do shadPS4'],
      requirements: [
        ['Sistema', 'Windows 10/11, 64 bits'],
        ['Placa de vídeo', 'Compatível com Vulkan 1.3 (NVIDIA, AMD ou Intel) com driver recente'],
        ['Arquivo do jogo', 'Seu próprio dump: CUSA08809 (EU 1.01) ou CUSA08034 (US 1.00)'],
        ['Som', 'Módulos libSceNgs2.sprx e libSceUlt.sprx do seu console ou do shadPS4; sem eles o jogo fica mudo'],
        ['Python', 'Não precisa instalar']
      ],
      steps: [
        'Baixe o SotC-PC.zip pelo botão "Baixar" desta página.',
        'Extraia o .zip em uma pasta.',
        'Abra o SotC.exe. Na primeira execução, o launcher procura nos seus discos a pasta do jogo, os módulos de som, saves do shadPS4 para importar e DLCs.',
        'Confira a página "Jogo e saves" do launcher.',
        'Clique em PLAY.'
      ],
      controls: 'F1, Insert ou L3+R3: menu · F7: limite de 30 FPS · F8: troca a geração de quadros · F10: mostra desempenho · F11: tela cheia',
      issues: 'A primeira execução depois de uma atualização recompila os shaders e demora para carregar. A qualidade de textura "Máxima" pode fechar o jogo em visões muito amplas. Em algumas placas AMD GCN o dispositivo de vídeo pode ser perdido depois do primeiro colosso. A geração de quadros pode fazer as barras do HUD tremerem.'
    }
  ];
})();
