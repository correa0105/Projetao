import { useId } from 'react';

// Render the warm illustrations with a transparent silhouette, not a colored square.
// The source atlas uses a blue matte; red-minus-blue separates it from copper/ink.
function GuildIcon({ column, row }: { column: number; row: number; size?: number }) {
  const matteId = useId().replace(/:/g, '') + '-matte';
  return (
    <svg
      className="guild-engraving"
      viewBox={`${column * 512 + 20} ${row * 512 + 20} 472 472`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter
          id={matteId}
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  14 0 -14 0 0" />
        </filter>
      </defs>
      <image
        href="/guild-icons-candle-helmet.png"
        width="1536"
        height="1024"
        filter={`url(#${matteId})`}
      />
    </svg>
  );
}
type IconProps = { size?: number };
export function CandleIcon({ size }: IconProps) {
  return <GuildIcon column={0} row={0} size={size} />;
}
export function HelmetIcon({ size }: IconProps) {
  return <GuildIcon column={1} row={0} size={size} />;
}
export function SwordIcon({ size }: IconProps) {
  return <GuildIcon column={2} row={0} size={size} />;
}
export function PouchIcon({ size }: IconProps) {
  return <GuildIcon column={0} row={1} size={size} />;
}
export function MapIcon({ size }: IconProps) {
  return <GuildIcon column={1} row={1} size={size} />;
}
export function BookIcon({ size }: IconProps) {
  return <GuildIcon column={2} row={1} size={size} />;
}
