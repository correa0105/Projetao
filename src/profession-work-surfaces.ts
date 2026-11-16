import { professionWork } from '../shared/profession-production';
export type WorkPoint = { x: number; y: number };
const points = (v: number[][]): WorkPoint[] => v.map(([x, y]) => ({ x, y }));
const oval = (x: number, y: number, rx: number, ry: number): WorkPoint[] =>
  Array.from({ length: 96 }, (_, i) => ({
    x: x + Math.cos((i * Math.PI) / 48) * rx,
    y: y + Math.sin((i * Math.PI) / 48) * ry,
  }));
const paper = points([
  [191, 242],
  [267, 207],
  [354, 174],
  [464, 158],
  [553, 143],
  [638, 138],
  [670, 209],
  [714, 269],
  [751, 328],
  [793, 371],
  [844, 391],
  [801, 422],
  [738, 438],
  [649, 454],
  [563, 468],
  [447, 487],
  [337, 505],
  [250, 514],
  [231, 479],
  [192, 435],
  [184, 387],
  [160, 332],
  [160, 283],
]);
const wood = points([
  [220, 118],
  [345, 111],
  [412, 128],
  [495, 140],
  [644, 147],
  [644, 236],
  [615, 300],
  [207, 269],
  [202, 176],
]);
const leather = points([
  [223, 178],
  [477, 151],
  [551, 408],
  [287, 441],
]);
const stone = points([
  [280, 130],
  [402, 81],
  [640, 35],
  [708, 29],
  [748, 100],
  [742, 301],
  [646, 353],
  [530, 382],
  [310, 394],
  [274, 302],
]);
const mortar = points([
  [396, 287],
  [415, 274],
  [440, 259],
  [465, 256],
  [490, 254],
  [516, 257],
  [550, 248],
  [554, 262],
  [583, 264],
  [610, 275],
  [636, 291],
  [621, 305],
  [578, 317],
  [518, 318],
  [464, 315],
  [420, 305],
  [396, 292],
]);
const shapes: Record<string, WorkPoint[]> = {
  smithing: points([
    [296, 175],
    [715, 151],
    [737, 173],
    [737, 193],
    [300, 205],
  ]),
  alchemy: mortar,
  herbalism: mortar,
  cartography: paper,
  calligraphy: paper,
  navigation: paper,
  forgery: paper,
  painting: paper,
  carpentry: wood,
  woodcarving: wood,
  leatherwork: leather,
  masonry: stone,
  brewing: oval(478, 238, 208, 52),
  cooking: oval(510, 197, 148, 60),
  poison: oval(480, 260, 181, 43),
  jewelry: points([
    [279, 82],
    [309, 76],
    [335, 96],
    [347, 137],
    [330, 173],
    [299, 188],
    [273, 165],
    [268, 116],
  ]),
  tinkering: points([
    [616, 191],
    [670, 163],
    [763, 182],
    [835, 213],
    [853, 283],
    [809, 331],
    [700, 344],
    [620, 286],
    [592, 240],
  ]),
  'thieves-tools': points([
    [741, 207],
    [804, 214],
    [857, 245],
    [845, 305],
    [772, 334],
    [719, 303],
    [713, 242],
  ]),
  pottery: points([
    [375, 218],
    [425, 198],
    [526, 197],
    [597, 213],
    [612, 235],
    [591, 289],
    [551, 331],
    [450, 337],
    [410, 312],
    [387, 269],
  ]),
  glassblowing: points([
    [443, 254],
    [484, 250],
    [511, 219],
    [560, 198],
    [624, 197],
    [681, 224],
    [704, 267],
    [699, 304],
    [664, 337],
    [600, 348],
    [545, 333],
    [502, 303],
    [481, 282],
    [443, 281],
  ]),
  luthiery: points([
    [110, 243],
    [245, 247],
    [433, 230],
    [769, 227],
    [779, 309],
    [448, 308],
    [241, 306],
    [111, 319],
  ]),
  weaving: points([
    [317, 115],
    [700, 142],
    [636, 399],
    [232, 375],
  ]),
  cobbling: points([
    [166, 382],
    [185, 342],
    [297, 310],
    [389, 236],
    [433, 189],
    [509, 131],
    [651, 105],
    [689, 185],
    [699, 261],
    [651, 347],
    [479, 397],
    [349, 431],
    [201, 425],
    [166, 410],
  ]),
  disguise: points([
    [297, 263],
    [305, 218],
    [360, 190],
    [447, 177],
    [492, 183],
    [597, 196],
    [654, 233],
    [644, 321],
    [613, 365],
    [577, 387],
    [522, 375],
    [481, 352],
    [432, 385],
    [352, 368],
    [312, 334],
  ]),
  games: points([
    [303, 165],
    [657, 165],
    [691, 363],
    [274, 363],
  ]),
};
const anchors: Record<string, [number, number]> = {
  smithing: [510, 181],
  alchemy: [514, 286],
  herbalism: [514, 286],
  poison: [480, 260],
  brewing: [478, 238],
  cooking: [510, 197],
  jewelry: [307, 91],
  tinkering: [724, 229],
  'thieves-tools': [759, 254],
  pottery: [490, 273],
  glassblowing: [590, 275],
  luthiery: [500, 275],
  weaving: [440, 310],
  cobbling: [340, 419],
  disguise: [480, 325],
  games: [490, 265],
  masonry: [455, 245],
  carpentry: [430, 205],
  woodcarving: [430, 205],
  leatherwork: [516, 300],
};
export function professionSurface(id: string) {
  const polygon = shapes[id] ?? wood,
    box = {
      minX: Math.min(...polygon.map((p) => p.x)),
      maxX: Math.max(...polygon.map((p) => p.x)),
      minY: Math.min(...polygon.map((p) => p.y)),
      maxY: Math.max(...polygon.map((p) => p.y)),
    };
  const [x, y] = anchors[id] ?? [510, 310];
  return {
    x,
    y,
    rx: (box.maxX - box.minX) / 2,
    ry: (box.maxY - box.minY) / 2,
    angle: 0,
    polygon,
    liquid: ['mixture', 'cooking'].includes(professionWork(id).bench),
    holes:
      id === 'disguise'
        ? [
            { x: 395, y: 285, rx: 48, ry: 20 },
            { x: 560, y: 285, rx: 48, ry: 20 },
            { x: 480, y: 380, rx: 45, ry: 28 },
          ]
        : [],
  };
}
function segmentPoint(p: WorkPoint, a: WorkPoint, b: WorkPoint) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return { x: a.x + t * dx, y: a.y + t * dy };
}
function polygonContains(p: WorkPoint, v: WorkPoint[]) {
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const a = v[j],
      b = v[i],
      edge = segmentPoint(p, a, b);
    if (Math.hypot(p.x - edge.x, p.y - edge.y) < 1e-6) return true;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function insideSurface(p: WorkPoint, s: ReturnType<typeof professionSurface>) {
  return (
    polygonContains(p, s.polygon) &&
    !s.holes.some((h) => ((p.x - h.x) / h.rx) ** 2 + ((p.y - h.y) / h.ry) ** 2 <= 1)
  );
}
export function projectOnSurface(p: WorkPoint, s: ReturnType<typeof professionSurface>) {
  if (insideSurface(p, s)) return p;
  const candidates = s.polygon.map((a, i) =>
    segmentPoint(p, a, s.polygon[(i + 1) % s.polygon.length]),
  );
  for (const h of s.holes) {
    const a = Math.atan2((p.y - h.y) / h.ry, (p.x - h.x) / h.rx);
    candidates.push({ x: h.x + Math.cos(a) * (h.rx + 1), y: h.y + Math.sin(a) * (h.ry + 1) });
    for (let i = 0; i < 32; i++)
      candidates.push({
        x: h.x + Math.cos((i * Math.PI) / 16) * (h.rx + 1),
        y: h.y + Math.sin((i * Math.PI) / 16) * (h.ry + 1),
      });
  }
  const valid = candidates.filter((c) => insideSurface(c, s));
  valid.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  return valid[0] ?? { x: s.x, y: s.y };
}
export function acquireSurface(
  p: WorkPoint,
  s: ReturnType<typeof professionSurface>,
  padding: number,
) {
  if (insideSurface(p, s)) return p;
  const near = projectOnSurface(p, s);
  return Math.hypot(near.x - p.x, near.y - p.y) <= padding ? near : null;
}
export function surfacePath(s: ReturnType<typeof professionSurface>) {
  return 'M' + s.polygon.map((p) => p.x + ',' + p.y).join(' L') + ' Z';
}
export function professionView(id: string): [number, number, number, number] {
  if (id === 'jewelry') return [140, -25, 440, 294];
  if (id === 'tinkering') return [620, 125, 300, 200];
  if (['tinkering', 'thieves-tools'].includes(id)) return [430, 30, 530, 354];
  if (id === 'glassblowing') return [70, 30, 820, 547];
  if (id === 'poison') return [80, 25, 800, 533];
  if (['alchemy', 'herbalism', 'cooking'].includes(id)) return [160, 45, 680, 453];
  if (['cartography', 'calligraphy', 'forgery', 'navigation', 'painting'].includes(id))
    return [100, 40, 820, 547];
  return [80, 15, 800, 533];
}
