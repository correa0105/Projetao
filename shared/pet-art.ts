import { petAppearance } from './pets';

type Frame = readonly [number, number, number, number];
type Artwork = { frame: Frame; width: number; source: string };
// Frames follow complete silhouettes, rather than equal atlas cells. Scene
// widths express relative animal sizes independently of catalog thumbnails.
const originals: Record<string, Artwork> = {
  dog: { frame: [0, 0, 673, 650], width: 218, source: '/pets/classics-a-v3.png' },
  cat: { frame: [709, 31, 545, 620], width: 122, source: '/pets/classics-a-v3.png' },
  rabbit: { frame: [36, 650, 652, 591], width: 94, source: '/pets/classics-a-v3.png' },
  owl: { frame: [741, 635, 421, 619], width: 92, source: '/pets/classics-a-v3.png' },
  fox: { frame: [0, 0, 677, 702], width: 156, source: '/pets/classics-b-v3.png' },
  raven: { frame: [85, 60, 1100, 1194], width: 106, source: '/pets/raven-ground-v4.png' },
  frog: { frame: [33, 713, 611, 495], width: 70, source: '/pets/classics-b-v3.png' },
  snake: { frame: [638, 693, 607, 554], width: 132, source: '/pets/classics-b-v3.png' },
  rat: { frame: [17, 95, 649, 526], width: 84, source: '/pets/classics-c-v3.png' },
  'guinea-pig': { frame: [664, 132, 590, 457], width: 90, source: '/pets/classics-c-v3.png' },
};
const variants: Record<string, Artwork> = {
  shepherd: { frame: [6, 30, 610, 642], width: 218, source: '/pets/variants-a-v2.png' },
  longhair: { frame: [674, 88, 580, 582], width: 146, source: '/pets/variants-a-v2.png' },
  runic: { frame: [83, 664, 576, 569], width: 108, source: '/pets/variants-a-v2.png' },
  horned: { frame: [230, 18, 828, 1236], width: 99, source: '/pets/owl-horned-ground-v3.png' },
  shadow: { frame: [9, 53, 618, 631], width: 112, source: '/pets/variants-b-v2.png' },
  emerald: { frame: [652, 53, 602, 631], width: 148, source: '/pets/variants-b-v2.png' },
  fluffy: { frame: [27, 694, 634, 538], width: 88, source: '/pets/variants-b-v2.png' },
};

export function petArtwork(petId: string, appearance = 'original') {
  const variant = petAppearance(petId, appearance),
    artwork = variant ? variants[variant.id] : originals[petId] || originals.dog;
  return { ...artwork, sheetWidth: 1254, sheetHeight: 1254 };
}
