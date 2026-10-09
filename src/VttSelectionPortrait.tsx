import { useEffect, useId, useState } from 'react';
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
    [source, setSource] = useState(''),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'),
      update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    let live = true;
    setSource('');
    const image = new Image();
    const portrait = token.characterId
      ? `/api/vtt/rooms/${roomId}/tokens/${token.id}/portrait?v=${encodeURIComponent(token.image)}`
      : token.image;
    image.onload = () => {
      if (live) setSource(image.src);
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
  if (!source) return null;
  const animated = visualEffects && !reduced;
  return (
    <figure
      className="vtt-selection-portrait"
      aria-label={'Retrato de ' + token.name}
      data-token-id={token.id}
      data-animated={animated}
      data-effects={visualEffects}
    >
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
            >
              {animated && (
                <animate
                  attributeName="baseFrequency"
                  values=".022 .031;.028 .023;.022 .031"
                  dur="14s"
                  repeatCount="indefinite"
                />
              )}
            </feTurbulence>
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
              rx="79"
              ry="88"
              fill={'url(#' + id + 'fade)'}
              filter={'url(#' + id + 'vapor)'}
            />
          </mask>
        </defs>
        <image
          href={source}
          x="32"
          y="12"
          width="160"
          height="196"
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
            opacity=".58"
          />
        )}
      </svg>
      <figcaption>{token.name}</figcaption>
    </figure>
  );
}
