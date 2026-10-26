import { z } from 'zod';
import type { VttToken } from './vtt.js';
import type { VehicleId } from './vtt-vehicles.js';

export const vehicleMotionSchema = z
  .object({
    sail: z.enum(['furled', 'inflated']).default('furled'),
    sailsAnimated: z.boolean().default(false),
    oarsAnimated: z.boolean().default(false),
    sailAngle: z.number().finite().min(-180).max(180).default(0),
    speed: z.number().finite().min(0.25).max(2).default(1),
  })
  .strict();
export type VehicleMotion = z.infer<typeof vehicleMotionSchema>;
export const oceanSchema = z
  .object({
    enabled: z.boolean().default(true),
    animated: z.boolean().default(true),
    speed: z.number().finite().min(0.25).max(2).default(1),
    seaVolume: z.number().finite().min(0).max(1).default(0),
    windVolume: z.number().finite().min(0).max(1).default(0),
  })
  .strict();
export type Ocean = z.infer<typeof oceanSchema>;
export type OceanMotionPreference = 'system' | 'on' | 'off';
export function oceanAnimationEnabled(
  ocean: Ocean | undefined,
  mapEffects: boolean,
  preference: OceanMotionPreference = 'system',
  reduced = false,
) {
  return !!(
    ocean?.enabled &&
    ocean.animated &&
    mapEffects &&
    preference !== 'off' &&
    (!reduced || preference === 'on')
  );
}
export const oceanImage = '/vtt/terrain-water-20261013/water.webp';
export const navalAtlas = (id: VehicleId) =>
  '/vtt/naval-20261026/' + (id === 'longship' ? 'striped' : 'ivory') + '-rig-v4.png';
export const rowingImage = '/vtt/naval-20261026/rowboat-oar-v3.png';
export const sailMasts: Partial<Record<VehicleId, number[]>> = {
  galley: [0.435],
  keelboat: [0.445],
  longship: [0.51],
  'sailing-ship': [0.23865, 0.49405, 0.74945],
  warship: [0.37268, 0.75449],
};
// Hull silhouette and rowing stations, in normalized coordinates of the BASE
// sprite. Old source pixels are retained; the outboard strips become hinged oars.
export const rowing: Partial<
  Record<
    VehicleId,
    { left: number; right: number; first: number; last: number; count: number; sample: number }
  >
> = {
  galley: { left: 0.285, right: 0.727, first: 0.24, last: 0.725, count: 17, sample: 0.42 },
  longship: { left: 0.275, right: 0.73, first: 0.334, last: 0.709, count: 10, sample: 0.47 },
  rowboat: { left: 0.18, right: 0.83, first: 0.49, last: 0.49, count: 1, sample: 0.49 },
};
export function navalMotion(t: Pick<VttToken, 'vehicleMotion'>): VehicleMotion {
  return (
    t.vehicleMotion ?? {
      sail: 'furled',
      sailsAnimated: false,
      oarsAnimated: false,
      sailAngle: 0,
      speed: 1,
    }
  );
}
export function navalAnimated(t: VttToken) {
  if (!t.vehicle) return false;
  const m = navalMotion(t),
    id = t.vehicle.itemId;
  return !!(
    (rowing[id] && m.oarsAnimated) ||
    (sailMasts[id] && m.sail === 'inflated' && m.sailsAnimated)
  );
}
export function rowingPose(seconds: number, speed: number, side: number) {
  const phase = seconds * speed * Math.PI * 0.9;
  return { angle: Math.sin(phase) * 0.28 * side, lift: 1 - Math.max(0, Math.cos(phase)) * 0.13 };
}
