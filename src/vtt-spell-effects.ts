import { drawCinematicSpellEffects } from './vtt-spell-cinematic';
import { type VttScene, type VttToken } from '../shared/vtt';
import {
  pixelsPerFoot,
  spellCells,
  spellOrigin,
  type SpellEffect,
  type SpellProfile,
  type SpellPlacement,
} from '../shared/vtt-spells';
import { alpha, tau } from './vtt-effects-primitives';
export type SpellPreview = {
  profile: SpellProfile;
  actorId: string;
  targets: string[];
  points: SpellPlacement[];
};
type View = { left: number; top: number; right: number; bottom: number };
function line(c: CanvasRenderingContext2D, points: number[], close = false) {
  c.beginPath();
  for (let i = 0; i < points.length; i += 2)
    i ? c.lineTo(points[i], points[i + 1]) : c.moveTo(points[i], points[i + 1]);
  if (close) c.closePath();
}
export function spellPath(
  c: CanvasRenderingContext2D,
  p: SpellProfile,
  at: SpellPlacement,
  f: number,
) {
  const s = p.size * f,
    w = Math.max(1, p.width * f);
  c.beginPath();
  if (p.shape === 'sphere' || p.shape === 'ring') {
    c.arc(at.x, at.y, s, 0, tau);
    if (p.shape === 'ring') c.arc(at.x, at.y, Math.max(0, s - w), 0, tau, true);
    return;
  }
  const coords =
    p.shape === 'cone'
      ? [0, 0, s, -s / 2, s, s / 2]
      : p.shape === 'line'
        ? [0, -w / 2, s, -w / 2, s, w / 2, 0, w / 2]
        : p.shape === 'wall'
          ? [-s / 2, -w / 2, s / 2, -w / 2, s / 2, w / 2, -s / 2, w / 2]
          : p.origin === 'caster-face'
            ? [0, -s / 2, s, -s / 2, s, s / 2, 0, s / 2]
            : [-s / 2, -s / 2, s / 2, -s / 2, s / 2, s / 2, -s / 2, s / 2];
  const a = Math.cos(at.angle),
    b = Math.sin(at.angle);
  for (let i = 0; i < coords.length; i += 2) {
    const x = at.x + coords[i] * a - coords[i + 1] * b,
      y = at.y + coords[i] * b + coords[i + 1] * a;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.closePath();
}
export function drawSpellEffects(
  c: CanvasRenderingContext2D,
  scene: VttScene,
  effects: SpellEffect[],
  pass: 'behind' | 'front',
  view: View,
  now = Date.now(),
  reduced = false,
  images = new Map<string, HTMLImageElement>(),
) {
  drawCinematicSpellEffects(c, scene, effects, pass, view, spellPath, now, reduced, images);
}
export function drawSpellPreview(
  c: CanvasRenderingContext2D,
  scene: VttScene,
  preview: SpellPreview,
  view: View,
  zoom: number,
) {
  const actor = scene.tokens.find((t) => t.id === preview.actorId);
  if (!actor) return;
  const p = preview.profile,
    f = pixelsPerFoot(scene.grid);
  c.save();
  c.lineWidth = 1.5 / zoom;
  c.strokeStyle = '#d9cba0';
  c.setLineDash([5 / zoom, 5 / zoom]);
  c.beginPath();
  c.arc(actor.x, actor.y, p.range * f, 0, tau);
  c.stroke();
  c.setLineDash([]);
  const points = p.mode === 'self' ? [{ x: actor.x, y: actor.y, angle: 0 }] : preview.points;
  for (const at of points) {
    for (const cell of spellCells(p, at, scene, view)) {
      c.fillStyle = alpha(p.visual.color, 0.17);
      c.fillRect(cell.x + 1, cell.y + 1, scene.grid.size - 2, scene.grid.size - 2);
      c.strokeStyle = alpha(p.visual.light, 0.4);
      c.lineWidth = 0.8 / zoom;
      c.strokeRect(cell.x + 1, cell.y + 1, scene.grid.size - 2, scene.grid.size - 2);
    }
    spellPath(c, p, at, f);
    c.strokeStyle = p.visual.light;
    c.lineWidth = 2 / zoom;
    c.stroke();
  }
  for (const id of new Set(preview.targets)) {
    const t = scene.tokens.find((t) => t.id === id);
    if (!t) continue;
    c.strokeStyle = '#b5dfb8';
    c.lineWidth = 2.5 / zoom;
    c.strokeRect(
      t.x - t.width / 2 - 5 / zoom,
      t.y - t.height / 2 - 5 / zoom,
      t.width + 10 / zoom,
      t.height + 10 / zoom,
    );
    const n = preview.targets.filter((a) => a === id).length;
    c.fillStyle = '#d9efc5';
    c.font = 'bold ' + 14 / zoom + 'px Inter,sans-serif';
    c.textAlign = 'center';
    c.fillText(n > 1 ? '×' + n : '✓', t.x, t.y - t.height / 2 - 12 / zoom);
  }
  c.restore();
}
