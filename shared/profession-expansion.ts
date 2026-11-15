import rows from './profession-expanded-recipes.json';
import { balanceCraftRecipe } from './profession-balancing';
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
    if (p.id === 'brewing')
      p.recipes = p.recipes.filter((r) => !r.output.item_id.startsWith('potion-'));
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
    const common =
      p.recipes
        .flatMap((r) => r.ingredients)
        .find(
          (i) =>
            i.item_id.startsWith('craft-material-') && !(i.item_id in professionMaterialMinimums),
        )?.item_id ?? 'craft-material-herbs';
    for (const r of p.recipes) balanceCraftRecipe(r, common, professionMaterialMinimums);
    p.recipes.sort(
      (a, b) =>
        (a.required_level ?? 1) - (b.required_level ?? 1) ||
        a.hours - b.hours ||
        a.name.localeCompare(b.name, 'pt-BR'),
    );
  }
}
