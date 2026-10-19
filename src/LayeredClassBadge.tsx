import type { CSSProperties } from 'react';
import layers from '../shared/class-badge-layers.json';

type BadgeLayers = {
  core: string;
  tools: string[];
  coreScale?: number;
  toolScale?: number;
  toolWidthScale?: number;
};

/** Each tool is a complete rigid image; its hidden middle is never reconstructed. */
export function LayeredClassBadge({ id, tier }: { id: string; tier: number }) {
  const layer = (layers as Record<string, BadgeLayers>)[`${id}-${tier}`];
  if (!layer)
    return (
      <img
        className="level-badge-art"
        src={`/sheet/level-badges-v2-20261019/${id}-${tier}.webp`}
        width="384"
        height="384"
        alt=""
        aria-hidden="true"
        decoding="async"
      />
    );
  return (
    <span
      className="level-badge-art level-badge-layers"
      aria-hidden="true"
      data-layered-badge={`${id}-${tier}`}
      style={
        {
          '--core-scale': layer.coreScale ?? 0.86,
          '--tool-scale': layer.toolScale ?? 1.28,
          '--tool-width-scale': layer.toolWidthScale ?? 1,
        } as CSSProperties
      }
    >
      {layer.tools.map((tool, index) => (
        <img
          key={`${tool}-${index}`}
          className="level-badge-tool"
          src={tool}
          alt=""
          decoding="async"
          data-tool-layer={index}
          style={{ '--tool-angle': `${index === 0 ? -45 : 45}deg` } as CSSProperties}
        />
      ))}
      <img className="level-badge-core" src={layer.core} alt="" decoding="async" />
    </span>
  );
}
