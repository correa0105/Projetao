import type { AttackVisual } from '../shared/vtt-attack-visual';
import type { Point, VttToken } from '../shared/vtt';
import { drawWeaponArt, drawProjectile, preloadWeaponArt } from './vtt-weapon-art';
void preloadWeaponArt();
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
    distance = Math.hypot(dx, dy) || 1;
  const offset = Math.min(distance * 0.2, Math.max(actor.width, actor.height) * 0.35),
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
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#f5e9bd');
  g.addColorStop(0.2, '#deedf2aa');
  g.addColorStop(1, '#b9d5e000');
  c.save();
  c.globalAlpha *= alpha;
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
function ribbon(c: CanvasRenderingContext2D, r: number, sweep: number, strength: number) {
  c.save();
  c.rotate(sweep);
  const g = c.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
  g.addColorStop(0, '#c7dce900');
  g.addColorStop(0.65, '#c7dce919');
  g.addColorStop(0.88, '#dbf1ff75');
  g.addColorStop(1, '#ecf5ff00');
  c.fillStyle = g;
  c.globalAlpha *= strength;
  c.beginPath();
  c.arc(0, 0, r, -0.85, -0.04);
  c.arc(0, 0, r * 0.63, -0.04, -0.85, true);
  c.closePath();
  c.fill();
  for (let i = 0; i < 3; i++) {
    c.strokeStyle = i === 0 ? '#f1f9ffc2' : '#b5d5e644';
    c.lineWidth = i === 0 ? 1.15 : 0.8;
    c.beginPath();
    c.arc(0, 0, r * (1 - i * 0.08), -0.72 + i * 0.12, -0.06);
    c.stroke();
  }
  c.restore();
}
function impact(c: CanvasRenderingContext2D, e: WeaponAnimation, age: number, angle: number) {
  const u = clamp(age / 410),
    heavy = e.weapon === 'mace',
    power = e.critical ? 1.3 : 1;
  c.save();
  c.translate(e.target.x, e.target.y);
  c.globalAlpha *= Math.pow(1 - u, 1.5);
  glow(c, 0, 0, e.radius * (0.45 + u * 0.6) * power, (1 - u) * 0.65);
  c.rotate(angle);
  c.strokeStyle = '#eff8ff';
  c.lineWidth = heavy ? 3 : 2;
  c.beginPath();
  if (heavy) {
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * e.radius * 0.32, Math.sin(a) * e.radius * 0.32);
    }
  } else {
    c.moveTo(-e.radius * 0.2, -e.radius * 0.35);
    c.quadraticCurveTo(0, 2, e.radius * 0.2, e.radius * 0.35);
  }
  c.stroke();
  for (let i = 0; i < (e.critical ? 14 : 9); i++) {
    const a = i * 2.399963 + Math.sin(i * 17.13) * 0.4,
      r = (5 + u * (heavy ? 45 : 33)) * power,
      tail = 7 * (1 - u) + 2;
    c.strokeStyle = i % 3 ? '#e1edf2' : '#e4bc76';
    c.lineWidth = i % 3 ? 1 : 1.9;
    c.beginPath();
    c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    c.lineTo(Math.cos(a) * (r - tail), Math.sin(a) * (r - tail));
    c.stroke();
  }
  if (heavy) {
    c.strokeStyle = '#a9c4cf66';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(0, 0, e.radius * (0.2 + u * 0.7), e.radius * (0.2 + u * 0.7), 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}
export function drawWeaponAnimation(c: CanvasRenderingContext2D, e: WeaponAnimation, now: number) {
  const age = now - e.started;
  if (age < 0 || age > weaponAnimationDuration) return false;
  const ranged = e.kind === 'arrow',
    style = e.weapon || (ranged ? 'bow' : 'sword'),
    launch = ranged ? 180 : 0,
    flight = ranged ? 650 : 500;
  const raw = clamp((age - launch) / flight),
    u = ranged ? raw : ease(raw),
    dx = e.target.x - e.source.x,
    dy = e.target.y - e.source.y,
    angle = Math.atan2(dy, dx),
    distance = Math.hypot(dx, dy),
    fade = clamp((weaponAnimationDuration - age) / 280);
  c.save();
  c.globalAlpha *= fade;
  c.lineCap = 'round';
  if (ranged && age < 360) {
    c.save();
    c.translate(e.source.x, e.source.y);
    c.rotate(angle);
    c.globalAlpha *= clamp((360 - age) / 120);
    drawWeaponArt(c, style, e.radius * 1.45);
    if (style === 'bow') {
      const pull =
        age < launch
          ? Math.sin((clamp(age / launch) * Math.PI) / 2) * 14
          : Math.max(0, 14 - (age - launch) * 0.45);
      c.strokeStyle = '#e6d8b3';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-7, -e.radius * 0.7);
      c.lineTo(-7 - pull, 0);
      c.lineTo(-7, e.radius * 0.7);
      c.stroke();
    }
    if (age < launch) {
      c.translate(-12 * clamp(age / launch), 0);
      drawProjectile(c, style === 'crossbow');
    }
    c.restore();
  }
  if (age >= launch && raw < 1) {
    const x = e.source.x + dx * u,
      y = e.source.y + dy * u;
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    if (ranged) {
      const tail = Math.min(distance * u, 110),
        g = c.createLinearGradient(-tail, 0, 0, 0);
      g.addColorStop(0, '#c0d2da00');
      g.addColorStop(0.65, '#c0d2da25');
      g.addColorStop(1, '#e5edf177');
      c.strokeStyle = g;
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-tail, 0);
      c.lineTo(-5, 0);
      c.stroke();
      c.strokeStyle = '#d9e5e822';
      c.lineWidth = 0.6;
      for (const y of [-2, 2]) {
        c.beginPath();
        c.moveTo(-tail * 0.7, y);
        c.lineTo(-16, y);
        c.stroke();
      }
      drawProjectile(c, style === 'crossbow');
    } else {
      const thrust = style === 'spear',
        heavy = style === 'mace',
        sweep = thrust ? 0 : (u - 0.5) * (heavy ? 1.25 : 2.05),
        size = e.radius * (style === 'dagger' ? 1.2 : 1.55);
      if (thrust) {
        const g = c.createLinearGradient(-size, 0, size, 0);
        g.addColorStop(0, '#c9e4ee00');
        g.addColorStop(1, '#edf8ff55');
        c.strokeStyle = g;
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-size, 0);
        c.lineTo(size * 0.8, 0);
        c.stroke();
      } else ribbon(c, size, sweep, Math.sin(Math.PI * raw));
      c.rotate(sweep);
      c.shadowColor = '#0007';
      c.shadowBlur = 3;
      c.shadowOffsetY = 2;
      drawWeaponArt(c, style, size);
      c.shadowBlur = 0;
      c.shadowOffsetY = 0;
      const glint = Math.pow(Math.max(0, 1 - Math.abs(raw - 0.45) * 9), 2);
      if (glint) glow(c, size * 0.82, -2, 6, glint * 0.8);
    }
    c.restore();
  }
  const impactAge = age - launch - flight;
  if (e.hit && impactAge >= 0 && impactAge < 410) impact(c, e, impactAge, angle);
  c.restore();
  return true;
}
