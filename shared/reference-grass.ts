const root = '/vtt/reference-grass-20261017';
export const referenceGrassTextures = [
  {
    id: 'grass-reference-dense',
    name: 'Grama fina escura',
    image: `${root}/grass-reference-dense.webp`,
    thumbnail: `${root}/grass-reference-dense-thumb.webp`,
  },
  {
    id: 'grass-reference-meadow',
    name: 'Grama campestre',
    image: `${root}/grass-reference-meadow.webp`,
    thumbnail: `${root}/grass-reference-meadow-thumb.webp`,
  },
  {
    id: 'grass-reference-light',
    name: 'Grama fina clara',
    image: `${root}/grass-reference-light.webp`,
    thumbnail: `${root}/grass-reference-light-thumb.webp`,
  },
  {
    id: 'grass-reference-sparse',
    name: 'Grama clara rala',
    image: `${root}/grass-reference-sparse.webp`,
    thumbnail: `${root}/grass-reference-sparse-thumb.webp`,
  },
] as const;
export const house2DefaultGrassImage = referenceGrassTextures[3].image;
