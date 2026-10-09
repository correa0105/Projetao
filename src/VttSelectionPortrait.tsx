import { useEffect, useId, useRef, useState } from 'react';
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
    canvas = useRef<HTMLCanvasElement>(null);
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
    const smoke = new Image();
    smoke.onload = () => {
      if (!live || !canvas.current) return;
      stop = startPortraitSmoke(canvas.current, portraitImage, smoke);
      setFlowing(!!stop);
    };
    smoke.src = '/vtt/effects/portrait-smoke-v1.webp';
    return () => {
      live = false;
      smoke.onload = null;
      stop?.();
    };
  }, [animated, portraitImage]);
  if (!portraitImage) return null;
  return (
    <figure
      className="vtt-selection-portrait"
      aria-label={'Retrato de ' + token.name}
      data-token-id={token.id}
      data-animated={animated}
      data-effects={visualEffects}
      data-flowing={flowing}
    >
      <canvas ref={canvas} className="vtt-portrait-flow" aria-hidden="true" />
      <svg viewBox="0 0 224 224" aria-hidden="true">
        <defs>
          <radialGradient id={id + 'fade'}>
            <stop offset="58%" stopColor="white" />
            <stop offset="88%" stopColor="white" stopOpacity=".86" />
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
              scale="25"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <mask id={id + 'mask'} maskUnits="userSpaceOnUse" x="0" y="0" width="224" height="224">
            <ellipse
              cx="112"
              cy="108"
              rx="68"
              ry="78"
              fill={'url(#' + id + 'fade)'}
              filter={'url(#' + id + 'vapor)'}
            />
          </mask>
        </defs>
        <image
          href={portraitImage.src}
          x="22"
          y="4"
          width="180"
          height="216"
          preserveAspectRatio="xMidYMin slice"
          mask={'url(#' + id + 'mask)'}
        />
        {visualEffects && (
          <image
            className="vtt-portrait-smoke"
            href="/vtt/effects/portrait-smoke-v1.webp"
            x="0"
            y="0"
            width="224"
            height="224"
            opacity=".38"
          />
        )}
      </svg>
      <figcaption>{token.name}</figcaption>
    </figure>
  );
}
