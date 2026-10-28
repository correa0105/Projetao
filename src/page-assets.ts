import type { Page } from './types';

// Only opening scenery belongs here. Catalogues and maps load inside their own areas.
const wood = '/achievement-wood-v1.png';
const board = ['/notice-village-complete-v5.png', '/notices/wood-plaque-v1.png', wood];
export const primaryPageAssets: Partial<Record<Page, readonly string[]>> = {
  overview: ['/home-guild-hall.webp'],
  characters: ['/character-camp-v2.webp'],
  profile: ['/achievement-house-v3.png', '/character-parchment-v2.png'],
  inventory: [
    '/inventory-loot-v1.png',
    '/inventory-stat-icons-v1.png',
    '/character-parchment-v2.png',
  ],
  achievements: [
    '/achievement-house-v3.png',
    '/achievement-frames-v2.png',
    '/achievement-badges-v1.png',
  ],
  board,
  missions: board,
  hooks: board,
  stable: ['/stable/paddock-camp-v2.webp', '/stable/ginna.webp', '/stable/riding-horse.png', wood],
  pets: ['/pets/garalho-cottage-v2.webp', '/pets/garalho-sign-ready-v2.png'],
  cards: ['/cards/host-shadow-study-20261027.png', '/cards/host-shadow-study-mobile-20261027.png', '/cards/nocturne-back-20261027.svg'],
  'character-cards': ['/cards/private-archive-20261012.webp'],
  hall: ['/achievement-house-v3.png'],
  profiles: ['/character-camp-v2.png'],
  house: [wood],
  shop: [
    '/shop/reference/shop-counter-v2.png',
    '/shop/reference/shop-merchant-v1.png',
    '/character-parchment-v2.png',
  ],
};
export const siteBootAssets = [
  ...new Set([
    '/guild-icons-candle-helmet.png',
    '/guild-icon-notice-board-v3.png',
    ...Object.entries(primaryPageAssets)
      .filter(([page]) => page !== 'shop')
      .flatMap(([, assets]) => assets!),
  ]),
];
