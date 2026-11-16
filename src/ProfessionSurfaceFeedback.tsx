import type { WorkPoint, professionSurface } from './profession-work-surfaces';
export function ProfessionSurfaceFeedback({
  technique,
  surface: s,
  working,
  phase,
  impact,
}: {
  technique: string;
  surface: ReturnType<typeof professionSurface>;
  working: boolean;
  phase: number;
  impact: { id: number; points: WorkPoint[] } | null;
}) {
  if (technique === 'pluck')
    return (
      <g className={'pf-lute-strings' + (working ? ' is-vibrating' : '')}>
        {Array.from({ length: 6 }, (_, i) => {
          const position = phase * phase * (3 - 2 * phase),
            crossing = Math.max(0, (-4 + i * 9) / 44),
            age = position - crossing;
          const displacement =
            working && age > 0 ? Math.sin(age * Math.PI * 58) * 1.4 * Math.exp(-age * 9) : 0;
          return (
            <path
              key={i}
              d={`M${s.x - s.rx} ${s.y - 24 + i * 9}Q${s.x} ${s.y - 24 + i * 9 + displacement} ${s.x + s.rx} ${s.y - 24 + i * 9}`}
            />
          );
        })}
      </g>
    );
  return null;
}
