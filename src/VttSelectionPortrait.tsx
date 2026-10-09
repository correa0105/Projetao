import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { VttToken } from '../shared/vtt';
import { startPortraitSmoke } from './vtt-portrait-smoke';
import './vtt-selection-portrait.css';

export function VttSelectionPortrait({
  roomId,
  token,
  visualEffects,
}: {
  roomId: string;
  token: VttToken;
  visualEffects: boolean;
}) {
  const id = useId().replaceAll(':', ''),
    [portraitImage, setPortraitImage] = useState<HTMLImageElement | null>(null),
    [reduced, setReduced] = useState(false),
    [flowing, setFlowing] = useState(false),
    [frame, setFrame] = useState<{ width: number; bottom: number }>(),
    figure = useRef<HTMLElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const stage = figure.current?.parentElement;
    if (!stage) return;
    const fit = () => {
      const compact = window.innerWidth <= 1100;
      const bottom = Math.min(compact ? 172 : 14, Math.max(14, stage.clientHeight - 128));
      const width = Math.min(
        window.innerWidth <= 700 ? 138 : compact ? 150 : 200,
        Math.max(48, stage.clientHeight - bottom - 36),
      );
      setFrame((previous) =>
        previous?.width === width && previous.bottom === bottom ? previous : { width, bottom },
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    window.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [portraitImage]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'),
      update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    let live = true;
    setPortraitImage(null);
    const image = new Image();
    const portrait = token.characterId
      ? `/api/vtt/rooms/${roomId}/tokens/${token.id}/portrait?v=${encodeURIComponent(token.image)}`
      : token.image;
    image.onload = () => {
      if (live) setPortraitImage(image);
    };
    image.onerror = () => {
      if (live && image.getAttribute('src') !== token.image && token.image) image.src = token.image;
    };
    if (portrait) image.src = portrait;
    return () => {
      live = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [roomId, token.id, token.characterId, token.image]);
  const animated = visualEffects && !reduced;
  useEffect(() => {
    setFlowing(false);
    if (!animated || !portraitImage || !canvas.current) return;
    let live = true;
    let stop: (() => void) | null = null;
    const surface = canvas.current;
    const lost = () => setFlowing(false);
    surface.addEventListener('portraitflowlost', lost);
    const smoke = new Image();
    smoke.onload = () => {
      if (!live || !canvas.current) return;
      stop = startPortraitSmoke(canvas.current, portraitImage, smoke);
      setFlowing(!!stop);
    };
    smoke.src = '/vtt/effects/portrait-wisp-v2.webp';
    return () => {
      live = false;
      smoke.onload = null;
      surface.removeEventListener('portraitflowlost', lost);
      stop?.();
    };
  }, [animated, portraitImage]);
  if (!portraitImage) return null;
  return (
    <figure
      className="vtt-selection-portrait"
      ref={figure}
      style={frame}
      aria-label={'Retrato de ' + token.name}
      data-token-id={token.id}
      data-animated={animated}
      data-effects={visualEffects}
      data-flowing={flowing}
    >
      <svg viewBox="0 0 224 224" aria-hidden="true">
        <defs>
          <radialGradient id={id + 'fade'}>
            <stop offset="62%" stopColor="white" />
            <stop offset="82%" stopColor="white" stopOpacity=".65" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <filter id={id + 'vapor'} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".022 .031"
              numOctaves="3"
              seed="11"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="10"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <mask id={id + 'mask'} maskUnits="userSpaceOnUse" x="0" y="0" width="224" height="224">
            <ellipse
              cx="112"
              cy="126"
              rx="81"
              ry="79"
              fill={'url(#' + id + 'fade)'}
              filter={'url(#' + id + 'vapor)'}
            />
            <ellipse cx="112" cy="72" rx="55" ry="64" fill={'url(#' + id + 'fade)'} />
          </mask>
        </defs>
        <g className="vtt-portrait-fallback">
          <image
            href={portraitImage.src}
            x="24"
            y="14"
            width="176"
            height="200"
            preserveAspectRatio="xMidYMin meet"
            mask={'url(#' + id + 'mask)'}
          />
          {visualEffects && (
            <g className="vtt-portrait-smoke" opacity=".24">
              <image
                href="/vtt/effects/portrait-wisp-v2.webp"
                x="22"
                y="75"
                width="68"
                height="112"
                transform="rotate(-19 56 150)"
              />
              <image
                href="/vtt/effects/portrait-wisp-v2.webp"
                x="129"
                y="84"
                width="66"
                height="114"
                transform="rotate(23 164 151)"
              />
              <image
                href="/vtt/effects/portrait-wisp-v2.webp"
                x="51"
                y="120"
                width="67"
                height="99"
                transform="rotate(-35 84 183)"
              />
              <image
                href="/vtt/effects/portrait-wisp-v2.webp"
                x="105"
                y="124"
                width="67"
                height="93"
                transform="rotate(31 138 182)"
              />
            </g>
          )}
        </g>
      </svg>
      <canvas ref={canvas} className="vtt-portrait-flow" aria-hidden="true" />
      <figcaption>{token.name}</figcaption>
    </figure>
  );
}
