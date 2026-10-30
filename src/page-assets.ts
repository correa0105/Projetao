import type { Page } from './types';

// Only opening scenery belongs here. Catalogues and maps load inside their own areas.
const wood = '/achievement-wood-v1.png';
const board = ['/notice-village-complete-v5.png', '/notices/wood-plaque-v1.png', wood];
export const primaryPageAssets: Partial<Record<Page, readonly string[]>> = {
  overview: ['/home-guild-hall.webp'],
  tower: ['/tower/headquarters-reception-20261029.webp'],
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
  cards: ['/cards/host-shadow-study-20261027.png', '/cards/host-shadow-study-mobile-20261027.png', '/cards/back-celestial-original-20261014.webp'],
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
// Entry downloads only its own scenery. Authenticated visits prepare their
// destination instead of fetching every area's background before entering.
export const siteBootAssets = ['/alvorada-map-v2.png','/alvorada-fog.svg'];
export function openingPageAssets(page: Page) {
  if(page==='cards')return [matchMedia('(max-width:900px)').matches
    ? '/cards/host-shadow-study-mobile-20261027.png'
    : '/cards/host-shadow-study-20261027.png'];
  return primaryPageAssets[page] || [];
}
