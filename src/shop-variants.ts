import type { Item } from './types';

export type ShopItemModel = { id: string; label: string; variants: Item[] };
export type ShopItemGroup = {
  /** Display identity only. Purchases always use the selected variant's real Item.id. */
  id: string;
  name: string;
  family: string | null;
  kind: 'weapon' | 'armor' | null;
  variants: Item[];
  models: ShopItemModel[];
  categories: string[];
};
export type ShopVariantDimension =
  'base_item' | 'enhancement' | 'damage_type' | 'rarity' | 'variant';
export type ShopVariantSelection = Partial<Record<ShopVariantDimension, string>>;
export type ShopVariantOption = { value: string; label: string; variants: Item[] };

export const shopDamageLabels: Readonly<Record<string, string>> = {
  acid: 'Ácido',
  cold: 'Frio',
  fire: 'Fogo',
  force: 'Força',
  lightning: 'Elétrico',
  necrotic: 'Necrótico',
  poison: 'Veneno',
  psychic: 'Psíquico',
  radiant: 'Radiante',
  thunder: 'Trovão',
  bludgeoning: 'Contundente',
  piercing: 'Perfurante',
  slashing: 'Cortante',
};
export const shopRarityLabels: Readonly<Record<string, string>> = {
  Common: 'Comum',
  Uncommon: 'Incomum',
  Rare: 'Raro',
  'Very Rare': 'Muito raro',
  Legendary: 'Lendário',
  'unknown (magic)': 'Raridade não informada',
};
const dimensions: ShopVariantDimension[] = [
  'base_item',
  'enhancement',
  'damage_type',
  'rarity',
  'variant',
];

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function humanize(value: string) {
  const text = value.replace(/[-_]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function variantName(item: Item) {
  const start = item.name.lastIndexOf(' (');
  return start >= 0 && item.name.endsWith(')') ? item.name.slice(start + 2, -1) : '';
}
function familyName(item: Item) {
  if (item.magic_family?.startsWith('Enspelled Weapon')) return 'Armas com magia vinculada';
  const label = variantName(item);
  return label ? item.name.slice(0, item.name.length - label.length - 3) : item.name;
}
function equipmentKind(item: Item, catalog: ReadonlyMap<string, Item>) {
  if (item.magic_kind === 'weapon' || item.magic_kind === 'armor') return item.magic_kind;
  const base = item.base_item ? catalog.get(item.base_item) : undefined;
  return base?.category === 'Armas' ? 'weapon' : base?.category === 'Armaduras' ? 'armor' : null;
}
function modelName(item: Item, catalog: ReadonlyMap<string, Item>) {
  const base = item.base_item ? catalog.get(item.base_item) : undefined;
  if (base) return base.name;
  const form = item.description.match(/\bForma: ([^.]+)\./)?.[1];
  return form || humanize(item.base_item || item.name);
}

/** Group the complete catalog before category/search filtering, so selectors retain every offer. */
export function groupShopItems(items: readonly Item[]): ShopItemGroup[] {
  const catalog = new Map(items.map((item) => [item.id, item]));
  const families = new Map<string, Item[]>();
  const familyKeys = new Map<Item, string>();
  for (const item of items) {
    const kind = equipmentKind(item, catalog);
    if (!item.magic_family || !item.base_item || !kind) continue;
    const family = item.magic_family.startsWith('Enspelled Weapon')
      ? 'Enspelled Weapon'
      : item.magic_family;
    const key = `${kind}:${family}`;
    const variants = families.get(key) || [];
    variants.push(item);
    families.set(key, variants);
    familyKeys.set(item, key);
  }
  const result: ShopItemGroup[] = [];
  const emitted = new Set<string>();
  for (const item of items) {
    const key = familyKeys.get(item);
    const family = key ? families.get(key) : undefined;
    if (!family || family.length < 2) {
      result.push({
        id: item.id,
        name: item.name,
        family: null,
        kind: null,
        variants: [item],
        models: [],
        categories: [item.category],
      });
      continue;
    }
    if (emitted.has(key!)) continue;
    emitted.add(key!);
    const models = new Map<string, ShopItemModel>();
    for (const variant of family) {
      const id = variant.base_item!;
      const model = models.get(id) || { id, label: modelName(variant, catalog), variants: [] };
      model.variants.push(variant);
      models.set(id, model);
    }
    result.push({
      id: `magic-family:${key}`,
      name: familyName(item),
      family: item.magic_family!.startsWith('Enspelled Weapon')
        ? 'Enspelled Weapon'
        : item.magic_family!,
      kind: equipmentKind(item, catalog),
      variants: [...family],
      models: [...models.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
      categories: [...new Set(family.map((variant) => variant.category))],
    });
  }
  return result;
}

/** A concrete variant label: translated model/color/damage, bonus and rarity, never a new item. */
export function getVariantLabel(item: Item, modelLabel?: string): string {
  const binding = item.raw_data?.spell_binding as { level: number } | undefined;
  if (binding) return binding.level === 0 ? 'Truque (nível 0)' : 'Magia de nível ' + binding.level;
  let label = variantName(item) || item.name;
  if (modelLabel && normalize(label).startsWith(normalize(modelLabel))) {
    const remainder = label.slice(modelLabel.length).replace(/^[\s·,:-]+/, '');
    if (remainder) label = remainder;
  }
  const parts = [label];
  if (item.enhancement != null && !label.includes(`+${item.enhancement}`)) {
    parts.push(`+${item.enhancement}`);
  }
  const damage =
    item.damage_type && (shopDamageLabels[item.damage_type] || humanize(item.damage_type));
  if (damage && !normalize(label).includes(normalize(damage))) parts.push(damage);
  const rarity = item.rarity && (shopRarityLabels[item.rarity] || item.rarity);
  if (rarity && !normalize(label).includes(normalize(rarity))) parts.push(rarity);
  return parts.join(' · ');
}

/** Search suggests matching real variants without removing the other choices from the group. */
export function matchShopGroup(group: ShopItemGroup, query: string): Item[] {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return [...group.variants];
  return group.variants.filter((item) => {
    const model = group.models.find((candidate) => candidate.id === item.base_item);
    const searchable = normalize(
      [
        item.name,
        item.original_name,
        group.family || '',
        model?.label || '',
        (item.base_item || '').replace(/[-_]/g, ' '),
        item.damage_type || '',
        item.variant || '',
        item.rarity || '',
        getVariantLabel(item),
      ].join(' '),
    );
    return terms.every((term) => {
      // The English family name lists all bonuses; a bonus search must match this real offer.
      const bonus = /^\+(\d+)$/.exec(term);
      return bonus && item.enhancement != null
        ? item.enhancement === Number(bonus[1])
        : searchable.includes(term);
    });
  });
}

function dimensionValue(item: Item, dimension: ShopVariantDimension) {
  const value = item[dimension];
  return value == null ? '' : String(value);
}
function optionLabel(group: ShopItemGroup, item: Item, dimension: ShopVariantDimension) {
  const value = dimensionValue(item, dimension);
  switch (dimension) {
    case 'base_item':
      return group.models.find((model) => model.id === value)?.label || humanize(value);
    case 'enhancement':
      return `+${value}`;
    case 'damage_type':
      return shopDamageLabels[value] || humanize(value);
    case 'rarity':
      return shopRarityLabels[value] || value;
    case 'variant':
      return getVariantLabel(
        item,
        group.models.find((model) => model.id === item.base_item)?.label,
      );
  }
}

/** Only options compatible with the other selected dimensions are exposed. */
export function getVariantOptions(
  group: ShopItemGroup,
  dimension: ShopVariantDimension,
  selection: ShopVariantSelection = {},
): ShopVariantOption[] {
  const candidates = group.variants.filter((item) =>
    dimensions.every(
      (other) =>
        other === dimension ||
        !selection[other] ||
        dimensionValue(item, other) === selection[other],
    ),
  );
  const options = new Map<string, ShopVariantOption>();
  for (const item of candidates) {
    const value = dimensionValue(item, dimension);
    if (!value) continue;
    const option = options.get(value) || {
      value,
      label: optionLabel(group, item, dimension),
      variants: [],
    };
    option.variants.push(item);
    options.set(value, option);
  }
  return [...options.values()];
}

/** Preserve the current model/bonus/damage where possible while resolving to an existing offer. */
export function selectShopVariant(
  group: ShopItemGroup,
  current: Item | null,
  dimension: ShopVariantDimension,
  value: string,
): Item | null {
  const candidates = group.variants.filter((item) => dimensionValue(item, dimension) === value);
  if (!current) return candidates[0] || null;
  const weights: Record<ShopVariantDimension, number> = {
    base_item: 32,
    enhancement: 16,
    damage_type: 8,
    rarity: 4,
    variant: 1,
  };
  const score = (item: Item) =>
    dimensions.reduce(
      (total, other) =>
        total +
        (other !== dimension && dimensionValue(item, other) === dimensionValue(current, other)
          ? weights[other]
          : 0),
      0,
    );
  return candidates.reduce<Item | null>(
    (best, item) => (!best || score(item) > score(best) ? item : best),
    null,
  );
}
