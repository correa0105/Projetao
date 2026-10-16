import { house2DayPhases, type House2DayPhase } from '../shared/house2-lighting';
export function House2Lighting({ phase }: { phase: House2DayPhase }) {
  const sun = house2DayPhases[phase];
  return (
    <defs>
      {Object.entries({ tree: 1.25, rock: 0.45, plant: 0.2, house: 1, item: 0.25 }).map(
        ([kind, height]) => (
          <filter
            key={kind}
            id={'h2-shadow-' + kind}
            x="-90%"
            y="-90%"
            width="280%"
            height="280%"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow
              dx={sun.dx * height}
              dy={sun.dy * height}
              stdDeviation={sun.blur * Math.max(0.4, height)}
              floodColor="#15170f"
              floodOpacity={sun.opacity}
            />
          </filter>
        ),
      )}
      <filter id="h2-rock-tone" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values=".68" />
        <feComponentTransfer>
          <feFuncR type="linear" slope=".82" intercept=".025" />
          <feFuncG type="linear" slope=".84" intercept=".025" />
          <feFuncB type="linear" slope=".81" intercept=".02" />
        </feComponentTransfer>
      </filter>
    </defs>
  );
}
