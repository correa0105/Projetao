import type { Rank } from './progression';

export const economyVersion = 'economy-20261102';
export const bastionCurrencyName = 'Créditos do Bastião';
export const launchStartingGoldPo = 250;
export const missionDifficulties = ['Tranquila', 'Moderada', 'Perigosa'] as const;
export type MissionDifficulty = (typeof missionDifficulties)[number];
const gold: Record<Rank, readonly number[]> = {
  Ferro: [100, 125, 150],
  Bronze: [250, 300, 350],
  Adamantium: [500, 625, 750],
  Ametista: [1000, 1250, 1500],
  Obsidiana: [2000, 2500, 3000],
};
const credits: Record<Rank, readonly number[]> = {
  Ferro: [40, 50, 60],
  Bronze: [60, 75, 90],
  Adamantium: [80, 100, 120],
  Ametista: [120, 150, 180],
  Obsidiana: [160, 200, 240],
};
export function missionReward(rank: Rank, difficulty: string = 'Moderada') {
  const index = missionDifficulties.indexOf(difficulty as MissionDifficulty);
  if (!gold[rank] || index < 0) throw new Error('Patente ou dificuldade de missão inválida.');
  return { gold_cp: gold[rank][index] * 100, bastion_credits: credits[rank][index] };
}
export const rarityReferencePo = {
  common: 200,
  uncommon: 1000,
  rare: 8000,
  'very rare': 50000,
  legendary: 250000,
} as const;
export const basicArmorPo: Readonly<Record<string,number>> = {
  'padded-armor':60, 'leather-armor':100, 'hide-armor':120, 'ring-mail':250,
  'studded-leather':400, 'chain-shirt':300, 'scale-mail':500, 'chain-mail':650,
  breastplate:700, 'half-plate-armor':1100, shield:200, 'splint-armor':1200, 'plate-armor':1500,
};
const oldReferencePo = {
  common: 100,
  uncommon: 400,
  rare: 4000,
  'very rare': 20000,
  legendary: 150000,
} as const;
export type MagicRarity = keyof typeof rarityReferencePo;
// Core potions predate the rarity metadata in the expanded catalog (DMG).
const corePotionRarity: Record<string, MagicRarity> = {
  'potion-of-healing': 'common',
  'potion-of-climbing': 'common',
  'potion-of-growth': 'uncommon',
  'potion-of-heroism': 'rare',
  'potion-of-flying': 'very rare',
};
type Product = {
  id: string;
  name?: string;
  category?: string;
  price_cp: number | null;
  raw_data?: Record<string, any>;
};
export function magicRarity(item: Product): MagicRarity | null {
  const raw = item.raw_data || {};
  const value = String(raw.rarity || raw.upstream_facts?.rarity || '')
    .trim()
    .toLowerCase();
  if (value in rarityReferencePo) return value as MagicRarity;
  if (corePotionRarity[item.id]) return corePotionRarity[item.id];
  return (
    (
      {
        'Mágicos comuns': 'common',
        'Mágicos incomuns': 'uncommon',
        'Mágicos raros': 'rare',
        'Mágicos muito raros': 'very rare',
        'Mágicos lendários': 'legendary',
      } as Record<string, MagicRarity>
    )[item.category || ''] || null
  );
}
export function isConsumable(item: Product) {
  const raw = item.raw_data || {};
  return (
    raw.consumable === true ||
    item.category === 'Poções' ||
    ['P', 'SC', 'A', 'AF'].includes(
      String(raw.upstream_facts?.type || raw.type || '').split('|')[0],
    ) ||
    /^potion-|^spell-scroll-|^scroll-/.test(item.id)
  );
}
export function balancedMagicPrice(item: Product): number | null {
  const rarity = magicRarity(item);
  if (!rarity || item.price_cp === null) return null;
  const consumable = isConsumable(item);
  // Keep relative price tiers from the existing catalog, with a bounded premium.
  const reference = (item.price_cp / 100) * (consumable ? 2 : 1);
  const factor = Math.max(1, Math.min(4, Math.ceil((reference / oldReferencePo[rarity]) * 2) / 2));
  const price=Math.round((rarityReferencePo[rarity] * factor * 100) / (consumable ? 4 : 1));
  const raw=item.raw_data || {};
  const armorBase=rarity==='common' && !consumable && !['mount','pet'].includes(raw.equipment_target)
    ? basicArmorPo[raw.base_item] : undefined;
  return armorBase === undefined ? price : Math.max(price,(armorBase+rarityReferencePo.common)*100);
}
export function furnishingCredits(item: {
  id: string;
  name?: string;
  category?: string;
  width?: number;
  height?: number;
}) {
  if (item.id === 'letter') return 15;
  if (item.id === 'frame') return 60;
  const area = (item.width || 2) * (item.height || 2);
  const base =
    area <= 1.2 ? 20 : area <= 3 ? 40 : area <= 6 ? 75 : area <= 12 ? 120 : area <= 20 ? 200 : 300;
  const luxury = /trono|throne|royal|nobre|mármore|marble|luxuoso|ornament/i.test(item.name || '');
  return luxury ? Math.min(800, base * 2) : base;
}
export const bastionFoundingCredits = 1500;
export const housePlotCredits = 600;
export const facilityLevelCredits = [
  0, 0, 300, 600, 1000, 1600, 2400, 3600, 5200, 7500, 10000,
] as const;
