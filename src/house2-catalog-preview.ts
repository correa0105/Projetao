import visuals from '../shared/vtt-asset-visuals.json';
const thumbnails = new Map(Object.values(visuals).map((v) => [v.image, v.thumbnail]));

/** Catalog cards use the existing small art; the map and purchase modal keep full resolution. */
export function house2CatalogPreview(item: { image: string; thumbnail?: string }) {
  return item.thumbnail ?? thumbnails.get(item.image) ?? item.image;
}
