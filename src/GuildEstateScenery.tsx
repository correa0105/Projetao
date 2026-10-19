import { vttVisualSource } from '../shared/vtt-asset-visuals';
const trees = [
  [9, 8, 8, 'oak-ancient', 18],
  [18, 8, 6, 'oak-young', 90],
  [30, 8, 8, 'oak-hollow', 210],
  [43, 8, 7, 'oak-young', 36],
  [51, 9, 8, 'oak-ancient', 120],
  [10, 18, 7, 'oak-young', 45],
  [10, 29, 8, 'oak-hollow', 75],
  [11, 40, 8, 'oak-ancient', 190],
  [49, 20, 8, 'oak-hollow', 20],
  [50, 31, 7, 'oak-young', 140],
  [49, 41, 8, 'oak-ancient', 275],
  [19, 39, 6, 'oak-young', 120],
  [40, 39, 7, 'oak-young', 240],
  [18, 14, 4, 'juniper', 25],
  [43, 15, 4, 'juniper', 90],
] as const;
const fence = '/vtt/medieval-expansion-20261017/outdoor-032.webp';
export function GuildEstateScenery({ wooded }: { wooded: boolean }) {
  return (
    <g data-estate-landscape="garden" pointerEvents="none">
      <ellipse cx="30" cy="24" rx="12" ry="10.2" fill="#483b20" opacity=".14" />
      <path
        d="M30 45C30 41 32 38 30 32"
        fill="none"
        stroke="#4d4b2d"
        strokeWidth="3.3"
        opacity=".28"
        strokeLinecap="round"
      />
      <path
        d="M30 45C30 41 32 38 30 32"
        fill="none"
        stroke="url(#ge-paving)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <rect
        x="25.5"
        y="30"
        width="9"
        height="5.2"
        rx="1.6"
        fill="url(#ge-paving)"
        filter="url(#ge-shadow)"
      />
      <g data-estate-boundary="stone" filter="url(#ge-shadow)">
        {Array.from({ length: 23 }, (_, i) => (
          <g key={'h' + i}>
            <image href={fence} x={7 + i * 2} y="4.7" width="2.1" height=".6" />
            {(i < 10 || i > 12) && (
              <image href={fence} x={7 + i * 2} y="44.7" width="2.1" height=".6" />
            )}
          </g>
        ))}
        {Array.from({ length: 20 }, (_, i) => (
          <g key={'v' + i}>
            <image
              href={fence}
              x="-1.05"
              y="-.3"
              width="2.1"
              height=".6"
              transform={`translate(7 ${6 + i * 2}) rotate(90)`}
            />
            <image
              href={fence}
              x="-1.05"
              y="-.3"
              width="2.1"
              height=".6"
              transform={`translate(53 ${6 + i * 2}) rotate(90)`}
            />
          </g>
        ))}
      </g>
      <image
        href="/vtt/medieval-expansion-20261017/outdoor-030.webp"
        x="28.5"
        y="44.5"
        width="3"
        height=".8"
      />
      {wooded &&
        trees.map(([x, y, size, id, rotation], i) => (
          <g key={i} data-estate-tree={id}>
            <ellipse
              cx={x + 0.7}
              cy={y + 1}
              rx={size * 0.46}
              ry={size * 0.32}
              fill="#101c10"
              opacity=".28"
            />
            <image
              href={vttVisualSource('/vtt/trees-20261013/' + id + '.png')}
              x={-size / 2}
              y={-size / 2}
              width={size}
              height={size}
              transform={`translate(${x} ${y}) rotate(${rotation})`}
              filter="url(#ge-shadow)"
            />
          </g>
        ))}
      {[22.5, 35.5].map((x) => (
        <image
          key={x}
          href="/vtt/medieval-expansion-20261017/outdoor-019.webp"
          x={x}
          y="32"
          width="2"
          height="2"
        />
      ))}
    </g>
  );
}
