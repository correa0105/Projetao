export const towerName = 'Torre do Véu';
export const towerFloorCount = 100;
export const towerZones = [
  ...[
    {
      name: 'O Limiar Esquecido',
      theme: 'stone',
      level: '1–3',
      reward: 'Selo do Limiar',
    },
    {
      name: 'Cavernas Prismáticas',
      theme: 'crystal',
      level: '3–5',
      reward: 'Coração Prismático',
    },
    {
      name: 'Jardins da Fome',
      theme: 'grove',
      level: '5–8',
      reward: 'Semente do Véu',
    },
    {
      name: 'Forjas do Crepúsculo',
      theme: 'ember',
      level: '8–11',
      reward: 'Brasa Imortal',
    },
    {
      name: 'O Inverno Imóvel',
      theme: 'frost',
      level: '11–15',
      reward: 'Lágrima do Inverno',
    },
    {
      name: 'A Coroa Sem Aurora',
      theme: 'void',
      level: '15–20',
      reward: 'Fragmento da Aurora',
    },
  ],
  ...Array.from({ length: 14 }, (_, i) => ({
    name: 'Setor ' + String(i + 7).padStart(2, '0'),
    theme: 'stone',
    level: 'Definido pelo mestre',
    reward: 'Selo do Andar ' + (i + 7) * 5,
  })),
];
export const towerFloors = Array.from({ length: towerFloorCount }, (_, i) => ({
  number: i + 1,
  name: 'Andar ' + (i + 1),
  zone: Math.floor(i / 5),
  boss: (i + 1) % 5 === 0,
}));
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
    floor > towerFloorCount ||
    bosses.some((b) => !Number.isInteger(b) || b < 1 || b > floor) ||
    new Set(bosses).size !== bosses.length
  )
    throw Error('Progresso inválido.');
  const tier = bosses.length;
  return { floor, tier, gold_cp: (floor * 8 + tier * 35) * 100, crystals: floor * 2 + tier * 8 };
}
export function towerLootTable(tier: number) {
  if (!Number.isInteger(tier) || tier < 0 || tier > towerFloorCount)
    throw Error('Tesouro inválido.');
  const relic = tier
    ? towerZones[tier - 1]?.reward || 'Selo da Ascensão ' + tier
    : 'Fragmento do Limiar';
  return ranges.map(([min, max], i) => ({
    min,
    max,
    rarity: towerRarities[i],
    relic: `${['Estilhaço', 'Insígnia', 'Núcleo', 'Relíquia', 'Coração'][i]} · ${relic}`,
    gold_cp: [5, 15, 35, 70, 140][i] * (tier + 1) * 100,
    crystals: [2, 5, 12, 24, 50][i] * (tier + 1),
    item_id: null as string | null,
    quantity: 1,
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
  item_id: string | null;
  item_quantity: number;
  item: TowerItemInfo | null;
};
export type TowerState = {
  can_create: boolean;
  floors: TowerFloorContent[];
  reward_tables: TowerRewardTable[];
  expeditions: TowerRun[];
  wallets: { character_id: string; crystals: number }[];
  claims: TowerClaim[];
};
export type TowerCreature = { name: string; art: string };
export type TowerFloorContent = {
  number: number;
  name: string;
  description: string;
  challenge: string | null;
  hazard: string | null;
  traps: string | null;
  creatures: TowerCreature[] | null;
  boss: boolean;
  boss_name: string | null;
  revision: number;
  discovery: 'master' | 'personal' | 'guild' | 'hidden';
  base_gold_cp: number | null;
  base_crystals: number | null;
};
export type TowerReward = {
  min: number;
  max: number;
  rarity: string;
  relic: string;
  gold_cp: number;
  crystals: number;
  item_id: string | null;
  quantity: number;
};
export type TowerRewardTable = { tier: number; revision: number; rows: TowerReward[] };
export type TowerItemInfo = {
  id: string;
  name: string;
  description: string;
  image_path?: string | null;
  category?: string;
};
