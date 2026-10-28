export const cards = [
  {
    id: 'vigil',
    rarity: 'common',
    name: 'A Lanterna',
    family: 'Luz',
    price_cp: 5000,
    buyable: true,
    cell: 0,
    description:
      'Uma chama protegida contra a noite. O símbolo de quem permanece quando os outros precisam descansar.',
    comment:
      'A Lanterna. Ficavam acesas lanternas como esta nos portões do Norte, mesmo quando ninguém esperava visitas. Gosto de pensar que algum viajante conseguiu voltar por causa delas.',
  },
  {
    id: 'raven',
    rarity: 'common',
    name: 'O Corvo',
    family: 'Presságio',
    price_cp: 7500,
    buyable: true,
    cell: 1,
    description:
      'Olhos atentos sobre as ruínas. Nem toda mensagem chega pelas mãos de um mensageiro.',
    comment:
      'Olhe as penas, perto do pescoço. O artista pintou cada uma antes de tocar no céu. Disse que este corvo conhecia o caminho de casa; nunca me contou de quem era a casa.',
  },
  {
    id: 'mirror',
    rarity: 'uncommon',
    name: 'O Espelho Partido',
    family: 'Mistério',
    price_cp: 10000,
    buyable: true,
    cell: 2,
    description: 'Os fragmentos guardam perspectivas que um espelho inteiro jamais mostraria.',
    comment:
      'Recebi este espelho dentro de um pano de linho. O dono pediu que eu não juntasse os pedaços. Guardei a carta, e respeitei o pedido. Você parece ter parado no mesmo fragmento que ele.',
  },
  {
    id: 'moon',
    rarity: 'rare',
    name: 'A Chave',
    family: 'Acesso',
    price_cp: 15000,
    buyable: true,
    cell: 3,
    description: 'Ferro antigo, uma pedra verde e dentes que ainda procuram a fechadura certa.',
    comment:
      'Repare nos dentes da chave. Não combinam com nenhuma porta deste salão. Veio embrulhada num mapa de ruínas; a fechadura desenhada na pedra era a única marca que não havia sido riscada.',
  },
  {
    id: 'roots',
    rarity: 'uncommon',
    name: 'A Árvore',
    family: 'Memória',
    price_cp: 0,
    buyable: false,
    cell: 4,
    description: 'Muito antes dos nomes dos reinos, estas raízes já sustentavam a terra.',
    comment:
      'Passe o olhar pelas raízes. Quase se confundem com a pedra. Ainda não posso entregar esta carta; prometi guardá-la até que saibam de onde veio.',
  },
  {
    id: 'anchor',
    rarity: 'rare',
    name: 'O Poço',
    family: 'Profundidade',
    price_cp: 0,
    buyable: false,
    cell: 5,
    description: 'Pedra quebrada e uma corda gasta cercam uma luz fria no fundo do poço.',
    comment:
      'O artista deixou cair uma moeda antes de desenhar este poço. Esperou pelo som até a vela se apagar. Na manhã seguinte, pintou aquela luz no fundo. A carta continua sob minha guarda.',
  },
  {
    id: 'blade',
    rarity: 'very-rare',
    name: 'A Lança',
    family: 'Juramento',
    price_cp: 0,
    buyable: false,
    cell: 6,
    description: 'Uma lança dourada permanece entre as armas comuns de um pátio abandonado.',
    comment:
      'As outras lanças eram da guarda do pátio. A dourada já estava ali quando chegaram. Ninguém quis levar a última arma depois que os portões fecharam. Guardo a carta até saber por quê.',
  },
  {
    id: 'throne',
    rarity: 'legendary',
    name: 'A Torre',
    family: 'Vigília',
    price_cp: 0,
    buyable: false,
    cell: 7,
    description: 'Uma esfera verde ilumina o alto de uma torre de pedra entre montanhas desertas.',
    comment:
      'A escada sobe por fora da torre, mas o desenho não mostra uma entrada. O pintor disse que a esfera ainda acendia ao anoitecer. Não voltou às montanhas e não me pediu a carta de volta.',
  },
] as const;
export type Card = (typeof cards)[number];
export type OwnedCard = {
  id: string;
  card_id: string;
  level: number;
  slot: number | null;
  price_cp: number;
  created_at: string;
};
export const cardQuestions = [
  {
    question: 'Quem é você?',
    answer:
      'Chamam-me de Anfitrião. Recebo as cartas que viajantes trazem e cuido delas até encontrarem outra companhia. Algumas vieram com uma história; outras, apenas com um pedido de silêncio. Pode se sentar.',
  },
  {
    question: 'Quantas cartas posso levar?',
    answer:
      'Três podem acompanhar você ao mesmo tempo. As demais ficam guardadas na sua coleção. Escolha um dos três lugares e coloque ali a carta que deseja levar; poderá trocar a combinação quando voltar.',
  },
  {
    question: 'Como consigo novas cartas?',
    answer:
      'As quatro primeiras estão à venda; deixei o preço junto de cada uma. As outras ficam sob minha guarda por enquanto. Quando houver um modo de recebê-las, você saberá. Não aceito ouro por promessas.',
  },
] as const;
export const cardRarities = {
  common: {name:'Comum',colour:'#f5f4ef',effects:0},
  uncommon: {name:'Incomum',colour:'#7aa75f',effects:0},
  rare: {name:'Rara',colour:'#70a7e2',effects:1},
  'very-rare': {name:'Muito rara',colour:'#b88ce8',effects:3},
  legendary: {name:'Lendária',colour:'#eeaa58',effects:5},
} as const;
