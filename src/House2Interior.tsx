import { useEffect, useRef, useState } from 'react';
import { house2Houses } from '../shared/house-v2';
import { house2CutawayImage } from './house2-architecture';
import { house2Finish, type House2Finishes } from '../shared/house2-finishes';
import { house2InteriorSurfaces, house2WoodFloorTileSizes } from './house2-interior-surfaces';
export { house2CutawayImage } from './house2-architecture';

/** Empty interiors share the VTT vertical plan and matching roof footprint. */
export function House2Interior({
  id,
  instance,
  width,
  height,
  doorOpen = false,
  finishes,
}: {
  id: string;
  instance: string;
  width: number;
  height: number;
  doorOpen?: boolean;
  finishes?: House2Finishes;
}) {
  const image = house2CutawayImage(id);
  const spec = house2Houses.find((h) => h.id === id);
  const [angle, setAngle] = useState(doorOpen ? 90 : 0),
    current = useRef(angle);
  useEffect(() => {
    const target = doorOpen ? 90 : 0,
      from = current.current;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = target;
      setAngle(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 380);
      current.current = from + (target - from) * (1 - (1 - progress) ** 3);
      setAngle(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [doorOpen]);
  if (!image) return null;
  if (!spec) return null;
  // Move the doorway's existing pixels instead of drawing a second door over the roof.
  const f = spec.footprint,
    x = (f.doorStart - 0.5) * width,
    y = (f.bottom - 0.5) * height,
    w = (f.doorEnd - f.doorStart) * width,
    h = 0.024 * height,
    mask = 'h2-native-door-mask-' + instance,
    clip = 'h2-native-door-clip-' + instance;
  const floor = house2Finish(finishes, 'floor'),
    walls = house2Finish(finishes, 'walls'),
    tile = 'h2-finish-' + instance;
  const { left, right, top, bottom } = house2InteriorSurfaces(spec, width, height);
  const imageBox = { x: -width / 2, y: -height / 2, width, height };
  const floorBox = { x: left, y: top, width: right - left, height: bottom - top };
  const floorTileSize = floor && house2WoodFloorTileSizes[floor.id];
  return (
    <g data-house2-interior="orthographic" data-house2-cutaway={Number(id.slice(-3))}>
      <defs>
        {[floor, walls]
          .filter((v) => !!v)
          .map((v) => (
            <pattern
              key={v!.kind}
              id={tile + '-' + v!.kind}
              x={v!.kind === 'floor' ? left : 0}
              y={v!.kind === 'floor' ? top : 0}
              width={v!.kind === 'floor' ? floorTileSize || right - left : 1}
              height={v!.kind === 'floor' ? floorTileSize || bottom - top : 1}
              patternUnits="userSpaceOnUse"
            >
              <image
                href={v!.image}
                x={0}
                y={0}
                width={v!.kind === 'floor' ? floorTileSize || right - left : 1}
                height={v!.kind === 'floor' ? floorTileSize || bottom - top : 1}
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          ))}
        {walls && (
          <>
            <pattern
              id={tile + '-walls-vertical'}
              width="1"
              height="1"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(90)"
            >
              <image href={walls.image} width="1" height="1" />
            </pattern>
            <filter id={tile + '-wall-alpha'} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
            </filter>
            <filter id={tile + '-wall-shading'} colorInterpolationFilters="sRGB">
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncR type="linear" slope=".65" intercept=".35" />
                <feFuncG type="linear" slope=".65" intercept=".35" />
                <feFuncB type="linear" slope=".65" intercept=".35" />
              </feComponentTransfer>
            </filter>
            <mask id={tile + '-wall-surface'} maskUnits="userSpaceOnUse" {...imageBox}>
              <image href={image} {...imageBox} filter={`url(#${tile}-wall-alpha)`} />
              <rect {...floorBox} fill="black" />
              <rect x={x} y={y} width={w} height={h} fill="black" />
            </mask>
          </>
        )}
        <mask
          id={mask}
          maskUnits="userSpaceOnUse"
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
        >
          <rect {...imageBox} fill={walls ? 'black' : 'white'} />
          {walls && <rect {...floorBox} fill="white" />}
          <rect x={x} y={y} width={w} height={h} fill="black" />
        </mask>
        <clipPath id={clip}>
          <rect x="0" y={-h / 2} width={w} height={h} />
        </clipPath>
      </defs>
      <image
        href={image}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        mask={`url(#${mask})`}
      />
      {floor && (
        <rect data-house2-floor-finish={floor.id} {...floorBox} fill={`url(#${tile}-floor)`} />
      )}
      {walls && (
        <g
          mask={`url(#${tile}-wall-surface)`}
          data-house2-wall-finish={walls.id}
          data-house2-wall-replacement="native-silhouette"
          style={{ isolation: 'isolate' }}
        >
          {walls.id === 'walls-wood' ? (
            <image href={image} {...imageBox} />
          ) : (
            <>
              <path
                d={`M${-width / 2} ${-height / 2}H${width / 2}L${right} ${top}H${left}Z M${-width / 2} ${height / 2}H${width / 2}L${right} ${bottom}H${left}Z`}
                fill={`url(#${tile}-walls)`}
              />
              <path
                d={`M${-width / 2} ${-height / 2}V${height / 2}L${left} ${bottom}V${top}Z M${width / 2} ${-height / 2}V${height / 2}L${right} ${bottom}V${top}Z`}
                fill={`url(#${tile}-walls-vertical)`}
              />
              <image
                href={image}
                {...imageBox}
                filter={`url(#${tile}-wall-shading)`}
                opacity=".85"
                style={{ mixBlendMode: 'multiply' }}
              />
            </>
          )}
        </g>
      )}
      <g transform={`translate(${x} ${y + h / 2})`}>
        <g
          data-house2-door-leaf={instance}
          data-door-open={doorOpen ? 'true' : 'false'}
          data-door-angle={angle}
          transform={`rotate(${-angle})`}
        >
          <g clipPath={`url(#${clip})`}>
            <image
              href={image}
              x={-width / 2 - x}
              y={-height / 2 - y - h / 2}
              width={width}
              height={height}
            />
          </g>
        </g>
      </g>
    </g>
  );
}
