import type { WeaponStyle } from '../shared/vtt-attack-visual';
const sprites = new Map<WeaponStyle, HTMLCanvasElement>();
const images = new Map<WeaponStyle, HTMLImageElement>();
const requested = new Set<WeaponStyle>();
export function preloadWeaponArt() {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all(
    ['sword', 'axe', 'mace', 'spear', 'dagger', 'bow', 'crossbow'].map(
      (style) =>
        new Promise<void>((resolve) => {
          const key = style as WeaponStyle;
          if (images.has(key)) {
            resolve();
            return;
          }
          const img = new Image();
          requested.add(key);
          img.onload = () => {
            images.set(key, img);
            sprites.delete(key);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = '/vtt/attack-weapons-v2/' + style + '.webp';
        }),
    ),
  );
}
function metal(c: CanvasRenderingContext2D, low = -10, high = 10) {
  const g = c.createLinearGradient(0, low, 0, high);
  g.addColorStop(0, '#283643');
  g.addColorStop(0.22, '#81959e');
  g.addColorStop(0.46, '#eff6f5');
  g.addColorStop(0.5, '#a3b8c3');
  g.addColorStop(0.65, '#536877');
  g.addColorStop(1, '#233242');
  return g;
}
function outline(c: CanvasRenderingContext2D) {
  c.fill();
  c.strokeStyle = '#172027';
  c.lineWidth = 1;
  c.stroke();
}
function haft(c: CanvasRenderingContext2D, x: number, end: number, width = 5) {
  const wood = c.createLinearGradient(0, -width, 0, width);
  wood.addColorStop(0, '#372619');
  wood.addColorStop(0.35, '#9e7047');
  wood.addColorStop(1, '#392319');
  c.fillStyle = wood;
  c.fillRect(x, -width / 2, end - x, width);
  c.strokeStyle = '#c0935855';
  c.lineWidth = 0.5;
  for (let y = -width / 2 + 1; y < width / 2; y += 1.6) {
    c.beginPath();
    c.moveTo(x + 1, y);
    c.lineTo(end - 1, y + 0.3);
    c.stroke();
  }
}
function grip(c: CanvasRenderingContext2D, x = -23, end = -4) {
  haft(c, x, end, 7);
  c.strokeStyle = '#201813';
  c.lineWidth = 1.4;
  for (let n = x + 1; n < end; n += 3) {
    c.beginPath();
    c.moveTo(n, -3.5);
    c.lineTo(n + 2, 3.5);
    c.stroke();
  }
  c.strokeStyle = '#c59966';
  c.lineWidth = 0.5;
  for (let n = x + 1; n < end; n += 3) {
    c.beginPath();
    c.moveTo(n, -3);
    c.lineTo(n + 2, 3);
    c.stroke();
  }
}
function blade(c: CanvasRenderingContext2D, length: number, width: number) {
  c.fillStyle = metal(c, -width, width);
  c.beginPath();
  c.moveTo(0, -width);
  c.lineTo(length - 13, -width * 0.65);
  c.lineTo(length, 0);
  c.lineTo(length - 13, width * 0.65);
  c.lineTo(0, width);
  c.closePath();
  outline(c);
  c.fillStyle = '#edf5f7aa';
  c.beginPath();
  c.moveTo(2, -width + 1);
  c.lineTo(length - 13, -width * 0.65 + 0.6);
  c.lineTo(length, 0);
  c.lineTo(length - 12, -width * 0.35);
  c.lineTo(2, -width * 0.55);
  c.closePath();
  c.fill();
  c.strokeStyle = '#243543aa';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(8, 0);
  c.lineTo(length - 17, 0);
  c.stroke();
  c.strokeStyle = '#d5e5e966';
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(10, 0.8);
  c.lineTo(length - 17, 0.8);
  c.stroke();
}
function art(c: CanvasRenderingContext2D, style: WeaponStyle) {
  c.lineJoin = 'round';
  if (style === 'bow') {
    const wood = c.createLinearGradient(-5, 0, 21, 0);
    wood.addColorStop(0, '#24170f');
    wood.addColorStop(0.45, '#b88b53');
    wood.addColorStop(0.75, '#79522f');
    wood.addColorStop(1, '#2c1b13');
    c.fillStyle = wood;
    c.beginPath();
    c.moveTo(-7, -37);
    c.bezierCurveTo(20, -31, 25, -15, 18, 0);
    c.bezierCurveTo(25, 15, 20, 31, -7, 37);
    c.lineTo(-5, 32);
    c.bezierCurveTo(15, 24, 17, 12, 13, 0);
    c.bezierCurveTo(17, -12, 15, -24, -5, -32);
    c.closePath();
    outline(c);
    c.strokeStyle = '#ead1a477';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-4, -33);
    c.quadraticCurveTo(25, -20, 15, 0);
    c.quadraticCurveTo(25, 20, -4, 33);
    c.stroke();
    c.fillStyle = '#493323';
    c.fillRect(11, -6, 7, 12);
    return;
  }
  if (style === 'crossbow') {
    haft(c, -31, 30, 9);
    c.fillStyle = metal(c, -8, 8);
    c.fillRect(2, -7, 16, 14);
    c.fillStyle = '#735235';
    c.beginPath();
    c.moveTo(-5, -32);
    c.quadraticCurveTo(27, -15, 19, 0);
    c.quadraticCurveTo(27, 15, -5, 32);
    c.lineTo(-5, 27);
    c.quadraticCurveTo(19, 12, 13, 0);
    c.quadraticCurveTo(19, -12, -5, -27);
    c.closePath();
    outline(c);
    c.strokeStyle = '#d7c3a4';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(-5, -30);
    c.lineTo(-15, 0);
    c.lineTo(-5, 30);
    c.stroke();
    c.fillStyle = '#384750';
    c.fillRect(-5, -2, 34, 4);
    c.fillStyle = '#cab687';
    c.fillRect(-23, -3, 13, 6);
    return;
  }
  if (style === 'axe') {
    haft(c, -24, 58, 6);
    grip(c, -23, -3);
    c.fillStyle = metal(c, -23, 23);
    c.beginPath();
    c.moveTo(44, -9);
    c.quadraticCurveTo(61, -8, 70, -22);
    c.quadraticCurveTo(87, 1, 70, 25);
    c.quadraticCurveTo(64, 10, 44, 8);
    c.closePath();
    outline(c);
    c.strokeStyle = '#eff9fc';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(70, -21);
    c.quadraticCurveTo(85, 1, 70, 24);
    c.stroke();
    c.fillStyle = '#465865';
    c.fillRect(43, -10, 8, 21);
    c.strokeStyle = '#c8d6da';
    c.lineWidth = 0.7;
    c.strokeRect(44, -9, 6, 19);
    return;
  }
  if (style === 'mace') {
    haft(c, -24, 55, 6);
    grip(c, -24, -3);
    c.fillStyle = metal(c, -20, 20);
    c.beginPath();
    c.ellipse(62, 0, 14, 17, 0, 0, Math.PI * 2);
    outline(c);
    for (const y of [-14, -7, 0, 7, 14]) {
      c.fillStyle = metal(c, y - 3, y + 3);
      c.beginPath();
      c.moveTo(52, y);
      c.lineTo(63, y * 1.35);
      c.lineTo(77, y * 0.7);
      c.lineTo(68, y + 3);
      c.closePath();
      outline(c);
    }
    c.strokeStyle = '#e6f0f3';
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(64, -17);
    c.lineTo(68, 16);
    c.stroke();
    return;
  }
  if (style === 'spear') {
    haft(c, -27, 46, 5);
    grip(c, -22, -7);
    c.fillStyle = metal(c, -8, 8);
    c.beginPath();
    c.moveTo(43, -3);
    c.quadraticCurveTo(57, -12, 80, 0);
    c.quadraticCurveTo(57, 12, 43, 3);
    c.closePath();
    outline(c);
    c.strokeStyle = '#eff5f8';
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(45, -2);
    c.lineTo(80, 0);
    c.stroke();
    c.fillStyle = '#556a79';
    c.fillRect(38, -3, 9, 6);
    return;
  }
  const dagger = style === 'dagger';
  blade(c, dagger ? 49 : 76, dagger ? 5 : 6.5);
  const bronze = c.createLinearGradient(-5, -11, 0, 11);
  bronze.addColorStop(0, '#6b5130');
  bronze.addColorStop(0.4, '#e2c487');
  bronze.addColorStop(1, '#6c4c29');
  c.fillStyle = bronze;
  c.beginPath();
  c.moveTo(-5, -12);
  c.quadraticCurveTo(0, -7, 0, -3);
  c.lineTo(0, 3);
  c.quadraticCurveTo(0, 7, -5, 12);
  c.lineTo(-8, 11);
  c.quadraticCurveTo(-5, 5, -5, -5);
  c.lineTo(-8, -11);
  c.closePath();
  outline(c);
  grip(c, -24, -6);
  c.fillStyle = bronze;
  c.beginPath();
  c.ellipse(-27, 0, 4.8, 4.2, 0, 0, Math.PI * 2);
  outline(c);
  c.fillStyle = '#ffe4a455';
  c.beginPath();
  c.ellipse(-28, -1, 2, 1.5, 0, 0, Math.PI * 2);
  c.fill();
}
export function drawWeaponArt(c: CanvasRenderingContext2D, style: WeaponStyle, size: number) {
  if (!requested.has(style)) void preloadWeaponArt();
  const image = images.get(style);
  if (image) {
    c.save();
    const factor = size / 76;
    c.scale(factor, factor);
    const width =
      style === 'bow' ? (image.width / image.height) * 78 : style === 'dagger' ? 83 : 108;
    const height = style === 'bow' ? 78 : (image.height / image.width) * width;
    // Place the actual grip close to the actor; point/head always faces the target.
    const x = style === 'bow' ? -9 : style === 'crossbow' ? -32 : -30;
    c.drawImage(image, x, -height / 2, width, height);
    c.restore();
    return;
  }
  let sprite = sprites.get(style);
  if (!sprite && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 432;
    canvas.height = 270;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(3, 3);
    ctx.translate(36, 45);
    ctx.save();
    art(ctx, style);
    ctx.restore();
    sprites.set(style, canvas);
    sprite = canvas;
  }
  c.save();
  const factor = size / 76;
  c.scale(factor, factor);
  if (sprite) c.drawImage(sprite, -36, -45, 144, 90);
  else art(c, style);
  c.restore();
}
export function drawProjectile(c: CanvasRenderingContext2D, bolt = false) {
  const length = bolt ? 25 : 36;
  haft(c, -length, -3, 2.6);
  c.fillStyle = metal(c, -3, 3);
  c.beginPath();
  c.moveTo(9, 0);
  c.lineTo(-5, -4.5);
  c.lineTo(-2, 0);
  c.lineTo(-5, 4.5);
  c.closePath();
  outline(c);
  for (const side of [-1, 1]) {
    c.fillStyle = side > 0 ? '#9aa7ab' : '#dfe7e4';
    c.beginPath();
    c.moveTo(-length, 0);
    c.lineTo(-length - 4, side * 5);
    c.quadraticCurveTo(-length + 4, side * 6, -length + 12, 0);
    c.closePath();
    c.fill();
    c.strokeStyle = '#495a6466';
    c.lineWidth = 0.6;
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.moveTo(-length + i * 2, 0);
      c.lineTo(-length - 2 + i * 2, side * (4 - i * 0.45));
      c.stroke();
    }
  }
  c.fillStyle = '#463c30';
  c.fillRect(-length - 1, -1, 2, 2);
}
