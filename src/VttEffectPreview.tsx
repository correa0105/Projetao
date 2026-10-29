import { useEffect, useRef } from 'react';
import type { EffectPreset } from '../shared/vtt-effects';
import type { VttToken } from '../shared/vtt';
import { renderEffect } from './vtt-effects-canvas';
import {watchVttMedia} from './vtt-media';
import { arcanaEffectReady } from './vtt-effects-arcana';
import { livingEffectReady } from './vtt-effects-living';
import { drawDeath } from './vtt-death';
import posters from '../shared/vtt-effect-previews.json';
import {VttAssetImage} from './VttAssetImage';
import {effectPreviewToken} from './vtt-effect-preview-token';
function hue(hex:string){
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  return !d?0:(max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4)*60;
}
export function VttEffectPreview({preset,animated=false}:{preset:EffectPreset;animated?:boolean}){
  if(animated)return <AnimatedEffectPreview preset={preset} animated/>;
  const poster=(posters as Record<string,{image:string;color:string}>)[preset.kind];
  if(!poster)return <span className="vtt-effect-preview-art" aria-hidden="true"/>;
  return <VttAssetImage thumbnail src={poster.image} className="vtt-effect-preview-art" width={152} height={112} alt="" aria-hidden="true"
    style={preset.color===poster.color?undefined:{filter:`hue-rotate(${hue(preset.color)-hue(poster.color)}deg)`}}/>;
}

// Gallery thumbnails are still until hovered/focused. Only the active card runs
// an animation, with cleanup on exit/unmount and reduced-motion support.
function AnimatedEffectPreview({
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
    const dpr = 1;
    surface.width = Math.round(152 * dpr);
    surface.height = Math.round(112 * dpr);
    const start = performance.now();
    const image = effectPreviewToken(),
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
      if (preset.kind !== 'death')
        renderEffect(c, effect, width, height, { ...options, pass: 'front' });
      c.restore();
    };
    const animate = (now: number) => {
      if (now - last >= 1000 / 30 - 1 && !document.hidden) {
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
    const stopMedia=watchVttMedia(update);
    void Promise.all([
      arcanaEffectReady(preset.kind),
      livingEffectReady(preset.kind),
    ]).then(() => {
      if (alive) update();
    });
    image.addEventListener('load', update);
    media.addEventListener('change', update);
    return () => {
      alive = false;
      stopMedia();
      cancelAnimationFrame(frame);
      media.removeEventListener('change', update);
      image.removeEventListener('load', update);
    };
  }, [preset.kind, preset.color, preset.id, animated]);
  return <canvas ref={canvas} aria-hidden="true" className="vtt-effect-preview-art" />;
}
