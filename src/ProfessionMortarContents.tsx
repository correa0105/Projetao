// The contents sit below the back wall. This contour is independent of the tool's hit area.
// The same contour removes ALL food from the stone occluder, including the lower edge.
export const mortarContentsPath =
  'M396 287 C405 277 419 272 431 266 L440 259 L453 255 L465 257 L476 253 L489 255 L503 254 L517 257 L530 253 L542 257 L550 248 L554 262 C581 260 608 273 625 282 L637 291 C622 307 578 319 518 318 C465 317 421 307 396 292 Z';

export function ProfessionMortarContents({
  id,
  bench,
  travel,
  phase,
  reduced,
}: {
  id: string;
  bench: string;
  travel: number;
  phase: number;
  reduced: boolean;
}) {
  const ramp = Math.min(1, Math.abs(travel) / 10),
    active = !reduced && ramp > 0;
  const pressure = Math.sin(phase * Math.PI) ** 2;
  const dx = Math.sin(travel * 0.11) * 2.4 * ramp,
    dy = Math.sin(travel * 0.15) * 0.45 * ramp;
  return (
    <>
      <defs>
        <clipPath id={id + '-all-ingredients'}>
          <path d={mortarContentsPath} />
        </clipPath>
        <filter
          id={id + '-ingredient-flow'}
          filterUnits="userSpaceOnUse"
          x="370"
          y="225"
          width="295"
          height="120"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".028 .09"
            numOctaves="2"
            seed="7"
            result="grain"
          />
          <feOffset
            in="grain"
            dx={Math.sin(travel * 0.07) * 16}
            dy={Math.cos(travel * 0.09) * 8}
            result="moving-grain"
          />
          <feColorMatrix
            in="moving-grain"
            type="matrix"
            values="1 0 0 0 0  0 .18 0 0 .41  0 0 1 0 0  0 0 0 1 0"
            result="perspective-flow"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="perspective-flow"
            scale={(11 + pressure * 2) * ramp}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <mask
          id={id + '-stone-only'}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="960"
          height="640"
        >
          <rect x="365" y="279" width="300" height="245" fill="white" />
          <path d={mortarContentsPath} fill="black" />
        </mask>
      </defs>
      <g
        clipPath={'url(#' + id + '-all-ingredients)'}
        data-whole-contents="true"
        data-material-travel={travel}
      >
        <image
          className="pf-liquid-texture"
          href={bench}
          width="960"
          height="640"
          filter={active ? 'url(#' + id + '-ingredient-flow)' : undefined}
          transform={active ? `translate(${dx} ${dy})` : undefined}
        />
      </g>
    </>
  );
}
export function ProfessionMortarFront({ id, bench }: { id: string; bench: string }) {
  return (
    <image
      className="pf-container-lip"
      data-occluder="stone-only"
      href={bench}
      width="960"
      height="640"
      mask={'url(#' + id + '-stone-only)'}
    />
  );
}
