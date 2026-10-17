import catalog from './feats-2024.json';
import type { SheetChoices } from './character-sheet.js';
export const fightingStyles = catalog.filter((f) => f.category === 'FS').map((f) => f.name);
export function classFightingStyles(primary: string, c: SheetChoices) {
  const state: Record<string, string[]> = { [primary]: [...(c.options.style || [])] };
  const levels: Record<string, number> = { [primary]: 1 };
  const edits = (cls: string) => {
    for (const edit of c.advancement?.styleChanges || [])
      if (edit.classLevel === levels[cls] && cls === 'Guerreiro')
        state[cls] = (state[cls] || []).map((v) => (v === edit.from ? edit.to : v));
  };
  edits(primary);
  for (const row of c.advancement?.levels || []) {
    levels[row.class] = (levels[row.class] || 0) + 1;
    state[row.class] ||= [];
    for (const swap of row.retrain || [])
      if (swap.kind === 'style')
        state[row.class] = state[row.class].map((v) => (v === swap.from ? swap.to : v));
    state[row.class].push(...(row.choices.style || []));
    const feat = catalog.find((f) => f.id === row.feat);
    if (feat?.category === 'FS') state[row.class].push(feat.name);
    edits(row.class);
  }
  return Object.fromEntries(
    Object.entries(state).map(([cls, values]) => [cls, [...new Set(values)]]),
  );
}
