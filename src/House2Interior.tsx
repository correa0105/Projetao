import { house2CutawayImage } from './house2-architecture';
export { house2CutawayImage } from './house2-architecture';

/** Empty interiors share the VTT vertical plan and matching roof footprint. */
export function House2Interior({ id, width, height }: { id: string; instance: string; width: number; height: number }) {
  const image = house2CutawayImage(id);
  if (!image) return null;
  return (
    <g data-house2-interior="orthographic" data-house2-cutaway={Number(id.slice(-3))}>
      <image href={image} x={-width / 2} y={-height / 2} width={width} height={height} />
    </g>
  );
}
