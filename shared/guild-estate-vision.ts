import { z } from 'zod';
export type EstatePoint = { x: number; y: number };
export const guildEstateOpenings = [
  {
    id: 'entry',
    kind: 'door',
    name: 'Porta de entrada',
    x: 29.15,
    y: 30.7,
    length: 1.55,
    rotation: 0,
  },
  {
    id: 'main-forge',
    kind: 'door',
    name: 'Porta da oficina',
    x: 30,
    y: 19.35,
    length: 1.3,
    rotation: 90,
  },
  {
    id: 'main-lounge',
    kind: 'door',
    name: 'Porta da sala de estar',
    x: 24.85,
    y: 23.8,
    length: 1.2,
    rotation: 0,
  },
  {
    id: 'forge-meeting',
    kind: 'door',
    name: 'Porta da sala de reunião',
    x: 34.2,
    y: 23.8,
    length: 1.15,
    rotation: 0,
  },
  {
    id: 'west-window',
    kind: 'window',
    name: 'Janela do salão',
    x: 24.45,
    y: 17.2,
    length: 1.35,
    rotation: 0,
  },
  {
    id: 'east-window',
    kind: 'window',
    name: 'Janela da oficina',
    x: 34.1,
    y: 17.2,
    length: 1.4,
    rotation: 0,
  },
] as const;
export type EstateOpeningId = (typeof guildEstateOpenings)[number]['id'];
export const estateOpeningId = z.enum([
  'entry',
  'main-forge',
  'main-lounge',
  'forge-meeting',
  'west-window',
  'east-window',
]);
export const estateOpeningsSchema = z
  .object({
    entry: z.boolean().default(true),
    'main-forge': z.boolean().default(false),
    'main-lounge': z.boolean().default(false),
    'forge-meeting': z.boolean().default(false),
    'west-window': z.boolean().default(true),
    'east-window': z.boolean().default(true),
  })
  .strict();
export type EstateOpenings = z.infer<typeof estateOpeningsSchema>;
export type EstateLine = { a: EstatePoint; b: EstatePoint };
const line = (x: number, y: number, u: number, v: number): EstateLine => ({
  a: { x, y },
  b: { x: u, y: v },
});
const walls = [
  line(21.12, 17.2, 24.45, 17.2),
  line(25.8, 17.2, 34.1, 17.2),
  line(35.5, 17.2, 38.88, 17.2),
  line(21.12, 17.2, 21.12, 30.7),
  line(38.88, 17.2, 38.88, 30.7),
  line(21.12, 30.7, 29.15, 30.7),
  line(30.7, 30.7, 38.88, 30.7),
  line(30, 17.2, 30, 19.35),
  line(30, 20.65, 30, 23.8),
  line(30, 23.8, 30, 27.5),
  line(21.12, 23.8, 24.85, 23.8),
  line(26.05, 23.8, 34.2, 23.8),
  line(35.35, 23.8, 38.88, 23.8),
];
export function guildEstateVisionLines(state: EstateOpenings) {
  return [
    ...walls,
    ...guildEstateOpenings
      .filter((o) => !state[o.id])
      .map((o) => {
        const angle = (o.rotation * Math.PI) / 180;
        return line(o.x, o.y, o.x + Math.cos(angle) * o.length, o.y + Math.sin(angle) * o.length);
      }),
  ];
}
function ray(at: EstatePoint, angle: number, lines: EstateLine[], limit = 200) {
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  let distance = limit;
  for (const { a, b } of lines) {
    const sx = b.x - a.x,
      sy = b.y - a.y,
      den = dx * sy - dy * sx;
    if (Math.abs(den) < 1e-10) continue;
    const ax = a.x - at.x,
      ay = a.y - at.y,
      t = (ax * sy - ay * sx) / den,
      u = (ax * dy - ay * dx) / den;
    if (t > 0.0001 && t < distance && u >= 0 && u <= 1) distance = t;
  }
  return { x: at.x + dx * distance, y: at.y + dy * distance, distance };
}
export function guildEstateCanSee(at: EstatePoint, target: EstatePoint, state: EstateOpenings) {
  const distance = Math.hypot(target.x - at.x, target.y - at.y);
  return (
    ray(at, Math.atan2(target.y - at.y, target.x - at.x), guildEstateVisionLines(state), distance)
      .distance >=
    distance - 0.02
  );
}
export function guildEstateVisionPolygon(at: EstatePoint, state: EstateOpenings) {
  const lines = guildEstateVisionLines(state),
    angles = Array.from({ length: 128 }, (_, i) => (i * Math.PI * 2) / 128);
  for (const l of lines)
    for (const p of [l.a, l.b]) {
      const a = Math.atan2(p.y - at.y, p.x - at.x);
      angles.push(...[a - 0.00001, a, a + 0.00001].map((n) => (n + Math.PI * 2) % (Math.PI * 2)));
    }
  return (
    'M' +
    angles
      .sort((a, b) => a - b)
      .map((a) => {
        const p = ray(at, a, lines);
        return p.x.toFixed(4) + ' ' + p.y.toFixed(4);
      })
      .join('L') +
    'Z'
  );
}
