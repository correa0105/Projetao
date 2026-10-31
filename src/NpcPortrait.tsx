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
  intimidating = false,
}: {
  src: string;
  kind: 'lia' | 'events';
  portraitClass?: string;
  lightClass: string;
  intimidating?: boolean;
}) {
  const id = useId();
  const { visible, reduced } = useNpcMotion();
  const adjusting = kind === 'lia' && /considering-refined|lia-glasses-/.test(src);
  const glasses = !adjusting
    ? 'none'
    : src.includes('glasses-stern')
      ? 'stern'
      : src.includes('glasses-knowing')
        ? 'knowing'
        : 'adjust';
  const lensPaths = [
    'M356 286C364 274 394 271 423 274C436 276 444 280 442 299C439 319 421 331 397 333C375 338 362 332 357 319C352 306 351 296 356 286Z',
    'M479 250C493 239 521 229 544 234C560 238 565 248 561 266C557 284 546 293 525 299C503 306 483 299 478 287C472 274 472 261 479 250Z',
  ];
  const eye = /speaking-refined|speaking-closed/.test(src)
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
      data-glasses={glasses}
      data-intimidating={intimidating || undefined}
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
          <feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="expanded" />
          <feGaussianBlur in="expanded" stdDeviation="3" result="soft" />
          <feComposite in="soft" in2="SourceAlpha" operator="out" result="outside" />
          <feFlood floodColor="#cfb078" floodOpacity="0.3" result="warm" />
          <feComposite in="warm" in2="outside" operator="in" result="halo" />
          <feComposite in="expanded" in2="SourceAlpha" operator="out" result="edge" />
          <feGaussianBlur in="edge" stdDeviation="0.85" result="softEdge" />
          <feFlood floodColor="#d8ba82" floodOpacity="0.65" result="gold" />
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
        <linearGradient
          id={id + '-white'}
          x1="0"
          y1="0"
          x2=".6"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          <stop stopColor="#fffefa" />
          <stop offset=".55" stopColor="#f3f5ec" />
          <stop offset="1" stopColor="#dce8e6" />
        </linearGradient>
        <linearGradient id={id + '-glint'}>
          <stop stopColor="#fff7dc" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff7dc" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff7dc" stopOpacity="0" />
        </linearGradient>
        <clipPath id={id + '-lenses'}>
          {lensPaths.map((d, i) => (
            <path key={i} d={d} />
          ))}
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
      {kind === 'events' && intimidating && (
        <ellipse
          className="npc-eye-glow"
          cx={eye[0]}
          cy={eye[1]}
          rx="24"
          ry="13"
          fill={`url(#${id}-eye)`}
        />
      )}
      {adjusting && !src.includes('-painted-') && (
        <g key={src} className="npc-glasses-effect" data-mood={glasses}>
          {(glasses === 'stern'
            ? lensPaths
            : glasses === 'knowing'
              ? lensPaths.slice(0, 1)
              : []
          ).map((d, i) => (
            <path
              key={i}
              className="npc-lens-white"
              data-lens={i}
              d={d}
              fill={`url(#${id}-white)`}
            />
          ))}
          {glasses === 'adjust' && (
            <g clipPath={`url(#${id}-lenses)`}>
              <path
                className="npc-glasses-glint"
                d="M250 220h38l110 200h-38z"
                fill={`url(#${id}-glint)`}
              />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
