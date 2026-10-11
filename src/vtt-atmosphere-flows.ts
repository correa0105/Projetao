import { weatherPreset, type MapAtmosphere } from '../shared/vtt-atmosphere';
import { fract, seededRandom, tau } from './vtt-effects-primitives';
// CSS pixels per second: speed .65 is the normal setting, independent of map zoom.
export function weatherVelocity(a: MapAtmosphere, depth: number) {
  const family = weatherPreset(a.weather)[3],
    gain = a.speed / 0.65,
    wind = Math.sin(((a.wind - 90) * Math.PI) / 180);
  const fastSnow = a.weather === 'blizzard' || a.weather === 'frozen-hell';
  let vx = wind * 130,
    vy = 1000;
  if (family === 'storm' || family === 'vortex') {
    vx = wind * 470;
    vy = 1550;
  }
  if (family === 'snow') {
    vx = wind * (fastSnow ? 900 : 85);
    vy = fastSnow ? 420 : 105;
  }
  if (family === 'hail') {
    vx = wind * 310;
    vy = 1250;
  }
  if (family === 'sand' || family === 'wind') {
    vx = (wind >= 0 ? 1 : -1) * (family === 'sand' ? 1450 : 1200);
    vy = wind * 65;
  }
  if (family === 'ash') {
    vx = wind * 150;
    vy = 75;
  }
  if (a.weather === 'ethereal-drizzle') {
    vy = 560;
    vx = wind * 80;
  }
  return { x: vx * gain * depth, y: vy * gain * depth };
}
const wrap = (p: number, extent: number) => fract(p / extent) * extent;
export function drawWeatherFlows(
  c: CanvasRenderingContext2D,
  sceneId: string,
  a: MapAtmosphere,
  t: number,
  w: number,
  h: number,
) {
  const family = weatherPreset(a.weather)[3],
    rain = ['rain', 'storm', 'vortex'].includes(family),
    snow = family === 'snow',
    dust = ['ash', 'sand', 'wind'].includes(family),
    hail = family === 'hail';
  if ((!rain && !snow && !dust && !hail) || a.weather === 'meteors' || a.intensity <= 0) return;
  const rnd = seededRandom(sceneId + ' continuous weather ' + a.weather),
    count = Math.min(
      1400,
      Math.ceil(
        ((w * h) /
          (family === 'sand'
            ? 650
            : rain
              ? 950
              : family === 'wind'
                ? 2300
                : snow || family === 'ash'
                  ? 1100
                  : 1800)) *
          a.intensity,
      ),
    );
  const color =
    a.weather === 'blood-rain'
      ? '#d73348'
      : a.weather === 'mana-storm'
        ? '#b568ff'
        : a.weather === 'void-storm'
          ? '#863fea'
          : a.weather === 'spectral-storm'
            ? '#3fe3b7'
            : a.weather === 'sunshower'
              ? '#ffe4a8'
              : a.weather === 'ethereal-drizzle'
                ? '#ba9fff'
                : '#dceefb';
  for (let i = 0; i < count; i++) {
    const depth = 0.4 + rnd(i * 13) * 0.9,
      v = weatherVelocity(a, depth),
      margin = 150;
    const x = wrap(rnd(i * 13 + 1) * (w + margin * 2) + v.x * t, w + margin * 2) - margin,
      y = wrap(rnd(i * 13 + 2) * (h + margin * 2) + v.y * t, h + margin * 2) - margin;
    c.save();
    c.globalAlpha *= a.intensity * (0.25 + depth * 0.35);
    if (rain) {
      const streak = (a.weather === 'drizzle' ? 18 : family === 'storm' ? 65 : 42) * depth,
        mag = Math.hypot(v.x, v.y),
        dx = (v.x / mag) * streak,
        dy = (v.y / mag) * streak;
      const g = c.createLinearGradient(x - dx, y - dy, x, y);
      g.addColorStop(0, 'transparent');
      g.addColorStop(0.7, color);
      g.addColorStop(1, a.weather === 'blood-rain' ? '#ef6c78' : '#f4fcff');
      c.strokeStyle = g;
      c.lineWidth = (a.weather === 'drizzle' ? 0.6 : 1.05) * depth;
      c.beginPath();
      c.moveTo(x - dx, y - dy);
      c.lineTo(x, y);
      c.stroke();
      if (a.weather === 'ethereal-drizzle' || a.weather === 'mana-storm') {
        c.globalAlpha *= 0.5;
        c.fillStyle = color;
        c.beginPath();
        c.ellipse(x, y, 1.5 * depth, 3 * depth, 0, 0, tau);
        c.fill();
      }
    } else if (snow || hail) {
      c.fillStyle = hail ? '#b4d9ea' : a.weather === 'frozen-hell' ? '#68d5ff' : '#f5faff';
      c.translate(x + Math.sin(t * 1.7 + i) * depth * 7, y);
      if (hail || a.weather === 'frozen-hell') {
        const r = (hail ? 1.6 + rnd(i * 13 + 5) * 2.5 : 2) * depth;
        if (hail) {
          c.strokeStyle = '#e6f7ff';
          c.lineWidth = 0.8 * depth;
          c.globalAlpha *= 0.65;
          c.beginPath();
          c.moveTo(-v.x * 0.012, -v.y * 0.012);
          c.lineTo(0, 0);
          c.stroke();
          c.globalAlpha /= 0.65;
        }
        c.rotate(t * (0.5 + depth) + i);
        c.beginPath();
        for (let side = 0; side < 7; side++) {
          const angle = (side * tau) / 7,
            radius = r * (0.8 + rnd(i * 13 + side + 4) * 0.3);
          if (!side) c.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          else c.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        c.closePath();
        c.fill();
        c.fillStyle = '#f9ffff';
        c.beginPath();
        c.ellipse(-r * 0.3, -r * 0.35, r * 0.35, r * 0.23, 0, 0, tau);
        c.fill();
      } else {
        c.beginPath();
        c.ellipse(0, 0, (1 + rnd(i * 13 + 5) * 1.4) * depth, 1.6 * depth, 0, 0, tau);
        c.fill();
        if (a.weather === 'blizzard') {
          c.strokeStyle = '#effaff';
          c.lineWidth = 0.6;
          c.beginPath();
          c.moveTo(-v.x * 0.027, -v.y * 0.027);
          c.lineTo(0, 0);
          c.stroke();
        }
      }
    } else {
      const gust = Math.sin(t * 2.3 + i * 0.7) * 13 * depth;
      if (family === 'wind') {
        c.strokeStyle = a.weather === 'wild-winds' ? (i % 2 ? '#c884ff' : '#fbc975') : '#d1e3e2';
        c.lineWidth = 0.5 + depth * 0.45;
        const length = 60 + rnd(i * 13 + 5) * 110;
        c.beginPath();
        c.moveTo(x - length, y + gust);
        c.bezierCurveTo(
          x - length * 0.68,
          y + gust - 10,
          x - length * 0.35,
          y + gust + 7,
          x,
          y + gust,
        );
        c.stroke();
      } else if (family === 'sand') {
        c.strokeStyle = i % 4 === 0 ? '#edd5a2' : i % 3 === 0 ? '#997042' : '#cba26a';
        c.lineWidth = 0.6 * depth;
        c.beginPath();
        c.moveTo(x - v.x * 0.019, y + gust - v.y * 0.019);
        c.lineTo(x, y + gust);
        c.stroke();
      } else {
        c.translate(x + Math.sin(t * 0.8 + i) * 22, y);
        c.rotate(t * (rnd(i * 13 + 3) * 2 - 1));
        const r = (1.1 + rnd(i * 13 + 4) * 2.3) * depth;
        c.fillStyle = i % 6 === 0 ? '#cc8c5f' : i % 3 === 0 ? '#a1a0a0' : '#514e4a';
        c.beginPath();
        c.moveTo(-r, -r * 0.4);
        c.lineTo(r * 0.6, -r);
        c.lineTo(r, r * 0.8);
        c.lineTo(-r * 0.6, r * 0.5);
        c.closePath();
        c.fill();
      }
    }
    c.restore();
  }
  if (family === 'wind' || family === 'sand') {
    const direction = Math.sin(((a.wind - 90) * Math.PI) / 180) >= 0 ? 1 : -1;
    c.save();
    c.globalAlpha *= a.intensity * 0.25;
    for (let i = 0; i < 9; i++) {
      const x =
          wrap(
            ((t * (family === 'sand' ? 450 : 600) * a.speed) / 0.65) * direction + i * w * 0.17,
            w * 1.8,
          ) -
          w * 0.4,
        y = (h * (i + 0.5)) / 9 + Math.sin(t * 1.2 + i) * 20;
      const g = c.createLinearGradient(x - w * 0.24, y, x + w * 0.24, y);
      g.addColorStop(0, 'transparent');
      g.addColorStop(
        0.6,
        family === 'sand' ? '#a5743666' : a.weather === 'wild-winds' ? '#a057d966' : '#c5ddd533',
      );
      g.addColorStop(1, 'transparent');
      c.strokeStyle = g;
      c.lineWidth = family === 'sand' ? 14 : 3;
      c.beginPath();
      c.moveTo(x - w * 0.24, y + 20);
      c.bezierCurveTo(x - w * 0.08, y - 26, x + w * 0.1, y + 30, x + w * 0.24, y);
      c.stroke();
    }
    c.restore();
  }
}

export function drawCelestialWeather(
  c: CanvasRenderingContext2D,
  a: MapAtmosphere,
  t: number,
  w: number,
  h: number,
) {
  if (a.weather === 'eclipse') {
    const x = w * 0.77,
      y = h * 0.23,
      r = Math.min(w, h) * 0.085;
    c.save();
    c.globalAlpha *= a.intensity;
    const corona = c.createRadialGradient(x, y, r * 0.75, x, y, r * 2.5);
    corona.addColorStop(0, 'transparent');
    corona.addColorStop(0.13, '#fff4cacc');
    corona.addColorStop(0.25, '#dc95565a');
    corona.addColorStop(1, 'transparent');
    c.fillStyle = corona;
    c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    c.fillStyle = '#111327';
    c.beginPath();
    c.arc(x + Math.sin(t * 0.09) * r * 0.02, y, r, 0, tau);
    c.fill();
    c.restore();
  }
  if (a.weather === 'sunshower' || a.weather === 'arcane-fog') {
    c.save();
    c.globalCompositeOperation = 'screen';
    c.globalAlpha *= a.intensity * (a.weather === 'sunshower' ? 0.12 : 0.07);
    for (let i = 0; i < 5; i++) {
      const x = w * (i / 5 + 0.06) + Math.sin(t * 0.5 + i) * 30,
        g = c.createLinearGradient(x, 0, x + w * 0.13, h);
      g.addColorStop(0, a.weather === 'sunshower' ? '#ffd56a' : '#c168ff');
      g.addColorStop(1, 'transparent');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 20, 0);
      c.lineTo(x + w * 0.3, h);
      c.lineTo(x + w * 0.13, h);
      c.closePath();
      c.fill();
    }
    c.restore();
  }
}
