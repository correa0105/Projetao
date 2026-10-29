import type { NaturalStyle } from '../shared/vtt-attack-visual';

// High-resolution material sprites are painted once, then reused by all monsters.
// No per-frame texture generation, downloads, external art, or monster image changes.
const cache = new Map<string, HTMLCanvasElement>();
const illustrations = new Map<string, HTMLImageElement>();
export function preloadNaturalArt() {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all(
    ['bite', 'claw', 'tail', 'slam', 'scale-material', 'bone-material'].map(
      (id) =>
        new Promise<void>((resolve) => {
          if (illustrations.has(id)) {
            resolve();
            return;
          }
          const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
          image.onload = () => {
            illustrations.set(id, image);
            cache.clear();
            resolve();
          };
          image.onerror = () => resolve();
          image.src = id === 'slam'
            ? '/vtt/natural-attacks-20261020/fist-leather-glove-v1.webp'
            : '/vtt/natural-attacks-20261016/' + id + '.webp';
        }),
    ),
  );
}
void preloadNaturalArt();
function material(c: CanvasRenderingContext2D, path: Path2D, colors: string[], seed: number) {
  c.save();
  c.clip(path);
  const g = c.createLinearGradient(-90, -90, 60, 95);
  colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), color));
  c.fillStyle = g;
  c.fillRect(-140, -140, 280, 280);
  const texture = illustrations.get(
    colors === bone || colors === keratin ? 'bone-material' : 'scale-material',
  );
  if (texture) {
    c.save();
    c.globalCompositeOperation = 'soft-light';
    c.globalAlpha = 0.65;
    c.drawImage(texture, -140, -140, 280, 280);
    c.restore();
  }
  // Deterministic enamel/keratin pores and fine scars; clipped to the anatomy.
  let s = seed;
  const random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 2100; i++) {
    c.fillStyle = i % 3 ? '#080b0b24' : '#fff2d424';
    const x = random() * 250 - 125,
      y = random() * 250 - 125;
    c.fillRect(x, y, 0.15 + random() * 0.65, 0.15 + random() * 1.6);
  }
  c.strokeStyle = '#f9ebce21';
  c.lineWidth = 0.4;
  for (let i = 0; i < 80; i++) {
    const x = random() * 190 - 95,
      y = random() * 190 - 95;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + random() * 5, y + 2 + random() * 8);
    c.stroke();
  }
  c.restore();
  c.strokeStyle = '#161715d9';
  c.lineWidth = 1.2;
  c.stroke(path);
}
const bone = ['#3f392d', '#b1a286', '#f0e3c2', '#c6b797', '#6a5942'];
const scale = ['#171d20', '#34434a', '#6e7973', '#394b4c', '#131a1c'];
const keratin = ['#211c18', '#6c5841', '#c1ad86', '#827052', '#272a26'];
function paintJaw(c: CanvasRenderingContext2D, pincer: boolean) {
  if (pincer) {
    material(
      c,
      new Path2D(
        'M-76 -22 C-32 -82 48 -65 82 -9 Q44 -24 19 -14 L11 -24 0 -15 -11 -27 -22 -17 -34 -26 -49 -9 Z',
      ),
      keratin,
      411,
    );
    c.strokeStyle = '#c1ae8c77';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-68, -23);
    c.bezierCurveTo(-28, -66, 47, -52, 74, -13);
    c.stroke();
    return;
  }
  material(
    c,
    new Path2D('M-74 -36 Q0 -74 74 -36 L60 -8 Q0 -29 -60 -8 Z'),
    pincer ? keratin : scale,
    1123,
  );
  material(
    c,
    new Path2D('M-69 -32 Q0 -61 69 -32 L57 -15 Q0 -34 -57 -15 Z'),
    pincer ? keratin : bone,
    992,
  );
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 13,
      y = -26 + Math.pow(Math.abs(i - 4) / 4, 1.7) * 11;
    const len = i === 1 || i === 7 ? 36 : 14 + (i % 2) * 6;
    material(
      c,
      new Path2D(
        `M${x - 5} ${y} Q${x - 6} ${y + len * 0.48} ${x + 1} ${y + len} Q${x + 7} ${y + len * 0.38} ${x + 5} ${y - 1} Z`,
      ),
      pincer ? keratin : bone,
      800 + i * 13,
    );
  }
  c.strokeStyle = '#f5e4c34f';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-65, -37);
  c.quadraticCurveTo(0, -64, 65, -37);
  c.stroke();
}
function paint(c: CanvasRenderingContext2D, style: NaturalStyle) {
  if (style === 'bite' || style === 'pincer') {
    paintJaw(c, style === 'pincer');
    return;
  }
  if (style === 'claw') {
    material(c, new Path2D('M-72 -51 Q-12 -93 39 -39 L14 -9 Q-26 -32 -61 -12 Z'), scale, 882);
    for (let i = 0; i < 3; i++) {
      c.save();
      c.translate(-31 + i * 31, -14 - i * 5);
      c.rotate((i - 1) * 0.18);
      material(
        c,
        new Path2D('M-13 -28 Q19 -25 17 13 Q12 45 -12 64 Q1 30 -7 12 Q-22 -4 -13 -28 Z'),
        keratin,
        132 + i,
      );
      c.strokeStyle = '#eee1bd8c';
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(0, -15);
      c.bezierCurveTo(15, 3, 11, 32, -9, 56);
      c.stroke();
      c.restore();
    }
    return;
  }
  if (style === 'tail' || style === 'tentacle') {
    material(
      c,
      new Path2D(
        'M-100 13 C-42 -72 28 -77 70 -13 Q102 36 119 18 C86 69 65 10 46 -3 C9 -27 -28 -17 -63 51 Z',
      ),
      style === 'tentacle' ? ['#28202e', '#736278', '#a08b99', '#66596e', '#272b33'] : scale,
      920,
    );
    for (let i = 0; i < 22; i++) {
      const u = i / 22,
        x = -85 + u * 183,
        y = -27 * Math.sin(u * Math.PI) - 3;
      c.strokeStyle = style === 'tentacle' ? '#d4b6ae95' : '#a9ab9260';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(x, y + 9, 4 + 5 * (1 - u), style === 'tentacle' ? 4 : 9, -0.65, 0, Math.PI * 2);
      c.stroke();
      if (style === 'tentacle') {
        c.fillStyle = '#242430b0';
        c.fill();
        c.stroke();
      }
    }
    if (style === 'tail')
      for (let i = 0; i < 7; i++) {
        const x = -48 + i * 20,
          y = -35 * Math.sin(((i + 2) / 11) * Math.PI) - 5;
        material(c, new Path2D(`M${x - 4} ${y} l5 -17 7 15 Z`), keratin, 80 + i);
      }
    return;
  }
  if (style === 'horn' || style === 'sting' || style === 'beak') {
    const path =
      style === 'beak'
        ? 'M-62 -51 Q23 -56 91 0 Q18 -8 -11 30 L-66 22 Z'
        : style === 'sting'
          ? 'M-73 28 Q-13 -54 44 -35 Q69 -16 102 -47 Q78 15 43 4 Q0 -8 -45 55 Z'
          : 'M-73 49 Q11 35 59 -26 Q76 -46 92 -74 Q82 -11 65 17 Q8 90 -73 82 Z';
    material(c, new Path2D(path), style === 'sting' ? keratin : bone, 441);
    c.strokeStyle = '#342d2570';
    c.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      c.beginPath();
      c.moveTo(-55 + i * 12, 25 - i * 2);
      c.quadraticCurveTo(-40 + i * 12, 43 - i * 3, -32 + i * 11, 42 - i * 4);
      c.stroke();
    }
    return;
  }
  if (style === 'wing') {
    material(
      c,
      new Path2D('M-85 54 L-53 -70 -12 -48 42 -64 105 25 Q49 0 54 60 Q0 10 -7 66 Q-42 34 -85 54 Z'),
      ['#211f28', '#6f6265', '#a28d80', '#695d64', '#252934'],
      788,
    );
    c.strokeStyle = '#dcc5a4';
    c.lineWidth = 3;
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(-85, 54);
    c.lineTo(-53, -70);
    c.lineTo(-12, -48);
    c.lineTo(42, -64);
    c.lineTo(105, 25);
    c.moveTo(-12, -48);
    c.lineTo(54, 60);
    c.moveTo(-12, -48);
    c.lineTo(-7, 66);
    c.stroke();
    return;
  }
  if (style === 'hoof') {
    material(
      c,
      new Path2D('M-49 -62 Q0 -80 49 -62 L63 28 Q40 59 4 53 L0 1 -4 53 Q-45 60 -63 29 Z'),
      keratin,
      733,
    );
    c.strokeStyle = '#d8c4a94d';
    c.lineWidth = 1;
    for (let i = -48; i <= 48; i += 8) {
      c.beginPath();
      c.moveTo(i, -47);
      c.lineTo(i * 1.08, 35);
      c.stroke();
    }
    return;
  }
  if (style === 'touch') {
    material(
      c,
      new Path2D(
        'M-29 80 L-45 6 -63 -21 Q-69 -36 -57 -34 L-32 -9 -40 -64 Q-38 -83 -28 -69 L-12 -21 -10 -85 Q-3 -99 4 -81 L10 -21 23 -70 Q34 -82 36 -66 L31 -13 53 -49 Q65 -56 64 -39 L47 10 27 64 29 80 Z',
      ),
      ['#171a24', '#566971', '#93a4a5', '#465963', '#151b2b'],
      843,
    );
    return;
  }
  if (style === 'burst') return;
  // A broad knuckled strike works for fists, body slams and rams of any creature.
  material(
    c,
    new Path2D(
      'M-57 58 L-73 -12 Q-78 -42 -57 -43 Q-52 -70 -28 -65 Q-7 -87 14 -65 Q40 -72 52 -42 Q82 -35 69 -2 L45 57 Z',
    ),
    ['#252a2b', '#6d7772', '#a9b1a0', '#5b6865', '#242a2b'],
    671,
  );
  c.strokeStyle = '#303b39';
  c.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(-49 + i * 30, -20);
    c.quadraticCurveTo(-59 + i * 29, -37, -46 + i * 26, -47);
    c.stroke();
  }
}
export function drawNaturalArt(
  c: CanvasRenderingContext2D,
  style: NaturalStyle,
  size: number,
  mirror = false,
) {
  const illustration = illustrations.get(style);
  if (illustration) {
    c.save();
    if (mirror) c.scale(1, -1);
    const width = size * (style === 'tail' ? 2.7 : style === 'bite' ? 1.9 : 1.65),
      height = (width * illustration.height) / illustration.width;
    c.drawImage(
      illustration,
      -width / 2,
      style === 'bite' ? -height * 0.43 : -height / 2,
      width,
      height,
    );
    c.restore();
    return;
  }
  let sprite = cache.get(style);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = 640;
    sprite.height = 640;
    const ctx = sprite.getContext('2d')!;
    ctx.scale(2.4, 2.4);
    ctx.translate(133.333, 133.333);
    paint(ctx, style);
    cache.set(style, sprite);
  }
  c.save();
  if (mirror) c.scale(1, -1);
  c.drawImage(sprite, -size * 1.333, -size * 1.333, size * 2.666, size * 2.666);
  c.restore();
}
