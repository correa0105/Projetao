import { z } from 'zod';
import { hitDice, modifier, statNames, races } from './rules.js';
import base from './sheet-common.json';
import spellData from './character-rules-2024.json';
import { applyAdvancement, type AdvancementState } from './character-advancement.js';
import { additionalBackgrounds, type BackgroundRule } from './character-backgrounds.js';
import { classFightingStyles, fightingStyles } from './fighting-styles.js';
import { sheetFeatureEntries } from './sheet-features.js';
import { featRules } from './feat-choices.js';
import { eberronSpecies, shifterBenefits } from './eberron-species.js';
import { tieflingHornIds } from './tiefling-horns.js';
export const RULESET = 'D&D 2024 · Livro do Jogador e suplementos';
export const { skills, skillAbilities, alignments } = base;
export const languages = [
  'Comum',
  'Língua de sinais comum',
  'Dracônico',
  'Anão',
  'Élfico',
  'Gigante',
  'Gnômico',
  'Goblin',
  'Halfling',
  'Orc',
];
export const rareLanguages = [
  'Abissal',
  'Celestial',
  'Infernal',
  'Primordial',
  'Silvestre',
  'Subcomum',
  'Druídico',
  'Gíria dos ladrões',
  'Dialeto Profundo',
];
const instruments = [
  'Alaúde',
  'Flauta',
  'Tambor',
  'Lira',
  'Gaita de foles',
  'Trombeta',
  'Violino',
  'Dulcimer',
  'Flauta de pã',
  'Charamela',
];
export const artisanTools = [
  'Ferramentas de alquimista',
  'Ferramentas de cervejeiro',
  'Suprimentos de caligrafia',
  'Ferramentas de carpinteiro',
  'Ferramentas de cartógrafo',
  'Ferramentas de sapateiro',
  'Ferramentas de cozinheiro',
  'Ferramentas de vidreiro',
  'Ferramentas de joalheiro',
  'Ferramentas de couro',
  'Ferramentas de pedreiro',
  'Ferramentas de pintor',
  'Ferramentas de oleiro',
  'Ferramentas de ferreiro',
  'Ferramentas de funileiro',
  'Ferramentas de tecelão',
  'Ferramentas de entalhador',
];
export const tools = [
  ...artisanTools,
  'Ferramentas de ladrão',
  'Ferramentas de navegador',
  'Kit de disfarce',
  'Kit de falsificação',
  'Kit de herbalismo',
  'Kit de venenos',
  'Dados de jogo',
  'Baralho',
  'Xadrez de dragão',
  'Três dragões',
  ...instruments,
];
export const spells = spellData.spells;
export const backgroundRules: Record<string, BackgroundRule> = {
  Acólito: {
    abilities: [3, 4, 5],
    skills: ['Intuição', 'Religião'],
    tool: 'Suprimentos de caligrafia',
    feat: 'Iniciado em Magia: Clérigo',
    gold: 8,
    gear: [
      'Suprimentos de caligrafia',
      'Livro de orações',
      'Símbolo sagrado',
      '10 folhas de pergaminho',
      'Vestes',
    ],
  },
  Criminoso: {
    abilities: [1, 2, 3],
    skills: ['Prestidigitação', 'Furtividade'],
    tool: 'Ferramentas de ladrão',
    feat: 'Alerta',
    gold: 16,
    gear: [
      'Duas adagas',
      'Ferramentas de ladrão',
      'Pé de cabra',
      'Duas bolsas',
      'Roupas de viajante',
    ],
  },
  Sábio: {
    abilities: [2, 3, 4],
    skills: ['Arcanismo', 'História'],
    tool: 'Suprimentos de caligrafia',
    feat: 'Iniciado em Magia: Mago',
    gold: 8,
    gear: [
      'Bordão',
      'Suprimentos de caligrafia',
      'Livro de história',
      '8 folhas de pergaminho',
      'Vestes',
    ],
  },
  Soldado: {
    abilities: [0, 1, 2],
    skills: ['Atletismo', 'Intimidação'],
    tool: 'Jogo escolhido',
    feat: 'Atacante Selvagem',
    gold: 14,
    gear: [
      'Lança',
      'Arco curto',
      '20 flechas',
      'Aljava',
      'Kit de curandeiro',
      'Roupas de viajante',
    ],
  },
  ...additionalBackgrounds,
};
export const ORIGIN_RULES = 'alvorada-20261015' as const;
export const originFeats = [
  'Alerta',
  'Atacante Selvagem',
  'Habilidoso',
  'Iniciado em Magia: Clérigo',
  'Iniciado em Magia: Druida',
  'Iniciado em Magia: Mago',
  'Artífice',
  'Brigão de Taverna',
  'Curandeiro',
  'Músico',
  'Robusto',
  'Sortudo',
];
type RaceRule = { speed: number; size: string; traits: string[]; variants: string[] };
export const raceRules: Record<string, RaceRule> = {
  ...eberronSpecies,
  Humano: {
    speed: 9,
    size: 'Médio',
    variants: ['Humano'],
    traits: [
      'Engenhosidade: recebe Inspiração Heroica após descanso longo.',
      'Versatilidade: uma perícia e um talento de origem adicional.',
    ],
  },
  Elfo: {
    speed: 9,
    size: 'Médio',
    variants: ['Alto elfo', 'Elfo da floresta', 'Drow'],
    traits: [
      'Ancestralidade feérica: vantagem em salvaguardas para evitar ou encerrar Enfeitiçado.',
      'Transe: não precisa dormir; magia não o faz dormir; descanso longo em 4 horas de meditação consciente.',
      'Sentidos aguçados: escolha Intuição, Percepção ou Sobrevivência.',
    ],
  },
  Anão: {
    speed: 9,
    size: 'Médio',
    variants: ['Anão'],
    traits: [
      'Visão no escuro: 36 m.',
      'Resiliência anã: resistência a dano venenoso e vantagem para evitar ou encerrar Envenenado.',
      'Tenacidade anã: +1 PV máximo por nível.',
      'Conhecimento de rochas: ação bônus, sentido sísmico de 18 m por 10 minutos enquanto toca pedra; usos iguais à proficiência por descanso longo.',
    ],
  },
  Halfling: {
    speed: 9,
    size: 'Pequeno',
    variants: ['Halfling'],
    traits: [
      'Bravura: vantagem para evitar ou encerrar Amedrontado.',
      'Agilidade halfling: atravessa o espaço de criaturas maiores, sem parar nele.',
      'Sorte: ao obter 1 num teste de d20, pode repetir e deve usar o novo resultado.',
      'Furtividade natural: pode se esconder encoberto apenas por criatura maior.',
    ],
  },
  Draconato: {
    speed: 9,
    size: 'Médio',
    variants: ['Draconato'],
    traits: [
      'Visão no escuro: 18 m.',
      'Sopro: substitui um ataque da ação Atacar; 1d10 de dano, salvaguarda de Destreza para metade, CD 8 + Constituição + proficiência. Escolha cone de 4,5 m ou linha de 9 × 1,5 m a cada uso. Usos iguais à proficiência por descanso longo.',
      'Ancestralidade dracônica: resistência ao dano da ancestralidade escolhida.',
    ],
  },
  Gnomo: {
    speed: 9,
    size: 'Pequeno',
    variants: ['Gnomo das rochas', 'Gnomo da floresta'],
    traits: [
      'Visão no escuro: 18 m.',
      'Esperteza gnômica: vantagem em salvaguardas de Inteligência, Sabedoria e Carisma.',
    ],
  },
  Golias: {
    speed: 10.5,
    size: 'Médio',
    variants: ['Nuvem', 'Fogo', 'Gelo', 'Colina', 'Pedra', 'Tempestade'],
    traits: [
      'Porte poderoso: vantagem nos testes para encerrar Agarrado; conta como um tamanho maior para capacidade de carga.',
      'Ancestralidade gigante: usos iguais à proficiência por descanso longo.',
    ],
  },
  Orc: {
    speed: 9,
    size: 'Médio',
    variants: ['Orc'],
    traits: [
      'Visão no escuro: 36 m.',
      'Adrenalina: Disparada como ação bônus e PV temporários iguais à proficiência; usos iguais à proficiência por descanso curto ou longo.',
      'Resistência implacável: ao chegar a 0 PV sem morrer, pode ficar com 1 PV; uma vez por descanso longo.',
    ],
  },
  Tiefling: {
    speed: 9,
    size: 'Médio',
    variants: ['Infernal', 'Abissal', 'Ctônico'],
    traits: [
      'Visão no escuro: 18 m.',
      'Presença sobrenatural: conhece Taumaturgia; usa o atributo escolhido para o legado.',
    ],
  },
};
type ClassRule = {
  id: string;
  saves: number[];
  count: number;
  skills: string[];
  proficiencies: string[];
  features: string[];
  ability?: number;
  cantrips: number;
  known: number;
  slots: number;
  prepared: boolean;
  prepareCount: number;
  masteries: number;
};
const features: Record<string, string[]> = {
  Artífice: [
    'Conjuração: Inteligência; dois truques e duas magias preparadas de círculo 1. Use ferramentas como foco.',
    'Magia de funileiro: conhece Consertar sem contar no limite; cria objetos utilitários conforme a característica.',
  ],
  Bárbaro: [
    'Fúria e magia: enquanto estiver em Fúria, não pode conjurar magias nem manter concentração.',
    'Fúria: 2 usos; recupera um no descanso curto e todos no longo. Ação bônus, sem armadura pesada; resistência a dano contundente, cortante e perfurante; +2 no dano de ataques com Força, incluindo desarmados.',
    'Manter Fúria: até 10 minutos, prolongando a cada turno ao atacar inimigo, forçar salvaguarda ou gastar ação bônus; termina ao vestir armadura pesada ou ficar Incapacitado.',
    'Defesa sem armadura: 10 + Destreza + Constituição; permite escudo.',
  ],
  Bardo: [
    'Inspiração de bardo: ação bônus, outra criatura a até 18 m que vê ou ouve você recebe d6 por 1 hora; pode somar após falhar num teste de d20. Usos iguais a Carisma, mínimo 1, por descanso longo.',
  ],
  Bruxo: [
    'Invocação mística: escolha uma invocação sem pré-requisito de nível superior.',
    'Magia de pacto: 1 espaço de nível 1, recuperado em descanso curto ou longo.',
  ],
  Clérigo: [
    'Ordem divina: Protetor concede armas marciais e armaduras pesadas; Taumaturgo concede um truque adicional e bônus de Sabedoria (mínimo +1) em Arcanismo e Religião.',
  ],
  Druida: [
    'Druídico: conhece o idioma e sempre tem Falar com Animais preparada.',
    'Ordem primal: Guardião concede armas marciais e armaduras médias; Mago primal concede um truque adicional e bônus de Sabedoria (mínimo +1) em Arcanismo e Natureza.',
  ],
  Feiticeiro: [
    'Feitiçaria inata: ação bônus, 1 minuto; +1 na CD das magias de feiticeiro e vantagem nos ataques dessas magias. Dois usos por descanso longo; bônus situacionais resolvidos na mesa.',
  ],
  Guerreiro: [
    'Retomar o fôlego: ação bônus, recupera 1d10 + nível PV; 2 usos, recupera um no descanso curto e todos no longo.',
    'Estilo de luta: um talento de estilo de luta.',
  ],
  Ladino: [
    'Ataque furtivo: +1d6 uma vez por turno com arma de acuidade ou à distância, com vantagem ou aliado não incapacitado a 1,5 m do alvo e sem desvantagem.',
    'Especialização: dobra proficiência em duas perícias proficientes.',
    'Gíria dos ladrões: conhece a gíria e um idioma adicional.',
  ],
  Mago: [
    'Grimório: seis magias de nível 1; prepara quatro.',
    'Adepto ritual: pode realizar rituais do grimório sem prepará-los.',
    'Recuperação arcana: após descanso curto recupera um espaço de nível 1; uma vez por descanso longo.',
  ],
  Monge: [
    'Artes marciais: d6; pode usar Destreza para ataques, dano, agarrar e empurrar. Válido sem armadura/escudo, com armas simples corpo a corpo ou marciais corpo a corpo leves.',
    'Ataque desarmado adicional: ação bônus; não exige a ação Atacar.',
    'Defesa sem armadura: 10 + Destreza + Sabedoria, sem escudo.',
  ],
  Paladino: [
    'Cura pelas mãos: ação bônus por toque; reserva de 5 PV por descanso longo. Pode gastar 5 para encerrar Envenenado em vez de curar.',
    'Conjuração: disponível desde o nível 1.',
  ],
  Patrulheiro: [
    'Inimigo favorito: Marca do Caçador sempre preparada; duas conjurações sem espaço por descanso longo. Exige concentração normalmente.',
    'Conjuração: disponível desde o nível 1.',
  ],
};
const magic: Record<string, number[]> = {
  Artífice: [3, 2, 0, 2, 2],
  Bardo: [5, 2, 4, 2, 0],
  Bruxo: [5, 2, 2, 1, 0],
  Clérigo: [4, 3, 0, 2, 4],
  Druida: [4, 2, 0, 2, 4],
  Feiticeiro: [5, 4, 2, 2, 0],
  Mago: [3, 3, 6, 2, 4],
  Paladino: [5, 0, 0, 2, 2],
  Patrulheiro: [4, 0, 0, 2, 2],
};
export const classRules: Record<string, ClassRule> = Object.fromEntries(
  Object.entries(base.classes).map(([name, k]) => {
    const m = magic[name];
    const warrior = ['Bárbaro', 'Guerreiro', 'Paladino', 'Patrulheiro'].includes(name);
    return [
      name,
      {
        ...k,
        skills:
          name === 'Mago'
            ? [...k.skills, 'Natureza']
            : name === 'Guerreiro'
              ? [...k.skills, 'Persuasão']
              : name === 'Ladino'
                ? k.skills.filter((v) => v !== 'Atuação')
                : k.skills,
        proficiencies: [
          warrior
            ? 'Armas simples e marciais'
            : name === 'Ladino'
              ? 'Armas simples e marciais de acuidade ou leves'
              : name === 'Monge'
                ? 'Armas simples e marciais leves'
                : 'Armas simples',
          ...(['Mago', 'Monge', 'Feiticeiro'].includes(name)
            ? []
            : [
                ['Guerreiro', 'Paladino'].includes(name)
                  ? 'Armaduras leves, médias, pesadas e escudos'
                  : ['Artífice', 'Bárbaro', 'Clérigo', 'Patrulheiro'].includes(name)
                    ? 'Armaduras leves, médias e escudos'
                    : name === 'Druida'
                      ? 'Armaduras leves e escudos'
                      : 'Armaduras leves',
              ]),
        ],
        features: features[name],
        ability: m?.[0],
        cantrips: m?.[1] || 0,
        known: m?.[2] || 0,
        slots: m?.[3] || 0,
        prepared: !!m?.[4],
        prepareCount: m?.[4] || 0,
        masteries:
          name === 'Guerreiro'
            ? 3
            : ['Bárbaro', 'Paladino', 'Patrulheiro', 'Ladino'].includes(name)
              ? 2
              : 0,
      },
    ];
  }),
);
export function spellOptions(cls: string, level: number) {
  return spells.filter(
    (s) =>
      s.level === level &&
      s.classes.includes(classRules[cls]?.id) &&
      !(cls === 'Artífice' && s.id === 'mending'),
  );
}
export const dragons: Record<string, { damage: string; shape: string; save: string }> =
  Object.fromEntries(
    Object.entries({
      Negro: 'Ácido',
      Azul: 'Elétrico',
      Latão: 'Fogo',
      Bronze: 'Elétrico',
      Cobre: 'Ácido',
      Ouro: 'Fogo',
      Verde: 'Veneno',
      Vermelho: 'Fogo',
      Prata: 'Frio',
      Branco: 'Frio',
    }).map(([k, damage]) => [
      k,
      { damage, shape: 'Cone 4,5 m ou linha 9 × 1,5 m', save: 'Destreza' },
    ]),
  );
