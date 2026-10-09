import type { VttToken } from '../shared/vtt';
import type { AnimatedAsset } from '../shared/vtt-animated-assets';
import { materialSprite } from './vtt-effects-materials';
import { physicalProp } from './vtt-effects-physical';
import { alpha, fract, glow, seededRandom, tau } from './vtt-effects-primitives';
import { boatWake } from './vtt-effects-native-flow';

// Called in the token's local frame. Every asset has native transparent art;
// animation adds material flow rather than rectangular video backgrounds.
export function drawAnimatedAsset(
  c: CanvasRenderingContext2D,
  token: VttToken,
  image: HTMLImageElement | undefined,
  now: number,
  reduced: boolean,
  enabled: boolean,
) {
  const asset = token.animatedAsset!;
  const moving = enabled && !reduced && asset.playing;
  const t = moving ? (now / 1000) * asset.speed : 1.7,
    power = asset.intensity;
  c.save();
  c.scale(token.width / 200, token.height / 200);
  const id = asset.id,
    random = seededRandom(token.id);
  const renderArt = () => {
    if (image?.complete && image.naturalWidth) {
      const fit = 200 / Math.max(image.naturalWidth, image.naturalHeight);
      c.drawImage(
        image,
        (-image.naturalWidth * fit) / 2,
        (-image.naturalHeight * fit) / 2,
        image.naturalWidth * fit,
        image.naturalHeight * fit,
      );
    }
  };
  if (id === 'rowboat') {
    c.translate(Math.sin(t * 1.5) * 1.8, Math.cos(t * 1.1) * 2.1);
    c.rotate(Math.sin(t * 0.9) * 0.035);
  }
  if (id === 'windmill') {
    c.rotate(t * 0.24);
    renderArt();
    c.restore();
    return;
  }
  if (id === 'bush') {
    c.rotate(Math.sin(t * 1.5) * 0.015);
    c.scale(1 + Math.sin(t * 1.2) * 0.008, 1);
  }
  if (id === 'banner' && moving && image?.complete && image.naturalWidth) {
    for (let i = 0; i < 16; i++) {
      const u = i / 16,
        w = image.naturalWidth / 16;
      c.drawImage(
        image,
        i * w,
        0,
        w,
        image.naturalHeight,
        -100 + i * 12.5,
        -100 + Math.sin(u * 8 - t * 2.8) * u * 2.2,
        12.6,
        200,
      );
    }
  } else renderArt();
  if (!enabled) {
    c.restore();
    return;
  }
  c.globalAlpha *= power;
  if (['firepit', 'brazier', 'candles'].includes(id)) {
    const centers =
      id === 'candles'
        ? [
            [-35, -27],
            [36, -25],
            [0, 36],
          ]
        : [[0, 0]];
    for (const [x, y] of centers)
      for (let i = 0; i < (id === 'candles' ? 3 : 12); i++) {
        const u = fract(t * 1.05 + i * 0.19),
          a = random(i) * tau,
          r = id === 'candles' ? 3 : 24 + random(i + 9) * 11;
        materialSprite(
          c,
          i % 3 ? '#ff8b27' : '#ffd894',
          'flame',
          x + Math.cos(a) * r * u,
          y + Math.sin(a) * r * u,
          id === 'candles' ? 14 + u * 8 : 48 + u * 39,
          a,
          t * 1.8 + i,
          Math.sin(u * Math.PI) * 0.9,
        );
      }
    if (id !== 'candles')
      for (let i = 0; i < 13; i++) {
        const u = fract(t * 0.5 + random(i)),
          a = random(i + 29) * tau;
        glow(
          c,
          Math.cos(a) * (24 + u * 57),
          Math.sin(a) * (24 + u * 57),
          1.1,
          '#ffd38b',
          Math.sin(u * Math.PI) * 0.85,
        );
      }
  } else if (id === 'portal-ring') {
    c.save();
    c.beginPath();
    c.arc(0, 0, 65, 0, tau);
    c.clip();
    for (let i = 0; i < 12; i++) {
      const u = fract(t * 0.55 + i / 12),
        a = (i / 12) * tau + t * 0.7,
        r = 8 + u * 44;
      materialSprite(
        c,
        i % 2 ? '#69d6ed' : '#ac8ddd',
        'energy',
        Math.cos(a) * r,
        Math.sin(a) * r,
        66,
        a + t * 0.3,
        t + i,
        Math.sin(u * Math.PI) * 0.65,
      );
    }
    c.restore();
  } else if (['rowboat', 'fountain', 'magic-pool'].includes(id)) {
    if (id === 'rowboat') {
      boatWake(c, t, 1);
    } else {
      const radius = id === 'fountain' ? 51 : 62;
      c.save();
      c.beginPath();
      c.arc(0, 0, radius, 0, tau);
      c.clip();
      for (let i = 0; i < 5; i++) {
        const u = fract(t * 0.28 + i / 5);
        c.beginPath();
        c.arc(0, 0, 4 + u * radius, 0, tau);
        c.strokeStyle = alpha('#dbf8ef', (1 - u) * 0.46);
        c.lineWidth = 0.9;
        c.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const a = random(i) * tau,
          u = fract(t * 0.7 + random(i + 31));
        physicalProp(
          c,
          'droplet',
          Math.cos(a) * (4 + u * radius * 0.85),
          Math.sin(a) * (4 + u * radius * 0.85),
          2 + u * 4,
          a,
          Math.sin(u * Math.PI) * 0.5,
        );
      }
      c.restore();
    }
  } else if (['steam-vent', 'cauldron', 'potions', 'wind'].includes(id)) {
    const color = id === 'cauldron' ? '#73b998' : id === 'potions' ? '#b1a7dc' : '#d4dddb';
    for (let i = 0; i < (id === 'wind' ? 12 : 7); i++) {
      const u = fract(t * 0.3 + random(i)),
        x = id === 'wind' ? (u - 0.5) * 190 : Math.sin(t * 0.5 + i) * u * 31,
        y = id === 'wind' ? Math.sin(i) * 39 : -u * 42;
      materialSprite(
        c,
        color,
        'vapor',
        x,
        y,
        26 + u * 58,
        t * 0.15 + i,
        t * 0.8 + i,
        Math.sin(u * Math.PI) * (id === 'wind' ? 0.24 : 0.46),
      );
    }
    if (id === 'wind')
      for (let i = 0; i < 6; i++) {
        const u = fract(t * 0.23 + i / 6);
        physicalProp(c, 'leaf', (u - 0.5) * 190, Math.sin(t + i) * 39, 11, i + t, 0.6);
      }
  } else if (['chest', 'spellbook', 'crystals'].includes(id)) {
    const color = id === 'chest' ? '#ffe1a1' : id === 'spellbook' ? '#a8d5ed' : '#c4a4ef';
    glow(c, 0, 0, 44, color, 0.07 + Math.sin(t * 1.8) * 0.025);
    for (let i = 0; i < 8; i++) {
      const u = fract(t * 0.28 + random(i)),
        a = random(i + 13) * tau;
      materialSprite(
        c,
        color,
        'energy',
        Math.cos(a) * (12 + u * 40),
        Math.sin(a) * (12 + u * 40),
        17 + u * 18,
        a,
        t + i,
        Math.sin(u * Math.PI) * 0.35,
      );
      glow(
        c,
        Math.cos(a) * (12 + u * 40),
        Math.sin(a) * (12 + u * 40),
        1,
        color,
        Math.sin(u * Math.PI) * 0.7,
      );
    }
  } else if (id === 'bush')
    for (let i = 0; i < 5; i++) {
      const u = fract(t * 0.18 + random(i));
      physicalProp(
        c,
        'leaf',
        Math.cos(i) * (50 + u * 37),
        Math.sin(i) * (50 + u * 37),
        10,
        t + i,
        Math.sin(u * Math.PI) * 0.6,
      );
    }
  c.restore();
}
