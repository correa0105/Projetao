import type { House2Item } from './house-v2';

// Small light fixtures rest on top of tables and counters, independently of purchase order.
const tabletop = new Set([
  'furniture-031',
  'furniture-032',
  'furniture-145',
  'furniture-146',
  'h2-candle',
]);
export function house2ItemLayers(items: House2Item[]): House2Item[] {
  return [...items].sort(
    (a, b) => Number(tabletop.has(a.catalog_id)) - Number(tabletop.has(b.catalog_id)),
  );
}
