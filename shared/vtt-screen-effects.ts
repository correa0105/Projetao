import { z } from 'zod';

export const screenEffectPresets = [
  {
    id: 'earthquake',
    name: 'Tremor de terra',
    description: 'A tela treme; terra, cascalho e poeira despencam do alto.',
    sound: 'sfx-screen-earthquake',
    duration: 12,
    color: '#c9a57a',
  },
  {
    id: 'cave-in',
    name: 'Desabamento',
    description: 'Pedras em vários planos, impacto e uma nuvem de poeira.',
    sound: 'sfx-screen-cave-in',
    duration: 10,
    color: '#bcb1a2',
  },
  {
    id: 'thunderstorm',
    name: 'Tormenta',
    description: 'Chuva oblíqua, clarões espaçados e trovões profundos.',
    sound: 'sfx-screen-thunderstorm',
    duration: 20,
    color: '#a6bacb',
  },
  {
    id: 'blizzard',
    name: 'Nevasca',
    description: 'Rajadas de neve com flocos próximos e vento gelado.',
    sound: 'sfx-screen-blizzard',
    duration: 20,
    color: '#dae7ed',
  },
  {
    id: 'embers',
    name: 'Cinzas e brasas',
    description: 'Cinzas suspensas, brasas ascendentes e fogo crepitando.',
    sound: 'sfx-screen-embers',
    duration: 20,
    color: '#df9c64',
  },
  {
    id: 'haunting',
    name: 'Presença espectral',
    description: 'Vultos nas bordas, névoa fria e um lamento distante.',
    sound: 'sfx-screen-haunting',
    duration: 16,
    color: '#a3b9c3',
  },
  {
    id: 'arcane',
    name: 'Ruptura arcana',
    description: 'Uma onda de energia atravessa a tela e dispersa partículas luminosas.',
    sound: 'sfx-screen-arcane',
    duration: 12,
    color: '#baa4da',
  },
] as const;
export type ScreenEffectId = (typeof screenEffectPresets)[number]['id'];
export const screenEffectIdSchema = z.enum([
  'earthquake',
  'cave-in',
  'thunderstorm',
  'blizzard',
  'embers',
  'haunting',
  'arcane',
]);
export const screenEffectSettingsSchema = z
  .object({
    preset: screenEffectIdSchema,
    sceneId: z.string().uuid(),
    duration: z.number().int().min(5).max(60),
    intensity: z.number().min(0.1).max(1),
    volume: z.number().min(0).max(1),
    muted: z.boolean(),
  })
  .strict();
export const screenEffectSchema = screenEffectSettingsSchema
  .extend({
    id: z.string().uuid(),
    startedAt: z.number().int().min(0).max(8640000000000000),
  })
  .strict();
export type ScreenEffect = z.infer<typeof screenEffectSchema>;
export type ScreenEffectSettings = z.infer<typeof screenEffectSettingsSchema>;
export const screenEffectPreset = (id: ScreenEffectId) =>
  screenEffectPresets.find((p) => p.id === id)!;
