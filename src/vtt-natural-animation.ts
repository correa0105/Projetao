import { isNaturalStyle } from '../shared/vtt-attack-visual';
import type { WeaponAnimation } from './vtt-weapon-animation';
import { drawNaturalArt } from './vtt-natural-art';
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const u = clamp(x);
  return u * u * (3 - 2 * u);
};

function motes(c: CanvasRenderingContext2D, e: WeaponAnimation, u: number, cold = false) {
  c.save();
  c.globalAlpha *= Math.pow(1 - u, 1.6);
  c.lineCap = 'round';
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996,
      r = e.radius * (0.15 + u * (0.5 + (i % 4) * 0.2)),
      x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    c.strokeStyle = cold ? (i % 3 ? '#9fced6' : '#c0a3d4') : i % 3 ? '#c6b899' : '#e5dabd';
    c.lineWidth = 0.6 + (i % 3) * 0.3;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - Math.cos(a) * (2 + 4 * (1 - u)), y - Math.sin(a) * (2 + 4 * (1 - u)));
    c.stroke();
  }
  c.restore();
}
export function drawNaturalAnimation(c: CanvasRenderingContext2D, e: WeaponAnimation, age: number) {
  if (!isNaturalStyle(e.weapon)) return false;
  const style = e.weapon,
    r = e.radius * (e.critical ? 1.2 : 1),
    dx = e.target.x - e.source.x,
    dy = e.target.y - e.source.y;
  const angle = Math.atan2(dy, dx),
    u = smooth((age - 70) / 470),
    impact = clamp((age - 520) / 500);
  const fade = smooth(age / 130) * (1 - smooth((age - 820) / 420));
  c.save();
  c.globalAlpha *= fade;
  c.translate(e.target.x, e.target.y);
  c.rotate(angle);
  c.lineCap = 'round';
  // Natural attacks stay near the target; their windup follows the source direction.
  c.shadowColor = '#080d10b0';
  c.shadowBlur = 3;
  c.shadowOffsetY = 2;
  if (style === 'bite' || style === 'pincer') {
    const gape = r * (0.68 * (1 - u) + 0.045 + smooth((age - 650) / 330) * 0.36);
    c.save();
    c.rotate(-Math.PI / 2);
    c.scale(1.1, 1.1);
    for (const side of [-1, 1]) {
      c.save();
      c.translate(0, side * gape);
      if (side === 1) c.scale(0.88, -0.88);
      drawNaturalArt(c, style, r * 0.78);
      c.restore();
    }
    c.restore();
  } else if (style === 'claw') {
    c.save();
    c.translate((1 - u) * -r * 0.6, (1 - u) * -r * 0.7);
    c.rotate(-0.8 + u * 1.45);
    c.globalAlpha *= 1 - smooth((age - 660) / 260);
    drawNaturalArt(c, style, r * 0.95);
    c.restore();
    const progress = clamp((age - 240) / 300);
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * r * 0.28;
      c.save();
      c.globalAlpha *= smooth(progress) * (1 - impact * 0.85);
      const g = c.createLinearGradient(-r * 0.7, y, r * 0.65, y + r * 0.6);
      g.addColorStop(0, '#ece5c900');
      g.addColorStop(0.2, '#e6dfc199');
      g.addColorStop(0.55, '#faf1d8');
      g.addColorStop(1, '#8babb900');
      c.strokeStyle = g;
      c.lineWidth = 2.1 * (1 - impact) + 0.4;
      c.beginPath();
      c.moveTo(-r * 0.7, y - r * 0.2);
      c.quadraticCurveTo(0, y + r * 0.1, r * (progress * 1.4 - 0.7), y + r * 0.55 * progress);
      c.stroke();
      c.restore();
    }
  } else if (style === 'tail' || style === 'tentacle') {
    c.save();
    c.translate(-r * 0.1, 0);
    c.rotate(-1.15 + u * 1.65);
    c.scale(1, 0.75 + Math.sin(u * Math.PI) * 0.25);
    drawNaturalArt(c, style, r);
    c.restore();
    c.save();
    c.globalAlpha *= Math.sin(u * Math.PI) * 0.4;
    c.strokeStyle = '#c8d2b955';
    c.lineWidth = r * 0.16;
    c.beginPath();
    c.arc(-r * 0.35, 0, r * 0.95, -1.5, -1.5 + u * 2);
    c.stroke();
    c.restore();
  } else if (style === 'touch' || style === 'burst') {
    if (style === 'touch') {
      c.save();
      c.translate(-r * 0.35 * (1 - u), 0);
      c.rotate(Math.PI / 2);
      drawNaturalArt(c, style, r * 0.8);
      c.restore();
    } else {
      c.translate(-Math.min(Math.hypot(dx, dy), r * 7) * (1 - u), 0);
    }
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.9);
    g.addColorStop(0, '#c2dddf9c');
    g.addColorStop(0.24, '#7d9aaf7d');
    g.addColorStop(0.6, '#71678c3d');
    g.addColorStop(1, '#526a8400');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 4; i++) {
      c.strokeStyle = `rgba(162,192,200,${0.22 * (1 - impact)})`;
      c.lineWidth = 0.6 + i * 0.25;
      c.beginPath();
      c.ellipse(0, 0, r * (0.3 + i * 0.12), r * (0.12 + i * 0.05), age / 500 + i, 0, Math.PI * 1.7);
      c.stroke();
    }
  } else {
    c.save();
    c.translate(-r * 0.7 * (1 - u), 0);
    c.rotate(
      style === 'wing' ? -0.9 + u * 1.2 : style === 'beak' ? -0.12 : style === 'hoof' ? -0.4 : 0,
    );
    drawNaturalArt(c, style, r * (style === 'wing' ? 1 : 0.8));
    c.restore();
  }
  c.shadowBlur = 0;
  c.shadowOffsetY = 0;
  if (age >= 520 && e.hit) {
    const cold = style === 'touch' || style === 'burst';
    motes(c, e, impact, cold);
    const flash = c.createRadialGradient(0, 0, 0, 0, 0, r * (0.15 + impact * 0.7));
    flash.addColorStop(0, cold ? '#d0e8eb80' : '#e2d9be66');
    flash.addColorStop(1, '#e3dfc000');
    c.save();
    c.globalAlpha *= Math.pow(1 - impact, 2);
    c.fillStyle = flash;
    c.beginPath();
    c.arc(0, 0, r * (0.15 + impact * 0.7), 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  c.restore();
  return true;
}
