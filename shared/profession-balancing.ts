import values from './profession-item-values.json';
import prices from './profession-reference-prices.json';
import { professionBuff } from './profession-buffs';
import { standardConsumableItems } from './item-consumables';
import type { CraftRecipe } from './professions';
const rare = new Set(['craft-material-rare-catalyst', 'craft-material-masterwork-core']);
const food = new Set([
  'craft-ale',
  'craft-malt-extract',
  'craft-trail-meal',
  'craft-feast',
  'craft-restorative-tea',
  'chime-of-opening',
]);
export function isCraftConsumable(id: string) {
  return (
    !!professionBuff(id) ||
    standardConsumableItems.has(id) ||
    food.has(id) ||
    (values as Record<string, { consumable: boolean }>)[id]?.consumable === true
  );
}
export function craftValueTier(r: CraftRecipe) {
  if (/plus-3$/.test(r.output.item_id) && !isCraftConsumable(r.output.item_id)) return 5;
  const meta = (values as Record<string, { rarity: string }>)[r.output.item_id],
    price = (prices as Record<string, number>)[r.output.item_id] ?? 0;
  const byRarity: Record<string, number> = {
    common: 1,
    uncommon: 2,
    rare: 3,
    'very rare': 4,
    legendary: 5,
    artifact: 5,
  };
  return (
    byRarity[meta?.rarity] ??
    (price >= 100000000
      ? 5
      : price >= 10000000
        ? 4
        : price >= 1000000
          ? 3
          : price >= 100000
            ? 2
            : 1)
  );
}
export function balanceCraftRecipe(
  r: CraftRecipe,
  common: string,
  minimums: Record<string, number>,
) {
  const buff = professionBuff(r.output.item_id),
    consumable = isCraftConsumable(r.output.item_id),
    tier = craftValueTier(r);
  const known = !!(values as Record<string, unknown>)[r.output.item_id];
  let level =
    buff?.level ??
    (known ? (consumable ? [1, 3, 5, 7, 9] : [1, 3, 6, 8, 10])[tier - 1] : (r.required_level ?? 1));
  const sourceRaw = r.ingredients.filter(
    (i) =>
      i.item_id.startsWith('craft-material-') &&
      !rare.has(i.item_id) &&
      (minimums[i.item_id] ?? 1) <= level,
  );
  const raw = [...new Set(sourceRaw.map((i) => i.item_id))];
  if (!raw.length) raw.push(common);
  const shop = r.ingredients.filter((i) => !i.item_id.startsWith('craft-material-'));
  if (consumable) {
    const quantity = buff
      ? buff.level === 3
        ? 1
        : buff.level === 6
          ? 2
          : 3
      : tier <= 2
        ? tier
        : 2;
    const rawCount = buff || tier <= 2 ? 1 : 2;
    r.ingredients = raw.slice(0, rawCount).map((item_id) => ({ item_id, quantity }));
    r.ingredients.push(...shop.slice(0, 1).map((i) => ({ item_id: i.item_id, quantity: 1 })));
    r.hours = buff
      ? buff.level === 3
        ? 1
        : buff.level === 6
          ? 2
          : 4
      : [2, 4, 8, 12, 24][tier - 1];
    if (r.output.item_id.startsWith('potion-of-healing')) r.hours = [24, 24, 36, 48, 72][tier - 1];
  } else {
    const amount = tier <= 2 ? 2 : tier === 3 ? 3 : 4;
    r.ingredients = raw.slice(0, 2).map((item_id) => ({ item_id, quantity: amount }));
    r.ingredients.push(...shop.slice(0, 1).map((i) => ({ item_id: i.item_id, quantity: 1 })));
    if (tier >= 3)
      r.ingredients.push({ item_id: 'craft-material-rare-catalyst', quantity: tier >= 4 ? 2 : 1 });
    if (tier === 5) r.ingredients.push({ item_id: 'craft-material-masterwork-core', quantity: 1 });
    // Mundane objects and narrative work keep a useful, modest workload.
    const hours = [Math.min(r.hours, 6), Math.min(Math.max(r.hours, 8), 24), 48, 96, 168][tier - 1];
    r.hours = known ? hours : Math.min(r.hours, 24);
  }
  // A component's own level remains a hard floor for every recipe.
  level = Math.max(level, ...r.ingredients.map((i) => minimums[i.item_id] ?? 1));
  r.required_level = level;
}
