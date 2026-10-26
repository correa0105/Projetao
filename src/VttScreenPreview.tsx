import { useEffect, useRef } from 'react';
import { screenAtlas, drawScreenSprite } from './vtt-screen-materials';
import type { ActiveScreenEffectId } from '../shared/vtt-screen-effects';
export function VttScreenPreview({ preset }: { preset: ActiveScreenEffectId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = screenAtlas(),
      canvas = ref.current,
      ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const paint = () => {
      const width = canvas.width,
        height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, preset === 'embers' ? '#211b1a' : '#1e2528');
      bg.addColorStop(1, preset === 'embers' ? '#4b291b' : '#4a4033');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      if (preset === 'cave-in') {
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.28;
          drawScreenSprite(ctx, 8 + i, i * 145 - 30, 110, 310, 250);
        }
        for (let i = 0; i < 8; i++) {
          const size = 48 + (i % 3) * 30;
          ctx.save();
          ctx.globalAlpha = 0.45 + (i % 3) * 0.2;
          ctx.translate(40 + ((i * 97) % 420), 20 + ((i * 71) % 290));
          ctx.rotate(i * 0.8);
          drawScreenSprite(ctx, i, -size / 2, -size / 2, size);
          ctx.restore();
        }
      } else {
        ctx.globalAlpha = 0.1;
        drawScreenSprite(ctx, 10, -80, 30, 590, 400);
        for (let i = 0; i < 24; i++) {
          const size = 9 + (i % 5) * 5;
          ctx.save();
          ctx.translate((i * 137 + 19) % 480, (i * 83 + 21) % 360);
          ctx.rotate(i * 0.7);
          ctx.globalAlpha = 0.3 + (i % 4) * 0.15;
          drawScreenSprite(
            ctx,
            i % 3 === 0 ? 12 + (i % 4) : i % 8,
            -size / 2,
            -size / 2,
            size,
            size * (i % 3 ? 1.4 : 1),
          );
          ctx.restore();
        }
        for (let i = 0; i < 4; i++) {
          ctx.globalAlpha = 0.9;
          drawScreenSprite(ctx, 12 + i, 30 + i * 110, 245 - i * 48, 65, 75);
        }
      }
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, 0, 0, height);
      shade.addColorStop(0, '#0000');
      shade.addColorStop(1, '#080b0d77');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, width, height);
    };
    paint();
    image.addEventListener('load', paint);
    return () => image.removeEventListener('load', paint);
  }, [preset]);
  return (
    <canvas ref={ref} width={480} height={360} className="vtt-screen-preview" aria-hidden="true" />
  );
}
