import type { VttScene, VttToken } from '../shared/vtt';
import {
  pixelsPerFoot,
  spellOrigin,
  type SpellEffect,
  type SpellPlacement,
  type SpellProfile,
} from '../shared/vtt-spells';
import { spellChoreography } from '../shared/vtt-spell-choreography';
import { alpha, fract, glow, seededRandom, tau, tint } from './vtt-effects-primitives';
import { materialSprite } from './vtt-effects-materials';
import { physicalProp } from './vtt-effects-physical';
import { discharge } from './vtt-effects-overhead-magic';
import { crystalVolume, energyShell, livingVine } from './vtt-effects-volume';
import { drawWeaponArt } from './vtt-weapon-art';

type Path = (c: CanvasRenderingContext2D, p: SpellProfile, at: SpellPlacement, f: number) => void;
type View = { left: number; top: number; right: number; bottom: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
  const u = clamp(n);
  return u * u * (3 - 2 * u);
};
export function spellTokenOpacity(
  token: VttToken,
  effects: SpellEffect[],
  now: number,
  reduced: boolean,
) {
  if (reduced) return 1;
  const transit = effects.find(
    (e) =>
      e.sceneId &&
      now >= e.started &&
      now < e.started + 1300 &&
      e.movement?.some(
        (m) => m.tokenId === token.id && Math.hypot(token.x - m.to.x, token.y - m.to.y) < 1,
      ),
  );
  return transit ? smooth(((now - transit.started) / 1000 - 0.5) / 0.65) : 1;
}
function ghost(
  c: CanvasRenderingContext2D,
  token: VttToken,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  opacity: number,
  blur: number,
  scale = 1,
) {
  if (!image?.complete || !image.naturalWidth) return;
  c.save();
  c.translate(x, y);
  c.rotate((token.rotation * Math.PI) / 180);
  c.scale((token.flipX ? -1 : 1) * scale, (token.flipY ? -1 : 1) * scale);
  c.globalAlpha *= opacity;
  c.filter = `blur(${blur}px) saturate(.45)`;
  c.shadowBlur = 9;
  c.shadowColor = '#a1a1ec';
  const fit = Math.min(token.width / image.naturalWidth, token.height / image.naturalHeight);
  c.drawImage(
    image,
    (-image.naturalWidth * fit) / 2,
    (-image.naturalHeight * fit) / 2,
    image.naturalWidth * fit,
    image.naturalHeight * fit,
  );
  c.restore();
}
function portal(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  t: number,
  color: string,
  opacity: number,
) {
  c.save();
  c.translate(x, y);
  c.globalAlpha *= opacity;
  const random = seededRandom('portal-volume');
  for (let i = 0; i < 18; i++) {
    const age = fract(t * 0.7 + i / 18),
      a = (i / 18) * tau + t * 0.25;
    materialSprite(
      c,
      color,
      'energy',
      Math.cos(a) * r * 0.8,
      Math.sin(a) * r * 0.8,
      r * 0.56,
      a,
      t * 0.9 + i,
      Math.sin(age * Math.PI) * 0.7,
    );
  }
  for (let i = 0; i < 26; i++) {
    const a = random(i) * tau + t * 0.6,
      u = fract(t * 0.66 + random(i + 13));
    glow(
      c,
      Math.cos(a) * r * (0.85 + u * 0.35),
      Math.sin(a) * r * (0.85 + u * 0.35),
      r * 0.024,
      color,
      Math.sin(u * Math.PI) * 0.8,
    );
  }
  materialSprite(c, tint(color, 0.6), 'vapor', 0, 0, r * 2.3, -t * 0.3, t * 0.65, 0.5);
  c.restore();
}
function impact(
  c: CanvasRenderingContext2D,
  kind: string,
  p: SpellProfile,
  x: number,
  y: number,
  r: number,
  t: number,
  seed: string,
  opacity: number,
  persistent: boolean,
) {
  const rnd = seededRandom(seed),
    color = p.visual.color,
    light = p.visual.light;
  c.save();
  c.translate(x, y);
  c.globalAlpha *= opacity;
  const life = clamp(t / 2),
    wave = smooth(t / 1.15);
  const ambient = persistent ? 0.65 : Math.max(0, 1 - t / 2.7);
  if (kind === 'fireball' || kind === 'flames' || kind === 'fire-ray') {
    if (kind === 'fireball') {
      const expansion = 0.12 + wave * 0.98;
      physicalProp(
        c,
        'fireball',
        0,
        0,
        r * 2.35 * expansion,
        t * 0.23,
        Math.min(1, t * 6) * Math.max(0, 1 - (t - 0.8) / 1.8),
      );
      for (let i = 0; i < 13; i++) {
        const a = rnd(i + 13) * tau,
          age = clamp((t - rnd(i) * 0.22) / 1.8);
        materialSprite(
          c,
          color,
          'flame',
          Math.cos(a) * r * age * 0.87,
          Math.sin(a) * r * age * 0.87,
          r * (0.48 + age * 0.45),
          a,
          t * 0.9 + i,
          Math.sin(age * Math.PI) * 0.82,
        );
      }
    } else
      for (let i = 0; i < 10; i++) {
        const u = fract(t * 0.9 + rnd(i)),
          a = rnd(i + 19) * tau;
        materialSprite(
          c,
          color,
          'flame',
          Math.cos(a) * r * 0.65,
          Math.sin(a) * r * 0.65,
          r * (0.48 + u * 0.3),
          a,
          t * 1.35 + i,
          Math.sin(u * Math.PI) * ambient,
        );
      }
    for (let i = 0; i < 40; i++) {
      const a = rnd(i + 42) * tau,
        u = clamp((t - rnd(i) * 0.35) / 2.2),
        d = r * (0.12 + u * 1.3);
      glow(
        c,
        Math.cos(a) * d,
        Math.sin(a) * d,
        r * 0.012 + 1,
        color,
        Math.sin(u * Math.PI) * (1 - u) * 0.7,
      );
    }
    if (t > 0.35)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * tau;
        materialSprite(
          c,
          '#484047',
          'vapor',
          Math.cos(a) * r * wave * 0.5,
          Math.sin(a) * r * wave * 0.5,
          r * (0.8 + life),
          a,
          t * 0.23 + i,
          Math.sin(life * Math.PI) * 0.35,
        );
      }
  } else if (kind === 'lightning') {
    for (let i = 0; i < 5; i++) {
      const phase = fract(t * 2.4 + i * 0.17),
        a = rnd(i + 8) * tau;
      c.save();
      c.globalAlpha *= Math.max(0.08, 1 - phase * 1.5);
      discharge(
        c,
        { x: Math.cos(a) * r * 0.2, y: Math.sin(a) * r * 0.2 },
        { x: Math.cos(a + 0.5) * r, y: Math.sin(a + 0.5) * r },
        rnd,
        i + 81 + Math.floor(t * 3) * 117,
        color,
        Math.max(0.65, r * 0.014),
      );
      c.restore();
      if (phase < 0.35)
        glow(c, Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65, 14, color, (0.35 - phase) * 0.9);
    }
    physicalProp(c, 'plasma', 0, 0, r * 1.7, t * 0.28, ambient * 0.52);
  } else if (kind === 'earth' || kind === 'petrify') {
    physicalProp(c, 'rubble', 0, 0, r * 2.4, t * 0.025, 0.75);
    for (let i = 0; i < 12; i++) {
      const a = rnd(i + 15) * tau,
        d = r * (0.65 + rnd(i) * 0.36);
      physicalProp(
        c,
        'rock',
        Math.cos(a) * d,
        Math.sin(a) * d - Math.sin(t * 1.5 + i) * r * 0.07,
        r * (0.16 + rnd(i + 45) * 0.18),
        a + t * 0.16,
        ambient,
      );
      materialSprite(
        c,
        color,
        'vapor',
        Math.cos(a) * d,
        Math.sin(a) * d,
        r * 0.65,
        a,
        t * 0.3 + i,
        ambient * 0.28,
      );
    }
  } else if (kind === 'roots') {
    c.globalAlpha *= 0.6;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * tau;
      c.save();
      c.rotate(a);
      livingVine(c, color, r * 0.85, t, i);
      c.restore();
    }
  } else if (kind === 'weapon') {
    c.save();
    c.rotate(t * 0.36);
    drawWeaponArt(c, /Sword|Blade/i.test(p.name) ? 'sword' : 'mace', r * 1.25);
    c.restore();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * tau + t * 0.38;
      materialSprite(
        c,
        color,
        'energy',
        Math.cos(a) * r * 0.5,
        Math.sin(a) * r * 0.5,
        r * 0.5,
        a,
        t * 0.75 + i,
        0.22,
      );
    }
  } else if (kind === 'shield') {
    energyShell(c, color, r, t, 0.8, /Prismatic/.test(p.name));
  } else if (kind === 'web') {
    c.strokeStyle = alpha('#fff5dc', 0.76 + Math.sin(t * 1.3) * 0.06);
    c.lineWidth = 1;
    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * tau;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      c.stroke();
    }
    for (let k = 1; k <= 6; k++) {
      c.beginPath();
      for (let i = 0; i <= 15; i++) {
        const a = (i / 15) * tau,
          d = (r * k) / 6;
        if (!i) c.moveTo(d, 0);
        else
          c.quadraticCurveTo(
            Math.cos(a - tau / 30) * d * 0.83,
            Math.sin(a - tau / 30) * d * 0.83,
            Math.cos(a) * d,
            Math.sin(a) * d,
          );
      }
      c.stroke();
    }
  } else if (kind === 'frost') {
    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * tau,
        d = r * 0.72;
      crystalVolume(
        c,
        Math.cos(a) * d,
        Math.sin(a) * d,
        r * (0.18 + rnd(i) * 0.18),
        color,
        a + Math.PI / 2,
      );
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * tau;
      materialSprite(
        c,
        '#e9f2fb',
        'vapor',
        Math.cos(a) * r * 0.5,
        Math.sin(a) * r * 0.5,
        r * 0.8,
        a,
        t * 0.6 + i,
        0.35,
      );
    }
  } else if (kind === 'portal' || kind === 'teleport') {
    portal(c, 0, 0, r, t, color, 0.8);
  } else {
    const watery = kind === 'water',
      misty = ['fog', 'darkness', 'poison', 'wind', 'acid'].includes(kind),
      heal = kind === 'healing';
    const material = misty || watery ? 'vapor' : 'energy';
    const count = misty ? 14 : heal ? 9 : 8;
    for (let i = 0; i < count; i++) {
      const u = fract(t * (misty ? 0.22 : heal ? 0.36 : 0.55) + rnd(i)),
        a = (i / count) * tau + t * (kind === 'time' ? -0.28 : 0.24) + Math.sin(u * tau) * 0.13;
      const radius =
        r * (heal ? 0.9 - u * 0.7 : kind === 'drain' ? 0.95 - u * 0.83 : 0.3 + u * 0.58);
      const local = misty ? color : i % 3 ? color : light;
      materialSprite(
        c,
        local,
        material,
        Math.cos(a) * radius,
        Math.sin(a) * radius,
        r * (misty ? 0.95 : 0.5),
        a + t * 0.12,
        t * (misty ? 0.38 : 0.78) + i,
        Math.sin(u * Math.PI) * (misty ? 0.54 : 0.52),
      );
      if (watery) {
        c.beginPath();
        c.arc(0, 0, r * (0.2 + u * 0.8), a, a + 0.65);
        c.strokeStyle = alpha(tint(color, 0.7), Math.sin(u * Math.PI) * 0.42);
        c.lineWidth = 1;
        c.stroke();
      }
    }
    const motes = heal ? 34 : kind === 'divination' ? 16 : 26;
    for (let i = 0; i < motes; i++) {
      const u = fract(t * (heal ? 0.25 : 0.42) + rnd(i + 190)),
        a = rnd(i + 107) * tau + t * 0.18,
        d = r * (heal ? 0.95 - u * 0.68 : 0.22 + u * 0.86);
      const xx = Math.cos(a) * d,
        yy = Math.sin(a) * d;
      glow(c, xx, yy, 1 + r * 0.012, light, Math.sin(u * Math.PI) * 0.7);
    }
    if (kind === 'thunder' || kind === 'psychic')
      for (let k = 0; k < 3; k++) {
        const u = fract(t * 0.8 + k / 3);
        c.beginPath();
        c.arc(0, 0, r * (0.25 + u * 0.9), 0, tau);
        c.strokeStyle = alpha(light, (1 - u) * 0.28);
        c.lineWidth = r * 0.026 * (1 - u) + 0.3;
        c.stroke();
      }
  }
  c.restore();
}
function projectile(
  c: CanvasRenderingContext2D,
  e: SpellEffect,
  actor: VttToken,
  at: { x: number; y: number },
  age: number,
  index: number,
  reduced: boolean,
) {
  const p = e.profile,
    recipe = spellChoreography(e.spellId, p.visual.family),
    delay = index * 0.11,
    t = age - delay;
  const flight = recipe.flight,
    hit = t - flight;
  const distance = Math.hypot(at.x - actor.x, at.y - actor.y),
    angle = Math.atan2(at.y - actor.y, at.x - actor.x),
    size = Math.max(12, Math.min(32, Math.max(actor.width, actor.height) * 0.23));
  if (!reduced && t >= 0 && t < flight) {
    const u = smooth(t / flight),
      x = actor.x + (at.x - actor.x) * u,
      y = actor.y + (at.y - actor.y) * u;
    for (let k = 1; k <= 7; k++) {
      const q = clamp(u - k * 0.035),
        xx = actor.x + (at.x - actor.x) * q,
        yy = actor.y + (at.y - actor.y) * q;
      materialSprite(
        c,
        p.visual.color,
        p.visual.family === 'fire' ? 'flame' : 'energy',
        xx,
        yy,
        size * (1.6 - k * 0.13),
        angle,
        age * 1.6 + k,
        (1 - k / 8) * 0.65,
      );
    }
    if (p.visual.family === 'fire' || recipe.kind === 'fireball')
      physicalProp(c, 'fireball', x, y, size * 2.4, angle + age, 0.96);
    else if (p.visual.family === 'lightning') physicalProp(c, 'plasma', x, y, size * 2.1, age, 0.9);
    else {
      materialSprite(c, p.visual.color, 'energy', x, y, size * 2.5, angle, age * 1.8, 0.95);
      glow(c, x, y, size * 0.38, p.visual.light, 0.8);
    }
  }
  if (hit >= 0 || reduced) {
    // Exact area radius is supplied separately by field rendering; local impacts stay compact.
    if (recipe.kind !== 'fireball')
      impact(
        c,
        p.visual.family === 'fire'
          ? 'flames'
          : p.visual.family === 'frost'
            ? 'frost'
            : p.visual.family === 'acid'
              ? 'acid'
              : recipe.kind === 'missiles'
                ? 'force'
                : recipe.kind,
        p,
        at.x,
        at.y,
        size * 1.5,
        reduced ? 0.9 : hit,
        e.id + index,
        Math.max(0, 1 - hit / 2.1),
        false,
      );
  }
}
export function drawCinematicSpellEffects(
  c: CanvasRenderingContext2D,
  scene: VttScene,
  effects: SpellEffect[],
  pass: 'behind' | 'front',
  view: View,
  path: Path,
  now: number,
  reduced: boolean,
  images: Map<string, HTMLImageElement>,
) {
  for (const e of effects
    .filter((e) => e.sceneId === scene.id && e.started <= now && (!e.expires || e.expires > now))
    .slice(0, 200)) {
    const actor = scene.tokens.find((t) => t.id === e.actorId);
    if (!actor) continue;
    const p = e.profile,
      recipe = spellChoreography(e.spellId, p.visual.family),
      age = reduced ? 1.5 : (now - e.started) / 1000;
    const opacity =
      (reduced ? 1 : smooth(age / 0.16)) * (e.expires ? clamp((e.expires - now) / 600) : 1);
    if (!opacity) continue;
    if (e.movement?.length) {
      for (const m of e.movement) {
        const token = scene.tokens.find((t) => t.id === m.tokenId);
        if (!token) continue;
        const r = Math.max(token.width, token.height) * 0.6;
        if (age < 2.7 || reduced) {
          portal(c, m.from.x, m.from.y, r, age, p.visual.color, opacity * clamp(1 - age / 2.7));
          portal(
            c,
            m.to.x,
            m.to.y,
            r,
            age + 0.6,
            p.visual.color,
            opacity * clamp(1 - (age - 0.7) / 2),
          );
          if (pass === 'front' && !reduced && age < 0.7)
            ghost(
              c,
              token,
              images.get(token.image),
              m.from.x,
              m.from.y,
              clamp(1 - age / 0.7),
              age * 7,
              1 + age * 0.1,
            );
        }
      }
      continue;
    }
    if (['mirror', 'double', 'illusion-image'].includes(recipe.kind)) {
      if (pass === 'behind') {
        const count = recipe.kind === 'mirror' ? 3 : 1,
          origin = recipe.kind === 'mirror' ? actor : e.points[0] || actor;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * tau + age * 0.52,
            r =
              recipe.kind === 'mirror'
                ? Math.min(actor.width, actor.height) * (0.32 + 0.07 * Math.sin(age * 1.2 + i))
                : 0;
          ghost(
            c,
            actor,
            images.get(actor.image),
            origin.x + Math.cos(a) * r,
            origin.y + Math.sin(a) * r,
            opacity * 0.48,
            Math.max(0.6, Math.max(actor.width, actor.height) * 0.007),
          );
        }
        if (!images.get(actor.image))
          impact(c, 'illusion', p, origin.x, origin.y, actor.width * 0.6, age, e.id, opacity, true);
      }
      continue;
    }
    const points = e.points.map((at) => spellOrigin(p, actor, at)),
      area = p.shape && (p.mode !== 'targets' || p.areaFromTargets);
    const firing = recipe.delivery === 'projectile' && !p.origin.startsWith('caster');
    if (area) {
      for (const at of points) {
        const time = age - (firing ? recipe.flight : 0);
        if (time < 0 && !reduced) continue;
        if (
          at.x + p.size * pixelsPerFoot(scene.grid) < view.left ||
          at.x - p.size * pixelsPerFoot(scene.grid) > view.right
        )
          continue;
        if (pass === 'behind' || (recipe.kind === 'fireball' && pass === 'front')) {
          c.save();
          path(c, p, at, pixelsPerFoot(scene.grid));
          c.clip();
          const radius = Math.max(scene.grid.size * 0.35, p.size * pixelsPerFoot(scene.grid));
          const strength =
            opacity * (pass === 'front' ? 0.5 : 0.95) * (e.persistent ? 1 : clamp(1 - time / 3.5));
          if (p.shape === 'line' || p.shape === 'wall' || p.shape === 'cone') {
            c.globalAlpha *= 0.62;
            const random = seededRandom(e.id),
              segments = Math.min(38, Math.max(5, Math.ceil(radius / 24)));
            for (let i = 0; i < segments; i++) {
              const u = (i + 0.5) / segments,
                wide =
                  p.shape === 'cone'
                    ? radius * u * 0.62
                    : p.width * pixelsPerFoot(scene.grid) * 0.5;
              const lateral = (random(i) - 0.5) * wide * 1.6,
                angle = at.angle,
                x =
                  at.x +
                  Math.cos(angle) * radius * (u - (p.shape === 'wall' ? 0.5 : 0)) -
                  Math.sin(angle) * lateral,
                y =
                  at.y +
                  Math.sin(angle) * radius * (u - (p.shape === 'wall' ? 0.5 : 0)) +
                  Math.cos(angle) * lateral;
              const mat =
                p.visual.family === 'fire'
                  ? 'flame'
                  : p.visual.family === 'lightning'
                    ? 'energy'
                    : 'vapor';
              materialSprite(
                c,
                p.visual.color,
                mat,
                x,
                y,
                Math.max(scene.grid.size * 0.65, wide * 1.8),
                angle,
                age * 0.9 + i,
                strength * 0.75,
              );
            }
            if (p.visual.family === 'lightning')
              discharge(
                c,
                at,
                { x: at.x + Math.cos(at.angle) * radius, y: at.y + Math.sin(at.angle) * radius },
                random,
                33 + Math.floor(age * 5) * 111,
                p.visual.color,
                2.2,
              );
          } else if (radius > Math.max(view.right - view.left, view.bottom - view.top) * 0.65) {
            const span = Math.max(
              scene.grid.size,
              Math.min(360, Math.max(view.right - view.left, view.bottom - view.top) / 4),
            );
            const left = Math.floor(view.left / span) * span,
              top = Math.floor(view.top / span) * span;
            c.globalAlpha *= 0.62;
            for (let ix = 0; ix < 5; ix++)
              for (let iy = 0; iy < 5; iy++)
                impact(
                  c,
                  recipe.kind,
                  p,
                  left + (ix + 0.5) * span,
                  top + (iy + 0.5) * span,
                  span * 0.62,
                  Math.max(0.02, time) + ix * 0.13 + iy * 0.07,
                  e.id + ix + ',' + iy,
                  strength,
                  e.persistent,
                );
          } else
            impact(
              c,
              recipe.kind,
              p,
              at.x,
              at.y,
              p.shape === 'cube' ? radius * 0.65 : radius,
              Math.max(0.02, time),
              e.id,
              strength,
              e.persistent,
            );
          c.restore();
        }
      }
    } else if (pass === 'behind')
      for (const id of new Set(e.targets.length ? e.targets : [actor.id])) {
        const target = scene.tokens.find((t) => t.id === id);
        if (!target) continue;
        const time = age - (firing ? recipe.flight : 0);
        if (time < 0 && !reduced) continue;
        impact(
          c,
          recipe.kind,
          p,
          target.x,
          target.y,
          Math.max(24, Math.max(target.width, target.height) * 0.65),
          Math.max(0.01, time),
          e.id + id,
          opacity * (e.persistent ? 0.8 : clamp(1 - time / 3)),
          e.persistent,
        );
      }
    if (pass === 'front' && firing && age < 3) {
      const destinations =
        p.mode === 'targets'
          ? e.targets
              .map((id) => scene.tokens.find((t) => t.id === id))
              .filter((t): t is VttToken => !!t)
          : points;
      destinations.forEach((at, i) =>
        projectile(
          c,
          e,
          p.chain && i > 0
            ? scene.tokens.find((t) => t.id === e.targets[p.chainFromLast ? i - 1 : 0]) || actor
            : actor,
          at,
          age,
          i,
          reduced,
        ),
      );
    }
  }
}
