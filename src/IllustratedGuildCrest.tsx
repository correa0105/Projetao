import { useId } from 'react';
import type { Crest } from '../shared/guilds';
import { crestArtBanners, crestArtFrames, crestArtSigils, crestArtImageSource } from '../shared/guild-crest-art';
import { CrestExtraField, CrestFieldDefs } from './guild-crest-designs';
// Individual transparent sprites avoid atlas bleed when SVG color filters are applied.
export function CrestArtImage({
  kind,
  index,
  x = 0,
  y = 0,
  width = 100,
  height = 120,
  filter,
}: {
  kind: 'cloth' | 'sigils' | 'ornaments';
  index: number;
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  filter?: string;
}) {
  return (
    <image
      x={x}
      y={y}
      width={width}
      height={height}
      href={crestArtImageSource(kind, index)}
      preserveAspectRatio="xMidYMid meet"
      filter={filter}
    />
  );
}
export function IllustratedGuildCrest({
  crest,
  size,
  decorative,
}: {
  crest: Crest;
  size: number;
  decorative: boolean;
}) {
  const id = 'crest-art-' + useId().replaceAll(':', ''),
    a = crest.art!;
  const tint = (name: string, color: string) => {
    const rgb = [1, 3, 5].map((n) => parseInt(color.slice(n, n + 2), 16) / 255);
    return (
      <filter id={id + name} x="-5%" y="-5%" width="110%" height="110%">
        <feColorMatrix
          type="matrix"
          values={`${0.2126 * rgb[0]} ${0.7152 * rgb[0]} ${0.0722 * rgb[0]} 0 0 ${0.2126 * rgb[1]} ${0.7152 * rgb[1]} ${0.0722 * rgb[1]} 0 0 ${0.2126 * rgb[2]} ${0.7152 * rgb[2]} ${0.0722 * rgb[2]} 0 0 0 0 0 1 0`}
        />
      </filter>
    );
  };
  const banner = (
    <CrestArtImage
      kind="cloth"
      index={crestArtBanners.indexOf(a.banner)}
      x="4"
      y="5"
      width="92"
      height="110"
      filter={`url(#${id}cloth)`}
    />
  );
  return (
    <svg
      className="guild-crest guild-crest-illustrated"
      data-crest-style="illustrated"
      width={size}
      height={size * 1.15}
      viewBox="-10 -12 120 144"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'Brasão ilustrado da guilda'}
    >
      <defs>
        {tint('cloth', crest.fieldColor)}
        {tint('metal', crest.borderColor)}
        {tint('sigil', crest.iconColor)}
        <mask
          id={id + 'fabric'}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="100"
          height="120"
          style={{ maskType: 'alpha' }}
        >
          <CrestArtImage
            kind="cloth"
            index={crestArtBanners.indexOf(a.banner)}
            x="4"
            y="5"
            width="92"
            height="110"
          />
        </mask>
        <CrestFieldDefs id={id} color={crest.fieldColor2} />
      </defs>
      {a.order.map((layer) => (
        <g key={layer} data-crest-layer={layer}>
          {layer === 'banner' && a.showBanner && (
            <>
              {banner}
              {crest.field !== 'plain' && (
                <g mask={`url(#${id}fabric)`} opacity=".4">
                  <g fill={crest.fieldColor2} transform="scale(1 1.2)">
                    <CrestExtraField field={crest.field} id={id} color={crest.fieldColor2} />
                    {crest.field === 'quartered' && <path d="M0 0H50V50H100V100H50V50H0Z" />}
                    {crest.field === 'diagonal' && <path d="M-15 3L3-15 115 97 97 115Z" />}
                    {crest.field === 'stripes' &&
                      [22, 42, 62, 82].map((x) => <rect key={x} x={x} width="10" height="100" />)}
                    {crest.field === 'chevron' && <path d="M0 68L50 27 100 68V87L50 46 0 87Z" />}
                    {crest.field === 'sunburst' &&
                      Array.from({ length: 12 }, (_, i) => (
                        <path key={i} d="M50 74L36-15H50Z" transform={`rotate(${i * 30} 50 74)`} />
                      ))}
                  </g>
                </g>
              )}
            </>
          )}
          {layer === 'frame' && a.showFrame && (
            <CrestArtImage
              kind="ornaments"
              index={crestArtFrames.indexOf(a.frame)}
              x="-5"
              y="-5"
              width="110"
              height="130"
              filter={`url(#${id}metal)`}
            />
          )}
          {layer === 'symbol' && a.showSymbol && (
            <g
              transform={`translate(${50 + a.symbolX} ${55 + a.symbolY}) rotate(${a.symbolRotation}) scale(${a.symbolScale})`}
            >
              <CrestArtImage
                kind="sigils"
                index={crestArtSigils.indexOf(a.symbol)}
                x="-27"
                y="-27"
                width="54"
                height="54"
                filter={`url(#${id}sigil)`}
              />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
