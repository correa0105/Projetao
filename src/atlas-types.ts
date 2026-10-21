/** Shared geographic marker contract; rendering belongs to each map view. */
export type AtlasMarker = {
  id: string;
  name: string;
  x: number;
  y: number;
  available?: boolean;
  preview?: Extract<import('../shared/lore').LoreBlock, {type:'image'}>[];
};
