import { z } from 'zod';
export const combatSchema = z
  .object({
    sceneId: z.string().uuid(),
    revision: z.number().int().min(0),
    active: z.boolean(),
    round: z.number().int().min(1),
    currentId: z.string().uuid().nullable(),
    entries: z
      .array(
        z
          .object({
            tokenId: z.string().uuid(),
            value: z.number().int().min(-100).max(1000).nullable(),
            die: z.number().int().min(1).max(20).nullable(),
            bonus: z.number().int().min(-100).max(100).nullable(),
          })
          .strict(),
      )
      .max(1000),
  })
  .strict();
export type Combat = z.infer<typeof combatSchema>;
export type CombatView = Omit<Combat, 'entries'> & {
  nextId: string | null;
  entries: (Combat['entries'][number] & { name: string; image: string; canRoll: boolean })[];
};
export function sortCombat(combat: Combat) {
  combat.entries.sort(
    (a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || (b.bonus ?? 0) - (a.bonus ?? 0),
  );
}
