import { z } from 'zod';
export const effectKinds = ['death', 'fire', 'frost', 'poison', 'heal', 'sparks'] as const;
export const effectNames = [
  'Sangue e token vermelho',
  'Chamas',
  'Gelo',
  'Veneno',
  'Cura',
  'Faíscas',
];
export const effectColors = ['#801b19', '#d68a44', '#9dbed7', '#849363', '#a4c49a', '#d8bc76'];
const appearance = {
  kind: z.enum(effectKinds),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  scale: z.number().min(0.5).max(3),
  duration: z.number().int().min(0).max(60),
};
export const effectPresetSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(60),
    ...appearance,
  })
  .strict();
export const tokenEffectSchema = z
  .object({
    id: z.string().uuid(),
    ...appearance,
    at: z.number().int().min(0).max(9999999999999),
  })
  .strict();
export type EffectPreset = z.infer<typeof effectPresetSchema>;
export type TokenEffect = z.infer<typeof tokenEffectSchema>;
export function effectEnds(effect: TokenEffect) {
  return effect.duration ? effect.at + effect.duration * 1000 : 0;
}
