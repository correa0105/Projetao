import rows from './profession-expanded-recipes.json';
import prices from './profession-reference-prices.json';
import { professionBuffs, professionBuffDescription } from './profession-buffs';
import type { Profession, CraftRecipe } from './professions';
import { professionWork } from './profession-production';
export const professionMaterialMinimums: Record<string, number> = {
  'craft-material-alloy': 3,
  'craft-material-silk': 3,
  'craft-material-arcane': 6,
  'craft-material-rare-catalyst': 6,
  'craft-material-masterwork-core': 10,
};
export function expandProfessionCatalog(values: Profession[]) {
  for (const p of values) {
    p.description = professionWork(p.id).detail;
    p.recipes.push(...(rows.filter((r) => r.profession_id === p.id) as CraftRecipe[]));
    for (const buff of professionBuffs.filter((b) => b.profession === p.id)) {
      const base = [
        ...new Set(
          p.recipes[0].ingredients
            .map((i) => i.item_id)
            .filter((id) => id.startsWith('craft-material-')),
        ),
      ];
      p.recipes.push({
        id: buff.id,
        profession_id: p.id,
        name: buff.name,
        description: professionBuffDescription(buff),
        required_level: buff.level,
        experience: buff.level === 3 ? 35 : buff.level === 6 ? 60 : 100,
        hours: buff.level === 3 ? 12 : buff.level === 6 ? 24 : 48,
        ingredients: [
          ...base.map((item_id) => ({
            item_id,
            quantity: buff.level === 3 ? 3 : buff.level === 6 ? 5 : 8,
          })),
          {
            item_id: [
              'calligraphy',
              'cartography',
              'forgery',
              'navigation',
              'painting',
              'games',
            ].includes(p.id)
              ? 'parchment'
              : 'oil',
            quantity: 1,
          },
        ],
        output: { item_id: buff.id, quantity: 1 },
        steps: [],
      });
    }
    for (const r of p.recipes) {
      const price = (prices as Record<string, number>)[r.output.item_id] ?? 0;
      const buff = professionBuffs.find((b) => b.id === r.output.item_id);
      const add = (item_id: string, quantity: number) => {
        const previous = r.ingredients.find((i) => i.item_id === item_id);
        if (previous) previous.quantity = Math.max(previous.quantity, quantity);
        else r.ingredients.push({ item_id, quantity });
      };
      if (price >= 100000 || buff?.level === 6 || buff?.level === 10)
        add('craft-material-rare-catalyst', Math.max(1, Math.min(4, Math.ceil(price / 10000000))));
      if (price >= 1000000 || buff?.level === 10)
        add('craft-material-masterwork-core', Math.max(1, Math.min(8, Math.ceil(price / 5000000))));
      const level = Math.max(
        r.required_level ?? 1,
        ...r.ingredients.map((i) => professionMaterialMinimums[i.item_id] ?? 1),
      );
      r.required_level = level;
      if (price >= 1000000) r.hours = Math.max(r.hours, price >= 10000000 ? 168 : 96);
      else if (price >= 100000) r.hours = Math.max(r.hours, 36);
    }
    p.recipes.sort(
      (a, b) =>
        (a.required_level ?? 1) - (b.required_level ?? 1) ||
        a.hours - b.hours ||
        a.name.localeCompare(b.name, 'pt-BR'),
    );
  }
}
