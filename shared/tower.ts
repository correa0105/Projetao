export const towerName = 'Torre do Véu';
export const towerZones = [
  {
    name: 'O Limiar Esquecido',
    theme: 'stone',
    level: '1–3',
    description: 'A torre abre as portas para quem ainda acredita que pedra não sente fome.',
    rooms: [
      'Portas sem Nome',
      'Galeria dos Ossos',
      'Poço dos Ecos',
      'Salão das Correntes',
      'O Porteiro de Ferro',
    ],
    creatures: ['Skeleton', 'Giant Spider', 'Ogre'],
    boss: 'O Porteiro de Ferro',
    bossArt: 'Troll',
    challenge: 'Sinos despertam os mortos. Atravessar em silêncio pode valer mais que uma lâmina.',
    hazard: 'Placas de pressão e corredores que se fecham.',
    reward: 'Selo do Limiar',
  },
  {
    name: 'Cavernas Prismáticas',
    theme: 'crystal',
    level: '3–5',
    description: 'Cristais guardam luz e memórias. Algumas dessas memórias ainda caçam.',
    rooms: [
      'Veios de Luz',
      'Ponte Fraturada',
      'Câmara dos Reflexos',
      'Fenda Profunda',
      'Matriarca Prismática',
    ],
    creatures: ['Gargoyle', 'Bulette', 'Gelatinous Cube'],
    boss: 'Matriarca Prismática',
    bossArt: 'Young Blue Dragon',
    challenge: 'Reflexos mostram caminhos falsos. Reconstruam o mapa antes que a luz se apague.',
    hazard: 'Cristais ressonantes e pontes instáveis.',
    reward: 'Coração Prismático',
  },
  {
    name: 'Jardins da Fome',
    theme: 'grove',
    level: '5–8',
    description: 'Uma floresta cresce sem sol, alimentada por tudo que não conseguiu voltar.',
    rooms: [
      'Raízes Suspensas',
      'Estufa Cega',
      'Rio de Esporos',
      'Bosque dos Perdidos',
      'Raiz da Fome',
    ],
    creatures: ['Shambling Mound', 'Troll', 'Treant'],
    boss: 'Raiz da Fome',
    bossArt: 'Treant',
    challenge: 'Três sementes selam a passagem. Encontrá-las exige negociar com o próprio jardim.',
    hazard: 'Esporos, vinhas predatórias e trilhas mutáveis.',
    reward: 'Semente do Véu',
  },
  {
    name: 'Forjas do Crepúsculo',
    theme: 'ember',
    level: '8–11',
    description: 'O metal canta. Sob as forjas, alguma coisa continua forjando o fim do mundo.',
    rooms: [
      'Escadaria de Escória',
      'Vigília das Brasas',
      'Engrenagens Mortas',
      'Cadinho Rubro',
      'Ferreiro das Cinzas',
    ],
    creatures: ['Azer Sentinel', 'Salamander', 'Fire Elemental'],
    boss: 'Ferreiro das Cinzas',
    bossArt: 'Fire Giant',
    challenge:
      'Reativar os contrapesos abre o elevador, mas cada engrenagem alimenta uma sentinela.',
    hazard: 'Calor extremo, lava e vapor sob pressão.',
    reward: 'Brasa Imortal',
  },
  {
    name: 'O Inverno Imóvel',
    theme: 'frost',
    level: '11–15',
    description: 'Aqui o tempo congelou antes do último grito. O gelo lembra cada intruso.',
    rooms: [
      'Degraus de Geada',
      'Arquivo Congelado',
      'Abismo Branco',
      'Santuário do Silêncio',
      'Vigia Glacial',
    ],
    creatures: ['Winter Wolf', 'Frost Giant', 'Young White Dragon'],
    boss: 'Vigia Glacial',
    bossArt: 'Adult White Dragon',
    challenge:
      'Despertar os faróis exige dividir o grupo e resistir à tempestade entre os santuários.',
    hazard: 'Nevasca, gelo quebradiço e silêncio sobrenatural.',
    reward: 'Lágrima do Inverno',
  },
  {
    name: 'A Coroa Sem Aurora',
    theme: 'void',
    level: '15–20',
    description:
      'Acima das nuvens, a torre deixa de obedecer à realidade. A última porta olha de volta.',
    rooms: [
      'Horizonte Partido',
      'Corte das Sombras',
      'Órbita Vazia',
      'Trono do Eclipse',
      'O Rei Sem Aurora',
    ],
    creatures: ['Shadow', 'Wraith', 'Adult Black Dragon'],
    boss: 'O Rei Sem Aurora',
    bossArt: 'Ancient Black Dragon',
    challenge:
      'Os nomes dos antigos guardiões revelam a passagem. A resposta errada devolve a expedição ao vazio.',
    hazard: 'Gravidade instável, sombras vivas e pactos antigos.',
    reward: 'Fragmento da Aurora',
  },
] as const;
export const towerFloors = towerZones.flatMap((zone, z) =>
  zone.rooms.map((name, i) => ({ number: z * 5 + i + 1, name, zone: z, boss: i === 4 })),
);
export const towerRarities = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário'] as const;
const ranges = [
  [1, 50],
  [51, 75],
  [76, 90],
  [91, 98],
  [99, 100],
] as const;
export function towerBaseReward(floor: number, bosses: number[]) {
  if (
    !Number.isInteger(floor) ||
    floor < 1 ||
    floor > 30 ||
    bosses.some((b) => b % 5 !== 0 || b < 5 || b > floor) ||
    new Set(bosses).size !== bosses.length
  )
    throw Error('Progresso inválido.');
  const tier = bosses.length;
  return { floor, tier, gold_cp: (floor * 8 + tier * 35) * 100, crystals: floor * 2 + tier * 8 };
}
export function towerLootTable(tier: number) {
  if (!Number.isInteger(tier) || tier < 0 || tier > 6) throw Error('Tesouro inválido.');
  const relic = tier ? towerZones[tier - 1].reward : 'Fragmento do Limiar';
  return ranges.map(([min, max], i) => ({
    min,
    max,
    rarity: towerRarities[i],
    relic: `${['Estilhaço', 'Insígnia', 'Núcleo', 'Relíquia', 'Coração'][i]} · ${relic}`,
    gold_cp: [5, 15, 35, 70, 140][i] * (tier + 1) * 100,
    crystals: [2, 5, 12, 24, 50][i] * (tier + 1),
  }));
}
export function towerTreasure(tier: number, roll: number) {
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) throw Error('D100 inválido.');
  return towerLootTable(tier).find((r) => roll >= r.min && roll <= r.max)!;
}
export type TowerMember = {
  character_id: string;
  name: string;
  level: number;
  mine: boolean;
  image: string;
};
export type TowerRun = {
  id: string;
  name: string;
  status: 'preparing' | 'active' | 'completed' | 'cancelled';
  cleared_floor: number;
  bosses: number[];
  revision: number;
  can_manage: boolean;
  members: TowerMember[];
  created_at: string;
  summary: string;
};
export type TowerClaim = {
  run_id: string;
  character_id: string;
  name: string;
  expedition: string;
  floor: number;
  tier: number;
  base_gold_cp: number;
  base_crystals: number;
  roll: number | null;
  rarity: string | null;
  relic: string | null;
  bonus_gold_cp: number;
  bonus_crystals: number;
  rolled_at: string | null;
};
export type TowerState = {
  can_create: boolean;
  expeditions: TowerRun[];
  wallets: { character_id: string; crystals: number }[];
  claims: TowerClaim[];
};
