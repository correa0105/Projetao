export const professionAssistCooldownMs = 2 * 60 * 60 * 1000;
export const professionAssistReductionSeconds = 30 * 60;
export type ProfessionBench =
  'forge' | 'mixture' | 'writing' | 'wood' | 'textile' | 'precision' | 'stone' | 'kiln' | 'cooking';
export type ProfessionWork = {
  bench: ProfessionBench;
  tool: string | null;
  action: string;
  working: string;
  detail: string;
};
const work: Record<string, ProfessionWork> = {
  smithing: {
    bench: 'forge',
    tool: 'smith-hammer',
    action: 'Trabalhar na forja',
    working: 'Martelando a peça',
    detail: 'Calor, têmpera e golpes precisos dão forma ao metal.',
  },
  alchemy: {
    bench: 'mixture',
    tool: 'pestle',
    action: 'Cuidar da destilação',
    working: 'Preparando os reagentes',
    detail: 'Os extratos se combinam lentamente no alambique.',
  },
  herbalism: {
    bench: 'mixture',
    tool: 'pestle',
    action: 'Macerar as ervas',
    working: 'Macerando as ervas',
    detail: 'As plantas liberam suas propriedades durante o preparo.',
  },
  brewing: {
    bench: 'mixture',
    tool: 'pestle',
    action: 'Cuidar da fermentação',
    working: 'Trabalhando no preparo',
    detail: 'Os ingredientes descansam e amadurecem na oficina.',
  },
  poison: {
    bench: 'mixture',
    tool: 'pestle',
    action: 'Refinar o extrato',
    working: 'Refinando o extrato',
    detail: 'A mistura é filtrada e estabilizada com cuidado.',
  },
  cartography: {
    bench: 'writing',
    tool: 'quill',
    action: 'Revisar o traçado',
    working: 'Traçando os caminhos',
    detail: 'Registros de aventura ganham forma no pergaminho.',
  },
  calligraphy: {
    bench: 'writing',
    tool: 'quill',
    action: 'Iluminar o manuscrito',
    working: 'Trabalhando na escrita',
    detail: 'A tinta seca enquanto o documento recebe acabamento.',
  },
  navigation: {
    bench: 'writing',
    tool: 'quill',
    action: 'Conferir as rotas',
    working: 'Revisando a carta',
    detail: 'As anotações de viagem compõem uma carta precisa.',
  },
  forgery: {
    bench: 'writing',
    tool: 'quill',
    action: 'Trabalhar no documento',
    working: 'Preparando o documento',
    detail: 'O documento de cena recebe escrita e acabamento.',
  },
  painting: {
    bench: 'writing',
    tool: 'brush',
    action: 'Trabalhar na pintura',
    working: 'Aplicando os pigmentos',
    detail: 'Pigmentos e camadas de cor compõem a criação.',
  },
  carpentry: {
    bench: 'wood',
    tool: 'carving-chisel',
    action: 'Talhar e ajustar',
    working: 'Trabalhando na madeira',
    detail: 'A madeira é ajustada, unida e preparada para durar.',
  },
  woodcarving: {
    bench: 'wood',
    tool: 'carving-chisel',
    action: 'Refinar o entalhe',
    working: 'Entalhando os detalhes',
    detail: 'O desenho aparece a cada corte cuidadoso.',
  },
  luthiery: {
    bench: 'wood',
    tool: 'carving-chisel',
    action: 'Ajustar o instrumento',
    working: 'Refinando o instrumento',
    detail: 'Madeira, encaixes e ressonância encontram seu equilíbrio.',
  },
  games: {
    bench: 'wood',
    tool: 'carving-chisel',
    action: 'Lapidar as peças',
    working: 'Entalhando as peças',
    detail: 'Cada peça do conjunto recebe seu próprio acabamento.',
  },
  leatherwork: {
    bench: 'textile',
    tool: 'sewing-needle',
    action: 'Costurar o couro',
    working: 'Trabalhando na costura',
    detail: 'As fibras são alinhadas e as costuras reforçadas.',
  },
  cobbling: {
    bench: 'textile',
    tool: 'sewing-needle',
    action: 'Reforçar a costura',
    working: 'Costurando o acabamento',
    detail: 'Solas, tecidos e couro são preparados na bancada.',
  },
  weaving: {
    bench: 'textile',
    tool: 'sewing-needle',
    action: 'Trabalhar na trama',
    working: 'Tecendo o acabamento',
    detail: 'Os fios se encontram em uma trama firme e cuidadosa.',
  },
  disguise: {
    bench: 'textile',
    tool: 'sewing-needle',
    action: 'Ajustar o traje',
    working: 'Costurando os detalhes',
    detail: 'O traje e seus detalhes são preparados para a cena.',
  },
  jewelry: {
    bench: 'precision',
    tool: 'fine-file',
    action: 'Polir e lapidar',
    working: 'Lapidando a criação',
    detail: 'Metais e gemas recebem polimento e encaixes precisos.',
  },
  tinkering: {
    bench: 'precision',
    tool: 'fine-file',
    action: 'Ajustar o mecanismo',
    working: 'Ajustando o mecanismo',
    detail: 'Pequenos mecanismos ganham ajuste e acabamento.',
  },
  'thieves-tools': {
    bench: 'precision',
    tool: 'fine-file',
    action: 'Refinar as ferramentas',
    working: 'Ajustando as ferramentas',
    detail: 'Cada ferramenta recebe ajustes delicados na bancada.',
  },
  masonry: {
    bench: 'stone',
    tool: 'carving-chisel',
    action: 'Trabalhar a pedra',
    working: 'Talhando a pedra',
    detail: 'O bloco é talhado e o acabamento revela suas linhas.',
  },
  pottery: {
    bench: 'kiln',
    tool: null,
    action: 'Cuidar da queima',
    working: 'Controlando a queima',
    detail: 'A argila ganha resistência e acabamento no forno.',
  },
  glassblowing: {
    bench: 'kiln',
    tool: null,
    action: 'Cuidar do forno',
    working: 'Controlando o calor',
    detail: 'O vidro é aquecido, moldado e resfriado com cuidado.',
  },
  cooking: {
    bench: 'cooking',
    tool: 'ladle',
    action: 'Mexer o preparo',
    working: 'Mexendo o preparo',
    detail: 'Os ingredientes cozinham lentamente sobre as brasas.',
  },
};
export function professionWork(id: string) {
  return work[id] ?? work.smithing;
}
export function nextProfessionAssist(project: { last_assisted_at?: string | null }) {
  return project.last_assisted_at
    ? Date.parse(project.last_assisted_at) + professionAssistCooldownMs
    : 0;
}
