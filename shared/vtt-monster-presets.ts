import { z } from 'zod';
import { monsterActions, type MonsterAction } from './vtt-monster-actions.js';

export const monsterCustomizationSchema = z
  .object({
    sourceId: z.string().max(150).default(''),
    size: z.string().max(40).default('M'),
    cr: z.string().max(40).default(''),
    speed: z.string().max(300).default('30 ft'),
    information: z
      .array(z.object({ label: z.string().max(100), value: z.string().max(1000) }).strict())
      .max(30)
      .default([]),
    traits: z.string().max(24000).default(''),
    actions: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            name: z.string().trim().min(1).max(150),
            description: z.string().max(6000),
            attack: z.string().max(100).nullable(),
            damage: z.array(z.string().min(1).max(100)).max(10),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (new Set(m.actions.map((a) => a.id)).size !== m.actions.length)
      ctx.addIssue({ code: 'custom', message: 'Identificadores de ações repetidos.' });
  });
export type MonsterCustomization = z.infer<typeof monsterCustomizationSchema>;
export type MonsterPreset = {
  id: string;
  name: string;
  image: string;
  token: import('./vtt.js').VttToken;
  updated_at: string;
};
export function tokenMonsterActions(token: {
  monster?: MonsterCustomization | null;
  sheet: { details: string } | null;
}): MonsterAction[] {
  return token.monster?.actions ?? monsterActions(token.sheet?.details || '');
}
export function monsterCustomDetails(monster: MonsterCustomization) {
  return [monster.traits, '### Ações', ...monster.actions.map((a) => a.name + '\n' + a.description)]
    .filter(Boolean)
    .join('\n\n');
}
