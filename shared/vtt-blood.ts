import { z } from 'zod';
import type { Point, VttScene, VttToken } from './vtt.js';

export const MAX_BLOOD_DECALS = 800;
export const bloodStateSchema = z
  .object({
    serial: z.number().int().min(0).max(1000000000),
    distance: z.number().finite().min(0).max(500000),
    wounds: z
      .array(
        z
          .object({
            seed: z.number().int().min(0).max(2147483647),
            strength: z.number().finite().min(0).max(1),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();
export const bloodDecalSchema = z
  .object({
    id: z.string().uuid(),
    source: z.string().uuid(),
    x: z.number().finite().min(0).max(16000),
    y: z.number().finite().min(0).max(16000),
    size: z.number().finite().min(1).max(1000),
    angle: z
      .number()
      .finite()
      .min(-Math.PI * 2)
      .max(Math.PI * 2),
    seed: z.number().int().min(0).max(2147483647),
    kind: z.enum(['drop', 'splash', 'trail']),
    private: z.boolean(),
    at: z.number().int().min(0).max(9999999999999),
  })
  .strict();
export type BloodDecal = z.infer<typeof bloodDecalSchema>;
export type BloodState = z.infer<typeof bloodStateSchema>;
export const injury = (t: Pick<VttToken, 'hp' | 'maxHp'>) =>
  Math.max(0, Math.min(1, 1 - Math.max(0, t.hp) / Math.max(1, t.maxHp)));
// Bloodied is a threshold, not ongoing damage or a saving throw condition.
export const isBloodied = (t: Pick<VttToken, 'hp' | 'maxHp'>) => t.hp * 2 <= t.maxHp;

function seedFor(id: string, serial: number) {
  let seed = serial;
  for (const char of id) seed = (Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0) & 2147483647;
  return seed;
}
function append(
  scene: VttScene,
  token: VttToken,
  kind: BloodDecal['kind'],
  at: number,
  x: number,
  y: number,
  size: number,
  angle = 0,
) {
  const blood = token.blood!;
  blood.serial = (blood.serial + 1) % 1000000000;
  scene.blood.push({
    id: crypto.randomUUID(),
    source: token.id,
    x: Math.max(0, Math.min(scene.width, x)),
    y: Math.max(0, Math.min(scene.height, y)),
    size: Math.max(1, Math.min(1000, size)),
    angle,
    seed: seedFor(token.id, blood.serial),
    kind,
    at,
    private: token.hidden || token.layer === 'gm',
  });
  if (scene.blood.length > MAX_BLOOD_DECALS)
    scene.blood.splice(0, scene.blood.length - MAX_BLOOD_DECALS);
}
/** Server-only mutation, called under the same room lock as HP/movement. */
export function applyTokenBlood(
  scene: VttScene,
  token: VttToken,
  old: VttToken,
  path: Point[] = [{ x: token.x, y: token.y }],
  at = Date.now(),
  enabled = true,
) {
  if (!enabled || token.layer === 'map') {
    token.blood = null;
    return;
  }
  // Ignore client-authored scars. Replays and reloads cannot duplicate droplets.
  token.blood = old.blood ? structuredClone(old.blood) : { serial: 0, distance: 0, wounds: [] };
  const blood = token.blood,
    before = injury(old),
    after = injury(token);
  if (!blood.wounds.length && before > 0)
    blood.wounds.push({ seed: seedFor(token.id, 0), strength: before });
  if (after < before) {
    for (const wound of blood.wounds) wound.strength *= after / before;
    blood.wounds = blood.wounds.filter((w) => w.strength > 0.000001);
  } else if (after > before) {
    blood.serial = (blood.serial + 1) % 1000000000;
    blood.wounds.push({ seed: seedFor(token.id, blood.serial), strength: after - before });
    if (blood.wounds.length > 12) {
      const first = blood.wounds.shift()!;
      blood.wounds[0].strength = Math.min(1, blood.wounds[0].strength + first.strength);
    }
    if (token.hp < old.hp)
      append(
        scene,
        token,
        'splash',
        at,
        token.x,
        token.y,
        Math.min(scene.grid.size, token.width, token.height) *
          (0.06 + Math.min(0.3, after - before) * 0.14),
      );
  }
  if (after <= 0) {
    blood.wounds = [];
    blood.distance = 0;
    return;
  }
  // Only hits spill blood. Movement never paints a track.
  blood.distance = 0;
}
