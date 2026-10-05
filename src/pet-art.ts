import { petAppearance } from '../shared/pets';

type Frame = readonly [number, number, number, number];
// Actual painted silhouettes are not aligned to equal sprite cells. These
// viewports include ears, tails, feet and transparent padding without stretching.
const originals: Record<string, { frame: Frame; width: number }> = {
  dog: { frame: [0, 15, 370, 477], width: 178 },
  cat: { frame: [400, 35, 303, 460], width: 112 },
  rabbit: { frame: [749, 43, 291, 450], width: 82 },
  owl: { frame: [1089, 63, 307, 433], width: 90 },
  fox: { frame: [1425, 39, 349, 457], width: 150 },
  raven: { frame: [19, 482, 353, 387], width: 100 },
  frog: { frame: [384, 575, 333, 273], width: 70 },
  snake: { frame: [713, 519, 352, 326], width: 124 },
  rat: { frame: [1072, 551, 350, 315], width: 78 },
  'guinea-pig': { frame: [1427, 568, 347, 290], width: 88 },
};
const variants: Record<string, { frame: Frame; width: number }> = {
  shepherd: { frame: [6, 30, 610, 642], width: 218 },
  longhair: { frame: [674, 88, 580, 582], width: 146 },
  runic: { frame: [83, 664, 576, 569], width: 108 },
  horned: { frame: [721, 664, 383, 569], width: 99 },
  shadow: { frame: [9, 53, 618, 631], width: 112 },
  emerald: { frame: [652, 53, 602, 631], width: 148 },
  fluffy: { frame: [27, 694, 634, 538], width: 88 },
};

export function petArtwork(petId: string, appearance = 'original') {
  const variant = petAppearance(petId, appearance),
    artwork = variant ? variants[variant.id] : originals[petId] || originals.dog;
  return {
    ...artwork,
    source: variant ? `/pets/variants-${variant.atlas}-v2.png` : '/pets/animals-v2.png',
    sheetWidth: variant ? 1254 : 1774,
    sheetHeight: variant ? 1254 : 887,
  };
}
