import { house2Houses } from '../shared/house-v2';
import { house2Finish, type House2Finishes } from '../shared/house2-finishes';
import { vttVisualSource } from '../shared/vtt-asset-visuals';

/** Match the VTT's 32% eaves, feathered opaque center and protected chimney. */
export function House2Roof({
  house,
  instance,
  width,
  height,
  preview,
  fade,
  finishes,
}: {
  house: (typeof house2Houses)[number];
  instance: string;
  width: number;
  height: number;
  preview: boolean;
  fade: boolean;
  finishes?: House2Finishes;
}) {
  const finish = house2Finish(finishes, 'roof');
  const source =
    finish && 'sourceHouse' in finish
      ? (house2Houses.find((h) => h.id === finish.sourceHouse) ?? house)
      : house;
  // Fit the painted roof bounds to this house, keeping its walls and entrance fixed.
  const bounds = house.roofBounds,
    from = source.roofBounds;
  const imageWidth = (width * (bounds.right - bounds.left)) / (from.right - from.left);
  const imageHeight = (height * (bounds.bottom - bounds.top)) / (from.bottom - from.top);
  const imageX = -width / 2 + bounds.left * width - from.left * imageWidth;
  const imageY = -height / 2 + bounds.top * height - from.top * imageHeight;
  const f = house.footprint,
    mask = 'h2-eaves-' + instance,
    blur = mask + '-soft',
    walls = mask + '-walls';
  return (
    <>
      {fade && (
        <>
          <defs>
            <filter
              id={blur}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur stdDeviation={Math.min(width, height) * 0.011} />
            </filter>
            <mask
              id={mask}
              maskUnits="userSpaceOnUse"
              x={-width / 2}
              y={-height / 2}
              width={width}
              height={height}
            >
              <rect
                x={-width / 2}
                y={-height / 2}
                width={width}
                height={height}
                fill="white"
                fillOpacity=".32"
              />
              <rect
                x={(f.left + 0.025 - 0.5) * width}
                y={(f.top + 0.025 - 0.5) * height}
                width={(f.right - f.left - 0.05) * width}
                height={(f.bottom - f.top - 0.05) * height}
                fill="white"
                filter={`url(#${blur})`}
              />
              <rect
                x={-width / 2}
                y={-height / 2}
                width={width}
                height={(f.top + 0.025) * height}
                fill="white"
              />
            </mask>
            <clipPath id={walls}>
              <rect
                x={(f.left - 0.065 - 0.5) * width}
                y={(f.top - 0.5) * height}
                width={width * 0.105}
                height={(f.bottom - f.top + 0.07) * height}
              />
              <rect
                x={(f.right - 0.04 - 0.5) * width}
                y={(f.top - 0.5) * height}
                width={width * 0.105}
                height={(f.bottom - f.top + 0.07) * height}
              />
              <rect
                x={-width / 2}
                y={(f.bottom - 0.05 - 0.5) * height}
                width={width}
                height={height * 0.12}
              />
            </clipPath>
          </defs>
          <image
            data-house2-wall-bases={house.id}
            href={house.interior}
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            clipPath={`url(#${walls})`}
            pointerEvents="none"
          />
        </>
      )}
      <image
        className={preview ? 'h2-house-preview' : 'h2-house-fixed'}
        data-house2-roof={house.id}
        data-house2-roof-eaves={fade ? 'transparent' : 'solid'}
        href={vttVisualSource(finish?.image ?? house.image)}
        data-house2-roof-finish={finishes?.roof ?? 'original'}
        x={imageX}
        y={imageY}
        width={imageWidth}
        height={imageHeight}
        preserveAspectRatio="none"
        mask={fade ? `url(#${mask})` : undefined}
      />
    </>
  );
}
