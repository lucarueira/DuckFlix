// Catálogo do DuckSteam. Para adicionar um jogo, copie um bloco e troque os dados.
// "repo" (dono/nome no GitHub) faz o site buscar a versão mais recente e o link direto do download.
// "tag" usa uma release específica em vez da mais recente. "downloads": [{ name, url, size }] serve de
// reserva (ou de única fonte) com link direto. "cover" é a imagem larga; "poster" é a capa vertical.
(function () {
  'use strict';
  const og = repo => `https://opengraph.githubassets.com/1/${repo}`;
  const gh = (repo, label = 'Repositório no GitHub') => ({ label, url: `https://github.com/${repo}` });

  const N64_REQ = [
    ['Sistema', 'Windows 10/11, 64 bits'],
    ['Placa de vídeo', 'Compatível com Direct3D 12.0 (Shader Model 6) ou Vulkan 1.2, com o driver atualizado'],
    ['Processador', 'Com suporte a SSE4.1 (Intel Core 2 Penryn / AMD Bulldozer ou mais novo)'],
    ['Arquivo do jogo', 'A sua própria ROM do jogo original (veja abaixo qual versão)']
  ];
  const HM_REQ = [
    ['Sistema', 'Windows 10/11, 64 bits'],
    ['Placa de vídeo', 'Placa de vídeo com driver atualizado'],
    ['Arquivo do jogo', 'A sua própria ROM do jogo original (veja abaixo qual versão)']
  ];

  // Projetos "N64: Recompiled": o jogo é recompilado para rodar nativo no PC (RT64 para os gráficos).
  function recomp(o) {
    return {
      id: o.id, name: o.name, repo: o.repo, author: o.author, license: 'GPL-3.0',
      tagline: o.tagline, tags: ['Nintendo 64', ...o.tags, 'Port da comunidade'],
      cover: og(o.repo), icon: o.icon,
      links: [gh(o.repo), ...(o.links || [])],
      description: [
        o.about,
        'O projeto usa a "recompilação estática" (N64: Recompiled): o código do jogo original é traduzido para rodar nativo no PC, sem emulador, com gráficos renderizados pelo RT64.',
        `Nenhum arquivo do jogo vem junto. Você precisa fornecer a sua própria ROM: ${o.rom} Outros formatos além de .z64 são convertidos automaticamente, desde que seja a ROM correta. Não é um emulador e não roda outras ROMs.`
      ],
      features: o.features || ['Roda nativo no PC, sem emulador', 'Gráficos com RT64', 'Controle e teclado', 'Código aberto (GPL-3.0)'],
      requirements: o.requirements || N64_REQ,
      steps: [
        'Baixe o arquivo "Windows" (.zip) pelo botão "Baixar" desta página.',
        'Extraia o .zip em uma pasta do seu PC.',
        `Abra o executável do jogo (${o.exe || 'arquivo .exe da pasta'}).`,
        `No menu principal, selecione a sua ROM: ${o.rom}`,
        'Pronto: o jogo carrega os dados da ROM sozinho, sem etapa de extração separada. É só jogar.'
      ],
      issues: o.issues
    };
  }

  // Portes da HarbourMasters (libultraship): a ROM é convertida em um arquivo .o2r na primeira execução.
  function harbour(o) {
    return {
      id: o.id, name: o.name, repo: o.repo, tag: o.tag, downloads: o.downloads, author: o.author || 'HarbourMasters', license: o.license || '—',
      tagline: o.tagline, tags: [...o.tags, 'Port da comunidade'], cover: og(o.repo), icon: o.icon,
      links: [gh(o.repo), ...(o.links || [])],
      description: [
        o.about,
        'O projeto não inclui nenhum arquivo protegido por direitos autorais: você precisa fornecer uma cópia compatível do jogo. Na primeira execução, os dados da ROM são extraídos para um arquivo próprio (.o2r) e o jogo passa a rodar direto.'
      ],
      features: o.features,
      requirements: HM_REQ,
      steps: [
        `Confira se a sua ROM é compatível: ${o.rom}`,
        'Baixe o arquivo para Windows (.zip) pelo botão "Baixar" desta página.',
        'Extraia o .zip em uma pasta do seu PC.',
        `Abra ${o.exe}. Quando o jogo pedir, selecione a sua ROM.`,
        'Aguarde a conversão inicial e jogue.'
      ],
      issues: o.issues
    };
  }

  window.DUCKSTEAM_GAMES = [
    {
      id: 'bloodborne-pc',
      name: 'Bloodborne for Windows',
      repo: 'Supermedo/bloodborne_pc',
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
      repo: 'Lucas-blip-png/ShadowOfTheColossus-PC',
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
    },

    // ---- Jogos de Nintendo 64 recompilados (lista do GithubLauncher / N64RecompLauncher) ----
    recomp({
      id: 'zelda64-recomp', name: 'Zelda 64: Recompiled', repo: 'Zelda64Recomp/Zelda64Recomp', author: 'Zelda64Recomp',
      tagline: 'The Legend of Zelda: Majora\'s Mask nativo no PC, com alta taxa de quadros.',
      tags: ['Aventura', 'Ação'], icon: 'https://raw.githubusercontent.com/Zelda64Recomp/Zelda64Recomp/refs/heads/dev/icons/512.png',
      about: 'Recompilação estática de The Legend of Zelda: Majora\'s Mask para PC (Windows, Linux e Mac), com a promessa de suportar também Ocarina of Time no futuro.',
      rom: 'The Legend of Zelda: Majora\'s Mask, versão americana (US).',
      features: ['Alta taxa de quadros (RT64)', 'Suporte a widescreen e ultrawide', 'Controle e teclado', 'Roda nativo, sem emulador', 'Suporte a mods', 'Código aberto (GPL-3.0)'],
      exe: 'Zelda64Recompiled.exe'
    }),
    recomp({
      id: 'goemon64-recomp', name: 'Goemon 64: Recompiled', repo: 'klorfmorf/Goemon64Recomp', author: 'klorfmorf',
      tagline: 'Mystical Ninja Starring Goemon como port não oficial para PC.',
      tags: ['Aventura', 'Plataforma'], icon: 'https://raw.githubusercontent.com/klorfmorf/Goemon64Recomp/refs/heads/dev/icons/512.png',
      about: 'Port não oficial de Mystical Ninja Starring Goemon para PC, feito por recompilação estática (e, no futuro, também Goemon\'s Great Adventure).',
      rom: 'Mystical Ninja Starring Goemon, versão americana (US).',
      issues: 'A versão atual é de desenvolvimento (v0.2.0-dev), então podem existir falhas.',
      exe: 'Goemon64Recompiled.exe'
    }),
    recomp({
      id: 'mk64-recomp', name: 'Mario Kart 64: Recompiled', repo: 'sonicdcer/MarioKart64Recomp', author: 'sonicdcer',
      tagline: 'Mario Kart 64 para Windows, Linux e macOS.',
      tags: ['Corrida', 'Multiplayer local'], icon: 'https://raw.githubusercontent.com/sonicdcer/MarioKart64Recomp/refs/heads/main/icons/512.png',
      about: 'Mario Kart 64 para PC por recompilação estática, com gráficos modernos e alta taxa de quadros.',
      rom: 'Mario Kart 64, versão americana (US).',
      exe: 'MarioKart64Recompiled.exe'
    }),
    recomp({
      id: 'dinosaur-planet-recomp', name: 'Dinosaur Planet: Recompiled', repo: 'DinosaurPlanetRecomp/dino-recomp', author: 'DinosaurPlanetRecomp',
      tagline: 'O protótipo de Dinosaur Planet (dez/2000) virou um port nativo, com suporte a mods.',
      tags: ['Aventura', 'Mods'], icon: 'https://raw.githubusercontent.com/DinosaurPlanetRecomp/dino-recomp/refs/heads/main/icons/64.png',
      links: [{ label: 'Discord da comunidade', url: 'https://discord.gg/SUrA4aV7UW' }],
      about: 'Recompilação estática do protótipo de dezembro de 2000 de Dinosaur Planet (o jogo que virou Star Fox Adventures), em um port nativo com melhorias e suporte extenso a mods. O projeto não usa IA generativa.',
      rom: 'o protótipo de Dinosaur Planet de dezembro de 2000, divulgado pela Forest of Illusion em 20/02/2021. Não funciona com ROMs com patches: os patches populares existem como mods.',
      features: ['Roda nativo no PC', 'Suporte extenso a mods', 'Modo portátil (crie um portable.txt ao lado do .exe)', 'Janela 4:3 com o argumento --4x3', 'Código aberto (GPL-3.0)'],
      requirements: [
        ['Sistema', 'Windows 10/11, 64 bits'],
        ['Placa de vídeo', 'Compatível com Direct3D 12.0 (Shader Model 6) ou Vulkan 1.2 (de GeForce GT 630, Radeon HD 7750 ou Intel HD 510 em diante)'],
        ['Processador', 'Com suporte a SSE4.1 (Intel Core 2 Penryn / AMD Bulldozer ou mais novo)'],
        ['Arquivo do jogo', 'A ROM do protótipo de dezembro de 2000']
      ],
      issues: 'O projeto ainda está em desenvolvimento e não tem algumas melhorias comuns em outras recompilações. Os saves ficam em %LOCALAPPDATA%\\DinoPlanetRecompiled\\saves. Se o jogo fechar ao abrir, atualize o driver de vídeo.',
      exe: 'o .exe da pasta'
    }),
    recomp({
      id: 'drmario64-recomp', name: 'Dr. Mario 64: Recompiled', repo: 'theboy181/drmario64_recomp_plus', author: 'theboy181',
      tagline: 'Dr. Mario 64 modernizado, com interpolação de quadros e efeito CRT.',
      tags: ['Quebra-cabeça', 'Multiplayer local'], icon: 'https://raw.githubusercontent.com/theboy181/drmario64_recomp_plus/refs/heads/main/icons/512.png',
      about: 'Versão recompilada e modernizada de Dr. Mario 64, com renderização melhorada, movimento mais fluido e ajustes de qualidade de vida, mantendo a fidelidade ao original.',
      rom: 'Dr. Mario 64, versão americana (US), limpa e sem modificações.',
      features: ['Interpolação para 60+ FPS', 'Suporte a 4 jogadores com controles', 'Efeitos de CRT', 'Pílulas renderizadas na GPU', 'Menu principal e ícone novos'],
      issues: 'Foi pouco testado até agora.',
      exe: 'o .exe da pasta'
    }),
    recomp({
      id: 'dnzh-recomp', name: 'Duke Nukem: Zero Hour: Recompiled', repo: 'sonicdcer/DNZHRecomp', author: 'sonicdcer',
      tagline: 'Duke Nukem: Zero Hour recompilado para PC.',
      tags: ['Ação', 'Tiro'], icon: 'https://raw.githubusercontent.com/sonicdcer/DNZHRecomp/refs/heads/main/icons/512.png',
      about: 'Recompilação estática de Duke Nukem: Zero Hour para PC (Windows, Linux e macOS).',
      rom: 'Duke Nukem: Zero Hour, versão americana (US).',
      issues: 'Versão ainda inicial (0.0.3).',
      exe: 'DNZHRecompiled.exe'
    }),
    recomp({
      id: 'starfox64-recomp', name: 'Star Fox 64: Recompiled', repo: 'sonicdcer/Starfox64Recomp', author: 'sonicdcer',
      tagline: 'Star Fox 64 nativo no PC, com suporte a mods.',
      tags: ['Ação', 'Tiro espacial', 'Mods'], icon: 'https://raw.githubusercontent.com/sonicdcer/Starfox64Recomp/refs/heads/main/icons/512.png',
      links: [{ label: 'Mods (Thunderstore)', url: 'https://thunderstore.io/c/starfox-64-recompiled/' }],
      about: 'Star Fox 64 para PC (Windows, Linux e macOS) por recompilação estática, com alta taxa de quadros e mods disponíveis na Thunderstore (baixe os mods direto do site; o gerenciador r2modman não é suportado).',
      rom: 'Star Fox 64, versão americana 1.1 (Rev A).',
      exe: 'Starfox64Recompiled.exe'
    }),
    recomp({
      id: 'banjo-recomp', name: 'Banjo: Recompiled', repo: 'BanjoRecomp/BanjoRecomp', author: 'BanjoRecomp',
      tagline: 'Banjo-Kazooie para PC, com mods e taxa de quadros livre.',
      tags: ['Aventura', 'Plataforma', 'Mods'], icon: 'https://raw.githubusercontent.com/BanjoRecomp/BanjoRecomp/refs/heads/main/icons/app.png',
      links: [{ label: 'Mods (Thunderstore)', url: 'https://thunderstore.io/c/banjo-recompiled/' }],
      about: 'Port de Banjo-Kazooie para PC (Windows, Linux e Mac) feito com o N64: Recompiled. O áudio é fiel ao original, sem estalos, e os saves e carregamentos são instantâneos.',
      rom: 'Banjo-Kazooie, versão americana 1.0 (North American 1.0).',
      features: ['Qualquer taxa de quadros (RT64)', 'Áudio fiel ao original', 'Mods na Thunderstore', 'Opção para voltar à contagem de notas do N64', 'Steam Deck: extraia o build Linux e use "Add to Steam"'],
      requirements: [
        ['Sistema', 'Windows 10/11, 64 bits'],
        ['Placa de vídeo', 'Compatível com Direct3D 12.0 (Shader Model 6), Vulkan 1.2 ou Metal Tier 2. A mais antiga suportada da AMD é a Radeon HD 7750 (a de 2012)'],
        ['Arquivo do jogo', 'A sua própria ROM de Banjo-Kazooie (US 1.0)']
      ],
      exe: 'BanjoRecompiled.exe'
    }),
    recomp({
      id: 'bomberman64-recomp', name: 'Bomberman 64: Recompiled', repo: 'RevoSucks/BM64Recomp', author: 'RevoSucks',
      tagline: 'Bomberman 64 nativo no PC.',
      tags: ['Ação', 'Aventura'], icon: 'https://raw.githubusercontent.com/RevoSucks/BM64Recomp/refs/heads/master/icons/512.png',
      about: 'Port de Bomberman 64 para PC por recompilação estática.',
      rom: 'Bomberman 64, versão americana 1.0 (US).',
      exe: 'BM64Recompiled.exe'
    }),

    // ---- Experimentais ----
    recomp({
      id: 'chameleon-twist-recomp', name: 'Chameleon Twist: Recompiled', repo: 'Rainchus/ChameleonTwist1-JP-Recomp', author: 'Rainchus',
      tagline: 'Chameleon Twist (versão japonesa) recompilado para PC. Experimental.',
      tags: ['Plataforma', 'Experimental'], icon: 'https://cdn2.steamgriddb.com/icon/c1f22f4c38899f51f1ed3ce20120bbd9.png',
      about: 'Port de Chameleon Twist para PC por recompilação estática. É um projeto experimental.',
      rom: 'Chameleon Twist, versão JAPONESA (JP) do lançamento para Nintendo 64. Outras regiões não são aceitas.',
      issues: 'Projeto experimental: pode ter falhas. Suporte a mods e a outros idiomas está planejado.',
      exe: 'o .exe da pasta'
    }),
    recomp({
      id: 'megaman64-recomp', name: 'Mega Man 64: Recompiled', repo: 'MegaMan64Recomp/MegaMan64Recompiled', author: 'MegaMan64Recomp',
      tagline: 'Recompilação de Mega Man 64. Experimental.',
      tags: ['Ação', 'Experimental'], icon: 'https://cdn2.steamgriddb.com/icon/850618e22f83f152773d2a3e51168812.png',
      about: 'Recompilação de Mega Man 64 para PC. O projeto é experimental e o repositório ainda não traz instruções oficiais.',
      rom: 'Mega Man 64 (a versão exata não está documentada no repositório; confira a página do projeto).',
      issues: 'Projeto experimental e sem documentação oficial por enquanto.',
      exe: 'o .exe da pasta'
    }),
    recomp({
      id: 'quest64-recomp', name: 'Quest 64: Recompiled', repo: 'Rainchus/Quest64-Recomp', author: 'Rainchus',
      tagline: 'Quest 64 nativo no PC. Experimental.',
      tags: ['RPG', 'Experimental'], icon: 'https://raw.githubusercontent.com/Rainchus/Quest64-Recomp/refs/heads/main/icons/512.png',
      about: 'Port de Quest 64 para PC por recompilação estática. É um projeto experimental.',
      rom: 'Quest 64, versão americana 1.0 (US).',
      issues: 'Projeto experimental: pode ter falhas.',
      exe: 'o .exe da pasta'
    }),
    recomp({
      id: 'bomberman-hero-recomp', name: 'Bomberman Hero: Recompiled', repo: 'RevoSucks/BMHeroRecomp', author: 'RevoSucks',
      tagline: 'Bomberman Hero nativo no PC. Experimental.',
      tags: ['Ação', 'Aventura', 'Experimental'], icon: 'https://raw.githubusercontent.com/RevoSucks/BMHeroRecomp/refs/heads/master/icons/app.png',
      about: 'Port de Bomberman Hero para PC por recompilação estática. É um projeto experimental.',
      rom: 'Bomberman Hero, versão americana 1.0 (US).',
      issues: 'Projeto experimental: pode ter falhas.',
      exe: 'o .exe da pasta'
    }),

    // ---- Portes da HarbourMasters e outros ----
    harbour({
      id: 'ship-of-harkinian', name: 'Ship of Harkinian', repo: 'HarbourMasters/Shipwright',
      tagline: 'Ocarina of Time para PC, com randomizer, mods e controles modernos.',
      tags: ['Aventura', 'Ação', 'Mods'],
      links: [{ label: 'Site oficial', url: 'https://www.shipofharkinian.com' }, { label: 'Verificador de ROM', url: 'https://ship.equipment/' }, { label: 'Discord', url: 'https://discord.com/invite/harbourmasters' }],
      about: 'Port de The Legend of Zelda: Ocarina of Time para PC, construído sobre a libultraship (uma biblioteca que imita a libultra do Nintendo 64 em hardware moderno).',
      rom: 'Ocarina of Time (confira no verificador em ship.equipment).', exe: 'soh.exe',
      features: ['Roda nativo no PC', 'Salvar/carregar estado (F5/F7)', 'Assets alternativos (Tab)', 'Texto para voz (F9)', 'Tela cheia (F11)', 'Menu com ESC'],
      issues: 'Atalhos: ESC abre o menu · F2 captura o mouse · F5 salva o estado · F7 carrega · F11 tela cheia · Ctrl+R reinicia. Teclado padrão: A=X, B=C, Z=Z, Start=Espaço, analógico=WASD, botões C=setas.'
    }),
    harbour({
      id: '2ship-2harkinian', name: '2 Ship 2 Harkinian', repo: '2ship2harkinian/2ship2harkinian',
      downloads: [{ name: '2ship-windows.zip (build mais recente)', url: 'https://nightly.link/2ship2harkinian/2ship2harkinian/workflows/main/develop/2ship-windows.zip' }],
      author: '2ship2harkinian', tagline: 'Majora\'s Mask para PC, com a mesma base do Ship of Harkinian.',
      tags: ['Aventura', 'Ação'],
      links: [{ label: 'Verificador de ROM', url: 'https://2ship.equipment/' }],
      about: 'Port de The Legend of Zelda: Majora\'s Mask para PC, usando a libultraship.',
      rom: 'Majora\'s Mask (confira no verificador em 2ship.equipment).', exe: 'o .exe da pasta',
      features: ['Roda nativo no PC', 'Controle e teclado', 'Melhorias gráficas e de jogabilidade']
    }),
    harbour({
      id: 'starship', name: 'Starship', repo: 'HarbourMasters/Starship',
      tagline: 'Star Fox 64 para PC (HarbourMasters).', tags: ['Ação', 'Tiro espacial'],
      about: 'Port de Star Fox 64 para PC pela HarbourMasters.',
      rom: 'Star Fox 64 versão US 1.0 (SHA-1 D8B1088520F7C5F81433292A9258C1184AFA1457) ou US 1.1 Rev A.', exe: 'starship.exe',
      features: ['Roda nativo no PC', 'Aceita ROM US 1.0 e US 1.1 Rev A', 'Controle e teclado']
    }),
    harbour({
      id: 'spaghettikart', name: 'SpaghettiKart', repo: 'HarbourMasters/SpaghettiKart',
      tagline: 'Mario Kart 64 para PC (HarbourMasters).', tags: ['Corrida', 'Multiplayer local'],
      about: 'Port de Mario Kart 64 para PC pela HarbourMasters.',
      rom: 'Mario Kart 64 versão US, no formato .z64 (a US é a única versão suportada).', exe: 'Spaghettify.exe',
      features: ['Roda nativo no PC', 'Controle e teclado']
    }),
    harbour({
      id: 'ghostship', name: 'Ghostship', repo: 'HarbourMasters/Ghostship', license: 'MIT',
      tagline: 'Super Mario 64 para PC (HarbourMasters).', tags: ['Plataforma', 'Aventura'],
      about: 'Port de Super Mario 64 para PC pela HarbourMasters.',
      rom: 'Super Mario 64 versão US ou JP (SHA-1 da US: 9bef1128717f958171a4afac3ed78ee2bb4e86ce).', exe: 'Ghostship.exe',
      features: ['Roda nativo no PC', 'Aceita ROM US e JP', 'Controle e teclado']
    }),
    {
      id: 'perfect-dark-port', name: 'Perfect Dark (port)', repo: 'fgsfdsfgs/perfect_dark', tag: 'ci-dev-build', author: 'fgsfdsfgs',
      license: '—', tagline: 'Port de Perfect Dark para PC, com mouselook, widescreen e até 240 FPS.',
      tags: ['Nintendo 64', 'Tiro em primeira pessoa', 'Port da comunidade'], cover: og('fgsfdsfgs/perfect_dark'),
      downloads: [
        { name: 'pd-x86_64-windows.zip (64 bits)', url: 'https://github.com/fgsfdsfgs/perfect_dark/releases/download/ci-dev-build/pd-x86_64-windows.zip' },
        { name: 'pd-i686-windows.zip (32 bits)', url: 'https://github.com/fgsfdsfgs/perfect_dark/releases/download/ci-dev-build/pd-i686-windows.zip' }
      ],
      links: [gh('fgsfdsfgs/perfect_dark'), { label: 'Decompilação original', url: 'https://github.com/n64decomp/perfect_dark' }],
      description: [
        'Port em andamento da decompilação de Perfect Dark para plataformas modernas. Os modos para um jogador e multiplayer em tela dividida já funcionam, com pequenos problemas gráficos e de jogabilidade, e talvez travamentos ocasionais.',
        'Você precisa ter uma ROM de Perfect Dark. A recomendada é a ntsc-final (US V1.1 / Rev 1, md5 e03b088b6ac9e0080440efed07c1e40f), que aparece como "NTSC version 8.7 final" na tela de abertura.'
      ],
      features: ['Mouselook', 'Controle com dois analógicos', 'Widescreen e campo de visão configurável', '60 FPS (e experimental até 240 FPS)', 'Correções de bugs do original', 'Suporte básico a mods (fases customizadas)', 'Emula o Transfer Pak para liberar cheats'],
      requirements: [
        ['Sistema', 'Windows 7 ou mais novo (32 ou 64 bits)'],
        ['Arquivo do jogo', 'ROM de Perfect Dark: ntsc-final (recomendada), ntsc-1.0, jpn-final ou pal-final (as duas últimas exigem um executável compilado à parte)']
      ],
      steps: [
        'Baixe o arquivo para Windows pelo botão "Baixar" desta página.',
        'Extraia o .zip e abra a pasta criada.',
        'Dentro dela, coloque a sua ROM na pasta "data" com o nome pd.ntsc-final.z64 (PAL: pd.pal-final.z64 · JPN: pd.jpn-final.z64).',
        'Opcional: coloque também a ROM de Perfect Dark do Game Boy Color como pd.gbc na pasta "data" para emular o Transfer Pak e liberar cheats automaticamente.',
        'Abra o executável do jogo e jogue.'
      ],
      issues: 'Taxas acima de ~165 FPS dão problemas: use VSync ou o limite de quadros (Video.FramerateLimit). Os downloads são builds automáticos de desenvolvimento.'
    },
    {
      id: 'sm64coopdx', name: 'Super Mario 64: Coop Deluxe', repo: 'coop-deluxe/sm64coopdx', author: 'Coop Deluxe Team',
      license: '—', tagline: 'Super Mario 64 online multiplayer, com mods em Lua.',
      tags: ['Plataforma', 'Multiplayer online', 'Mods', 'Port da comunidade'], cover: og('coop-deluxe/sm64coopdx'),
      links: [gh('coop-deluxe/sm64coopdx'), { label: 'Wiki', url: 'https://github.com/coop-deluxe/sm64coopdx/wiki' }, { label: 'Discord', url: 'https://discord.gg/TJVKHS4' }],
      description: [
        'sm64coopdx é um projeto de multiplayer online para o port de Super Mario 64 para PC. Ele sincroniza todas as entidades e todas as fases entre os jogadores, inclusive inimigos e eventos, então todo mundo interage com o mesmo mundo ao mesmo tempo.',
        'Continuação oficial do sm64ex-coop (criado por djoslin0). Hoje o projeto também mantém e melhora uma API em Lua para mods, parecida com a do Roblox e do Garry\'s Mod.',
        'Assim como os outros ports, ele não inclui o jogo: você precisa fornecer a sua própria ROM de Super Mario 64.'
      ],
      features: ['Multiplayer online', 'Sincroniza inimigos e eventos', 'Mods em Lua', 'Mantido pela comunidade'],
      requirements: [
        ['Sistema', 'Windows 10/11, 64 bits'],
        ['Arquivo do jogo', 'A sua própria ROM de Super Mario 64 (consulte a wiki do projeto para as versões aceitas)']
      ],
      steps: [
        'Baixe o arquivo para Windows pelo botão "Baixar" desta página.',
        'Extraia o .zip em uma pasta do seu PC.',
        'Coloque a sua ROM de Super Mario 64 como o projeto indica (veja a wiki) e abra o executável.',
        'Para jogar online, hospede uma sala ou entre na de um amigo.'
      ],
      issues: 'As instruções detalhadas estão na wiki do projeto (em inglês).'
    }
  ];
})();
