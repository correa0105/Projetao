import { z } from 'zod';
// The original six IDs and ordering are part of saved rooms and hotbar presets.
export const effectKinds = [
  'death',
  'fire',
  'frost',
  'poison',
  'heal',
  'sparks',
  'lightning',
  'arcane',
  'shield',
  'radiant',
  'shadow',
  'acid',
  'wind',
  'water',
  'earth',
  'vines',
] as const;
export type EffectKind = (typeof effectKinds)[number];
export const effectLibrary: {
  kind: EffectKind;
  name: string;
  color: string;
  group: string;
  description: string;
}[] = [
  {
    kind: 'death',
    name: 'Sangue e token vermelho',
    color: '#801b19',
    group: 'Estado',
    description:
      'Sangue com bordas irregulares e reflexos discretos. O token permanece inteiro e vermelho.',
  },
  {
    kind: 'fire',
    name: 'Chamas',
    color: '#ed7836',
    group: 'Elementos',
    description: 'Línguas de fogo turbulentas, núcleo quente, fumaça e brasas que sobem.',
  },
  {
    kind: 'frost',
    name: 'Gelo',
    color: '#9dd7ef',
    group: 'Elementos',
    description: 'Cristais facetados, fraturas luminosas, névoa fria e pequenos flocos.',
  },
  {
    kind: 'poison',
    name: 'Veneno',
    color: '#92b65f',
    group: 'Estado',
    description: 'Vapor denso e sinuoso, bolhas suspensas e partículas esverdeadas.',
  },
  {
    kind: 'heal',
    name: 'Cura',
    color: '#99d5aa',
    group: 'Magia',
    description: 'Círculo de luz sob o corpo, espiral suave ao redor e pequenas estrelas.',
  },
  {
    kind: 'sparks',
    name: 'Faíscas',
    color: '#d8bc76',
    group: 'Elementos',
    description: 'Arcos curtos ramificados, centelhas rápidas e núcleos incandescentes.',
  },
  {
    kind: 'lightning',
    name: 'Relâmpagos',
    color: '#96beff',
    group: 'Elementos',
    description: 'Descargas que partem do centro, ramificações, centelhas e luz elétrica.',
  },
  {
    kind: 'arcane',
    name: 'Selo arcano',
    color: '#b79aef',
    group: 'Magia',
    description: 'Inscrições geométricas, fios de energia e fragmentos ao redor da silhueta.',
  },
  {
    kind: 'shield',
    name: 'Barreira',
    color: '#73c9eb',
    group: 'Magia',
    description: 'Facetas translúcidas e pulsos de proteção acompanhando os contornos do corpo.',
  },
  {
    kind: 'radiant',
    name: 'Luz radiante',
    color: '#f2cf79',
    group: 'Magia',
    description: 'Luz dourada sobre o corpo, fios luminosos e pequenas estrelas delicadas.',
  },
  {
    kind: 'shadow',
    name: 'Sombras',
    color: '#9270b7',
    group: 'Magia',
    description: 'Véus escuros, fios de sombra e brasas violetas nas bordas.',
  },
  {
    kind: 'acid',
    name: 'Ácido',
    color: '#b5d74f',
    group: 'Elementos',
    description: 'Poças corrosivas, respingos viscosos e bolhas que se desfazem.',
  },
  {
    kind: 'wind',
    name: 'Vendaval',
    color: '#b6dbda',
    group: 'Elementos',
    description: 'Correntes espirais com trilhas afiladas, poeira e pequenos detritos.',
  },
  {
    kind: 'water',
    name: 'Água',
    color: '#59bddd',
    group: 'Elementos',
    description: 'Ondas translúcidas, gotas brilhantes e anéis de água em expansão.',
  },
  {
    kind: 'earth',
    name: 'Terra',
    color: '#b39165',
    group: 'Natureza',
    description: 'Fragmentos de rocha facetada, fissuras quentes e poeira rasteira.',
  },
  {
    kind: 'vines',
    name: 'Raízes',
    color: '#80ae68',
    group: 'Natureza',
    description: 'Ramos entrelaçados, folhas com nervuras e pequenas sementes luminosas.',
  },
];
export const effectNames = effectLibrary.map((e) => e.name);
export const effectColors = effectLibrary.map((e) => e.color);
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
