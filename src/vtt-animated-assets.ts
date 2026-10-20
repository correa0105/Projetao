import type { VttToken } from '../shared/vtt';
import type { AnimatedAsset } from '../shared/vtt-animated-assets';
import { materialSprite } from './vtt-effects-materials';
import { physicalProp } from './vtt-effects-physical';
import { boatWake } from './vtt-effects-native-flow';
import { alpha, fract, glow, seededRandom, tau } from './vtt-effects-primitives';

let windmillBuilding: HTMLImageElement | undefined;
let windmillRotor: HTMLImageElement | undefined;
function buildingArt() {
  if (!windmillBuilding) {
    windmillBuilding = new Image();
    windmillBuilding.src = '/vtt/animated-assets-20261009/windmill-side-v5.webp';
  }
  return windmillBuilding;
}

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
  const side = Math.max(token.width, token.height);
  c.scale(side / 200, side / 200);
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
    const building = buildingArt();
    if (!windmillRotor) {
      windmillRotor = new Image();
      windmillRotor.src = '/vtt/animated-assets-20261009/windmill.webp';
    }
    if (building.complete && building.naturalWidth) c.drawImage(building, -90, -100, 180, 180);
    // Vertical sail plane on the front wall, projected from the overhead camera.
    c.translate(-2, 46);
    c.scale(0.9, 0.38);
    c.rotate(t * 0.65);
    if (windmillRotor.complete && windmillRotor.naturalWidth)
      c.drawImage(windmillRotor, -100, -100, 200, 200);
    // Keep the horizontal axle fixed while its sails rotate in the vertical plane.
    c.rotate(-t * 0.65);
    const hub = c.createRadialGradient(-2, -2, 1, 0, 0, 9);
    hub.addColorStop(0, '#bca178');
    hub.addColorStop(0.5, '#6f4b2e');
    hub.addColorStop(1, '#35251d');
    c.fillStyle = hub;
    c.beginPath();
    c.arc(0, 0, 7, 0, tau);
    c.fill();
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
  if (id === 'cauldron' || id === 'potions') {
    for (let i = 0; i < 12; i++) {
      const u = fract(t * 0.42 + random(i + 200));
      const x =
        id === 'potions'
          ? [-35, 0, 35][i % 3] + (random(i + 201) - 0.5) * 8
          : (random(i + 201) - 0.5) * 40;
      const y = id === 'potions' ? 12 - u * 28 : (random(i + 202) - 0.5) * 28;
      c.beginPath();
      c.arc(x, y, 0.8 + u * 2.2, 0, tau);
      c.strokeStyle = alpha(id === 'potions' ? '#dfc1ff' : '#abedb0', Math.sin(u * Math.PI) * 0.65);
      c.lineWidth = 0.7;
      c.stroke();
    }
  }
  if (id === 'wind') {
    for (let i = 0; i < 6; i++) {
      const u = fract(t * 0.2 + i / 6),
        x = (u - 0.5) * 175,
        y = Math.sin(i * 2.3 + t * 0.6) * 38;
      c.beginPath();
      c.moveTo(x - 18, y);
      c.bezierCurveTo(x - 9, y - 6, x + 8, y + 5, x + 20, y - 2);
      c.strokeStyle = alpha('#dce9e2', Math.sin(u * Math.PI) * 0.2);
      c.lineWidth = 0.8;
      c.stroke();
    }
  }
  // Each surface has its own emitter geometry, rather than a halo around the prop.
  if (id === 'portal-ring') {
    c.save();
    c.beginPath();
    c.arc(0, 0, 53, 0, tau);
    c.clip();
    c.globalCompositeOperation = 'screen';
    for (let arm = 0; arm < 4; arm++) {
      c.beginPath();
      for (let j = 0; j <= 48; j++) {
        const u = j / 48,
          r = 4 + u * 48,
          a = (arm * tau) / 4 - u * 5 + t * 0.9;
        const x = Math.cos(a) * r,
          y = Math.sin(a) * r;
        if (j === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.strokeStyle = alpha(arm % 2 ? '#90c8ff' : '#59e6ef', 0.38);
      c.lineWidth = 1.4;
      c.stroke();
    }
    glow(c, 0, 0, 22, '#98eaff', 0.3);
    c.restore();
  }
  if (id === 'fountain' || id === 'magic-pool') {
    c.save();
    c.beginPath();
    c.arc(0, 0, id === 'fountain' ? 56 : 62, 0, tau);
    c.clip();
    for (let i = 0; i < 30; i++) {
      const a = random(i + 140) * tau,
        r = 20 + random(i + 141) * 36;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      const shimmer = 0.08 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.8 + i));
      c.beginPath();
      c.ellipse(x, y, 3 + random(i) * 6, 1, a + t * 0.06, 0, tau);
      c.strokeStyle = alpha('#a6f1ea', shimmer);
      c.lineWidth = 0.65;
      c.stroke();
    }
    if (id === 'fountain')
      for (let i = 0; i < 18; i++) {
        const u = fract(t * 0.65 + i / 18),
          a = i * 2.399;
        const r = 15 + u * 31,
          x = Math.cos(a) * r,
          y = Math.sin(a) * r;
        c.beginPath();
        c.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
        c.quadraticCurveTo(
          Math.cos(a) * r * 0.7,
          Math.sin(a) * r * 0.7 - 9 * Math.sin(u * Math.PI),
          x,
          y,
        );
        c.strokeStyle = alpha('#dcf7ff', Math.sin(u * Math.PI) * 0.35);
        c.lineWidth = 0.8;
        c.stroke();
        glow(c, x, y, 1.3, '#e0fbff', Math.sin(u * Math.PI) * 0.65);
      }
    c.restore();
  }
  if (id === 'chest' || id === 'spellbook' || id === 'crystals') {
    c.save();
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 14; i++) {
      const u = fract(t * 0.24 + random(i + 80));
      const x =
        id === 'chest'
          ? (random(i + 81) - 0.5) * 105
          : id === 'spellbook'
            ? (random(i + 81) - 0.5) * 96
            : (random(i + 81) - 0.5) * 60;
      const y =
        id === 'chest'
          ? -18 - u * 16
          : id === 'spellbook'
            ? (random(i + 82) - 0.5) * 55
            : -10 - u * 48;
      const color = id === 'chest' ? '#ffce76' : id === 'spellbook' ? '#a7e6ff' : '#e2bbff';
      glow(c, x, y, 1 + Math.sin(u * Math.PI) * 1.1, color, Math.sin(u * Math.PI) * 0.8);
      c.beginPath();
      c.moveTo(x - 3, y);
      c.lineTo(x + 3, y);
      c.moveTo(x, y - 3);
      c.lineTo(x, y + 3);
      c.strokeStyle = alpha(color, Math.sin(u * Math.PI) * 0.5);
      c.lineWidth = 0.6;
      c.stroke();
    }
    c.restore();
  }
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
          id === 'candles' ? 9 + u * 6 : 27 + u * 34,
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
        Math.sin(u * Math.PI) * 0.3,
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
    for (let i = 0; i < (id === 'wind' ? 12 : 14); i++) {
      const u = fract(t * 0.3 + random(i)),
        x =
          id === 'wind'
            ? (u - 0.5) * 190
            : (id === 'potions' ? [-35, 0, 35][i % 3] : 0) + Math.sin(t * 0.5 + i) * u * 18,
        y = id === 'wind' ? Math.sin(i) * 39 : -u * 42;
      materialSprite(
        c,
        color,
        'vapor',
        x,
        y,
        (id === 'potions' ? 10 : 18) + u * (id === 'wind' ? 58 : 32),
        t * 0.15 + i,
        t * 0.8 + i,
        Math.sin(u * Math.PI) * (id === 'wind' ? 0.18 : 0.3),
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
        8 + u * 12,
        a,
        t + i,
        Math.sin(u * Math.PI) * 0.2,
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