export const weaponData: Record<
  string,
  {
    dice: string;
    type: string;
    ability?: string;
    ranged?: boolean;
    martial?: boolean;
    two?: boolean;
  }
> = { ...base.weaponData };
delete weaponData.Rede;
weaponData['Picareta de guerra'].dice = '1d8 (1d10 com duas mãos)';
weaponData['Lança de montaria'] = {
  dice: '1d10',
  type: 'Perfurante',
  martial: true,
  two: true,
};
weaponData.Tridente = { dice: '1d8 (1d10 com duas mãos)', type: 'Perfurante', martial: true };
weaponData.Pistola = {
  dice: '1d10',
  type: 'Perfurante',
  martial: true,
  ranged: true,
  ability: 'dex',
};
weaponData.Mosquete = {
  dice: '1d12',
  type: 'Perfurante',
  martial: true,
  ranged: true,
  ability: 'dex',
  two: true,
};
export const mastery: Record<string, string> = {
  Alabarda: 'Fender',
  Glaive: 'Raspar',
  Pique: 'Empurrar',
  'Lança de montaria': 'Derrubar',
  'Maça estrela': 'Debilitar',
  Mangual: 'Debilitar',
  Malho: 'Derrubar',
  'Picareta de guerra': 'Debilitar',
  Tridente: 'Derrubar',
  Chicote: 'Lentidão',
  Zarabatana: 'Afligir',
  'Besta pesada': 'Empurrar',
  Adaga: 'Talhar',
  Bordão: 'Derrubar',
  Clava: 'Lentidão',
  Maça: 'Debilitar',
  Azagaia: 'Lentidão',
  Machadinha: 'Afligir',
  Lança: 'Debilitar',
  'Besta leve': 'Lentidão',
  'Arco curto': 'Afligir',
  Dardo: 'Afligir',
  Funda: 'Lentidão',
  Foice: 'Talhar',
  'Martelo leve': 'Talhar',
  Porrete: 'Empurrar',
  'Espada longa': 'Debilitar',
  'Espada curta': 'Afligir',
  Rapieira: 'Afligir',
  Cimitarra: 'Talhar',
  'Machado grande': 'Fender',
  'Espada grande': 'Raspar',
  'Machado de batalha': 'Derrubar',
  'Martelo de guerra': 'Empurrar',
  'Arco longo': 'Lentidão',
  'Besta de mão': 'Afligir',
  Pistola: 'Afligir',
  Mosquete: 'Lentidão',
};
export const masteryDescriptions: Record<string, string> = {
  Fender:
    'Ao acertar ataque corpo a corpo, pode atacar outra criatura a 1,5 m do alvo e no alcance. Não some o atributo ao dano, salvo se negativo; uma vez por turno.',
  Raspar:
    'Ao errar, pode causar dano igual ao atributo usado no ataque; somente esse atributo pode aumentar o dano.',
  Talhar:
    'O ataque extra da propriedade Leve pode fazer parte da ação Atacar, em vez de ação bônus; uma vez por turno.',
  Empurrar: 'Ao acertar criatura Grande ou menor, pode afastá-la até 3 m em linha reta.',
  Debilitar:
    'Ao acertar, o alvo tem desvantagem no próximo ataque antes do início do seu próximo turno.',
  Lentidão:
    'Ao acertar e causar dano, reduz deslocamento em 3 m até o início do seu próximo turno; não acumula.',
  Derrubar:
    'Ao acertar, pode forçar salvaguarda de Constituição, CD 8 + atributo do ataque + proficiência, ou alvo fica Caído.',
  Afligir:
    'Ao acertar e causar dano, recebe vantagem no próximo ataque contra o alvo antes do fim do seu próximo turno.',
};
const light = [
  'Adaga',
  'Clava',
  'Machadinha',
  'Foice',
  'Martelo leve',
  'Espada curta',
  'Cimitarra',
  'Besta de mão',
];
export function trainedWeapon(cls: string, w: string, c?: SheetChoices) {
  const v = weaponData[w];
  return (
    !!v &&
    (!v.martial ||
      ['Bárbaro', 'Guerreiro', 'Paladino', 'Patrulheiro'].includes(cls) ||
      (cls === 'Ladino' && (v.ability === 'finesse' || light.includes(w))) ||
      (cls === 'Monge' && light.includes(w)) ||
      (cls === 'Clérigo' && c?.options.order?.[0] === 'Protetor') ||
      (cls === 'Druida' && c?.options.order?.[0] === 'Guardião') ||
      Boolean(c?.advancement?.levels.some((r) => r.feat === 'martial-weapon-training')) ||
      Boolean(
        c?.advancement?.levels.some(
          (r) =>
            r.subclass === 'valor' ||
            r.subclass === 'battle-smith' ||
            (r.subclass === 'artillerist' && v.ranged) ||
            (r.subclass === 'bladesinger' && !v.ranged && !v.two),
        ),
      ))
  );
}
export type ChoiceField = { key: string; label: string; count: number; options: string[] };
export const choicesSchema = z.object({
  version: z.literal(2),
  originRules: z.literal(ORIGIN_RULES).optional(),
  species: z.enum(races),
  subrace: z.string().max(40),
  alignment: z.enum(alignments as [string, ...string[]]),
  backgroundType: z.enum(Object.keys(backgroundRules) as [string, ...string[]]),
  backgroundSkills: z.array(z.string()).length(2),
  backgroundExtras: z.array(z.string()).length(2),
  abilityBoosts: z.array(z.number().int().min(0).max(2)).length(6),
  classSkills: z.array(z.string()).max(4),
  options: z.record(z.string().max(40), z.array(z.string().max(100)).max(4)),
  equipment: z.record(z.string().max(40), z.array(z.string().max(100)).max(1)),
  cantrips: z.array(z.string()).max(4),
  spells: z.array(z.string()).max(6),
  expertise: z.array(z.string()).max(2),
  personality: z.string().trim().max(800).default(''),
  ideals: z.string().trim().max(800).default(''),
  bonds: z.string().trim().max(800).default(''),
  flaws: z.string().trim().max(800).default(''),
  appearance: z.string().trim().max(800).default(''),
  tieflingHorns: z.enum(tieflingHornIds).optional(),
  age: z.string().trim().max(40).default(''),
  height: z.string().trim().max(40).default(''),
  weight: z.string().trim().max(40).default(''),
});
export type SheetChoices = z.infer<typeof choicesSchema> & { advancement?: AdvancementState };
export function feats(c: SheetChoices) {
  const background = backgroundRules[c.backgroundType].feat;
  return [
    c.originRules && background.startsWith('Iniciado em Magia: ')
      ? 'Iniciado em Magia: ' + (c.options.featClass0?.[0] || background.split(': ')[1])
      : background,
    ...(c.options.humanFeat || []),
  ];
}
export function backgroundTool(c: SheetChoices) {
  const tool = backgroundRules[c.backgroundType].tool;
  return tool === 'Jogo escolhido'
    ? c.options.game?.[0] || tool
    : ['Ferramenta de artesão escolhida', 'Instrumento escolhido'].includes(tool)
      ? c.options.backgroundTool?.[0] || tool
      : tool;
}
export function choiceFields(race: string, cls: string, c?: SheetChoices): ChoiceField[] {
  const result: ChoiceField[] = [];
  const add = (key: string, label: string, count: number, options: string[]) =>
    result.push({ key, label, count, options });
  const background = backgroundRules[c?.backgroundType || 'Acólito'];
  if (c?.originRules && background.feat.startsWith('Iniciado em Magia: '))
    add('featClass0', 'Classe de Iniciado em Magia do antecedente', 1, [
      background.feat.split(': ')[1],
      ...['Clérigo', 'Druida', 'Mago'].filter((v) => v !== background.feat.split(': ')[1]),
    ]);
  if (background.tool === 'Ferramenta de artesão escolhida')
    add('backgroundTool', 'Ferramenta do antecedente', 1, artisanTools);
  if (background.tool === 'Instrumento escolhido')
    add('backgroundTool', 'Instrumento do antecedente', 1, instruments);
  if (['Humano', 'Tiefling', 'Changeling', 'Khoravar', 'Shifter', 'Warforged'].includes(race))
    add('size', 'Tamanho', 1, ['Médio', 'Pequeno']);
  if (race === 'Changeling')
    add('racialSkills', 'Instintos changeling', 2, [
      'Atuação',
      'Enganação',
      'Intimidação',
      'Intuição',
      'Persuasão',
    ]);
  if (race === 'Shifter')
    add('racialSkills', 'Instintos bestiais', 1, [
      'Acrobacia',
      'Atletismo',
      'Intimidação',
      'Sobrevivência',
    ]);
  if (race === 'Warforged') {
    add('racialSkills', 'Perícia do projeto especializado', 1, skills);
    add('racialTool', 'Ferramenta do projeto especializado', 1, tools);
  }
  if (race === 'Kalashtar')
    add(
      'dreamSkill',
      'Perícia dos sonhos (descanso longo)',
      1,
      skills.filter((s) => !c || ![...c.backgroundSkills, ...c.classSkills].includes(s)),
    );
  if (race === 'Khoravar') {
    add(
      'versatileTraining',
      'Versatilidade (descanso longo)',
      1,
      [...skills, ...tools].filter(
        (s) => !c || ![...c.backgroundSkills, ...c.classSkills, backgroundTool(c)].includes(s),
      ),
    );
    add('racialCantrip', 'Dom feérico (descanso longo)', 1, [
      ...new Set([
        'friends',
        ...['Clérigo', 'Druida', 'Mago'].flatMap((cl) => spellOptions(cl, 0).map((s) => s.id)),
      ]),
    ]);
  }
  if (race === 'Humano') {
    add('racialSkills', 'Perícia humana', 1, skills);
    add(
      'humanFeat',
      'Talento de origem humano',
      1,
      originFeats.filter((f) => f === 'Habilidoso' || f !== (c ? feats(c)[0] : background.feat)),
    );
  }
  if (race === 'Elfo')
    add('racialSkills', 'Sentidos aguçados', 1, ['Percepção', 'Intuição', 'Sobrevivência']);
  if (['Elfo', 'Gnomo', 'Tiefling', 'Khoravar'].includes(race))
    add('speciesAbility', 'Atributo das magias da espécie', 1, statNames.slice(3));
  if (race === 'Elfo' && (!c || c.subrace === 'Alto elfo'))
    add(
      'racialCantrip',
      'Truque de alto elfo (troca após descanso longo)',
      1,
      spellOptions('Mago', 0).map((s) => s.id),
    );
  if (race === 'Draconato') add('dragon', 'Ancestralidade dracônica', 1, Object.keys(dragons));
  if (cls === 'Bardo') {
    add(
      'instruments',
      'Instrumentos musicais',
      3,
      instruments.filter((v) => !c || v !== backgroundTool(c)),
    );
    add('instrument', 'Instrumento inicial', 1, instruments);
  }
  if (cls === 'Artífice')
    add(
      'artificerTool',
      'Ferramenta de artesão da classe',
      1,
      artisanTools.filter(
        (v) => v !== 'Ferramentas de funileiro' && (!c || v !== backgroundTool(c)),
      ),
    );
  if (cls === 'Monge')
    add('monkTool', 'Ferramenta ou instrumento', 1, [...artisanTools, ...instruments]);
  if (cls === 'Guerreiro') add('style', 'Estilo de luta', 1, fightingStyles);
  if (cls === 'Clérigo') add('order', 'Ordem divina', 1, ['Protetor', 'Taumaturgo']);
  if (cls === 'Druida') add('order', 'Ordem primal', 1, ['Guardião', 'Mago primal']);
  if (c?.options.order?.[0] === 'Taumaturgo' || c?.options.order?.[0] === 'Mago primal')
    add(
      'orderCantrip',
      'Truque adicional da ordem',
      1,
      spellOptions(cls, 0)
        .filter((s) => !c.cantrips.includes(s.id))
        .map((s) => s.id),
    );
  if (cls === 'Ladino')
    add(
      'rogueLanguage',
      'Idioma adicional do ladino',
      1,
      [...languages, ...rareLanguages].filter(
        (l) => l !== 'Comum' && l !== 'Gíria dos ladrões' && !c?.backgroundExtras.includes(l),
      ),
    );
  if (classRules[cls].masteries)
    add(
      'mastery',
      'Maestrias de armas',
      classRules[cls].masteries,
      Object.keys(weaponData).filter(
        (w) => trainedWeapon(cls, w, c) && (cls !== 'Bárbaro' || !weaponData[w].ranged),
      ),
    );
  if (background.tool === 'Jogo escolhido' || background.gear.includes('Jogo escolhido'))
    add('game', 'Jogo do antecedente', 1, [
      'Dados de jogo',
      'Baralho',
      'Xadrez de dragão',
      'Três dragões',
    ]);
  if (cls === 'Bruxo') {
    add('invocation', 'Invocação mística', 1, [
      'Armadura de Sombras',
      'Pacto da Lâmina',
      'Pacto da Corrente',
      'Pacto do Tomo',
      'Mente Mística',
    ]);
    if (c?.options.invocation?.[0] === 'Pacto do Tomo') {
      add(
        'tomeCantrips',
        'Truques do tomo',
        3,
        spells
          .filter((s) => s.level === 0 && !nonTomeSpells(race, cls, c).includes(s.id))
          .map((s) => s.id),
      );
      add(
        'tomeRituals',
        'Rituais do tomo',
        2,
        spells
          .filter((s) => s.level === 1 && s.ritual && !nonTomeSpells(race, cls, c).includes(s.id))
          .map((s) => s.id),
      );
    }
  }
  if (c)
    for (const [index, feat] of feats(c).entries()) {
      if (feat === 'Habilidoso')
        add(
          'skilled' + index,
          'Proficiências de Habilidoso',
          3,
          [...new Set([...skills, ...tools])].filter(
            (v) =>
              ![
                ...c.backgroundSkills,
                ...racialSkills(race, c),
                ...c.classSkills,
                backgroundTool(c),
                ...(cls === 'Druida' ? ['Kit de herbalismo'] : []),
                ...(cls === 'Ladino' ? ['Ferramentas de ladrão'] : []),
                ...(c.options.instruments || []),
                ...(c.options.monkTool || []),
                ...(cls === 'Artífice'
                  ? [
                      'Ferramentas de ladrão',
                      'Ferramentas de funileiro',
                      ...(c.options.artificerTool || []),
                    ]
                  : []),
                ...Object.entries(c.options)
                  .filter(
                    ([key]) =>
                      /^(crafter|musician)\d+$/.test(key) ||
                      (key.startsWith('skilled') && Number(key.slice(7)) < index),
                  )
                  .flatMap(([, values]) => values),
              ].includes(v),
          ),
        );
      if (feat === 'Artífice')
        add(
          'crafter' + index,
          'Ferramentas de Artífice',
          3,
          artisanTools.filter(
            (v) =>
              v !== backgroundTool(c) &&
              !c.options.monkTool?.includes(v) &&
              !(
                cls === 'Artífice' &&
                (v === 'Ferramentas de funileiro' || c.options.artificerTool?.includes(v))
              ),
          ),
        );
      if (feat === 'Músico')
        add(
          'musician' + index,
          'Instrumentos de Músico',
          3,
          instruments.filter(
            (v) =>
              v !== backgroundTool(c) &&
              !c.options.instruments?.includes(v) &&
              !c.options.monkTool?.includes(v),
          ),
        );
      if (feat.startsWith('Iniciado em Magia: ')) {
        const cl = feat.split(': ')[1];
        add(
          'featAbility' + index,
          'Atributo de ' + feat,
          1,
          c.originRules ? [cl === 'Mago' ? 'Inteligência' : 'Sabedoria'] : statNames.slice(3),
        );
        add(
          'featCantrips' + index,
          'Truques de ' + feat,
          2,
          spellOptions(cl, 0).map((s) => s.id),
        );
        add(
          'featSpell' + index,
          'Magia de ' + feat,
          1,
          spellOptions(cl, 1).map((s) => s.id),
        );
      }
    }
  // A proficiency choice cannot offer a skill already granted by another source.
  // Expertise deliberately remains separate: it improves an existing proficiency.
  return result.map((field) => {
    if (
      !['racialSkills', 'dreamSkill', 'versatileTraining'].includes(field.key) &&
      !field.key.startsWith('skilled')
    )
      return field;
    const taken = new Set(
      [
        ...(c?.backgroundSkills || background.skills),
        ...(c?.classSkills || []),
        ...Object.entries(c?.options || {})
          .filter(([key]) => key !== field.key)
          .flatMap(([, values]) => values),
        ...(c?.advancement?.levels || []).flatMap((row) =>
          Object.entries(row.choices)
            .filter(([key]) => !/expertise/i.test(key))
            .flatMap(([, values]) => values),
        ),
      ].filter((v) => skills.includes(v)),
    );
    return { ...field, options: field.options.filter((v) => !skills.includes(v) || !taken.has(v)) };
  });
}
const loadouts: Record<string, { gear: string[][]; gold: number[]; cash: number }> = {
  Artífice: {
    gear: [
      [
        'Couro batido',
        'Adaga',
        'Ferramentas de ladrão',
        'Ferramentas de funileiro',
        'Pacote de aventureiro',
      ],
    ],
    gold: [16],
    cash: 150,
  },
  Bárbaro: {
    gear: [['Machado grande', 'Quatro machadinhas', 'Pacote de explorador']],
    gold: [15],
    cash: 75,
  },
  Bardo: { gear: [['Couro', 'Duas adagas', 'Pacote de artista']], gold: [19], cash: 90 },
  Bruxo: {
    gear: [
      [
        'Couro',
        'Foice',
        'Duas adagas',
        'Foco arcano (orbe)',
        'Livro de ocultismo',
        'Pacote de estudioso',
      ],
    ],
    gold: [15],
    cash: 100,
  },
  Clérigo: {
    gear: [['Camisão de malha', 'Escudo', 'Maça', 'Símbolo sagrado', 'Pacote de sacerdote']],
    gold: [7],
    cash: 110,
  },
  Druida: {
    gear: [
      [
        'Couro',
        'Escudo',
        'Foice',
        'Bordão',
        'Foco druídico',
        'Pacote de explorador',
        'Kit de herbalismo',
      ],
    ],
    gold: [9],
    cash: 50,
  },
  Feiticeiro: {
    gear: [['Lança', 'Duas adagas', 'Foco arcano (cristal)', 'Pacote de aventureiro']],
    gold: [28],
    cash: 50,
  },
  Guerreiro: {
    gear: [
      ['Cota de malha', 'Espada grande', 'Mangual', 'Oito azagaias', 'Pacote de aventureiro'],
      [
        'Couro batido',
        'Cimitarra',
        'Espada curta',
        'Arco longo',
        '20 flechas',
        'Aljava',
        'Pacote de aventureiro',
      ],
    ],
    gold: [4, 11],
    cash: 155,
  },
  Ladino: {
    gear: [
      [
        'Couro',
        'Duas adagas',
        'Espada curta',
        'Arco curto',
        '20 flechas',
        'Aljava',
        'Ferramentas de ladrão',
        'Pacote de assaltante',
      ],
    ],
    gold: [8],
    cash: 100,
  },
  Mago: {
    gear: [['Duas adagas', 'Bordão', 'Foco arcano', 'Vestes', 'Grimório', 'Pacote de estudioso']],
    gold: [5],
    cash: 55,
  },
  Monge: { gear: [['Lança', 'Cinco adagas', 'Pacote de explorador']], gold: [11], cash: 50 },
  Paladino: {
    gear: [
      [
        'Cota de malha',
        'Escudo',
        'Espada longa',
        'Seis azagaias',
        'Símbolo sagrado',
        'Pacote de sacerdote',
      ],
    ],
    gold: [9],
    cash: 150,
  },
  Patrulheiro: {
    gear: [
      [
        'Couro batido',
        'Cimitarra',
        'Espada curta',
        'Arco longo',
        '20 flechas',
        'Aljava',
        'Foco druídico',
        'Pacote de explorador',
      ],
    ],
    gold: [7],
    cash: 150,
  },
};
export function equipmentFields(cls: string): ChoiceField[] {
  return [
    {
      key: 'package',
      label: 'Equipamento da classe',
      count: 1,
      options: loadouts[cls].gear.map((_, i) => 'Conjunto ' + (i + 1)).concat('Ouro da classe'),
    },
    {
      key: 'background',
      label: 'Equipamento do antecedente',
      count: 1,
      options: ['Conjunto do antecedente', '50 PO'],
    },
  ];
}
export function startingGold(cls: string, c: SheetChoices) {
  const l = loadouts[cls],
    v = c.equipment.package?.[0],
    i = Number(v?.split(' ')[1]) - 1;
  return (
    ((v === 'Ouro da classe' ? l.cash : l.gold[i] || 0) +
      (c.equipment.background?.[0] === '50 PO' ? 50 : backgroundRules[c.backgroundType].gold)) *
    100
  );
}
export function startingEquipment(cls: string, c: SheetChoices) {
  const i = Number(c.equipment.package?.[0]?.split(' ')[1]) - 1;
  return [
    ...(loadouts[cls].gear[i] || []),
    ...(i >= 0 && cls === 'Bardo' ? c.options.instrument || [] : []),
    ...(i >= 0 && cls === 'Monge' ? c.options.monkTool || [] : []),
    ...(c.equipment.background?.[0] === '50 PO'
      ? []
      : [
          ...backgroundRules[c.backgroundType].gear.map((v) =>
            v === 'Jogo escolhido'
              ? c.options.game?.[0] || v
              : ['Ferramenta de artesão escolhida', 'Instrumento escolhido'].includes(v)
                ? backgroundTool(c)
                : v,
          ),
          ...(c.backgroundType === 'Soldado' ? c.options.game || [] : []),
        ]),
  ];
}
export function racialSkills(_race: string, c: SheetChoices) {
  return [
    ...(c.options.racialSkills || []),
    ...(c.options.dreamSkill || []),
    ...(c.options.versatileTraining || []).filter((s) => skills.includes(s)),
  ];
}
export function proficientSkills(race: string, c: SheetChoices) {
  return [
    ...new Set([
      ...racialSkills(race, c),
      ...c.backgroundSkills,
      ...c.classSkills,
      ...Object.entries(c.options)
        .filter(([k]) => k.startsWith('skilled'))
        .flatMap(([, v]) => v)
        .filter((v) => skills.includes(v)),
    ]),
  ];
}
export function racialBonuses(_race: string, c: SheetChoices) {
  return c.abilityBoosts;
}
export function normalizeOptions(race: string, cls: string, c: SheetChoices) {
  if (race !== 'Tiefling' && c.tieflingHorns) { c = { ...c }; delete c.tieflingHorns; }
  for (let pass = 0; pass < 3; pass++) {
    const fields = choiceFields(race, cls, c);
    c = {
      ...c,
      options: Object.fromEntries(
        Object.entries(c.options).filter(([key]) => fields.some((f) => f.key === key)),
      ),
    };
    // Recompute after each choice so two proficiency fields cannot select the
    // same automatic replacement during a background/species/class change.
    for (const field of fields) {
      const f = choiceFields(race, cls, c).find((f) => f.key === field.key);
      if (!f) continue;
      const selected = [...new Set((c.options[f.key] || []).filter((v) => f.options.includes(v)))];
      c.options[f.key] = selected
        .concat(f.options.filter((v) => !selected.includes(v)))
        .slice(0, f.count);
    }
  }
  return c;
}
export function defaultChoices(race: string, cls: string, background = 'Acólito'): SheetChoices {
  const species = (races as readonly string[]).includes(race) ? race : 'Humano',
    b = backgroundRules[background];
  let c: SheetChoices = {
    version: 2,
    originRules: ORIGIN_RULES,
    species: species as SheetChoices['species'],
    subrace: raceRules[species].variants[0],
    alignment: 'Neutro',
    backgroundType: background as SheetChoices['backgroundType'],
    backgroundSkills: [...b.skills],
    backgroundExtras: ['Élfico', 'Anão'],
    abilityBoosts: statNames.map((_, i) =>
      i === b.abilities[0] ? 2 : i === b.abilities[1] ? 1 : 0,
    ),
    classSkills: [],
    options: {},
    equipment: { package: ['Conjunto 1'], background: ['Conjunto do antecedente'] },
    cantrips: spellOptions(cls, 0)
      .slice(0, classRules[cls].cantrips)
      .map((s) => s.id),
    spells: spellOptions(cls, 1)
      .slice(0, classRules[cls].known)
      .map((s) => s.id),
    expertise: [],
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
    appearance: '',
    ...(species === 'Tiefling' ? { tieflingHorns: 'curved' as const } : {}),
    age: '',
    height: '',
    weight: '',
  };
  c = normalizeOptions(species, cls, c);
  if (species === 'Elfo') c.options.racialCantrip = ['prestidigitation'];
  if (c.options.racialSkills) {
    const field = choiceFields(species, cls, c).find((f) => f.key === 'racialSkills')!;
    c.options.racialSkills = [
      ...new Set([
        ...c.options.racialSkills.filter((s) => !b.skills.includes(s)),
        ...field.options.filter((s) => !b.skills.includes(s)),
      ]),
    ].slice(0, field.count);
  }
  const taken = new Set([
    ...b.skills,
    ...racialSkills(species, c),
    backgroundTool(c),
    ...(cls === 'Druida' ? ['Kit de herbalismo'] : []),
    ...(cls === 'Ladino' ? ['Ferramentas de ladrão'] : []),
    ...(c.options.instruments || []),
    ...(c.options.monkTool || []),
    ...(cls === 'Artífice'
      ? ['Ferramentas de ladrão', 'Ferramentas de funileiro', ...(c.options.artificerTool || [])]
      : []),
  ]);
  for (const key of Object.keys(c.options).filter((key) => key.startsWith('skilled'))) {
    c.options[key] = [...skills, ...tools].filter((s) => !taken.has(s)).slice(0, 3);
    c.options[key].forEach((s) => taken.add(s));
  }
  c.classSkills = classRules[cls].skills
    .filter((s) => !proficientSkills(species, c).includes(s))
    .slice(0, classRules[cls].count);
  if (cls === 'Ladino') c.expertise = proficientSkills(species, c).slice(0, 2);
  return c;
}
export function reconcileChoices(
  race: string,
  cls: string,
  current: SheetChoices,
  background = current.backgroundType,
): SheetChoices {
  const defaults = defaultChoices(race, cls, background),
    b = backgroundRules[background],
    k = classRules[cls];
  const retain = (selected: string[], allowed: string[], count: number) =>
    [...new Set([...selected.filter((v) => allowed.includes(v)), ...allowed])].slice(0, count);
  let c = normalizeOptions(race, cls, {
    ...defaults,
    ...current,
    species: defaults.species,
    subrace: raceRules[race].variants.includes(current.subrace)
      ? current.subrace
      : defaults.subrace,
    backgroundType: background,
    backgroundSkills: [...b.skills],
    abilityBoosts:
      current.originRules || current.abilityBoosts.every((v, i) => !v || b.abilities.includes(i))
        ? [...current.abilityBoosts]
        : defaults.abilityBoosts,
    options: { ...defaults.options, ...current.options },
    equipment: Object.fromEntries(
      equipmentFields(cls).map((f) => [
        f.key,
        retain(current.equipment[f.key] || [], f.options, f.count),
      ]),
    ),
    cantrips: retain(
      current.cantrips,
      spellOptions(cls, 0).map((s) => s.id),
      k.cantrips,
    ),
    spells: retain(
      current.spells,
      spellOptions(cls, 1).map((s) => s.id),
      k.known,
    ),
    classSkills: [],
    expertise: [],
  });
  const racial = choiceFields(race, cls, c).find((f) => f.key === 'racialSkills');
  if (racial)
    c.options.racialSkills = retain(
      c.options.racialSkills || [],
      racial.options.filter((v) => !b.skills.includes(v)),
      racial.count,
    );
  const taken = new Set([
    ...b.skills,
    ...racialSkills(race, c),
    backgroundTool(c),
    ...(cls === 'Druida' ? ['Kit de herbalismo'] : []),
    ...(cls === 'Ladino' ? ['Ferramentas de ladrão'] : []),
    ...(c.options.instruments || []),
    ...(c.options.monkTool || []),
    ...(cls === 'Artífice'
      ? ['Ferramentas de ladrão', 'Ferramentas de funileiro', ...(c.options.artificerTool || [])]
      : []),
  ]);
  for (const f of choiceFields(race, cls, c).filter((f) => f.key.startsWith('skilled'))) {
    c.options[f.key] = retain(
      c.options[f.key] || [],
      f.options.filter((v) => !taken.has(v)),
      f.count,
    );
    c.options[f.key].forEach((v) => taken.add(v));
  }
  c.classSkills = retain(
    current.classSkills,
    k.skills.filter((v) => !taken.has(v)),
    k.count,
  );
  c.expertise = retain(current.expertise, proficientSkills(race, c), cls === 'Ladino' ? 2 : 0);
  return normalizeOptions(race, cls, c);
}
export function validateChoices(race: string, cls: string, input: unknown): SheetChoices {
  const c = choicesSchema.parse(input),
    r = raceRules[race],
    k = classRules[cls],
    b = backgroundRules[c.backgroundType];
  const check = (ok: boolean, msg: string) => {
    if (!ok) throw new Error(msg);
  };
  check(!c.tieflingHorns || race === 'Tiefling', 'O formato de chifres é uma escolha de aparência do Tiefling.');
  const list = (v: string[], n: number, a: string[], label: string) =>
    check(
      v.length === n && new Set(v).size === n && v.every((x) => a.includes(x)),
      `Confira ${label}: escolha ${n} opções distintas permitidas.`,
    );
  check(!!r && !!k && c.species === race, 'Espécie ou classe inválida.');
  check(r.variants.includes(c.subrace), 'Linhagem inválida.');
  check(
    c.abilityBoosts.reduce((a, b) => a + b, 0) === 3 &&
      c.abilityBoosts.every((v, i) => v === 0 || Boolean(c.originRules) || b.abilities.includes(i)),
    'Distribua +2/+1 ou +1/+1/+1 nos atributos do antecedente.',
  );
  list(c.backgroundSkills, 2, b.skills, 'perícias do antecedente');
  list(
    c.backgroundExtras,
    2,
    languages.filter((l) => l !== 'Comum'),
    'idiomas iniciais',
  );
  for (const [fields, values] of [
    [choiceFields(race, cls, c), c.options],
    [equipmentFields(cls), c.equipment],
  ] as const) {
    check(
      Object.keys(values).every((key) => fields.some((f) => f.key === key)),
      'Opção não permitida.',
    );
    for (const f of fields) list(values[f.key] || [], f.count, f.options, f.label);
  }
  const racial = racialSkills(race, c);
  check(
    !racial.some((v) => c.backgroundSkills.includes(v)),
    'Escolha outra perícia da espécie para evitar repetição.',
  );
  const skilled = Object.entries(c.options)
    .filter(([key]) => key.startsWith('skilled'))
    .flatMap(([, v]) => v);
  check(
    new Set(skilled).size === skilled.length &&
      !skilled.some((v) =>
        [
          ...racial,
          ...c.backgroundSkills,
          backgroundTool(c),
          ...(cls === 'Druida' ? ['Kit de herbalismo'] : []),
          ...(cls === 'Ladino' ? ['Ferramentas de ladrão'] : []),
          ...(c.options.instruments || []),
          ...(c.options.monkTool || []),
          ...(cls === 'Artífice'
            ? [
                'Ferramentas de ladrão',
                'Ferramentas de funileiro',
                ...(c.options.artificerTool || []),
              ]
            : []),
        ].includes(v),
      ),
    'Não repita proficiências do talento Habilidoso.',
  );
  list(
    c.classSkills,
    k.count,
    k.skills.filter((v) => ![...racial, ...c.backgroundSkills, ...skilled].includes(v)),
    'perícias da classe',
  );
  list(
    c.cantrips,
    k.cantrips,
    spellOptions(cls, 0).map((s) => s.id),
    'truques',
  );
  list(
    c.spells,
    k.known,
    spellOptions(cls, 1).map((s) => s.id),
    'magias',
  );
  list(c.expertise, cls === 'Ladino' ? 2 : 0, proficientSkills(race, c), 'especializações');
  return c;
}
export function sheetAttacks(
  race: string,
  cls: string,
  stats: number[],
  c: SheetChoices,
  equipped?: readonly string[],
  level = 1,
) {
  const advances = c.advancement?.levels || [];
  const classLevels = [cls, ...advances.map((s) => s.class)];
  const monkLevel = (cls === 'Monge' ? 1 : 0) + advances.filter((s) => s.class === 'Monge').length;
  const monkDie = monkLevel >= 17 ? 12 : monkLevel >= 11 ? 10 : monkLevel >= 5 ? 8 : 6;
  const styles = Object.values(classFightingStyles(cls, c)).flat();
  const masteries = [
    ...(c.options.mastery || []),
    ...advances.flatMap((s) => s.choices.mastery || []),
    ...advances.flatMap((s) => s.choices.featMastery || []),
  ];
  const gear = equipped ?? startingEquipment(cls, c),
    aliases: Record<string, string[]> = {
      Adaga: ['Duas adagas', 'Cinco adagas'],
      Machadinha: ['Quatro machadinhas'],
      Azagaia: ['Oito azagaias', 'Seis azagaias'],
    };
  return Object.entries(weaponData)
    .filter(([name]) => gear.includes(name) || aliases[name]?.some((n) => gear.includes(n)))
    .map(([name, w]) => {
      const monk = monkLevel > 0 && !w.ranged && (!w.martial || light.includes(name));
      const dex = w.ability === 'dex' || ((w.ability === 'finesse' || monk) && stats[1] > stats[0]);
      const ability = modifier(stats[dex ? 1 : 0]),
        trained = classLevels.some((cl) =>
          trainedWeapon(cl, name, {
            ...c,
            options:
              cl === cls
                ? c.options
                : advances
                    .filter((s) => s.class === cl)
                    .reduce((o, s) => ({ ...o, ...s.choices }), {}),
          }),
        ),
        dice = w.dice.match(/^\d+d\d+/)?.[0] || w.dice,
        versatileDice = w.dice.match(/\((\d+d\d+) com duas mãos\)/)?.[1] || null;
      return {
        name,
        dice: monk && Number(dice.match(/^1d(\d+)$/)?.[1] || 99) < monkDie ? `1d${monkDie}` : dice,
        versatileDice,
        type: w.type,
        ability,
        trained,
        attack:
          ability +
          (trained ? 2 + Math.floor((level - 1) / 4) : 0) +
          (w.ranged && styles.includes('Arquearia') ? 2 : 0),
        mastery: masteries.includes(name) ? mastery[name] : null,
      };
    });
}
function deriveOriginSheet(
  character: { race: string; class: string; stats: number[]; level: number },
  c: SheetChoices,
) {
  const { race, class: cls, stats, level } = character,
    r = raceRules[race],
    k = classRules[cls],
    m = stats.map(modifier),
    prof = 2 + Math.floor((level - 1) / 4),
    trained = proficientSkills(race, c),
    equipment = startingEquipment(cls, c);
  const bare = 10 + m[1] + (cls === 'Bárbaro' ? m[2] : cls === 'Monge' ? m[4] : 0);
  const armored = equipment.some((e) =>
      ['Cota de malha', 'Camisão de malha', 'Couro', 'Couro batido'].includes(e),
    ),
    shield = equipment.includes('Escudo');
  const armor = equipment.includes('Cota de malha')
    ? 16
    : equipment.includes('Camisão de malha')
      ? 13 + Math.min(2, m[1])
      : equipment.includes('Couro batido')
        ? 12 + m[1]
        : equipment.includes('Couro')
          ? 11 + m[1]
          : bare;
  const speciesCantrips =
    race === 'Khoravar'
      ? c.options.racialCantrip || ['friends']
      : race === 'Elfo'
        ? c.subrace === 'Drow'
          ? ['dancing-lights']
          : c.subrace === 'Elfo da floresta'
            ? ['druidcraft']
            : c.options.racialCantrip || []
        : race === 'Gnomo'
          ? c.subrace === 'Gnomo da floresta'
            ? ['minor-illusion']
            : ['mending', 'prestidigitation']
          : race === 'Tiefling'
            ? [
                'thaumaturgy',
                c.subrace === 'Abissal'
                  ? 'poison-spray'
                  : c.subrace === 'Ctônico'
                    ? 'chill-touch'
                    : 'fire-bolt',
              ]
            : [];
  const spellGrants: {
    source: string;
    ability: number;
    cantrips: string[];
    spells: string[];
    note: string;
  }[] = [];
  if (speciesCantrips.length)
    spellGrants.push({
      source: 'Espécie: ' + c.subrace,
      ability: statNames.indexOf(c.options.speciesAbility[0]),
      cantrips: speciesCantrips,
      spells: race === 'Gnomo' && c.subrace === 'Gnomo da floresta' ? ['speak-with-animals'] : [],
      note:
        race === 'Gnomo' && c.subrace === 'Gnomo da floresta'
          ? 'Falar com Animais: usos sem espaço iguais à proficiência por descanso longo.'
          : '',
    });
  feats(c).forEach((f, i) => {
    if (f.startsWith('Iniciado em Magia'))
      spellGrants.push({
        source: f,
        ability: statNames.indexOf(c.options['featAbility' + i][0]),
        cantrips: c.options['featCantrips' + i],
        spells: c.options['featSpell' + i],
        note: 'Magia de nível 1: uma conjuração sem espaço por descanso longo; também pode usar espaços.',
      });
  });
  if (cls === 'Bruxo' && c.options.invocation?.[0] === 'Pacto do Tomo')
    spellGrants.push({
      source: 'Pacto do Tomo',
      ability: 5,
      cantrips: c.options.tomeCantrips,
      spells: c.options.tomeRituals,
      note: 'Disponíveis enquanto carrega o tomo; pode escolher novamente ao conjurá-lo após descanso curto ou longo.',
    });
  const order = c.options.order?.[0];
  const featureGroups = {
    background: [
      'Perícias: ' + c.backgroundSkills.join(', ') + '.',
      'Ferramenta: ' + backgroundTool(c) + '.',
      'Idiomas escolhidos: ' + c.backgroundExtras.join(', ') + '.',
    ],
    class: [...k.features],
    race: [...r.traits],
    feats: feats(c).map((f) => 'Talento de origem: ' + f),
  };
  const features = [...featureGroups.race, ...featureGroups.class, ...featureGroups.feats];
  const addFeature = (group: 'class' | 'race' | 'feats', ...texts: string[]) => {
    featureGroups[group].push(...texts);
    features.push(...texts);
  };
  if (race === 'Shifter') addFeature('race', shifterBenefits[c.subrace]);
  if (feats(c).includes('Alerta'))
    addFeature(
      'feats',
      'Alerta: soma proficiência à iniciativa; pode trocar iniciativa com aliado disposto, desde que nenhum esteja Incapacitado.',
    );
  if (feats(c).includes('Atacante Selvagem'))
    addFeature(
      'feats',
      'Atacante Selvagem: uma vez por turno ao acertar com arma, role os dados de dano da arma duas vezes e escolha um resultado.',
    );
  const originDescriptions: Record<string, string> = {
    Artífice:
      'Artífice: proficiência em três ferramentas de artesão; desconto de 20% em itens não mágicos e fabricação rápida resolvidos na mesa.',
    Curandeiro:
      'Curandeiro: com um kit, uma criatura pode gastar um Dado de Vida para recuperar o resultado mais sua proficiência. Pode repetir resultados 1 de cura deste talento ou de magias, usando o novo resultado.',
    Sortudo:
      'Sortudo: pontos de sorte iguais à proficiência por descanso longo; gaste um para obter vantagem em um teste de d20 ou impor desvantagem a um ataque contra você.',
    Músico:
      'Músico: proficiência em três instrumentos. Ao terminar descanso curto ou longo, sua música pode conceder Inspiração Heroica a aliados que a escutem, até sua proficiência.',
    Robusto: 'Robusto: máximo de pontos de vida aumentado em 2 por nível.',
    'Brigão de Taverna':
      'Brigão de Taverna: dano desarmado 1d4 + Força; pode repetir um resultado 1 do dado. Proficiência em armas improvisadas; uma vez por turno, pode empurrar 1,5 m ao causar dano com ataque desarmado na ação Atacar.',
  };
  for (const feat of feats(c))
    if (originDescriptions[feat]) addFeature('feats', originDescriptions[feat]);
  if (race === 'Elfo')
    addFeature('race', 'Visão no escuro: ' + (c.subrace === 'Drow' ? 36 : 18) + ' m.');
  if (race === 'Gnomo' && c.subrace === 'Gnomo das rochas')
    addFeature(
      'race',
      'Engenhoqueiro: 10 minutos com Prestidigitação criam dispositivo minúsculo com um efeito do truque; ação bônus para ativar, até três dispositivos, duração de 8 horas.',
    );
  if (race === 'Tiefling')
    addFeature(
      'race',
      'Legado ' +
        c.subrace +
        ': resistência a ' +
        (c.subrace === 'Abissal' ? 'veneno' : c.subrace === 'Ctônico' ? 'necrótico' : 'fogo') +
        '.',
    );
  if (race === 'Golias')
    addFeature(
      'race',
      'Ancestralidade ' +
        c.subrace +
        ': ' +
        {
          Nuvem: 'ação bônus para teletransportar 9 m a um espaço visível.',
          Fogo: 'ao acertar e causar dano, +1d10 de fogo.',
          Gelo: 'ao acertar e causar dano, +1d6 de frio e -3 m de deslocamento até seu próximo turno.',
          Colina: 'ao acertar e causar dano a criatura Grande ou menor, pode derrubá-la.',
          Pedra: 'reação ao sofrer dano: reduz em 1d12 + Constituição.',
          Tempestade: 'reação ao sofrer dano de criatura a até 18 m: causa 1d8 trovejante nela.',
        }[c.subrace],
    );
  const inv = c.options.invocation?.[0];
  if (inv)
    addFeature(
      'class',
      inv +
        ': ' +
        {
          'Armadura de Sombras':
            'Armadura Arcana em si mesmo à vontade, sem espaço. CA sob o efeito: ' +
            (13 + m[1]) +
            '.',
          'Mente Mística': 'vantagem em salvaguardas de Constituição para manter concentração.',
          'Pacto da Lâmina':
            'ação bônus para conjurar/vincular arma corpo a corpo; proficiente, pode usar Carisma e dano normal, necrótico, psíquico ou radiante. Resolva a arma vinculada na mesa.',
          'Pacto da Corrente':
            'Encontrar Familiar sempre preparada; pode conjurar como ação Mágica sem espaço. Formas especiais e ataque do familiar conforme SRD.',
          'Pacto do Tomo':
            'três truques e dois rituais de nível 1, de qualquer lista, usando Carisma.',
        }[inv],
    );
  if (c.options.style?.[0])
    addFeature(
      'feats',
      'Estilo de luta: ' +
        c.options.style[0] +
        (c.options.style[0] === 'Combate com armas grandes'
          ? ' — trate 1 ou 2 nos dados de dano como 3 ao usar arma corpo a corpo versátil ou de duas mãos empunhada com duas mãos.'
          : c.options.style[0] === 'Combate com duas armas'
            ? ' — some o atributo no ataque extra da propriedade Leve.'
            : ''),
    );
  if (c.options.mastery)
    addFeature(
      'class',
      ...c.options.mastery.map(
        (w) => 'Maestria de ' + w + ': ' + mastery[w] + ' — ' + masteryDescriptions[mastery[w]],
      ),
    );
  return {
    modifiers: m,
    proficiency: prof,
    hp: Math.max(1, hitDice[cls] + m[2] + (race === 'Anão' ? 1 : 0)),
    armorClass:
      armor +
      (shield ? 2 : 0) +
      (armored && c.options.style?.includes('Defesa') ? 1 : 0) +
      (race === 'Warforged' ? 1 : 0),
    unarmored: bare + (race === 'Warforged' ? 1 : 0),
    initiative: m[1] + (feats(c).includes('Alerta') ? prof : 0),
    speed:
      (race === 'Elfo' && c.subrace === 'Elfo da floresta' ? 10.5 : r.speed) -
      (equipment.includes('Cota de malha') && stats[0] < 13 ? 3 : 0),
    size: c.options.size?.[0] || r.size,
    hitDie: hitDice[cls],
    passivePerception:
      10 +
      m[4] +
      (trained.includes('Percepção') ? prof * (c.expertise.includes('Percepção') ? 2 : 1) : 0),
    saves: m.map((v, i) => v + (k.saves.includes(i) ? prof : 0)),
    skills: skills.map((name, i) => ({
      name,
      value:
        m[skillAbilities[i]] +
        (trained.includes(name) ? prof * (c.expertise.includes(name) ? 2 : 1) : 0) +
        ((order === 'Taumaturgo' && ['Arcanismo', 'Religião'].includes(name)) ||
        (order === 'Mago primal' && ['Arcanismo', 'Natureza'].includes(name))
          ? Math.max(1, m[4])
          : 0),
      trained: trained.includes(name),
      expert: c.expertise.includes(name),
    })),
    languages: [
      ...new Set([
        'Comum',
        ...c.backgroundExtras,
        ...(cls === 'Druida'
          ? ['Druídico']
          : cls === 'Ladino'
            ? ['Gíria dos ladrões', ...c.options.rogueLanguage]
            : []),
      ]),
    ],
    equipment,
    features,
    featureGroups,
    proficiencies: [
      ...k.proficiencies,
      backgroundTool(c),
      ...(c.options.racialTool || []),
      ...(c.options.versatileTraining || []).filter((v) => tools.includes(v)),
      ...(c.options.game || []),
      ...(c.options.instruments || []),
      ...(c.options.monkTool || []),
      ...(cls === 'Artífice'
        ? ['Ferramentas de ladrão', 'Ferramentas de funileiro', ...(c.options.artificerTool || [])]
        : []),
      ...Object.entries(c.options)
        .filter(([key]) => /^(crafter|musician)\d+$/.test(key))
        .flatMap(([, v]) => v),
      ...(feats(c).includes('Brigão de Taverna') ? ['Armas improvisadas'] : []),
      ...(cls === 'Ladino'
        ? ['Ferramentas de ladrão']
        : cls === 'Druida'
          ? ['Kit de herbalismo']
          : []),
      ...(order === 'Protetor'
        ? ['Armas marciais e armaduras pesadas']
        : order === 'Guardião'
          ? ['Armas marciais e armaduras médias']
          : []),
      ...Object.entries(c.options)
        .filter(([key]) => key.startsWith('skilled'))
        .flatMap(([, v]) => v)
        .filter((v) => !skills.includes(v)),
    ],
    spellAbility: k.ability,
    spellDC: k.ability === undefined ? null : 8 + prof + m[k.ability],
    spellAttack: k.ability === undefined ? null : prof + m[k.ability],
    slots: k.slots,
    prepareCount: k.prepareCount,
    cantrips: [
      ...c.cantrips,
      ...(c.options.orderCantrip || []),
      ...(cls === 'Artífice' ? ['mending'] : []),
    ],
    known: c.spells,
    spellGrants,
    alwaysPrepared:
      cls === 'Druida'
        ? ['speak-with-animals']
        : cls === 'Patrulheiro'
          ? ['hunters-mark']
          : cls === 'Bruxo' && inv === 'Pacto da Corrente'
            ? ['find-familiar']
            : [],
  };
}
export function deriveSheet(
  character: { race: string; class: string; stats: number[]; level: number },
  c: SheetChoices,
) {
  const effectiveStyles = classFightingStyles(character.class, c);
  const origin = { ...c, options: { ...c.options, style: effectiveStyles[character.class] || [] } };
  const sheet = applyAdvancement(character, c, deriveOriginSheet(character, origin));
  if (feats(c).includes('Robusto')) sheet.hp += 2 * character.level;
  for (const row of c.advancement?.levels || [])
    if (row.feat) {
      const f = featRules.find((v) => v.id === row.feat);
      if (!f) continue;
      if (f.id === 'tough') sheet.hp += 2 * character.level;
      if (f.id === 'boon-of-fortitude') sheet.hp += 40;
      if (f.id === 'speedy') sheet.speed += 3;
      if (f.id === 'boon-of-speed') sheet.speed += 9;
      if (f.id === 'alert') sheet.initiative += sheet.proficiency;
      if (f.id === 'resilient') {
        const i = row.boosts.findIndex(Boolean);
        if (i >= 0) sheet.saves[i] = modifier(character.stats[i]) + sheet.proficiency;
      }
      const selectedSkills = [
        ...(row.choices.featSkills || []),
        ...(row.choices.featKnowledge || []),
        ...(f.id === 'boon-of-skill' ? skills : []),
      ];
      for (const skill of sheet.skills) {
        const previouslyTrained = skill.trained;
        if (selectedSkills.includes(skill.name) && !skill.trained) {
          skill.trained = true;
          skill.value += sheet.proficiency;
        }
        if (
          (row.choices.featExpertise || []).includes(skill.name) ||
          ((row.choices.featKnowledge || []).includes(skill.name) && previouslyTrained)
        )
          if (!skill.expert) {
            if (!skill.trained) {
              skill.trained = true;
              skill.value += sheet.proficiency;
            }
            skill.expert = true;
            skill.value += sheet.proficiency;
          }
      }
      sheet.proficiencies = [
        ...new Set([
          ...sheet.proficiencies,
          ...(row.choices.featTools || []),
          ...selectedSkills.filter((s) => !skills.includes(s)),
          ...({
            'lightly-armored': ['Armaduras leves e escudos'],
            'moderately-armored': ['Armaduras médias'],
            'heavily-armored': ['Armaduras pesadas'],
            'martial-weapon-training': ['Armas marciais'],
            chef: ['Utensílios de cozinheiro'],
          }[f.id] || []),
        ]),
      ];
      const selectedSpells = [
        ...(row.choices.featSpell || []),
        ...(row.choices.featRituals || []),
        ...(f.id === 'fey-touched'
          ? ['misty-step']
          : f.id === 'shadow-touched'
            ? ['invisibility']
            : f.id === 'telepathic'
              ? ['detect-thoughts']
              : []),
      ];
      const selectedCantrips = [
        ...(row.choices.featCantrips || []),
        ...(f.id === 'telekinetic' ? ['mage-hand'] : []),
      ];
      if (selectedSpells.length || selectedCantrips.length)
        sheet.spellGrants.push({
          source: `${f.name} · ${row.class}, nível ${row.classLevel}`,
          ability: row.choices.featAbility?.[0]
            ? statNames.indexOf(row.choices.featAbility[0])
            : Math.max(3, row.boosts.findIndex(Boolean)),
          cantrips: selectedCantrips,
          spells: selectedSpells,
          note: 'Magias concedidas pelo talento; custos, usos e recuperação conforme sua descrição. Não concede espaços de magia.',
        });
    }
  sheet.passivePerception = 10 + sheet.skills.find((s) => s.name === 'Percepção')!.value;
  return { ...sheet, featureEntries: sheetFeatureEntries(character, c, sheet.featureGroups) };
}
export type SheetRecord = {
  choices: SheetChoices | null;
  rolls: number[][] | null;
  assignment: number[] | null;
  finalized_at: string | null;
  prepared: string[];
  notes: string;
  current_hp: number | null;
  temp_hp: number;
  inspiration: boolean;
  death_success: number;
  death_failure: number;
  slots_used: number;
  hit_dice_used: number;
  rules_version?: string;
};
export type SheetResponse = {
  guild?: { id: string; name: string } | null;
  equipped?: { id: string; name: string; image_path: string | null; slots: string[] }[];
  startingEquipment?: { name: string; image_path: string | null }[];
  sheet: SheetRecord | null;
  derived: ReturnType<typeof deriveSheet> | null;
  attacks?: import('./equipped-attacks').EquippedAttack[];
  capabilities?: { can_grant_level: boolean; can_manage_resources?: boolean };
};

