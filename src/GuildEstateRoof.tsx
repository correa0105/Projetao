import type { EstatePoint } from '../shared/guild-estate-vision';

/** Vertical roof plan; only the eaves fade, keeping the rooms covered. */
export function GuildEstateRoof({ image, viewer }: { image: string; viewer: EstatePoint | null }) {
  const fade = Boolean(viewer && viewer.x >= 19.7 && viewer.x <= 40.3 && viewer.y >= 15.7 && viewer.y <= 32.5);
  return (
    <g data-estate-roof-eaves={fade ? 'transparent' : 'solid'}>
      <defs>
        <filter id="ge-eaves-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation=".12" />
        </filter>
        <mask id="ge-roof-eaves" maskUnits="userSpaceOnUse" x="20" y="16" width="20" height="16.2">
          <rect x="20" y="16" width="20" height="16.2" fill="white" fillOpacity={fade ? .32 : 1} style={{ transition: 'fill-opacity .25s ease' }} />
          <rect x="21.25" y="17.35" width="17.5" height="13.2" fill="white" filter="url(#ge-eaves-soft)" />
        </mask>
        <clipPath id="ge-eave-wall-bases">
          <path d="M20.65 16.65H39.35V31.35H20.65Z M21.55 17.65V30.25H38.45V17.65Z" clipRule="evenodd" />
        </clipPath>
      </defs>
      <image href="/guild/estate-20261019/interior-openings-v3.webp" x="20.65" y="16.65" width="18.7" height="14.7" preserveAspectRatio="none" clipPath="url(#ge-eave-wall-bases)" pointerEvents="none" />
      <image data-estate-roof="orthographic" href={image} x="20" y="16" width="20" height="16.2" preserveAspectRatio="none" mask="url(#ge-roof-eaves)" pointerEvents="none" />
    </g>
  );
}
