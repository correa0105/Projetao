export const terrainTextures = [
  { id: 'grass', name: 'Grama', image: '/vtt/terrain-v4-20261013/grass.webp' },
  { id: 'rocky-grass', name: 'Grama pedregosa', image: '/vtt/terrain-v4-20261013/rocky-grass.webp' },
  { id: 'earth', name: 'Terra', image: '/vtt/terrain-v3-20261013/earth.webp' },
  { id: 'sand', name: 'Areia', image: '/vtt/terrain-v3-20261013/sand.webp' },
  { id: 'water', name: 'Água', image: '/vtt/terrain-water-20261013/water.webp' },
  { id: 'stone', name: 'Pedra', image: '/vtt/terrain-v3-20261013/stone.webp' },
  { id: 'wood', name: 'Madeira', image: '/vtt/terrain-v3-20261013/wood.webp' },
  { id: 'snow', name: 'Neve', image: '/vtt/terrain-v3-20261013/snow.webp' },
] as const;
export type TerrainTextureId = (typeof terrainTextures)[number]['id'];
export const woodlandFloorImage = '/vtt/terrain-v4-20261013/woodland-floor.webp';

export const isGrassTexture = (id: string) => id === 'grass' || id === 'rocky-grass';
