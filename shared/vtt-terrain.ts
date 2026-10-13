export const terrainTextures = [
  { id: 'grass', name: 'Grama', image: '/vtt/terrain-v3-20261013/grass.webp' },
  { id: 'earth', name: 'Terra', image: '/vtt/terrain-v3-20261013/earth.webp' },
  { id: 'sand', name: 'Areia', image: '/vtt/terrain-v3-20261013/sand.webp' },
  { id: 'stone', name: 'Pedra', image: '/vtt/terrain-v3-20261013/stone.webp' },
  { id: 'wood', name: 'Madeira', image: '/vtt/terrain-v3-20261013/wood.webp' },
  { id: 'snow', name: 'Neve', image: '/vtt/terrain-v3-20261013/snow.webp' },
] as const;
export type TerrainTextureId = (typeof terrainTextures)[number]['id'];
