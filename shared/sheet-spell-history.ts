import { deriveSheet, spells, type SheetChoices } from './character-sheet.js';
import type { AdvancementCharacter } from './character-advancement.js';

export type AcquiredSpell = {
  id: string;
  source: string;
  characterLevel: number | null;
  classLevel: number | null;
  status: string;
};
/** Replay recorded levels; current preparation alone is not proof of acquisition. */
export function sheetSpellHistory(
  character: AdvancementCharacter,
  choices: SheetChoices,
): AcquiredSpell[] {
  const levels = choices.advancement?.levels || [];
  let previous = new Map<string, AcquiredSpell>();
  for (let index = 0; index <= levels.length; index++) {
    const history = levels.slice(0, index),
      characterLevel = index ? history[index - 1].characterLevel : 1;
    const c = {
      ...choices,
      advancement: { ...choices.advancement, version: 1 as const, levels: history },
    };
    const d = deriveSheet({ ...character, level: characterLevel }, c);
    const current = new Map<string, AcquiredSpell>();
    const add = (
      id: string,
      source: string,
      classLevel: number | null,
      status: string,
      recorded = true,
    ) => {
      if (!spells.some((s) => s.id === id)) return;
      const key = source + ':' + id,
        old = previous.get(key);
      current.set(key, {
        id,
        source,
        characterLevel: old?.characterLevel ?? (recorded ? characterLevel : null),
        classLevel: old?.classLevel ?? (recorded ? classLevel : null),
        status,
      });
    };
    for (const m of d.magicClasses) {
      for (const id of m.cantrips) add(id, m.class, m.level, 'Truque');
      for (const id of m.known)
        add(id, m.class, m.level, m.class === 'Mago' ? 'Grimório' : 'Aprendida');
      for (const id of m.always) add(id, m.class, m.level, 'Sempre preparada');
      for (const id of m.choices.arcanum || []) add(id, m.class, m.level, 'Arcano místico');
      for (const id of m.prepared)
        if (!current.has(m.class + ':' + id))
          add(id, m.class, m.level, 'Preparada atualmente', false);
    }
    for (const grant of d.spellGrants)
      for (const id of [...grant.cantrips, ...grant.spells])
        add(id, grant.source, null, 'Concedida');
    previous = current;
  }
  return [...previous.values()].sort(
    (a, b) =>
      (a.characterLevel ?? 99) - (b.characterLevel ?? 99) ||
      a.source.localeCompare(b.source) ||
      a.id.localeCompare(b.id),
  );
}
