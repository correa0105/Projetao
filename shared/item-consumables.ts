import expanded from './emporium-consumables.json';
export const standardConsumableItems = new Set<string>([
  ...expanded,
  'antitoxin',
  'acid',
  'alchemists-fire',
  'oil',
  'rations',
  'torch',
  'candle',
  'spell-scroll-cantrip',
  'potion-of-growth',
  'potion-of-healing',
  'potion-of-climbing',
  'potion-of-heroism',
  'potion-of-flying',
  'cigar',
]);
