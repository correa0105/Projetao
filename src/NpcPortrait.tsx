import { useEffect, useId, useState } from 'react';
import './npc-portrait.css';

export function useNpcMotion() {
  const [state, setState] = useState(() => ({
    visible: !document.hidden,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setState({ visible: !document.hidden, reduced: media.matches });
    document.addEventListener('visibilitychange', update);
    media.addEventListener('change', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      media.removeEventListener('change', update);
    };
  }, []);
  return state;
}

// Keep the previous decoded art on screen. Internal dialogue never opens the page loader.
export function useDialogueArt(requested: string, fallback: string) {
  const [src, setSrc] = useState(fallback);
  useEffect(() => {
    let live = true;
    if (requested === fallback) {
      setSrc(fallback);
      return;
    }
    const art = new Image();
    art.decoding = 'async';
    art.src = requested;
    void art
      .decode()
      .then(() => {
        if (live) setSrc(requested);
      })
      .catch(() => {
        if (live) setSrc(fallback);
      });
    return () => {
      live = false;
    };
  }, [requested, fallback]);
  return src;
}

export function NpcPortrait({
  src,
  kind,
  portraitClass,
  lightClass,
}: {
  src: string;
  kind: 'lia' | 'events';
  portraitClass?: string;
  lightClass: string;
}) {
  const id = useId();
  const { visible, reduced } = useNpcMotion();
  const reading = /reading-refined|atlas/.test(src);
  const considering = src.includes('considering-refined');
  const lenses = reading
    ? [402, 309, 540, 285]
    : considering
      ? [404, 303, 530, 267]
      : [400, 305, 545, 282];
  const eye = src.includes('speaking-refined')
    ? [478, 270]
    : src.includes('reserved-refined')
      ? [459, 263]
      : [459, 273];
  return (
    <svg
      viewBox="0 0 1024 1536"
      aria-hidden="true"
      className="npc-portrait"
      data-motion={visible && !reduced ? 'on' : 'off'}
      data-art={src}
    >
      <defs>
        <filter
          id={id + '-halo'}
          x="-10%"
          y="-5%"
          width="120%"
          height="110%"
          colorInterpolationFilters="sRGB"
        >
          <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="expanded" />
          <feGaussianBlur in="expanded" stdDeviation="6" result="soft" />
          <feComposite in="soft" in2="SourceAlpha" operator="out" result="outside" />
          <feFlood floodColor="#ecc263" floodOpacity="0.55" result="warm" />
          <feComposite in="warm" in2="outside" operator="in" result="halo" />
          <feComposite in="expanded" in2="SourceAlpha" operator="out" result="edge" />
          <feGaussianBlur in="edge" stdDeviation="0.85" result="softEdge" />
          <feFlood floodColor="#f5d58b" floodOpacity="0.92" result="gold" />
          <feComposite in="gold" in2="softEdge" operator="in" result="rim" />
          <feMerge>
            <feMergeNode in="halo" />
            <feMergeNode in="rim" />
          </feMerge>
        </filter>
        <radialGradient id={id + '-eye'}>
          <stop stopColor="#ffc98a" />
          <stop offset=".3" stopColor="#ef542b" stopOpacity=".8" />
          <stop offset="1" stopColor="#d22a19" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id + '-glint'}>
          <stop stopColor="#fff7dc" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff7dc" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff7dc" stopOpacity="0" />
        </linearGradient>
        <clipPath id={id + '-lenses'}>
          <ellipse
            cx={lenses[0]}
            cy={lenses[1]}
            rx="51"
            ry="27"
            transform={`rotate(-12 ${lenses[0]} ${lenses[1]})`}
          />
          <ellipse
            cx={lenses[2]}
            cy={lenses[3]}
            rx="51"
            ry="27"
            transform={`rotate(-12 ${lenses[2]} ${lenses[3]})`}
          />
        </clipPath>
      </defs>
      <image
        className={'npc-pose ' + (portraitClass || '')}
        href={src}
        width="1024"
        height="1536"
      />
      <image
        className={lightClass}
        href={src}
        width="1024"
        height="1536"
        filter={`url(#${id}-halo)`}
      />
      {kind === 'events' ? (
        <ellipse
          className="npc-eye-glow"
          cx={eye[0]}
          cy={eye[1]}
          rx="16"
          ry="9"
          fill={`url(#${id}-eye)`}
        />
      ) : (
        <g clipPath={`url(#${id}-lenses)`}>
          <path
            className="npc-glasses-glint"
            d="M250 220h38l110 200h-38z"
            fill={`url(#${id}-glint)`}
          />
        </g>
      )}
    </svg>
  );
}
