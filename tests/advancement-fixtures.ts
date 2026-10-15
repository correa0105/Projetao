import { randomUUID } from 'node:crypto';
import {
  defaultAdvanceChoice,
  levelPlan,
  validateAdvance,
  advancementStats,
  type AdvancementCharacter,
  type AdvanceChoice,
} from '../shared/character-advancement.js';
import { defaultChoices, deriveSheet, type SheetChoices } from '../shared/character-sheet.js';
export function legalAdvance(
  character: AdvancementCharacter,
  choices: SheetChoices,
  cls = character.class,
  subclass?: string,
): AdvanceChoice {
  const next = defaultAdvanceChoice(cls);
  let plan = levelPlan(character, choices, next);
  if (plan.subclassRequired) next.subclass = subclass || plan.subclasses[0].id;
  for (let pass = 0; pass < 3; pass++) {
    plan = levelPlan(character, choices, next);
    for (const field of plan.fields)
      next.choices[field.key] = field.options.slice(0, field.count);
  }
  plan = levelPlan(character, choices, next);
  next.newCantrips = plan.cantripOptions
    .filter(
      (s) =>
        !Object.entries(next.choices)
          .filter(([k]) => k.includes('Cantrip'))
          .flatMap(([, v]) => v)
          .includes(s),
    )
    .slice(0, plan.newCantrips);
  next.newSpells = plan.spellOptions.slice(0, plan.newSpells);
  if (plan.bonusCount)
    next.bonusSpells = plan.bonusOptions
      .filter((v) => !next.newSpells.includes(v))
      .slice(0, plan.bonusCount);
  if (plan.asi) {
    let remaining = 2;
    for (let i = 0; i < 6 && remaining; i++) {
      const n = Math.min(remaining, Math.max(0, 20 - character.stats[i]));
      next.boosts[i] = n;
      remaining -= n;
    }
  }
  validateAdvance(character, choices, next);
  return next;
}
export function advanceFixture(
  character: AdvancementCharacter,
  choices: SheetChoices,
  next: AdvanceChoice,
) {
  const plan = validateAdvance(character, choices, next).plan;
  const row = {
    ...next,
    characterLevel: character.level + 1,
    classLevel: plan.level,
    requestId: randomUUID(),
    actor: 'test',
    createdAt: new Date().toISOString(),
    granted: true,
  };
  character.stats = advancementStats(character, next, plan.level);
  character.level++;
  choices.advancement = {
    ...choices.advancement,
    version: 1,
    levels: [...(choices.advancement?.levels || []), row],
  };
  return deriveSheet(character, choices);
}
export function originFixture(cls: string) {
  const character = { class: cls, race: 'Orc', stats: [14, 14, 14, 14, 14, 14], level: 1 },
    choices = defaultChoices(character.race, cls);
  choices.advancement = {
    version: 1,
    levels: [],
    initialSpells: cls === 'Patrulheiro' ? ['alarm', 'animal-friendship'] : [],
    prepared: {},
    slotsUsed: Array(9).fill(0),
    pactUsed: 0,
  };
  return { character, choices };
}
