// PHB 2024, mechanical data only. Sources and the table's Magic Initiate rule:
// docs/CHARACTER-CREATION-20261015.md
export type BackgroundRule = {
  abilities: number[];
  skills: string[];
  tool: string;
  feat: string;
  gold: number;
  gear: string[];
};
export const additionalBackgrounds: Record<string, BackgroundRule> = {
  Artesão: {
    abilities: [0, 1, 3],
    skills: ['Investigação', 'Persuasão'],
    tool: 'Ferramenta de artesão escolhida',
    feat: 'Artífice',
    gold: 32,
    gear: ['Ferramenta de artesão escolhida', 'Duas bolsas', 'Roupas de viajante'],
  },
  Charlatão: {
    abilities: [1, 2, 5],
    skills: ['Enganação', 'Prestidigitação'],
    tool: 'Kit de falsificação',
    feat: 'Habilidoso',
    gold: 15,
    gear: ['Kit de falsificação', 'Fantasia', 'Roupas finas'],
  },
  Artista: {
    abilities: [0, 1, 5],
    skills: ['Acrobacia', 'Atuação'],
    tool: 'Instrumento escolhido',
    feat: 'Músico',
    gold: 11,
    gear: ['Instrumento escolhido', 'Duas fantasias', 'Espelho', 'Perfume', 'Roupas de viajante'],
  },
  Fazendeiro: {
    abilities: [0, 2, 4],
    skills: ['Adestrar Animais', 'Natureza'],
    tool: 'Ferramentas de carpinteiro',
    feat: 'Robusto',
    gold: 30,
    gear: [
      'Foice',
      'Ferramentas de carpinteiro',
      'Kit de curandeiro',
      'Panela de ferro',
      'Pá',
      'Roupas de viajante',
    ],
  },
  Guarda: {
    abilities: [0, 3, 4],
    skills: ['Atletismo', 'Percepção'],
    tool: 'Jogo escolhido',
    feat: 'Alerta',
    gold: 12,
    gear: [
      'Lança',
      'Besta leve',
      '20 virotes',
      'Jogo escolhido',
      'Lanterna coberta',
      'Algemas',
      'Aljava',
      'Roupas de viajante',
    ],
  },
  Guia: {
    abilities: [1, 2, 4],
    skills: ['Furtividade', 'Sobrevivência'],
    tool: 'Ferramentas de cartógrafo',
    feat: 'Iniciado em Magia: Druida',
    gold: 3,
    gear: [
      'Arco curto',
      '20 flechas',
      'Ferramentas de cartógrafo',
      'Saco de dormir',
      'Aljava',
      'Tenda',
      'Roupas de viajante',
    ],
  },
  Eremita: {
    abilities: [2, 4, 5],
    skills: ['Medicina', 'Religião'],
    tool: 'Kit de herbalismo',
    feat: 'Curandeiro',
    gold: 16,
    gear: [
      'Bordão',
      'Kit de herbalismo',
      'Saco de dormir',
      'Livro de filosofia',
      'Lamparina',
      'Três frascos de óleo',
      'Roupas de viajante',
    ],
  },
  Nobre: {
    abilities: [0, 3, 5],
    skills: ['História', 'Persuasão'],
    tool: 'Jogo escolhido',
    feat: 'Habilidoso',
    gold: 29,
    gear: ['Jogo escolhido', 'Roupas finas', 'Perfume'],
  },
  Mercador: {
    abilities: [2, 3, 5],
    skills: ['Adestrar Animais', 'Persuasão'],
    tool: 'Ferramentas de navegador',
    feat: 'Sortudo',
    gold: 22,
    gear: ['Ferramentas de navegador', 'Duas bolsas', 'Roupas de viajante'],
  },
  Marinheiro: {
    abilities: [0, 1, 4],
    skills: ['Acrobacia', 'Percepção'],
    tool: 'Ferramentas de navegador',
    feat: 'Brigão de Taverna',
    gold: 20,
    gear: ['Adaga', 'Ferramentas de navegador', 'Corda', 'Roupas de viajante'],
  },
  Escriba: {
    abilities: [1, 3, 4],
    skills: ['Investigação', 'Percepção'],
    tool: 'Suprimentos de caligrafia',
    feat: 'Habilidoso',
    gold: 23,
    gear: [
      'Suprimentos de caligrafia',
      'Roupas finas',
      'Lamparina',
      'Três frascos de óleo',
      '12 folhas de pergaminho',
    ],
  },
  Andarilho: {
    abilities: [1, 4, 5],
    skills: ['Intuição', 'Furtividade'],
    tool: 'Ferramentas de ladrão',
    feat: 'Sortudo',
    gold: 16,
    gear: [
      'Duas adagas',
      'Ferramentas de ladrão',
      'Jogo escolhido',
      'Saco de dormir',
      'Duas bolsas',
      'Roupas de viajante',
    ],
  },
};
