import { useEffect, useRef, useState } from 'react';
import { house2Houses } from '../shared/house-v2';
import { house2CutawayImage } from './house2-architecture';
import { house2Finish, type House2Finishes } from '../shared/house2-finishes';
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
    left = (f.left - 0.5) * width,
    right = (f.right - 0.5) * width,
    top = (f.top - 0.5) * height,
    bottom = (f.bottom - 0.5) * height,
    tile = 'h2-finish-' + instance;
  return (
    <g data-house2-interior="orthographic" data-house2-cutaway={Number(id.slice(-3))}>
      <defs>
        {[floor, walls]
          .filter((v) => !!v)
          .map((v) => (
            <pattern
              key={v!.kind}
              id={tile + '-' + v!.kind}
              width={v!.kind === 'floor' ? 2 : 1}
              height={v!.kind === 'floor' ? 2 : 1}
              patternUnits="userSpaceOnUse"
            >
              <image
                href={v!.image}
                width={v!.kind === 'floor' ? 2 : 1}
                height={v!.kind === 'floor' ? 2 : 1}
              />
            </pattern>
          ))}
        <mask
          id={mask}
          maskUnits="userSpaceOnUse"
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
        >
          <rect x={-width / 2} y={-height / 2} width={width} height={height} fill="white" />
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
        <rect
          data-house2-floor-finish={floor.id}
          x={left + 0.13}
          y={top + 0.13}
          width={right - left - 0.26}
          height={bottom - top - 0.26}
          fill={`url(#${tile}-floor)`}
          stroke="#21180e"
          strokeWidth=".05"
        />
      )}
      {walls && (
        <g mask={`url(#${mask})`} data-house2-wall-finish={walls.id}>
          <path
            d={`M${left - 0.09} ${top - 0.09}H${right + 0.09}V${bottom + 0.09}H${left - 0.09}Z M${left + 0.13} ${top + 0.13}V${bottom - 0.13}H${right - 0.13}V${top + 0.13}Z`}
            fillRule="evenodd"
            fill={`url(#${tile}-walls)`}
            stroke="#2b2419"
            strokeWidth=".035"
          />
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
