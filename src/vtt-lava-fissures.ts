import { alpha, tint } from './vtt-effects-primitives';
type Point = { x: number; y: number };
type Crack = { points: Point[]; width: number; seed: number };
const networks = new Map<string, Crack[]>();
export const lavaFissureCacheSize = () => networks.size;
function network(random: (i: number) => number) {
  const key = `${random(311).toFixed(5)}:${random(413).toFixed(5)}`;
  const cached = networks.get(key);
  if (cached) return cached;
  const cracks: Crack[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7 + (random(i + 35) - 0.5) * 0.56;
    let p = { x: (random(i + 12) - 0.5) * 40, y: (random(i + 19) - 0.5) * 37 };
    const points = [p];
    for (let j = 0; j < 7; j++) {
      const direction = a + (random(i * 57 + j * 19 + 91) - 0.5) * 0.9;
      p = {
        x: p.x + Math.cos(direction) * (9 + random(i + j * 21) * 9),
        y: p.y + Math.sin(direction) * (9 + random(i + j * 41) * 9),
      };
      if (Math.hypot(p.x, p.y) > 96) break;
      points.push(p);
    }
    cracks.push({ points, width: 2.5 + random(i + 49) * 2.1, seed: i });
    for (let fork = 0; fork < 2; fork++) {
      const origin = points[2 + fork * 2];
      if (!origin) continue;
      const side = random(i + fork * 23 + 411) > 0.5 ? 1 : -1;
      const branch = [origin];
      let q = origin;
      for (let j = 0; j < 4; j++) {
        const direction = a + side * (0.6 + random(i * 41 + j * 13) * 0.9);
        q = {
          x: q.x + Math.cos(direction) * (7 + random(i + j * 43) * 5),
          y: q.y + Math.sin(direction) * (7 + random(i + j * 31) * 5),
        };
        if (Math.hypot(q.x, q.y) > 99) break;
        branch.push(q);
      }
      cracks.push({ points: branch, width: 1.5 + random(i + fork * 41), seed: i * 3 + fork });
    }
  }
  if (networks.size >= 16) networks.delete(networks.keys().next().value!);
  networks.set(key, cracks);
  return cracks;
}
export function drawLavaFissures(
  c: CanvasRenderingContext2D,
  color: string,
  t: number,
  random: (i: number) => number,
) {
  c.save();
  c.lineJoin = 'bevel';
  c.lineCap = 'butt';
  for (const crack of network(random)) {
    for (let i = 1; i < crack.points.length; i++) {
      const p = crack.points[i - 1],
        q = crack.points[i],
        taper = 1 - (i / crack.points.length) * 0.83;
      const width = crack.width * taper;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(q.x, q.y);
      // Recessed dark fissure, subdued fractured crust, a narrow heated interior.
      c.strokeStyle = alpha('#30221c', 0.75);
      c.lineWidth = width + 1.8;
      c.stroke();
      c.strokeStyle = alpha('#775a3c', 0.8);
      c.lineWidth = width + 0.55;
      c.stroke();
      c.strokeStyle = alpha('#251814', 0.84);
      c.lineWidth = width;
      c.stroke();
      const heat = 0.35 + 0.11 * Math.sin(t * 0.8 + crack.seed + i * 0.72);
      const gradient = c.createLinearGradient(p.x, p.y, q.x, q.y);
      gradient.addColorStop(0, alpha(color, heat));
      gradient.addColorStop(0.43, alpha(tint(color, 0.38), heat + 0.12));
      gradient.addColorStop(1, alpha(color, heat * 0.7));
      c.strokeStyle = gradient;
      c.lineWidth = Math.max(0.18, width * 0.23);
      c.stroke();
      if (i % 2 === 0) {
        c.beginPath();
        c.moveTo(q.x - 0.8, q.y);
        c.lineTo(q.x + 1.7, q.y + 0.9);
        c.lineTo(q.x + 0.3, q.y + 2.3);
        c.closePath();
        c.fillStyle = alpha('#3b2f24', 0.72);
        c.fill();
      }
    }
  }
  c.restore();
}
