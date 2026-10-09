import { alpha, fract, luminousStroke, tau, tint } from './vtt-effects-primitives';
import { materialSprite } from './vtt-effects-materials';
type Random = (index: number) => number;

// Original shaded geometry. Every primitive is bounded and shares the existing
// map plane, color, scale and deterministic time; no physics or gameplay changes.
export function crystalVolume(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  angle: number,
  rock = false,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  const tip = -size,
    base = size * 0.6,
    w = size * 0.42;
  const shadow = c.createRadialGradient(0, base * 0.6, 0, 0, base * 0.6, size);
  shadow.addColorStop(0, '#06131a55');
  shadow.addColorStop(1, '#06131a00');
  c.fillStyle = shadow;
  c.fillRect(-size, -size * 0.4, size * 2, size * 2);
  const faces = [
    [0, tip, -w, -size * 0.2, -w * 0.8, base, 0, base * 0.8],
    [0, tip, 0, base * 0.8, w * 0.85, base, w, -size * 0.12],
    [-w, -size * 0.2, 0, -size * 0.45, w, -size * 0.12, 0, base * 0.8],
  ];
  for (let i = 0; i < faces.length; i++) {
    const gradient = c.createLinearGradient(-w, tip, w, base);
    gradient.addColorStop(0, alpha(tint(color, i === 0 ? 0.72 : 0.24), rock ? 0.92 : 0.85));
    gradient.addColorStop(
      0.45,
      alpha(tint(color, i === 1 ? 0.42 : 0.12, i === 1 ? '#142838' : '#ffffff'), 0.82),
    );
    gradient.addColorStop(1, alpha(tint(color, 0.55, '#193748'), rock ? 0.94 : 0.58));
    c.beginPath();
    const p = faces[i];
    c.moveTo(p[0], p[1]);
    for (let k = 2; k < p.length; k += 2) c.lineTo(p[k], p[k + 1]);
    c.closePath();
    c.fillStyle = gradient;
    c.fill();
  }
  c.beginPath();
  c.moveTo(0, tip);
  c.lineTo(0, base * 0.8);
  c.moveTo(-w, -size * 0.2);
  c.lineTo(0, -size * 0.45);
  c.lineTo(w, -size * 0.12);
  c.strokeStyle = alpha(tint(color, 0.78), 0.74);
  c.lineWidth = Math.max(0.35, size * 0.025);
  c.stroke();
  // Refraction veins / sediment grain, rather than a uniformly colored polygon.
  for (let i = 0; i < 4; i++) {
    const y0 = tip * 0.6 + i * size * 0.24;
    c.beginPath();
    c.moveTo(-w * 0.65, y0);
    c.lineTo(0, y0 + size * 0.09);
    c.lineTo(w * 0.55, y0 - size * 0.045);
    c.strokeStyle = alpha(
      tint(color, rock ? 0.6 : 0.82, rock ? '#293b42' : '#ffffff'),
      rock ? 0.3 : 0.22,
    );
    c.lineWidth = Math.max(0.22, size * 0.012);
    c.stroke();
  }
  c.restore();
}
export function energyShell(
  c: CanvasRenderingContext2D,
  color: string,
  radius: number,
  t: number,
  opacity: number,
  prism = false,
) {
  c.save();
  c.globalAlpha *= opacity;
  const rim = c.createRadialGradient(0, 0, radius * 0.66, 0, 0, radius * 1.04);
  rim.addColorStop(0, alpha(color, 0));
  rim.addColorStop(0.65, alpha(color, 0.025));
  rim.addColorStop(0.88, alpha(color, 0.2));
  rim.addColorStop(0.94, alpha(tint(color, 0.6), 0.42));
  rim.addColorStop(1, alpha(color, 0));
  c.fillStyle = rim;
  c.fillRect(-radius * 1.05, -radius * 1.05, radius * 2.1, radius * 2.1);
  c.save();
  c.beginPath();
  c.arc(0, 0, radius, 0, tau);
  c.clip();
  for (let i = 0; i < 3; i++) {
    const a = t * (i % 2 ? -0.28 : 0.2) + (i * tau) / 3;
    materialSprite(
      c,
      prism ? ['#a6e7ef', '#e5c08e', '#cda6ef'][i] : color,
      'energy',
      Math.cos(a) * radius * 0.3,
      Math.sin(a) * radius * 0.3,
      radius * 1.55,
      a,
      t * 0.55 + i,
      0.19,
    );
  }
  c.restore();
  for (let i = 0; i < 3; i++) {
    const a = t * (i % 2 ? -0.42 : 0.36) + (i * tau) / 3;
    c.beginPath();
    c.arc(
      0,
      0,
      radius * (0.96 + Math.sin(t + i) * 0.014),
      a,
      a + 1.35 + Math.sin(t * 1.7 + i) * 0.14,
    );
    luminousStroke(
      c,
      prism ? ['#a3dcff', '#f3d892', '#cea6ef'][i] : color,
      Math.max(0.6, radius * 0.012),
      0.64,
    );
  }
  c.restore();
}
export function livingVine(
  c: CanvasRenderingContext2D,
  color: string,
  length: number,
  t: number,
  seed: number,
) {
  c.save();
  const sway = Math.sin(t * 0.9 + seed) * length * 0.024;
  const stem = () => {
    c.beginPath();
    c.moveTo(length * 0.19, 0);
    c.bezierCurveTo(
      length * 0.36,
      -length * 0.23 + sway,
      length * 0.72,
      length * 0.23 + sway,
      length,
      -length * 0.08,
    );
  };
  c.translate(1, 2);
  stem();
  c.strokeStyle = '#10171070';
  c.lineWidth = length * 0.075;
  c.stroke();
  c.translate(-1, -2);
  stem();
  const gradient = c.createLinearGradient(0, -length * 0.15, 0, length * 0.12);
  gradient.addColorStop(0, tint(color, 0.3));
  gradient.addColorStop(0.4, tint(color, 0.42, '#41462b'));
  gradient.addColorStop(1, tint(color, 0.72, '#1e2919'));
  c.strokeStyle = gradient;
  c.lineWidth = length * 0.047;
  c.stroke();
  stem();
  c.strokeStyle = alpha(tint(color, 0.4), 0.7);
  c.lineWidth = length * 0.009;
  c.stroke();
  for (let i = 0; i < 7; i++) {
    const u = 0.28 + i * 0.096,
      x = length * u,
      y = Math.sin(u * tau) * length * 0.042 + sway * 0.5,
      side = i % 2 ? 1 : -1;
    c.beginPath();
    c.moveTo(x - length * 0.015, y);
    c.quadraticCurveTo(
      x - length * 0.025,
      y + length * 0.045 * side,
      x - length * 0.047,
      y + length * 0.125 * side,
    );
    c.quadraticCurveTo(x + length * 0.02, y + length * 0.042 * side, x + length * 0.035, y);
    c.closePath();
    const thorn = c.createLinearGradient(x, y, x, y + length * 0.12 * side);
    thorn.addColorStop(0, tint(color, 0.48, '#383920'));
    thorn.addColorStop(1, tint(color, 0.58));
    c.fillStyle = thorn;
    c.fill();
    c.strokeStyle = alpha(tint(color, 0.55), 0.45);
    c.lineWidth = 0.35;
    c.stroke();
  }
  c.restore();
}
export function chainLink(
  c: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  size: number,
  angle: number,
  edge: boolean,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  const minor = size * (edge ? 0.23 : 0.5);
  c.beginPath();
  c.ellipse(0.6, 1, size, minor, 0, 0, tau);
  c.strokeStyle = '#09121e88';
  c.lineWidth = size * 0.47;
  c.stroke();
  c.beginPath();
  c.ellipse(0, 0, size, minor, 0, 0, tau);
  const metal = c.createLinearGradient(0, -size, 0, size);
  metal.addColorStop(0, tint(color, 0.72));
  metal.addColorStop(0.32, tint(color, 0.12));
  metal.addColorStop(0.54, tint(color, 0.67, '#213044'));
  metal.addColorStop(0.76, tint(color, 0.34));
  metal.addColorStop(1, tint(color, 0.6, '#1a2637'));
  c.strokeStyle = metal;
  c.lineWidth = size * 0.32;
  c.stroke();
  c.beginPath();
  c.ellipse(-0.2, -size * 0.04, size * 0.89, minor * 0.87, 0, Math.PI, Math.PI * 1.82);
  c.strokeStyle = alpha(tint(color, 0.85), 0.78);
  c.lineWidth = Math.max(0.3, size * 0.055);
  c.stroke();
  c.restore();
}
export function volumeMotes(
  c: CanvasRenderingContext2D,
  color: string,
  r: number,
  t: number,
  random: Random,
  count: number,
  opacity: number,
) {
  c.save();
  const inherited = c.globalAlpha;
  for (let i = 0; i < count; i++) {
    const life = fract(t * (0.25 + random(i + 170) * 0.18) + random(i + 120)),
      a = random(i + 220) * tau + t * 0.08;
    const distance = r * (0.55 + life * 0.63),
      x = Math.cos(a) * distance,
      y = Math.sin(a) * distance;
    const s = ((0.4 + random(i + 310) * 1.2) * r) / 80;
    c.globalAlpha = inherited * opacity * Math.sin(life * Math.PI);
    c.fillStyle = tint(color, 0.72);
    c.beginPath();
    c.ellipse(x, y, s, s * 0.58, a, 0, tau);
    c.fill();
  }
  c.restore();
}
