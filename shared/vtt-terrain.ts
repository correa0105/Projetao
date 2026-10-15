export const terrainTextures = [
  { id: 'grass', name: 'Grama', image: '/vtt/terrain-v4-20261013/grass.webp' },
  { id: 'rocky-grass', name: 'Grama pedregosa', image: '/vtt/terrain-v4-20261013/rocky-grass.webp' },
  { id: 'earth', name: 'Terra', image: '/vtt/terrain-v3-20261013/earth.webp' },
  { id: 'sand', name: 'Areia', image: '/vtt/terrain-v3-20261013/sand.webp' },
  { id: 'water', name: 'Água', image: '/vtt/terrain-water-20261013/water.webp' },
  { id: 'stone', name: 'Pedra', image: '/vtt/terrain-v3-20261013/stone.webp' },
  { id: 'wood', name: 'Madeira', image: '/vtt/terrain-v3-20261013/wood.webp' },
  { id: 'snow', name: 'Neve', image: '/vtt/terrain-v3-20261013/snow.webp' },
  { id: 'packed-earth', name: 'Terra batida', image: '/vtt/terrain-expansion-20261015/packed-earth.webp', thumbnail: '/vtt/terrain-expansion-thumbs-20261015/packed-earth.webp' },
  { id: 'mud', name: 'Lama', image: '/vtt/terrain-expansion-20261015/mud.webp', thumbnail: '/vtt/terrain-expansion-thumbs-20261015/mud.webp' },
  { id: 'gravel', name: 'Cascalho', image: '/vtt/terrain-expansion-20261015/gravel.webp', thumbnail: '/vtt/terrain-expansion-thumbs-20261015/gravel.webp' },
  { id: 'leaves', name: 'Folhas secas', image: '/vtt/terrain-expansion-20261015/leaves.webp', thumbnail: '/vtt/terrain-expansion-thumbs-20261015/leaves.webp' },
  { id: 'moss', name: 'Musgo', image: '/vtt/terrain-expansion-20261015/moss.webp', thumbnail: '/vtt/terrain-expansion-thumbs-20261015/moss.webp' },
  { id: 'dry-grass', name: 'Grama seca', image: '/vtt/terrain-expansion-20261015/dry-grass.webp', thumbnail: '/vtt/terrain-expansion-thumbs-20261015/dry-grass.webp' },
  { id: 'cobblestone', name: 'Paralelepípedos', image: '/vtt/terrain-expansion-20261015/cobblestone.webp', thumbnail: '/vtt/terrain-expansion-thumbs-20261015/cobblestone.webp' },
  { id: 'terracotta', name: 'Terracota', image: '/vtt/terrain-expansion-20261015/terracotta.webp', thumbnail: '/vtt/terrain-expansion-thumbs-20261015/terracotta.webp' },
  { id: 'marble', name: 'Mármore', image: '/vtt/terrain-expansion-20261015/marble.webp', thumbnail: '/vtt/terrain-expansion-thumbs-20261015/marble.webp' },
  { id: 'dark-wood', name: 'Madeira escura', image: '/vtt/terrain-expansion-20261015/dark-wood.webp', thumbnail: '/vtt/terrain-expansion-thumbs-20261015/dark-wood.webp' },
] as const;
export type TerrainTextureId = (typeof terrainTextures)[number]['id'];
export const terrainTextureIds = terrainTextures.map(t=>t.id) as [TerrainTextureId, ...TerrainTextureId[]];
export const woodlandFloorImage = '/vtt/terrain-v4-20261013/woodland-floor.webp';

export const isGrassTexture = (id: string) => id === 'grass' || id === 'rocky-grass';
