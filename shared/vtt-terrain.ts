export const terrainTextures = [
  { id: 'grass', name: 'Grama', image: '/vtt/scenery-v2-20261012/terrain-grass.webp' },
  { id: 'earth', name: 'Terra', image: '/vtt/scenery-v2-20261012/terrain-earth.webp' },
  { id: 'sand', name: 'Areia', image: '/vtt/scenery-v2-20261012/terrain-sand.webp' },
  { id: 'stone', name: 'Pedra', image: '/vtt/scenery-v2-20261012/terrain-stone.webp' },
  { id: 'wood', name: 'Madeira', image: '/vtt/scenery-v2-20261012/terrain-wood.webp' },
  { id: 'snow', name: 'Neve', image: '/vtt/scenery-v2-20261012/terrain-snow.webp' },
] as const;
export type TerrainTextureId = (typeof terrainTextures)[number]['id'];
