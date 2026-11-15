import {
  projectOnSurface,
  type WorkPoint,
  type professionSurface,
} from './profession-work-surfaces';
type Surface = ReturnType<typeof professionSurface>;
export type ToolPose = WorkPoint & { tilt: number; lift: number; rotation: number };
// Traço cursivo contínuo, com laçadas e hastes, em vez de uma onda repetida.
const copyCurves = [
  [0, 0, 12, -12, 14, -28, 6, -24],
  [6, -24, -1, -20, 2, 4, 11, 0],
  [11, 0, 17, -10, 26, -11, 25, -2],
  [25, -2, 24, 7, 14, 4, 16, -4],
  [16, -4, 19, -12, 27, -8, 28, -2],
  [28, -2, 32, 0, 32, -10, 36, -10],
  [36, -10, 41, -11, 35, -3, 42, 0],
  [42, 0, 49, -2, 54, -12, 47, -9],
  [47, -9, 38, -6, 46, 8, 56, 0],
];
function copyPoint(t: number) {
  t = Math.max(0, Math.min(1, t));
  const at = Math.min(copyCurves.length - 1, Math.floor(t * copyCurves.length)),
    u = t === 1 ? 1 : t * copyCurves.length - at,
    v = 1 - u,
    c = copyCurves[at];
  return {
    x: v ** 3 * c[0] + 3 * v ** 2 * u * c[2] + 3 * v * u ** 2 * c[4] + u ** 3 * c[6],
    y: v ** 3 * c[1] + 3 * v ** 2 * u * c[3] + 3 * v * u ** 2 * c[5] + u ** 3 * c[7],
  };
}
export function techniquePose(
  id: string,
  t: number,
  a: WorkPoint,
  s: Surface,
  step: number,
): ToolPose {
  const u = Math.PI * 2 * t,
    rx = Math.min(s.rx * 0.7, 125),
    ry = Math.min(s.ry * 0.6, 55);
  let x = a.x,
    y = a.y,
    tilt = 0,
    lift = 0,
    rotation = 0;
  switch (id) {
    case 'swirl':
      x = s.x + Math.cos(u) * rx * 0.7;
      y = s.y + Math.sin(u) * ry;
      tilt = Math.sin(u) * 8;
      rotation = t * 360;
      break;
    case 'grind':
      x = a.x + Math.sin(u) * 11;
      y = a.y + Math.cos(u) * 5;
      lift = -(Math.sin(Math.PI * t) ** 2) * 27;
      tilt = Math.sin(u) * 4;
      rotation = t * 24;
      break;
    case 'dose':
      lift = -32;
      tilt = Math.sin(Math.PI * t) * 2;
      rotation = t * 8;
      break;
    case 'mash':
      x = a.x + Math.sin(u) * Math.min(s.rx * 0.5, 100);
      y = a.y + Math.sin(u * 2) * s.ry * 0.18;
      lift = 6 + Math.sin(Math.PI * t) * 5;
      tilt = Math.sin(u) * 8;
      rotation = Math.sin(u) * 22;
      break;
    case 'scoop':
      x = s.x + Math.cos(u) * rx * 0.7;
      y = s.y + Math.sin(u) * ry;
      lift = t > 0.25 && t < 0.75 ? -Math.sin((t - 0.25) * Math.PI * 2) * 20 : 0;
      tilt = Math.sin(u) * 18;
      rotation = t * 85;
      break;
    case 'route':
      x = a.x + (t - 0.5) * 100;
      y = a.y + Math.sin(t * 8 + step) * 15;
      tilt = -10;
      break;
    case 'copy': {
      const p = copyPoint(t);
      x = a.x - 55 + (step % 2) * 66 + p.x;
      y = a.y + Math.floor((step % 8) / 2) * 20 + p.y;
      tilt = -5 + Math.sin(t * 16) * 3;
      break;
    }
    case 'letter':
      x = a.x + (t - 0.5) * 95;
      y = a.y + Math.sin(t * 32) * 9;
      tilt = 8;
      break;
    case 'bearing':
      x = a.x + Math.cos(u * 0.65) * rx * 0.55;
      y = a.y + Math.sin(u * 0.65) * ry * 0.8;
      tilt = t * 18;
      break;
    case 'seal':
      lift = -45 * (1 - Math.sin(Math.PI * t));
      tilt = t < 0.4 ? -8 * (1 - t / 0.4) : 0;
      break;
    case 'paint':
      x = a.x + Math.sin((t - 0.5) * Math.PI) * rx * 0.6;
      y = a.y + Math.sin(t * 4) * 18;
      tilt = Math.cos(Math.PI * t) * 18;
      break;
    case 'plane':
      x = a.x + (t < 0.8 ? t / 0.8 : 0.5 - (t - 0.8) * 2.5) * Math.min(s.rx * 0.7, 90) - 35;
      y = a.y + t * 5;
      lift = t > 0.8 ? -18 : 0;
      tilt = -5;
      break;
    case 'carve':
      x = a.x + Math.sin(t * Math.PI) * 45 - 20;
      y = a.y - Math.sin(t * Math.PI * 1.5) * 15;
      tilt = t * 12;
      break;
    case 'pluck':
      x = a.x + Math.sin(Math.PI * t) * 8;
      y = s.y + (t - 0.5) * s.ry * 1.55;
      tilt = Math.sin(Math.PI * t) * 16;
      break;
    case 'piece':
      lift = -Math.sin(Math.PI * t) * 28;
      tilt = Math.sin(u) * 15;
      break;
    case 'saddle':
      x = a.x + (t - 0.5) * 72;
      y = a.y + Math.sin(t * Math.PI * 8) * 8;
      lift = -Math.abs(Math.sin(t * Math.PI * 4)) * 12;
      break;
    case 'sole':
      x = a.x + (t - 0.5) * 100;
      y = a.y + Math.sin(Math.PI * t) * 7 - (x - a.x) * 0.16;
      lift = -Math.abs(Math.sin(t * Math.PI * 5)) * 10;
      tilt = -12;
      break;
    case 'weave':
      x = s.x + (step % 2 ? -1 : 1) * (t - 0.5) * s.rx * 1.65;
      y = s.y + ((step % 5) - 2) * 12;
      tilt = step % 2 ? 180 : 0;
      break;
    case 'mask':
      x = a.x + Math.sin(u) * rx * 0.4;
      y = a.y + Math.sin(u * 2) * ry * 0.35;
      tilt = Math.cos(u) * 15;
      break;
    case 'facet':
      x = a.x + Math.sin(u * 2) * s.rx * 0.45;
      y = a.y + Math.cos(u * 2) * s.ry * 0.35;
      tilt = Math.sin(u) * 12;
      break;
    case 'gear':
      x = a.x + Math.cos(u) * s.rx * 0.55;
      y = a.y + Math.sin(u) * s.ry * 0.55;
      tilt = t * 28;
      rotation = t * 90;
      break;
    case 'pick':
      x = a.x + Math.sin(u) * 4;
      y = a.y - Math.sin(Math.PI * t) * s.ry * 0.6;
      tilt = -Math.sin(Math.PI * t) * 12;
      break;
    case 'chisel':
      x = a.x + Math.sin(u) * 3;
      y = a.y + Math.sin(Math.PI * t) * 5;
      lift = -Math.max(0, Math.cos(u)) * 22;
      tilt = Math.sin(u) * 6;
      break;
    case 'glaze':
      x = a.x + Math.sin((t - 0.5) * Math.PI) * rx * 0.8;
      y = a.y + Math.sin(Math.PI * t) * 13;
      tilt = t * 18 - 9;
      break;
    case 'glass':
      rotation = t * 180;
      break;
  }
  return { ...projectOnSurface({ x, y }, s), tilt, lift, rotation };
}
