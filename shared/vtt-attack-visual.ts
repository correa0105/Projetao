import { z } from 'zod';
export const attackVisualSchema = z
  .object({
    actor_id: z.string().uuid(),
    target_id: z.string().uuid(),
    kind: z.enum(['sword', 'arrow']),
  })
  .strict();
export type AttackVisualCommand = z.infer<typeof attackVisualSchema>;
export type AttackVisual = AttackVisualCommand & { sceneId: string; hit: boolean };
export function weaponVisual(name: string): AttackVisualCommand['kind'] {
  return /\b(arco|besta|bow|crossbow|longbow|shortbow)\b/i.test(name) ? 'arrow' : 'sword';
}
