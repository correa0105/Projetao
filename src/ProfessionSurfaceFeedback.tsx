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
  const p = impact?.points[0] ?? s;
  if (technique === 'pluck')
    return (
      <g className={'pf-lute-strings' + (working ? ' is-vibrating' : '')}>
        {Array.from({ length: 6 }, (_, i) => (
          <path
            key={i}
            d={`M${s.x - s.rx} ${s.y - 24 + i * 9}Q${s.x} ${s.y - 24 + i * 9 + Math.sin(phase * Math.PI * 14 + i) * 12} ${s.x + s.rx} ${s.y - 24 + i * 9}`}
          />
        ))}
      </g>
    );
  if (technique === 'seal')
    return (
      impact && (
        <g key={impact.id} className="pf-wax-impression" transform={`translate(${p.x} ${p.y})`}>
          <ellipse rx="23" ry="14" />
          <ellipse rx="16" ry="10" />
          <path d="M-8 3L0-7L8 3L0 7Z" />
        </g>
      )
    );
  if (technique === 'dose')
    return (
      working && (
        <g className="pf-dose-response">
          <ellipse cx={s.x} cy={s.y} rx={6 + phase * 38} ry={2 + phase * 10} />
          <circle cx={s.x} cy={s.y - 22 * (1 - phase)} r={2 + phase * 2} />
        </g>
      )
    );
  if (technique === 'gear')
    return (
      <g
        className="pf-gear-response"
        transform={`translate(${s.x} ${s.y}) rotate(${working ? phase * 70 : 0})`}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} transform={`rotate(${i * 45})`} d="M0-21V-29" />
        ))}
      </g>
    );
  if (technique === 'pick')
    return (
      working && (
        <g className="pf-lock-pin" transform={`translate(${s.x} ${s.y})`}>
          <path d={`M-12 10V${-10 - Math.sin(phase * Math.PI) * 16}M0 10V-17M12 10V-9`} />
          <path d="M-20 12H20" />
        </g>
      )
    );
  if (technique === 'glass')
    return (
      working && (
        <path
          className="pf-glass-reflection"
          d={`M${s.x - 18 + phase * 32} ${s.y - s.ry}Q${s.x + 8 + phase * 14} ${s.y} ${s.x - 18 + phase * 32} ${s.y + s.ry}`}
        />
      )
    );
  if (technique === 'bearing')
    return (
      <g className="pf-bearing-rose" transform={`translate(${s.x} ${s.y})`}>
        <circle r="30" />
        <path d="M0-45V45M-55 0H55M-20-20L20 20M20-20L-20 20" />
      </g>
    );
  if (technique === 'piece')
    return (
      impact && (
        <g key={impact.id} className="pf-board-engraving" transform={`translate(${p.x} ${p.y})`}>
          <path d="M-18-12H18V12H-18ZM-13-7H13V7H-13Z" />
        </g>
      )
    );
  return null;
}
