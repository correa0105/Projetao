import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { VttToken } from '../shared/vtt';
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
    [frame, setFrame] = useState<{ width: number; bottom: number }>(),
    figure = useRef<HTMLElement>(null);
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
        </g>
      </svg>
      <figcaption>{token.name}</figcaption>
    </figure>
  );
}
