import { z } from 'zod';
import { hitDice, modifier } from './rules.js';
import spellData from './srd-spells.json';

export const skills = [
  'Acrobacia',
  'Adestrar Animais',
  'Arcanismo',
  'Atletismo',
  'Atuação',
  'Enganação',
  'Furtividade',
  'História',
  'Intimidação',
  'Intuição',
  'Investigação',
  'Medicina',
  'Natureza',
  'Percepção',
  'Persuasão',
  'Prestidigitação',
  'Religião',
  'Sobrevivência',
];
export const skillAbilities = [1, 4, 3, 0, 5, 5, 1, 3, 5, 4, 3, 4, 3, 4, 5, 1, 3, 4];
export const languages = [
  'Comum',
  'Anão',
  'Élfico',
  'Gigante',
  'Gnômico',
  'Goblin',
  'Halfling',
  'Orc',
  'Abissal',
  'Celestial',
  'Dracônico',
  'Infernal',
  'Primordial',
  'Silvestre',
  'Subcomum',
  'Dialeto Subterrâneo',
];
export const tools = [
  'Ferramentas de ferreiro',
  'Ferramentas de cervejeiro',
  'Ferramentas de pedreiro',
  'Ferramentas de carpinteiro',
  'Ferramentas de cartógrafo',
  'Ferramentas de joalheiro',
  'Ferramentas de couro',
  'Ferramentas de costureiro',
  'Ferramentas de ladrão',
  'Kit de disfarce',
  'Kit de falsificação',
  'Kit de herbalismo',
  'Dados de jogo',
  'Baralho',
  'Veículos terrestres',
  'Veículos aquáticos',
  'Alaúde',
  'Flauta',
  'Tambor',
  'Lira',
  'Gaita de foles',
  'Trombeta',
  'Violino',
];
const instruments = tools.slice(16);
export const alignments = [
  'Leal e bom',
  'Neutro e bom',
  'Caótico e bom',
  'Leal e neutro',
  'Neutro',
  'Caótico e neutro',
  'Leal e mau',
  'Neutro e mau',
  'Caótico e mau',
];
type RaceRule = {
  bonus: number[];
  speed: number;
  size: string;
  languages: string[];
  traits: string[];
  variants: string[];
};
export const raceRules: Record<string, RaceRule> = {
  Humano: {
    bonus: [1, 1, 1, 1, 1, 1],
    speed: 9,
    size: 'Médio',
    languages: ['Comum'],
    traits: ['Versatilidade humana: +1 nos seis atributos.'],
    variants: ['Humano padrão'],
  },
  Elfo: {
    bonus: [0, 2, 0, 1, 0, 0],
    speed: 9,
    size: 'Médio',
    languages: ['Comum', 'Élfico'],
    traits: [
      'Visão no escuro: 18 m.',
      'Sentidos aguçados: Percepção.',
      'Ancestralidade feérica: vantagem contra encantamento; imune a sono mágico.',
      'Transe: medita por 4 horas.',
      'Treinamento élfico: espadas longas e curtas, arcos longos e curtos.',
    ],
    variants: ['Alto elfo'],
  },
  Anão: {
    bonus: [0, 0, 2, 0, 1, 0],
    speed: 7.5,
    size: 'Médio',
    languages: ['Comum', 'Anão'],
    traits: [
      'Visão no escuro: 18 m.',
      'Resiliência anã: vantagem contra veneno e resistência a dano venenoso.',
      'Tenacidade anã: +1 PV por nível.',
      'Conhecimento de rochas: dobro da proficiência em História sobre alvenaria.',
      'Treinamento: machados de batalha, machadinhas, martelos leves e de guerra.',
      'Armadura pesada não reduz seu deslocamento.',
    ],
    variants: ['Anão da colina'],
  },
  Halfling: {
    bonus: [0, 2, 0, 0, 0, 1],
    speed: 7.5,
    size: 'Pequeno',
    languages: ['Comum', 'Halfling'],
    traits: [
      'Sortudo: pode rolar novamente um 1 natural em ataque, teste de atributo ou salvaguarda.',
      'Bravura: vantagem contra amedrontamento.',
      'Agilidade halfling: atravessa o espaço de criaturas maiores.',
      'Furtividade natural: pode esconder-se atrás de criatura maior.',
    ],
    variants: ['Pés-leves'],
  },
  Draconato: {
    bonus: [2, 0, 0, 0, 0, 1],
    speed: 9,
    size: 'Médio',
    languages: ['Comum', 'Dracônico'],
    traits: [
      'Ancestralidade dracônica: resistência ao tipo de dano escolhido.',
      'Sopro: 2d6; CD 8 + Constituição + proficiência; metade no sucesso. Uma vez por descanso curto ou longo.',
    ],
    variants: ['Draconato'],
  },
  Gnomo: {
    bonus: [0, 0, 1, 2, 0, 0],
    speed: 7.5,
    size: 'Pequeno',
    languages: ['Comum', 'Gnômico'],
    traits: [
      'Visão no escuro: 18 m.',
      'Esperteza gnômica: vantagem em salvaguardas de Inteligência, Sabedoria e Carisma contra magia.',
      'Conhecimento de artífice: dobro da proficiência em História sobre magia, alquimia e tecnologia.',
      'Engenhoqueiro: ferramentas de funileiro; dispositivos custam 10 PO e 1 hora.',
    ],
    variants: ['Gnomo das rochas'],
  },
  'Meio-elfo': {
    bonus: [0, 0, 0, 0, 0, 2],
    speed: 9,
    size: 'Médio',
    languages: ['Comum', 'Élfico'],
    traits: [
      'Visão no escuro: 18 m.',
      'Ancestralidade feérica: vantagem contra encantamento; imune a sono mágico.',
      'Versatilidade: duas perícias e +1 em dois atributos diferentes de Carisma.',
    ],
    variants: ['Meio-elfo'],
  },
  'Meio-orc': {
    bonus: [2, 0, 1, 0, 0, 0],
    speed: 9,
    size: 'Médio',
    languages: ['Comum', 'Orc'],
    traits: [
      'Visão no escuro: 18 m.',
      'Ameaçador: Intimidação.',
      'Resistência implacável: ao cair a 0 PV sem morrer, fica com 1 PV; uma vez por descanso longo.',
      'Ataques selvagens: um dado de dano adicional em crítico com arma corpo a corpo.',
    ],
    variants: ['Meio-orc'],
  },
  Tiefling: {
    bonus: [0, 0, 0, 1, 0, 2],
    speed: 9,
    size: 'Médio',
    languages: ['Comum', 'Infernal'],
    traits: [
      'Visão no escuro: 18 m.',
      'Resistência infernal: resistência a fogo.',
      'Legado infernal: Taumaturgia usando Carisma no nível 1.',
    ],
    variants: ['Tiefling'],
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
  cantrips?: number;
  known?: number;
  slots?: number;
  prepared?: boolean;
};
const classRule = (
  id: string,
  saves: number[],
  count: number,
  allowed: string[],
  proficiencies: string[],
  features: string[],
  magic: Partial<ClassRule> = {},
): ClassRule => ({ id, saves, count, skills: allowed, proficiencies, features, ...magic });
export const classRules: Record<string, ClassRule> = {
  Bárbaro: classRule(
    'barbarian',
    [0, 2],
    2,
    ['Adestrar Animais', 'Atletismo', 'Intimidação', 'Natureza', 'Percepção', 'Sobrevivência'],
    ['Armaduras leves e médias; escudos', 'Armas simples e marciais'],
    [
      'Fúria: 2/descanso longo; +2 dano em ataques corpo a corpo com Força; resistência a dano contundente, cortante e perfurante.',
      'Defesa sem armadura: 10 + Destreza + Constituição (escudo permitido).',
    ],
  ),
  Bardo: classRule(
    'bard',
    [1, 5],
    3,
    skills,
    ['Armaduras leves', 'Armas simples, bestas de mão, espadas longas e curtas, rapieiras'],
    [
      'Inspiração de bardo: d6; usos iguais ao modificador de Carisma (mínimo 1), por descanso longo.',
      'Conjuração e rituais das magias conhecidas.',
    ],
    { ability: 5, cantrips: 2, known: 4, slots: 2 },
  ),
  Bruxo: classRule(
    'warlock',
    [4, 5],
    2,
    ['Arcanismo', 'Enganação', 'História', 'Intimidação', 'Investigação', 'Natureza', 'Religião'],
    ['Armaduras leves', 'Armas simples'],
    [
      'Patrono: O Corruptor (SRD).',
      'Bênção do Obscuro: ao reduzir inimigo a 0 PV, ganha PV temporários iguais a nível + Carisma (mínimo 1).',
      'Magia de pacto: um espaço de nível 1; recupera em descanso curto ou longo.',
    ],
    { ability: 5, cantrips: 2, known: 2, slots: 1 },
  ),
  Clérigo: classRule(
    'cleric',
    [4, 5],
    2,
    ['História', 'Intuição', 'Medicina', 'Persuasão', 'Religião'],
    ['Armaduras leves, médias e pesadas (Vida); escudos', 'Armas simples'],
    [
      'Domínio da Vida (SRD).',
      'Discípulo da Vida: cura por magia de nível 1+ recebe bônus de 2 + nível da magia.',
      'Magias de domínio sempre preparadas: Bênção e Curar Ferimentos.',
      'Conjuração e rituais das magias preparadas.',
    ],
    { ability: 4, cantrips: 3, slots: 2, prepared: true },
  ),
  Druida: classRule(
    'druid',
    [3, 4],
    2,
    [
      'Arcanismo',
      'Adestrar Animais',
      'Intuição',
      'Medicina',
      'Natureza',
      'Percepção',
      'Religião',
      'Sobrevivência',
    ],
    [
      'Armaduras leves e médias; escudos (não usa metal)',
      'Clavas, adagas, dardos, azagaias, maças, bordões, cimitarras, foices, fundas e lanças',
      'Kit de herbalismo',
    ],
    ['Idioma secreto druídico.', 'Conjuração e rituais das magias preparadas.'],
    { ability: 4, cantrips: 2, slots: 2, prepared: true },
  ),
  Feiticeiro: classRule(
    'sorcerer',
    [2, 5],
    2,
    ['Arcanismo', 'Enganação', 'Intuição', 'Intimidação', 'Persuasão', 'Religião'],
    ['Adagas, dardos, fundas, bordões e bestas leves'],
    [
      'Linhagem Dracônica (SRD): idioma dracônico; dobro da proficiência em Carisma ao interagir com dragões.',
      'Resiliência dracônica: +1 PV por nível e CA sem armadura 13 + Destreza.',
    ],
    { ability: 5, cantrips: 4, known: 2, slots: 2 },
  ),
  Guerreiro: classRule(
    'fighter',
    [0, 2],
    2,
    [
      'Acrobacia',
      'Adestrar Animais',
      'Atletismo',
      'História',
      'Intuição',
      'Intimidação',
      'Percepção',
      'Sobrevivência',
    ],
    ['Todas as armaduras e escudos', 'Armas simples e marciais'],
    [
      'Retomar o fôlego: ação bônus, recupera 1d10 + nível PV; uma vez por descanso curto ou longo.',
      'Estilo de luta escolhido na criação.',
    ],
  ),
  Ladino: classRule(
    'rogue',
    [1, 3],
    4,
    [
      'Acrobacia',
      'Atletismo',
      'Atuação',
      'Enganação',
      'Furtividade',
      'Intimidação',
      'Intuição',
      'Investigação',
      'Percepção',
      'Persuasão',
      'Prestidigitação',
    ],
    [
      'Armaduras leves',
      'Armas simples, bestas de mão, espadas longas e curtas, rapieiras',
      'Ferramentas de ladrão',
    ],
    [
      'Ataque furtivo: +1d6 uma vez por turno, com arma de acuidade ou à distância, quando as condições forem atendidas.',
      'Especialização: dobro da proficiência em duas escolhas.',
      'Gíria dos ladrões.',
    ],
  ),
  Mago: classRule(
    'wizard',
    [3, 4],
    2,
    ['Arcanismo', 'História', 'Intuição', 'Investigação', 'Medicina', 'Religião'],
    ['Adagas, dardos, fundas, bordões e bestas leves'],
    [
      'Grimório: seis magias de nível 1 iniciais.',
      'Recuperação arcana: recupera um espaço de nível 1 em descanso curto, uma vez por dia.',
      'Rituais do grimório não precisam estar preparados.',
    ],
    { ability: 3, cantrips: 3, known: 6, slots: 2, prepared: true },
  ),
  Monge: classRule(
    'monk',
    [0, 1],
    2,
    ['Acrobacia', 'Atletismo', 'Furtividade', 'História', 'Intuição', 'Religião'],
    ['Armas simples e espadas curtas'],
    [
      'Defesa sem armadura: 10 + Destreza + Sabedoria, sem escudo.',
      'Artes marciais: d4; usa Destreza; ataque desarmado como ação bônus após ação Atacar com arma de monge/desarmado, sem armadura ou escudo.',
    ],
  ),
  Paladino: classRule(
    'paladin',
    [4, 5],
    2,
    ['Atletismo', 'Intuição', 'Intimidação', 'Medicina', 'Persuasão', 'Religião'],
    ['Todas as armaduras e escudos', 'Armas simples e marciais'],
    [
      'Sentido divino: 1 + modificador de Carisma usos (mínimo 1), por descanso longo.',
      'Cura pelas mãos: reserva de 5 PV por nível, por descanso longo.',
      'Conjuração começa no nível 2.',
    ],
  ),
  Patrulheiro: classRule(
    'ranger',
    [0, 1],
    3,
    [
      'Adestrar Animais',
      'Atletismo',
      'Furtividade',
      'Intuição',
      'Investigação',
      'Natureza',
      'Percepção',
      'Sobrevivência',
    ],
    ['Armaduras leves e médias; escudos', 'Armas simples e marciais'],
    [
      'Inimigo favorito: vantagem em Sobrevivência para rastrear e Inteligência para recordar informações sobre o tipo escolhido.',
      'Explorador natural: benefícios de viagem e proficiência dobrada nos testes proficientes de Inteligência/Sabedoria relacionados ao terreno favorito.',
      'Conjuração começa no nível 2.',
    ],
  ),
};

const spellNames = [
  'Respingo Ácido',
  'Alarme',
  'Amizade Animal',
  'Perdição',
  'Bênção',
  'Mãos Flamejantes',
  'Enfeitiçar Pessoa',
  'Toque Arrepiante',
  'Leque Cromático',
  'Comando',
  'Compreender Idiomas',
  'Criar ou Destruir Água',
  'Curar Ferimentos',
  'Luzes Dançantes',
  'Detectar o Bem e o Mal',
  'Detectar Magia',
  'Detectar Veneno e Doença',
  'Disfarçar-se',
  'Favor Divino',
  'Druidismo',
  'Rajada Mística',
  'Constrição',
  'Recuo Acelerado',
  'Fogo das Fadas',
  'Vitalidade Falsa',
  'Queda Suave',
  'Encontrar Familiar',
  'Raio de Fogo',
  'Disco Flutuante',
  'Névoa Obscurecente',
  'Bom Fruto',
  'Área Escorregadia',
  'Orientação',
  'Raio Guiador',
  'Palavra Curativa',
  'Repreensão Infernal',
  'Heroísmo',
  'Riso Histérico',
  'Marca do Caçador',
  'Identificação',
  'Escrita Ilusória',
  'Infligir Ferimentos',
  'Salto',
  'Luz',
  'Passos Longos',
  'Armadura Arcana',
  'Mãos Mágicas',
  'Mísseis Mágicos',
  'Consertar',
  'Mensagem',
  'Ilusão Menor',
  'Rajada de Veneno',
  'Prestidigitação Arcana',
  'Criar Chamas',
  'Proteção contra o Bem e o Mal',
  'Purificar Alimentos e Bebidas',
  'Raio de Gelo',
  'Resistência',
  'Chama Sagrada',
  'Santuário',
  'Escudo Arcano',
  'Escudo da Fé',
  'Bordão Místico',
  'Toque Chocante',
  'Imagem Silenciosa',
  'Sono',
  'Estabilizar',
  'Falar com Animais',
  'Taumaturgia',
  'Onda Trovejante',
  'Ataque Certeiro',
  'Servo Invisível',
  'Zombaria Viciosa',
];
export const spells = spellData.spells.map((s, i) => ({ ...s, label: spellNames[i] }));
export function spellOptions(className: string, level: number) {
  const id = classRules[className].id;
  return spells.filter(
    (s) =>
      s.level === level &&
      (s.classes.includes(id) || (id === 'warlock' && ['burning-hands', 'command'].includes(s.id))),
  );
}
export const dragons: Record<string, { damage: string; shape: string; save: string }> = {
  Negro: { damage: 'Ácido', shape: 'Linha 1,5 × 9 m', save: 'Destreza' },
  Azul: { damage: 'Elétrico', shape: 'Linha 1,5 × 9 m', save: 'Destreza' },
  Latão: { damage: 'Fogo', shape: 'Linha 1,5 × 9 m', save: 'Destreza' },
  Bronze: { damage: 'Elétrico', shape: 'Linha 1,5 × 9 m', save: 'Destreza' },
  Cobre: { damage: 'Ácido', shape: 'Linha 1,5 × 9 m', save: 'Destreza' },
  Ouro: { damage: 'Fogo', shape: 'Cone 4,5 m', save: 'Destreza' },
  Verde: { damage: 'Veneno', shape: 'Cone 4,5 m', save: 'Constituição' },
  Vermelho: { damage: 'Fogo', shape: 'Cone 4,5 m', save: 'Destreza' },
  Prata: { damage: 'Frio', shape: 'Cone 4,5 m', save: 'Constituição' },
  Branco: { damage: 'Frio', shape: 'Cone 4,5 m', save: 'Constituição' },
};
export type ChoiceField = { key: string; label: string; count: number; options: string[] };
export function choiceFields(race: string, cls: string): ChoiceField[] {
  const result: ChoiceField[] = [];
  const add = (key: string, label: string, count: number, options: string[]) =>
    result.push({ key, label, count, options });
  if (['Humano', 'Elfo', 'Meio-elfo'].includes(race))
    add(
      'racialLanguage',
      'Idioma adicional da raça',
      1,
      languages.filter((l) => !raceRules[race].languages.includes(l)),
    );
  if (race === 'Meio-elfo') {
    add('racialSkills', 'Perícias do meio-elfo', 2, skills);
    add('racialAbilities', 'Atributos raciais +1', 2, [
      'Força',
      'Destreza',
      'Constituição',
      'Inteligência',
      'Sabedoria',
    ]);
  }
  if (race === 'Anão') add('artisan', 'Ferramenta anã', 1, tools.slice(0, 3));
  if (race === 'Elfo')
    add(
      'racialCantrip',
      'Truque de alto elfo (Inteligência)',
      1,
      spellOptions('Mago', 0).map((s) => s.id),
    );
  if (race === 'Draconato' || cls === 'Feiticeiro')
    add('dragon', 'Ancestralidade dracônica', 1, Object.keys(dragons));
  if (cls === 'Bardo') add('instruments', 'Instrumentos musicais', 3, instruments);
  if (cls === 'Monge')
    add('monkTool', 'Ferramenta ou instrumento', 1, [...tools.slice(0, 8), ...instruments]);
  if (cls === 'Guerreiro')
    add('style', 'Estilo de luta', 1, [
      'Arquearia',
      'Defesa',
      'Duelismo',
      'Combate com armas grandes',
      'Proteção',
      'Combate com duas armas',
    ]);
  if (cls === 'Patrulheiro') {
    add('enemy', 'Inimigo favorito', 1, [
      'Aberrações',
      'Bestas',
      'Celestiais',
      'Constructos',
      'Dragões',
      'Elementais',
      'Fadas',
      'Corruptores',
      'Gigantes',
      'Monstruosidades',
      'Limos',
      'Plantas',
      'Mortos-vivos',
    ]);
    add('terrain', 'Terreno favorito', 1, [
      'Ártico',
      'Costa',
      'Deserto',
      'Floresta',
      'Pradaria',
      'Montanha',
      'Pântano',
      'Subterrâneo',
    ]);
    add('enemyLanguage', 'Idioma do inimigo favorito (quando aplicável à criatura)', 1, languages);
  }
  return result;
}
export const weaponData: Record<
  string,
  {
    dice: string;
    type: string;
    ability?: 'dex' | 'finesse';
    ranged?: boolean;
    martial?: boolean;
    two?: boolean;
  }
> = {
  Alabarda: { dice: '1d10', type: 'Cortante', martial: true, two: true },
  Glaive: { dice: '1d10', type: 'Cortante', martial: true, two: true },
  Pique: { dice: '1d10', type: 'Perfurante', martial: true, two: true },
  'Lança de montaria': { dice: '1d12', type: 'Perfurante', martial: true },
  'Maça estrela': { dice: '1d8', type: 'Perfurante', martial: true },
  Mangual: { dice: '1d8', type: 'Contundente', martial: true },
  Malho: { dice: '2d6', type: 'Contundente', martial: true, two: true },
  'Picareta de guerra': { dice: '1d8', type: 'Perfurante', martial: true },
  Tridente: { dice: '1d6 (1d8 com duas mãos)', type: 'Perfurante', martial: true },
  Chicote: { dice: '1d4', type: 'Cortante', martial: true, ability: 'finesse' },
  Zarabatana: { dice: '1', type: 'Perfurante', martial: true, ability: 'dex', ranged: true },
  'Besta pesada': {
    dice: '1d10',
    type: 'Perfurante',
    martial: true,
    ability: 'dex',
    ranged: true,
    two: true,
  },
  Rede: {
    dice: '—',
    type: 'Sem dano; restringe conforme condições',
    martial: true,
    ability: 'dex',
    ranged: true,
  },
  Adaga: { dice: '1d4', type: 'Perfurante', ability: 'finesse' },
  Bordão: { dice: '1d6 (1d8 com duas mãos)', type: 'Contundente' },
  Clava: { dice: '1d4', type: 'Contundente' },
  Maça: { dice: '1d6', type: 'Contundente' },
  Azagaia: { dice: '1d6', type: 'Perfurante' },
  Machadinha: { dice: '1d6', type: 'Cortante' },
  Lança: { dice: '1d6 (1d8 com duas mãos)', type: 'Perfurante' },
  'Besta leve': { dice: '1d8', type: 'Perfurante', ability: 'dex', ranged: true, two: true },
  'Arco curto': { dice: '1d6', type: 'Perfurante', ability: 'dex', ranged: true, two: true },
  Dardo: { dice: '1d4', type: 'Perfurante', ability: 'finesse', ranged: true },
  Funda: { dice: '1d4', type: 'Contundente', ability: 'dex', ranged: true },
  Foice: { dice: '1d4', type: 'Cortante' },
  'Martelo leve': { dice: '1d4', type: 'Contundente' },
  Porrete: { dice: '1d8', type: 'Contundente', two: true },
  'Espada longa': { dice: '1d8 (1d10 com duas mãos)', type: 'Cortante', martial: true },
  'Espada curta': { dice: '1d6', type: 'Perfurante', ability: 'finesse', martial: true },
  Rapieira: { dice: '1d8', type: 'Perfurante', ability: 'finesse', martial: true },
  Cimitarra: { dice: '1d6', type: 'Cortante', ability: 'finesse', martial: true },
  'Machado grande': { dice: '1d12', type: 'Cortante', martial: true, two: true },
  'Espada grande': { dice: '2d6', type: 'Cortante', martial: true, two: true },
  'Machado de batalha': { dice: '1d8 (1d10 com duas mãos)', type: 'Cortante', martial: true },
  'Martelo de guerra': { dice: '1d8 (1d10 com duas mãos)', type: 'Contundente', martial: true },
  'Arco longo': {
    dice: '1d8',
    type: 'Perfurante',
    ability: 'dex',
    ranged: true,
    martial: true,
    two: true,
  },
  'Besta de mão': { dice: '1d6', type: 'Perfurante', ability: 'dex', ranged: true, martial: true },
};
const simple = Object.keys(weaponData).filter((w) => !weaponData[w].martial);
const martial = Object.keys(weaponData).filter((w) => weaponData[w].martial);
const packs = ['Pacote de explorador', 'Pacote de aventureiro'];
export function equipmentFields(cls: string): ChoiceField[] {
  const f = (key: string, label: string, options: string[]): ChoiceField => ({
    key,
    label,
    count: 1,
    options,
  });
  switch (cls) {
    case 'Bárbaro':
      return [
        f(
          'weapon',
          'Arma principal',
          martial.filter((w) => !weaponData[w].ranged),
        ),
        f('secondary', 'Arma secundária', ['Duas machadinhas', ...simple]),
      ];
    case 'Bardo':
      return [
        f('weapon', 'Arma', ['Rapieira', 'Espada longa', ...simple]),
        f('pack', 'Pacote', ['Pacote de diplomata', 'Pacote de artista']),
        f('focus', 'Instrumento', instruments),
      ];
    case 'Bruxo':
    case 'Feiticeiro':
      return [
        f('weapon', 'Arma', ['Besta leve e 20 virotes', ...simple]),
        f('focus', 'Foco', ['Bolsa de componentes', 'Foco arcano']),
        f(
          'pack',
          'Pacote',
          cls === 'Bruxo' ? ['Pacote de estudioso', 'Pacote de aventureiro'] : packs,
        ),
        ...(cls === 'Bruxo' ? [f('secondary', 'Arma simples adicional', simple)] : []),
      ];
    case 'Clérigo':
      return [
        f('weapon', 'Arma', ['Maça', 'Martelo de guerra']),
        f('armor', 'Armadura', ['Cota de escamas', 'Couro', 'Cota de malha']),
        f('secondary', 'Outra arma', ['Besta leve e 20 virotes', ...simple]),
        f('pack', 'Pacote', ['Pacote de sacerdote', 'Pacote de explorador']),
      ];
    case 'Druida':
      return [
        f('secondary', 'Escudo ou arma', ['Escudo de madeira', ...simple]),
        f('weapon', 'Arma', ['Cimitarra', ...simple.filter((w) => !weaponData[w].ranged)]),
      ];
    case 'Guerreiro':
      return [
        f('armor', 'Armadura', ['Cota de malha', 'Couro, arco longo e 20 flechas']),
        f('weapon', 'Arma marcial', martial),
        f('secondary', 'Escudo ou segunda arma', ['Escudo', ...martial]),
        f('ranged', 'Reserva', ['Besta leve e 20 virotes', 'Duas machadinhas']),
        f('pack', 'Pacote', packs),
      ];
    case 'Ladino':
      return [
        f('weapon', 'Arma', ['Rapieira', 'Espada curta']),
        f('secondary', 'Outra arma', ['Arco curto e 20 flechas', 'Espada curta']),
        f('pack', 'Pacote', ['Pacote de assaltante', ...packs]),
      ];
    case 'Mago':
      return [
        f('weapon', 'Arma', ['Bordão', 'Adaga']),
        f('focus', 'Foco', ['Bolsa de componentes', 'Foco arcano']),
        f('pack', 'Pacote', ['Pacote de estudioso', 'Pacote de explorador']),
      ];
    case 'Monge':
      return [f('weapon', 'Arma', ['Espada curta', ...simple]), f('pack', 'Pacote', packs)];
    case 'Paladino':
      return [
        f('weapon', 'Arma marcial', martial),
        f('secondary', 'Escudo ou segunda arma', ['Escudo', ...martial]),
        f('ranged', 'Reserva', ['Cinco azagaias', ...simple.filter((w) => !weaponData[w].ranged)]),
        f('pack', 'Pacote', ['Pacote de sacerdote', 'Pacote de explorador']),
      ];
    default:
      return [
        f('armor', 'Armadura', ['Cota de escamas', 'Couro']),
        f('weapon', 'Arma corpo a corpo', [
          'Duas espadas curtas',
          ...simple.filter((w) => !weaponData[w].ranged),
        ]),
        f(
          'secondary',
          'Segunda arma simples (se não escolheu duas espadas curtas)',
          simple.filter((w) => !weaponData[w].ranged),
        ),
        f('pack', 'Pacote', packs),
      ];
  }
}
const fixedEquipment: Record<string, string[]> = {
  Bárbaro: ['Pacote de explorador', 'Quatro azagaias'],
  Bardo: ['Couro', 'Adaga'],
  Bruxo: ['Couro', 'Duas adagas'],
  Clérigo: ['Escudo', 'Símbolo sagrado'],
  Druida: ['Couro', 'Pacote de explorador', 'Foco druídico'],
  Feiticeiro: ['Duas adagas'],
  Guerreiro: [],
  Ladino: ['Couro', 'Duas adagas', 'Ferramentas de ladrão'],
  Mago: ['Grimório'],
  Monge: ['Dez dardos'],
  Paladino: ['Cota de malha', 'Símbolo sagrado'],
  Patrulheiro: ['Arco longo e 20 flechas'],
};
export const choicesSchema = z.object({
  version: z.literal(1),
  subrace: z.string().max(40),
  alignment: z.enum(alignments as [string, ...string[]]),
  backgroundType: z.enum(['Acólito', 'Personalizado']),
  backgroundSkills: z.array(z.string()).length(2),
  backgroundExtras: z.array(z.string()).length(2),
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
  age: z.string().trim().max(40).default(''),
  height: z.string().trim().max(40).default(''),
  weight: z.string().trim().max(40).default(''),
});
export type SheetChoices = z.infer<typeof choicesSchema>;
export function racialSkills(race: string, c: SheetChoices) {
  return race === 'Elfo'
    ? ['Percepção']
    : race === 'Meio-orc'
      ? ['Intimidação']
      : race === 'Meio-elfo'
        ? c.options.racialSkills || []
        : [];
}
export function proficientSkills(race: string, c: SheetChoices) {
  return [...new Set([...racialSkills(race, c), ...c.backgroundSkills, ...c.classSkills])];
}
export function defaultChoices(race: string, cls: string): SheetChoices {
  const options = Object.fromEntries(
    choiceFields(race, cls).map((f) => [f.key, f.options.slice(0, f.count)]),
  );
  const c: SheetChoices = {
    version: 1,
    subrace: raceRules[race].variants[0],
    alignment: 'Neutro',
    backgroundType: 'Acólito',
    backgroundSkills: ['Intuição', 'Religião'],
    backgroundExtras: [],
    classSkills: [],
    options,
    equipment: Object.fromEntries(equipmentFields(cls).map((f) => [f.key, [f.options[0]]])),
    cantrips: spellOptions(cls, 0)
      .slice(0, classRules[cls].cantrips || 0)
      .map((s) => s.id),
    spells: spellOptions(cls, 1)
      .slice(0, classRules[cls].known || 0)
      .map((s) => s.id),
    expertise: [],
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
    appearance: '',
    age: '',
    height: '',
    weight: '',
  };
  c.backgroundExtras = languages
    .filter(
      (l) =>
        !raceRules[race].languages.includes(l) &&
        !options.racialLanguage?.includes(l) &&
        !(cls === 'Feiticeiro' && l === 'Dracônico'),
    )
    .slice(0, 2);
  c.backgroundSkills = c.backgroundSkills.map((s) =>
    racialSkills(race, c).includes(s)
      ? skills.find((k) => !c.backgroundSkills.includes(k) && !racialSkills(race, c).includes(k))!
      : s,
  );
  c.classSkills = classRules[cls].skills
    .filter((s) => !c.backgroundSkills.includes(s) && !racialSkills(race, c).includes(s))
    .slice(0, classRules[cls].count);
  if (cls === 'Ladino') c.expertise = proficientSkills(race, c).slice(0, 2);
  return c;
}
export function validateChoices(race: string, cls: string, input: unknown): SheetChoices {
  const c = choicesSchema.parse(input),
    r = raceRules[race],
    k = classRules[cls];
  const check = (ok: boolean, message: string) => {
    if (!ok) throw new Error(message);
  };
  const list = (v: string[], n: number, allowed: string[], label: string) =>
    check(
      v.length === n && new Set(v).size === n && v.every((x) => allowed.includes(x)),
      `Confira ${label}: escolha ${n} opções distintas permitidas.`,
    );
  check(r.variants.includes(c.subrace), 'Sub-raça inválida.');
  for (const [fields, values] of [
    [choiceFields(race, cls), c.options],
    [equipmentFields(cls), c.equipment],
  ] as const) {
    check(
      Object.keys(values).every((key) => fields.some((f) => f.key === key)),
      'Opção não permitida para esta raça ou classe.',
    );
    for (const f of fields) list(values[f.key] || [], f.count, f.options, f.label);
  }
  const racial = racialSkills(race, c);
  list(
    c.backgroundSkills,
    2,
    skills.filter((s) => !racial.includes(s)),
    'as perícias do antecedente',
  );
  if (c.backgroundType === 'Acólito')
    check(
      ['Intuição', 'Religião'].every((s) => racial.includes(s) || c.backgroundSkills.includes(s)),
      'Acólito recebe Intuição e Religião; substitua somente proficiências repetidas.',
    );
  const fixedLanguages = [
    ...r.languages,
    ...(c.options.racialLanguage || []),
    ...(cls === 'Feiticeiro' ? ['Dracônico'] : []),
  ];
  list(
    c.backgroundExtras,
    2,
    (c.backgroundType === 'Acólito' ? languages : [...languages, ...tools]).filter(
      (s) => !fixedLanguages.includes(s),
    ),
    'os idiomas/ferramentas do antecedente',
  );
  list(
    c.classSkills,
    k.count,
    k.skills.filter((s) => !racial.includes(s) && !c.backgroundSkills.includes(s)),
    'as perícias da classe',
  );
  list(
    c.cantrips,
    k.cantrips || 0,
    spellOptions(cls, 0).map((s) => s.id),
    'os truques',
  );
  list(
    c.spells,
    k.known || 0,
    spellOptions(cls, 1).map((s) => s.id),
    'as magias iniciais',
  );
  list(
    c.expertise,
    cls === 'Ladino' ? 2 : 0,
    [...proficientSkills(race, c), 'Ferramentas de ladrão'],
    'as especializações',
  );
  if (cls === 'Clérigo' && c.equipment.weapon?.[0] === 'Martelo de guerra')
    check(race === 'Anão', 'Martelo de guerra exige proficiência (anão).');
  return c;
}
export function racialBonuses(race: string, c: SheetChoices) {
  const b = [...raceRules[race].bonus];
  if (race === 'Meio-elfo')
    for (const s of c.options.racialAbilities || [])
      b[['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria'].indexOf(s)]++;
  return b;
}
export function sheetAttacks(race: string, cls: string, stats: number[], choices: SheetChoices) {
  const gear = startingEquipment(cls, choices);
  const aliases: Record<string, string[]> = {
    Machadinha: ['Duas machadinhas'],
    Azagaia: ['Quatro azagaias', 'Cinco azagaias'],
    Adaga: ['Duas adagas'],
    Dardo: ['Dez dardos'],
    'Espada curta': ['Duas espadas curtas'],
    'Arco longo': ['Couro, arco longo e 20 flechas'],
  };
  const limited: Record<string, string[]> = {
    Mago: ['Adaga', 'Dardo', 'Funda', 'Bordão', 'Besta leve'],
    Feiticeiro: ['Adaga', 'Dardo', 'Funda', 'Bordão', 'Besta leve'],
    Druida: [
      'Clava',
      'Adaga',
      'Dardo',
      'Azagaia',
      'Maça',
      'Bordão',
      'Cimitarra',
      'Foice',
      'Funda',
      'Lança',
    ],
  };
  return Object.entries(weaponData)
    .filter(([name]) =>
      gear.some((e) => e === name || e.startsWith(name + ' e ') || aliases[name]?.includes(e)),
    )
    .map(([name, w]) => {
      const monk =
        cls === 'Monge' && (name === 'Espada curta' || (!w.martial && !w.two && !w.ranged));
      const dex = w.ability === 'dex' || ((w.ability === 'finesse' || monk) && stats[1] > stats[0]);
      const ability = modifier(stats[dex ? 1 : 0]);
      const trained =
        ['Bárbaro', 'Guerreiro', 'Paladino', 'Patrulheiro'].includes(cls) ||
        (limited[cls] ? limited[cls].includes(name) : !w.martial) ||
        (['Bardo', 'Ladino'].includes(cls) &&
          ['Besta de mão', 'Espada longa', 'Espada curta', 'Rapieira'].includes(name)) ||
        (cls === 'Monge' && name === 'Espada curta') ||
        (race === 'Elfo' &&
          ['Espada longa', 'Espada curta', 'Arco longo', 'Arco curto'].includes(name)) ||
        (race === 'Anão' &&
          ['Machado de batalha', 'Machadinha', 'Martelo leve', 'Martelo de guerra'].includes(name));
      return {
        name,
        dice: w.dice,
        type: w.type,
        ability,
        trained,
        attack:
          ability +
          (trained ? 2 : 0) +
          (w.ranged && choices.options.style?.[0] === 'Arquearia' ? 2 : 0),
      };
    });
}
export function startingEquipment(cls: string, c: SheetChoices) {
  return [
    ...fixedEquipment[cls],
    ...Object.entries(c.equipment)
      .filter(
        ([key]) =>
          !(
            cls === 'Patrulheiro' &&
            key === 'secondary' &&
            c.equipment.weapon[0] === 'Duas espadas curtas'
          ),
      )
      .flatMap(([, v]) => v),
    ...[
      'Símbolo sagrado do antecedente',
      'Livro de orações',
      'Cinco varetas de incenso',
      'Vestes',
      'Roupas comuns',
    ],
  ];
}
export function deriveSheet(
  character: { race: string; class: string; stats: number[]; level: number },
  c: SheetChoices,
) {
  const { race, class: cls, stats, level } = character,
    r = raceRules[race],
    k = classRules[cls],
    m = stats.map(modifier),
    prof = 2 + Math.floor((level - 1) / 4);
  const trained = proficientSkills(race, c),
    equipment = startingEquipment(cls, c);
  const bare =
    cls === 'Bárbaro'
      ? 10 + m[1] + m[2]
      : cls === 'Monge'
        ? 10 + m[1] + m[4]
        : cls === 'Feiticeiro'
          ? 13 + m[1]
          : 10 + m[1];
  const armor = equipment.some((e) => e === 'Cota de malha')
    ? 16
    : equipment.includes('Cota de escamas')
      ? 14 + Math.min(2, m[1])
      : equipment.some((e) => e.startsWith('Couro'))
        ? 11 + m[1]
        : bare;
  const armored = equipment.some(
    (e) => e === 'Cota de malha' || e === 'Cota de escamas' || e.startsWith('Couro'),
  );
  const shield = equipment.some((e) => e === 'Escudo' || e === 'Escudo de madeira');
  const dexArmor =
    armor + (shield ? 2 : 0) + (armored && c.options.style?.[0] === 'Defesa' ? 1 : 0);
  const hp = hitDice[cls] + m[2] + (race === 'Anão' ? 1 : 0) + (cls === 'Feiticeiro' ? 1 : 0);
  return {
    modifiers: m,
    proficiency: prof,
    hp: Math.max(1, hp),
    armorClass: dexArmor,
    unarmored: bare,
    initiative: m[1],
    speed:
      r.speed - (equipment.includes('Cota de malha') && stats[0] < 13 && race !== 'Anão' ? 3 : 0),
    size: r.size,
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
        (trained.includes(name) ? prof * (c.expertise.includes(name) ? 2 : 1) : 0),
      trained: trained.includes(name),
      expert: c.expertise.includes(name),
    })),
    languages: [
      ...new Set([
        ...r.languages,
        ...(c.options.racialLanguage || []),
        ...c.backgroundExtras.filter((x) => languages.includes(x)),
        ...(cls === 'Druida'
          ? ['Druídico']
          : cls === 'Ladino'
            ? ['Gíria dos ladrões']
            : cls === 'Feiticeiro'
              ? ['Dracônico']
              : []),
        ...(c.options.enemyLanguage || []),
      ]),
    ],
    equipment,
    features: [
      ...r.traits,
      ...k.features,
      'Abrigo dos fiéis: você e seus companheiros podem receber cura e cuidados gratuitos em um templo de sua fé; componentes materiais de magias devem ser fornecidos. Você recebe sustento modesto nesses templos.',
      ...(c.options.style?.[0] === 'Duelismo'
        ? ['Duelismo: +2 ao dano com arma corpo a corpo em uma mão, quando não empunha outra arma.']
        : []),
      ...(c.options.style?.[0] === 'Combate com armas grandes'
        ? [
            'Combate com armas grandes: role novamente 1 ou 2 no dano de arma corpo a corpo empunhada com duas mãos, com propriedade versátil ou duas mãos; use o novo resultado.',
          ]
        : []),
      ...(c.options.style?.[0] === 'Proteção'
        ? [
            'Proteção: com escudo, use reação para impor desvantagem ao ataque de criatura que você vê contra outra pessoa a até 1,5 m de você.',
          ]
        : []),
      ...(c.options.style?.[0] === 'Combate com duas armas'
        ? ['Combate com duas armas: adiciona o modificador de atributo ao dano do segundo ataque.']
        : []),
    ],
    proficiencies: [
      ...k.proficiencies,
      ...c.backgroundExtras.filter((x) => tools.includes(x)),
      ...(c.options.artisan || []),
      ...(c.options.instruments || []),
      ...(c.options.monkTool || []),
      ...(race === 'Gnomo' ? ['Ferramentas de funileiro'] : []),
    ],
    spellAbility: k.ability,
    spellDC: k.ability === undefined ? null : 8 + prof + m[k.ability],
    spellAttack: k.ability === undefined ? null : prof + m[k.ability],
    slots: k.slots || 0,
    prepareCount: k.prepared ? Math.max(1, 1 + m[k.ability!]) : 0,
    cantrips: [
      ...c.cantrips,
      ...(c.options.racialCantrip || []),
      ...(race === 'Tiefling' ? ['thaumaturgy'] : []),
    ],
    known: c.spells,
  };
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
};
export type SheetResponse = {
  sheet: SheetRecord | null;
  derived: ReturnType<typeof deriveSheet> | null;
};
