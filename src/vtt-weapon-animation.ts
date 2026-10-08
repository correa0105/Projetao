import type { AttackVisual } from '../shared/vtt-attack-visual';
import type { Point, VttToken } from '../shared/vtt';
export type WeaponAnimation = AttackVisual & {
  id: string;
  started: number;
  source: Point;
  target: Point;
  radius: number;
};
export const weaponAnimationDuration = 1300;
export function weaponAnimation(
  event: AttackVisual,
  actor: VttToken,
  target: VttToken,
  id: string,
  started: number,
): WeaponAnimation {
  const dx = target.x - actor.x,
    dy = target.y - actor.y,
    distance = Math.hypot(dx, dy) || 1,
    offset = Math.min(distance * 0.2, Math.max(actor.width, actor.height) * 0.35),
    miss = event.hit ? 0 : Math.max(target.width, target.height) * 0.7;
  return {
    ...event,
    id,
    started,
    source: { x: actor.x + (dx / distance) * offset, y: actor.y + (dy / distance) * offset },
    target: { x: target.x - (dy / distance) * miss, y: target.y + (dx / distance) * miss },
    radius: Math.max(18, Math.min(48, Math.max(target.width, target.height) * 0.4)),
  };
}
function arrow(c: CanvasRenderingContext2D, length: number) {
  c.strokeStyle = '#a87941';
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(-length, 0);
  c.lineTo(-4, 0);
  c.stroke();
  c.fillStyle = '#cbd7d9';
  c.beginPath();
  c.moveTo(7, 0);
  c.lineTo(-6, -4);
  c.lineTo(-3, 0);
  c.lineTo(-6, 4);
  c.closePath();
  c.fill();
  c.fillStyle = '#f1e6c7';
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(-length, 0);
    c.lineTo(-length - 3, side * 5);
    c.lineTo(-length + 8, side * 3);
    c.lineTo(-length + 12, 0);
    c.closePath();
    c.fill();
  }
}
function sword(c: CanvasRenderingContext2D, length: number) {
  const g = c.createLinearGradient(0, -6, 0, 6);
  g.addColorStop(0, '#405974');
  g.addColorStop(0.48, '#e9f4fa');
  g.addColorStop(0.53, '#b1c7da');
  g.addColorStop(1, '#537189');
  c.fillStyle = g;
  c.strokeStyle = '#f0f5f8';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(0, -5);
  c.lineTo(length - 9, -4);
  c.lineTo(length, 0);
  c.lineTo(length - 9, 4);
  c.lineTo(0, 5);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#d4b16c';
  c.fillRect(-4, -12, 5, 24);
  c.fillStyle = '#694632';
  c.fillRect(-19, -3, 15, 6);
  c.strokeStyle = '#b59562';
  c.lineWidth = 1;
  for (let x = -17; x < -4; x += 3) {
    c.beginPath();
    c.moveTo(x, -3);
    c.lineTo(x + 2, 3);
    c.stroke();
  }
  c.fillStyle = '#d4b16c';
  c.beginPath();
  c.arc(-21, 0, 4, 0, Math.PI * 2);
  c.fill();
}
export function drawWeaponAnimation(
  c: CanvasRenderingContext2D,
  event: WeaponAnimation,
  now: number,
) {
  const age = now - event.started;
  if (age < 0 || age > weaponAnimationDuration) return false;
  const launch = event.kind === 'arrow' ? 180 : 0,
    flight = event.kind === 'arrow' ? 650 : 500,
    u = Math.max(0, Math.min(1, (age - launch) / flight)),
    dx = event.target.x - event.source.x,
    dy = event.target.y - event.source.y,
    angle = Math.atan2(dy, dx),
    length = Math.hypot(dx, dy),
    fade = Math.min(1, (weaponAnimationDuration - age) / 300);
  c.save();
  c.globalAlpha *= fade;
  c.lineCap = 'round';
  if (event.kind === 'arrow' && age < 350) {
    c.save();
    c.translate(event.source.x, event.source.y);
    c.rotate(angle);
    c.strokeStyle = '#b28245';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-3, -22);
    c.quadraticCurveTo(22, 0, -3, 22);
    c.stroke();
    c.strokeStyle = '#e5d7b3';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-3, -22);
    c.lineTo(age < launch ? -13 : -3, 0);
    c.lineTo(-3, 22);
    c.stroke();
    c.restore();
  }
  if (age >= launch) {
    const x = event.source.x + dx * u,
      y = event.source.y + dy * u;
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    if (event.kind === 'arrow') {
      if (u < 1) {
        const trail = c.createLinearGradient(-Math.min(length * u, 90), 0, 0, 0);
        trail.addColorStop(0, '#d7e6ed00');
        trail.addColorStop(1, '#d7e6edaa');
        c.strokeStyle = trail;
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-Math.min(length * u, 90), 0);
        c.lineTo(-7, 0);
        c.stroke();
      }
      arrow(c, 30);
    } else if (u < 1) {
      const sweep = (u - 0.5) * 1.7,
        blade = event.radius * 1.25;
      c.rotate(sweep);
      const trail = c.createRadialGradient(0, 0, 4, 0, 0, blade);
      trail.addColorStop(0, '#d8edff00');
      trail.addColorStop(1, '#c5e8ff99');
      c.fillStyle = trail;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, blade, -0.8, 0);
      c.closePath();
      c.fill();
      sword(c, blade);
    }
    c.restore();
  }
  const impact = age - launch - flight;
  if (event.hit && impact >= 0 && impact < 320) {
    c.save();
    c.translate(event.target.x, event.target.y);
    c.globalAlpha *= 1 - impact / 320;
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9,
        r = 4 + impact * 0.05,
        end = r + 12 * (1 - impact / 320);
      c.strokeStyle = i % 2 ? '#f5dfa0' : '#deedf8';
      c.lineWidth = i % 3 ? 1.4 : 2.8;
      c.beginPath();
      c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      c.lineTo(Math.cos(a) * end, Math.sin(a) * end);
      c.stroke();
    }
    c.restore();
  }
  c.restore();
  return true;
}
