import { craftRecipes, professions, professionMaterialIds } from './professions';
import { professionMaterialMinimums } from './profession-expansion';
export type MaterialChance = { item_id: string; chance: number; quantity: number };
export type ProfessionLootTable = {
  profession_id: string;
  min_level: number;
  entries: MaterialChance[];
};
export type MaterialRosterPlayer = {
  id: string;
  name: string;
  characters: { id: string; name: string; professions?: { id: string; level: number }[] }[];
};
export type MaterialLootRoll = {
  id: string;
  player_id: string;
  character_id: string | null;
  profession_id: string;
  profession_level: number;
  table_level: number;
  multiplier: number;
  value: number;
  item_id: string | null;
  quantity: number;
  rolled_by: string | null;
  created_at: string;
  granted_at: string | null;
};
export type MaterialReward = {
  id: string;
  room_id: string;
  mission_id: string | null;
  title: string;
  tables: ProfessionLootTable[];
  roster: MaterialRosterPlayer[];
  created_at: string;
  completed_at: string | null;
  rolls: MaterialLootRoll[];
};
export type MaterialRewardState = {
  current: MaterialReward | null;
  history: MaterialReward[];
  missions: { id: string; title: string; status: string; roster: MaterialRosterPlayer[] }[];
  registered: MaterialRosterPlayer[];
  is_gm: boolean;
  user_id: string;
};
export function professionLootMaterials(profession: string) {
  return [
    ...new Set(
      craftRecipes
        .filter((r) => r.profession_id === profession)
        .flatMap((r) => r.ingredients.map((i) => i.item_id))
        .filter((id) => professionMaterialIds.has(id)),
    ),
  ];
}
export const professionLootTiers = [1, 3, 6, 10] as const;
export const doubleMaterialFrom = 91;
export function professionMaterialLevel(profession: string, item: string) {
  const levels = craftRecipes
    .filter((r) => r.profession_id === profession && r.ingredients.some((i) => i.item_id === item))
    .map((r) => r.required_level ?? 1);
  return levels.length ? (professionMaterialMinimums[item] ?? 1) : Infinity;
}
export function materialChanceLimit(profession: string, item: string, level: number) {
  if (item === 'craft-material-masterwork-core') return 1;
  if (item === 'craft-material-rare-catalyst') return level >= 10 ? 2 : 1;
  const unlock = professionMaterialLevel(profession, item);
  if (unlock >= 6) return level > unlock ? 2 : 1;
  if (unlock >= 3) return level >= 10 ? 5 : level >= 6 ? 4 : 3;
  return 90;
}
export function defaultProfessionLootTables(): ProfessionLootTable[] {
  return professions.flatMap((p) =>
    professionLootTiers.map((min_level, stage) => {
      const items = professionLootMaterials(p.id).filter(
        (id) => professionMaterialLevel(p.id, id) <= min_level,
      );
      items.sort(
        (a, b) =>
          professionMaterialLevel(p.id, a) - professionMaterialLevel(p.id, b) || a.localeCompare(b),
      );
      const common = items.filter((id) => professionMaterialLevel(p.id, id) === 1);
      const commonBudget = 30 + stage * 10;
      const result = {
        profession_id: p.id,
        min_level,
        entries: items.map((item_id, i) => ({
          item_id,
          chance:
            professionMaterialLevel(p.id, item_id) === 1
              ? Math.floor(commonBudget / common.length) +
                (common.indexOf(item_id) < commonBudget % common.length ? 1 : 0)
              : materialChanceLimit(p.id, item_id, min_level),
          quantity:
            professionMaterialLevel(p.id, item_id) === 1
              ? 3 + stage
              : professionMaterialLevel(p.id, item_id) <= 3
                ? 1 + Math.max(0, stage - 1)
                : professionMaterialLevel(p.id, item_id) <= 6
                  ? 1 + Math.max(0, stage - 2)
                  : 1,
        })),
      };
      if (result.entries.reduce((sum, e) => sum + e.chance, 0) > 90)
        throw new Error('Tabela de materiais excede 90%: ' + p.id + ' ' + min_level);
      return result;
    }),
  );
}
export function professionLootTable(
  tables: ProfessionLootTable[],
  profession: string,
  level: number,
) {
  return tables
    .filter((t) => t.profession_id === profession && t.min_level <= level)
    .sort((a, b) => b.min_level - a.min_level)[0];
}
export function materialOutcome(entries: MaterialChance[], value: number) {
  const multiplier = value >= doubleMaterialFrom ? 2 : 1;
  const total = entries.reduce((sum, e) => sum + e.chance, 0);
  if (multiplier === 2)
    value = Math.max(
      1,
      Math.ceil(((value - doubleMaterialFrom + 1) * total) / (101 - doubleMaterialFrom)),
    );
  let end = 0;
  for (const entry of entries) {
    end += entry.chance;
    if (value <= end) return { ...entry, quantity: entry.quantity * multiplier, multiplier };
  }
  return null;
}
export function materialProbabilities(entries: MaterialChance[]) {
  const rows: {
    item_id: string | null;
    quantity: number;
    multiplier: number;
    chance: number;
    from: number;
    to: number;
  }[] = [];
  for (let value = 1; value <= 100; value++) {
    const result = materialOutcome(entries, value),
      key = result ? result.item_id + ':' + result.quantity + ':' + result.multiplier : 'none';
    const row = rows.find(
      (r) => (r.item_id ? r.item_id + ':' + r.quantity + ':' + r.multiplier : 'none') === key,
    );
    if (row) {
      row.chance++;
      row.to = value;
    } else
      rows.push({
        item_id: result?.item_id ?? null,
        quantity: result?.quantity ?? 0,
        multiplier: result?.multiplier ?? 1,
        chance: 1,
        from: value,
        to: value,
      });
  }
  return rows;
}
