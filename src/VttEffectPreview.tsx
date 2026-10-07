import { useEffect, useRef } from 'react';
import type { EffectPreset } from '../shared/vtt-effects';
import type { VttToken } from '../shared/vtt';
import { renderEffect } from './vtt-effects-canvas';
import { drawDeath } from './vtt-death';

// Gallery thumbnails are still until hovered/focused. Only the active card runs
// an animation, with cleanup on exit/unmount and reduced-motion support.
export function VttEffectPreview({
  preset,
  animated = false,
}: {
  preset: EffectPreset;
  animated?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const c = surface.getContext('2d');
    if (!c) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const dpr = Math.min(2, devicePixelRatio || 1);
    surface.width = Math.round(152 * dpr);
    surface.height = Math.round(112 * dpr);
    const start = performance.now();
    let frame = 0,
      last = 0;
    const paint = (elapsed: number) => {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, 152, 112);
      c.save();
      c.translate(76, 54);
      const effect = { ...preset, scale: 1, duration: 0, at: 0 };
      const options = { now: 1250 + elapsed, reducedMotion: media.matches, seed: 'gallery' };
      if (preset.kind === 'death')
        drawDeath(
          c,
          { id: preset.id, layer: 'tokens', deathAt: 1, width: 48, height: 48 } as VttToken,
          options,
        );
      else renderEffect(c, effect, 48, 48, { ...options, pass: 'behind' });
      const g = c.createRadialGradient(-8, -12, 0, 0, 0, 25);
      g.addColorStop(0, preset.kind === 'death' ? '#9c352b' : '#62737b');
      g.addColorStop(1, preset.kind === 'death' ? '#441618' : '#273440');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, 24, 24, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#b6bdab50';
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = preset.kind === 'death' ? '#d27159' : '#e1d5b3';
      c.beginPath();
      c.arc(0, -7, 6, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(-11, 12);
      c.quadraticCurveTo(-11, 2, 0, 2);
      c.quadraticCurveTo(11, 2, 11, 12);
      c.fill();
      if (preset.kind !== 'death') renderEffect(c, effect, 48, 48, { ...options, pass: 'front' });
      c.restore();
    };
    paint(0);
    const animate = (now: number) => {
      if (now - last >= 40 && !document.hidden) {
        paint(now - start);
        last = now;
      }
      frame = requestAnimationFrame(animate);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      paint(0);
      if (animated && !media.matches) frame = requestAnimationFrame(animate);
    };
    update();
    media.addEventListener('change', update);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener('change', update);
    };
  }, [preset.kind, preset.color, preset.id, animated]);
  return <canvas ref={canvas} aria-hidden="true" className="vtt-effect-preview-art" />;
}
