import { techniquePose, type ToolPose } from './profession-motion';
import type { WorkPoint, professionSurface } from './profession-work-surfaces';
export const professionRecoveryMs = 800;
export function easedProgress(t: number) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}
// A ferramenta termina a passada, se afasta do material e retorna sem riscar a peça no ar.
export function professionCyclePose(
  id: string,
  time: number,
  duration: number,
  anchor: WorkPoint,
  surface: ReturnType<typeof professionSurface>,
  step: number,
): ToolPose {
  if (time <= duration)
    return techniquePose(
      id,
      id === 'hammer' ? time / duration : easedProgress(time / duration),
      anchor,
      surface,
      step,
    );
  const end = techniquePose(id, 1, anchor, surface, step),
    next = techniquePose(id, 0, anchor, surface, step + 1),
    u = Math.max(0, Math.min(1, (time - duration) / professionRecoveryMs)),
    k = easedProgress(u),
    travel = Math.hypot(next.x - end.x, next.y - end.y);
  const lift =
    surface.liquid || ['hammer', 'gear', 'pick', 'glass', 'facet', 'pluck'].includes(id)
      ? 0
      : Math.min(22, 8 + travel * 0.08) * Math.sin(Math.PI * u);
  return {
    x: end.x + (next.x - end.x) * k,
    y: end.y + (next.y - end.y) * k,
    tilt: end.tilt + (next.tilt - end.tilt) * k,
    lift: end.lift + (next.lift - end.lift) * k - lift,
    rotation: end.rotation,
  };
}

export const professionApproachMs = 420;
export function professionApproachPose(
  id: string,
  progress: number,
  anchor: WorkPoint,
  surface: ReturnType<typeof professionSurface>,
): ToolPose {
  const to = techniquePose(id, 0, anchor, surface, 0),
    k = easedProgress(progress),
    rest = id === 'dose' ? -32 : id === 'mash' ? 6 : 0;
  return {
    x: anchor.x + (to.x - anchor.x) * k,
    y: anchor.y + (to.y - anchor.y) * k,
    tilt: to.tilt * k,
    lift: rest + (to.lift - rest) * k - Math.sin(Math.PI * progress) * (surface.liquid ? 6 : 14),
    rotation: 0,
  };
}
