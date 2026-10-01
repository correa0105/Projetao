// A complete suit is purchased once and delivered as six independently equippable pieces.
export const PLATE_PIECES = [
  'plate-helmet',
  'plate-bracers',
  'plate-leggings',
  'plate-boots',
  'plate-pauldrons',
] as const;
export function purchaseContents(itemId: string) {
  return itemId === 'plate-armor' ? [itemId, ...PLATE_PIECES] : [itemId];
}
export function shopWeight(item: { id: string; weight_lb: string | number }) {
  return Number(item.weight_lb) + (item.id === 'plate-armor' ? 38 : 0);
}
