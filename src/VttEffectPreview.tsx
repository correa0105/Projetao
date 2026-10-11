import { useEffect, useRef } from 'react';
import type { EffectPreset } from '../shared/vtt-effects';
import type { VttToken } from '../shared/vtt';
import { renderEffect } from './vtt-effects-canvas';
import { effectMaterialsReady } from './vtt-effects-materials';
import { spectralScreamerReady } from './vtt-spectral-screamer';
import { arcanaEffectReady } from './vtt-effects-arcana';
import { livingEffectReady } from './vtt-effects-living';
import { drawDeath } from './vtt-death';
let previewImage: HTMLImageElement | undefined;
function overheadPreview() {
  if (!previewImage) {
    previewImage = new Image();
    previewImage.src = '/api/vtt/premium-art/monster-knight';
  }
  return previewImage;
}

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
    const image = overheadPreview(),
      width = 68,
      height = 72;
    let alive = true,
      frame = 0,
      last = 0;
    const paint = (elapsed: number) => {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, 152, 112);
      c.save();
      c.translate(76, 54);
      const effect = { ...preset, scale: 1, duration: 0, at: 0 };
      const options = {
        now: 1250 + elapsed,
        reducedMotion: media.matches,
        seed: 'gallery',
        overhead: true,
        image,
      };
      if (preset.kind === 'death')
        drawDeath(
          c,
          { id: preset.id, layer: 'tokens', deathAt: 1, width, height } as VttToken,
          options,
        );
      else renderEffect(c, effect, width, height, { ...options, pass: 'behind' });
      c.save();
      if (preset.kind === 'death')
        c.filter = 'sepia(1) saturate(4) hue-rotate(320deg) brightness(.5)';
      if (image.complete && image.naturalWidth) {
        const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        c.drawImage(
          image,
          (-image.naturalWidth * fit) / 2,
          (-image.naturalHeight * fit) / 2,
          image.naturalWidth * fit,
          image.naturalHeight * fit,
        );
      } else {
        // Loading silhouette, without a circular token base.
        c.fillStyle = '#62737b';
        c.fillRect(-18, -12, 36, 24);
        c.fillStyle = '#d8c8a4';
        c.beginPath();
        c.ellipse(0, -9, 9, 10, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      if (preset.kind !== 'death')
        renderEffect(c, effect, width, height, { ...options, pass: 'front' });
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
    void Promise.all([
      effectMaterialsReady,
      spectralScreamerReady,
      arcanaEffectReady(preset.kind),
      livingEffectReady(preset.kind),
    ]).then(() => {
      if (alive) update();
    });
    image.addEventListener('load', update);
    media.addEventListener('change', update);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      media.removeEventListener('change', update);
      image.removeEventListener('load', update);
    };
  }, [preset.kind, preset.color, preset.id, animated]);
  return <canvas ref={canvas} aria-hidden="true" className="vtt-effect-preview-art" />;
}
