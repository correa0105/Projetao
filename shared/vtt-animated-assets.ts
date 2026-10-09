import { z } from 'zod';

export const animatedAssetIds = [
  'firepit',
  'rowboat',
  'portal-ring',
  'potions',
  'cauldron',
  'fountain',
  'chest',
  'spellbook',
  'brazier',
  'candles',
  'crystals',
  'bush',
  'steam-vent',
  'magic-pool',
  'windmill',
  'banner',
  'wind',
] as const;
export const animatedAssetSchema = z
  .object({
    id: z.enum(animatedAssetIds),
    speed: z.number().min(0.25).max(2).default(1),
    intensity: z.number().min(0.2).max(1).default(0.8),
    playing: z.boolean().default(true),
  })
  .strict();
export type AnimatedAsset = z.infer<typeof animatedAssetSchema>;
export const animatedAssets = [
  ['firepit', 'Fogueira', 'Chamas vivas, brasas e fumaça sobre lenha.', 2],
  ['rowboat', 'Barco', 'Balanço suave com ondulações e esteira na água.', 3],
  ['portal-ring', 'Portal', 'Vórtice de energia dentro de um aro de pedra.', 2],
  ['potions', 'Poções', 'Frascos luminosos com bolhas e vapor mágico.', 1],
  ['cauldron', 'Caldeirão', 'Líquido borbulhante e vapores de alquimia.', 2],
  ['fountain', 'Fonte', 'Água corrente, respingos e ondas na bacia.', 3],
  ['chest', 'Baú encantado', 'Luz escapando da tampa e partículas suspensas.', 1.5],
  ['spellbook', 'Grimório', 'Folhas com brilho arcano e energia flutuante.', 1.5],
  ['brazier', 'Braseiro', 'Carvões incandescentes, labaredas e calor.', 1.5],
  ['candles', 'Velas', 'Três chamas com oscilação e pontos de luz.', 1],
  ['crystals', 'Cristais', 'Reflexos móveis e pulsações entre facetas.', 2],
  ['bush', 'Vegetação', 'Folhagem movida pelo vento com folhas soltas.', 2],
  ['steam-vent', 'Saída de vapor', 'Plumas que sobem e se dissipam sobre a grade.', 2],
  ['magic-pool', 'Lago mágico', 'Reflexos e pequenas ondas na superfície.', 3],
  ['windmill', 'Moinho', 'Rotor de madeira girando continuamente.', 3],
  ['banner', 'Estandarte', 'Tecido com ondulações suaves ao vento.', 2],
  ['wind', 'Vento', 'Corrente de ar, névoa tênue e folhas carregadas.', 3],
].map(([id, name, description, squares]) => ({
  id: id as AnimatedAsset['id'],
  name: name as string,
  description: description as string,
  squares: squares as number,
  image: id === 'wind' ? '' : '/vtt/animated-assets-20261009/' + id + '.webp',
}));
export const animatedAssetMime = 'application/x-alvorada-animated-asset';
