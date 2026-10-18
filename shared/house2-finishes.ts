import houses from './vtt-houses-catalog.json';
import floors from './house2-floor-finishes-20261018.json';

export type House2FinishKind = 'roof' | 'walls' | 'floor';
export type House2Finishes = Partial<Record<House2FinishKind, string>>;
export const house2FinishNames = { roof: 'Telhados', walls: 'Paredes', floor: 'Pisos' } as const;
export const house2FinishesCatalog = [
  {
    id: 'roof-straw',
    sourceHouse: 'house-empty-001',
    kind: 'roof',
    name: 'Telhado de palha',
    price: 220,
    image: '/vtt/houses-empty-20261014/house-001-roof.webp',
  },
  {
    id: 'roof-red',
    sourceHouse: 'house-empty-002',
    kind: 'roof',
    name: 'Telhas vermelhas',
    price: 320,
    image: '/vtt/houses-empty-20261014/house-002-roof.webp',
  },
  {
    id: 'roof-wood',
    sourceHouse: 'house-empty-003',
    kind: 'roof',
    name: 'Telhas de madeira',
    price: 280,
    image: '/vtt/houses-empty-20261014/house-003-roof.webp',
  },
  {
    id: 'roof-slate',
    sourceHouse: 'house-empty-013',
    kind: 'roof',
    name: 'Telhado de ardósia',
    price: 420,
    image: '/vtt/houses-empty-20261014/house-013-roof.webp',
  },
  {
    id: 'walls-wood',
    kind: 'walls',
    name: 'Paredes de madeira',
    price: 180,
    image: '/vtt/terrain-v3-20261013/wood.webp',
  },
  {
    id: 'walls-stone',
    kind: 'walls',
    name: 'Paredes de pedra',
    price: 300,
    image: '/vtt/terrain-expansion-20261015/cobblestone.webp',
  },
  {
    id: 'walls-brick',
    kind: 'walls',
    name: 'Paredes de terracota',
    price: 260,
    image: '/vtt/terrain-expansion-20261015/terracotta.webp',
  },
  {
    id: 'floor-wood',
    kind: 'floor',
    name: 'Piso de madeira clara',
    price: 150,
    image: '/vtt/terrain-v3-20261013/wood.webp',
  },
  {
    id: 'floor-dark',
    kind: 'floor',
    name: 'Piso de madeira escura',
    price: 180,
    image: '/vtt/terrain-expansion-20261015/dark-wood.webp',
  },
  {
    id: 'floor-stone',
    kind: 'floor',
    name: 'Piso de pedra',
    price: 240,
    image: '/vtt/terrain-expansion-20261015/cobblestone.webp',
  },
  {
    id: 'floor-marble',
    kind: 'floor',
    name: 'Piso de mármore',
    price: 380,
    image: '/vtt/terrain-expansion-20261015/marble.webp',
  },
  {
    id: 'floor-terracotta',
    kind: 'floor',
    name: 'Piso de terracota',
    price: 200,
    image: '/vtt/terrain-expansion-20261015/terracotta.webp',
  },
  ...houses
    .filter(
      (h) =>
        h.category === 'Casas vazias' &&
        !['house-empty-001', 'house-empty-002', 'house-empty-003', 'house-empty-013'].includes(
          h.id,
        ),
    )
    .map((h, i) => ({
      id: 'roof-style-' + h.id.slice(-3),
      kind: 'roof' as const,
      name: 'Telhado · ' + h.name.replace(' · vazia', ''),
      price: 300 + i * 10,
      image: h.image,
      sourceHouse: h.id,
    })),
  ...floors.map((f) => ({ ...f, kind: 'floor' as const })),
] as const;
export const house2Finish = (finishes: House2Finishes | undefined, kind: House2FinishKind) =>
  house2FinishesCatalog.find((f) => f.id === finishes?.[kind] && f.kind === kind);
