import type { House2Plot } from '../shared/house-v2';
import { house2World } from '../shared/house-v2';
import { house2Floor, house2HouseWorld, type House2Token } from '../shared/house2-tokens';

export function House2IndoorVision({ plot }: { plot: House2Plot | null }) {
  const f = plot && house2Floor(plot);
  if (!plot || !f) return null;
  const margin = 0.16;
  const corners = [
    { x: f.left - margin, y: f.top - margin },
    { x: f.right + margin, y: f.top - margin },
    { x: f.right + margin, y: f.bottom + margin },
    { x: f.left - margin, y: f.bottom + margin },
  ].map((at) => house2HouseWorld(plot, at));
  const d =
    `M${house2World.x} ${house2World.y}h200v200h-200Z M` +
    corners.map((p) => p.x + ' ' + p.y).join(' L') +
    ' Z';
  return (
    <path
      data-house2-indoor-vision={plot.id}
      d={d}
      fill="#090d11"
      fillRule="evenodd"
      pointerEvents="visiblePainted"
    />
  );
}
export function House2Doors({
  plots,
  interior,
  viewer,
  busy,
  inspect,
  toggle,
}: {
  plots: House2Plot[];
  interior: string | null;
  viewer?: House2Token;
  busy: boolean;
  inspect: (p: House2Plot) => void;
  toggle: (p: House2Plot) => void;
}) {
  return (
    <g data-house2-doors="true">
      {plots
        .filter((p) => p.house_id)
        .map((p) => {
          const f = house2Floor(p)!;
          const at = house2HouseWorld(p, { x: f.doorEnd + 0.55, y: f.bottom + 0.95 });
          const name = viewer
            ? `${p.door_open ? 'Fechar' : 'Abrir'} porta da casa de ${p.owner_name}`
            : `${interior === p.id ? 'Sair da' : 'Entrar na'} casa de ${p.owner_name}`;
          return (
            <g key={p.id}>
              <g
                className="h2-door"
                role="button"
                tabIndex={busy ? -1 : 0}
                aria-disabled={busy}
                aria-label={name}
                transform={`translate(${at.x} ${at.y})`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  if (!busy) viewer ? toggle(p) : inspect(p);
                }}
                onKeyDown={(e) => {
                  if (!busy && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    viewer ? toggle(p) : inspect(p);
                  }
                }}
              >
                <title>{name}</title>
                <circle r=".25" fill="#191710" stroke="#c2a469" strokeWidth=".025" />
                <path
                  transform="scale(.47)"
                  d={
                    p.door_open
                      ? 'M-.2 .24v-.47h.36v.47m-.5 0h.65 M-.2-.23l.18.1v.47L-.2.24Z'
                      : 'M-.2 .24v-.47h.36v.47m-.5 0h.65'
                  }
                  fill="none"
                  stroke="#e1cca0"
                  strokeWidth=".04"
                />
              </g>
            </g>
          );
        })}
    </g>
  );
}