export function restChoiceFields(race: string, cls: string, c: SheetChoices) {
  return choiceFields(race, cls, c).filter((f) =>
    [
      'mastery',
      'racialCantrip',
      'tomeCantrips',
      'tomeRituals',
      'dreamSkill',
      'versatileTraining',
    ].includes(f.key),
  );
}
export function validateRestChoices(
  race: string,
  cls: string,
  previous: SheetChoices,
  input: unknown,
) {
  const next = validateChoices(race, cls, input),
    allowed = restChoiceFields(race, cls, previous).map((f) => f.key);
  const fixed = (c: SheetChoices) => ({
    ...c,
    cantrips: cls === 'Mago' ? [] : c.cantrips,
    options: Object.fromEntries(
      Object.entries(c.options)
        .filter(([k]) => !allowed.includes(k))
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  });
  if (JSON.stringify(fixed(choicesSchema.parse(previous))) !== JSON.stringify(fixed(next)))
    throw new Error('O descanso não permite alterar a origem, o treinamento ou os talentos.');
  if (cls === 'Mago' && next.cantrips.filter((v) => !previous.cantrips.includes(v)).length > 1)
    throw new Error('Mago pode substituir apenas um truque após descanso longo.');
  if (
    ['Bárbaro', 'Guerreiro'].includes(cls) &&
    (next.options.mastery || []).filter((v) => !previous.options.mastery?.includes(v)).length > 1
  )
    throw new Error('Esta classe pode substituir apenas uma maestria após descanso longo.');
  return next;
}

function nonTomeSpells(race: string, cls: string, c: SheetChoices) {
  const racial =
    race === 'Khoravar'
      ? c.options.racialCantrip || ['friends']
      : race === 'Elfo'
        ? c.subrace === 'Drow'
          ? ['dancing-lights']
          : c.subrace === 'Elfo da floresta'
            ? ['druidcraft']
            : c.options.racialCantrip || []
        : race === 'Gnomo'
          ? c.subrace === 'Gnomo da floresta'
            ? ['minor-illusion', 'speak-with-animals']
            : ['mending', 'prestidigitation']
          : race === 'Tiefling'
            ? [
                'thaumaturgy',
                c.subrace === 'Abissal'
                  ? 'poison-spray'
                  : c.subrace === 'Ctônico'
                    ? 'chill-touch'
                    : 'fire-bolt',
              ]
            : [];
  return [
    ...c.cantrips,
    ...c.spells,
    ...racial,
    ...Object.entries(c.options)
      .filter(
        ([k]) => k.startsWith('featCantrips') || k.startsWith('featSpell') || k === 'orderCantrip',
      )
      .flatMap(([, v]) => v),
  ];
}
