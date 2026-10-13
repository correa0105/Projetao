import { z } from 'zod';
import type { Point, VttToken } from './vtt';
const point = z
  .object({
    x: z.number().finite().min(0).max(16000),
    y: z.number().finite().min(0).max(16000),
  })
  .strict();
export const canopyAreaSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    points: z.array(point).min(3).max(128),
    opacity: z.number().min(0.1).max(0.8),
    enabled: z.boolean(),
  })
  .strict()
  .refine(
    (a) =>
      Math.abs(
        a.points.reduce((n, p, i) => {
          const q = a.points[(i + 1) % a.points.length];
          return n + p.x * q.y - q.x * p.y;
        }, 0),
      ) > 8,
    { message: 'Selecione uma área com tamanho visível.' },
  );
export type CanopyArea = z.infer<typeof canopyAreaSchema>;
export const isTreeCanopy = (t: VttToken) =>
  t.layer === 'map' && t.image.startsWith('/vtt/trees-20261013/');
export const canopyActor = (t: VttToken) => t.layer === 'tokens' && !t.hidden;
export function canopyContains(p: Point, points: Point[]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function canopyTokenSamples(t: VttToken) {
  const angle = (t.rotation * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  return Array.from({ length: 25 }, (_, i) => {
    const x = ((i % 5) / 4 - 0.5) * t.width * 0.9,
      y = (Math.floor(i / 5) / 4 - 0.5) * t.height * 0.9;
    return { x: t.x + x * c - y * s, y: t.y + x * s + y * c };
  });
}
export function canopyAreaOccupied(area: CanopyArea, actors: VttToken[]) {
  return (
    area.enabled &&
    actors.some(
      (t) =>
        canopyActor(t) &&
        (canopyTokenSamples(t).some((p) => canopyContains(p, area.points)) ||
          area.points.some((p) => {
            const a = (-t.rotation * Math.PI) / 180,
              x = p.x - t.x,
              y = p.y - t.y;
            return (
              Math.abs(x * Math.cos(a) - y * Math.sin(a)) <= t.width / 2 &&
              Math.abs(x * Math.sin(a) + y * Math.cos(a)) <= t.height / 2
            );
          }) || polygonEdgesOverlapToken(area.points, t)),
    )
  );
}

function polygonEdgesOverlapToken(points: Point[], t: VttToken) {
  const a = t.rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const corners = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => ({
    x: t.x + x*t.width/2*c - y*t.height/2*s,
    y: t.y + x*t.width/2*s + y*t.height/2*c,
  }));
  const cross = (a:Point,b:Point,p:Point) => (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
  return corners.some((a,i) => {
    const b=corners[(i+1)%4];
    return points.some((p,j) => {
      const q=points[(j+1)%points.length];
      if(Math.max(a.x,b.x)<Math.min(p.x,q.x) || Math.max(p.x,q.x)<Math.min(a.x,b.x) || Math.max(a.y,b.y)<Math.min(p.y,q.y) || Math.max(p.y,q.y)<Math.min(a.y,b.y)) return false;
      return cross(a,b,p)*cross(a,b,q)<=0 && cross(p,q,a)*cross(p,q,b)<=0;
    });
  });
}
