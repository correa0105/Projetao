import { professionToolArtwork } from '../shared/profession-production';
import type { WorkPoint } from './profession-work-surfaces';
export function ProfessionGlasswork({
  id,
  rotation,
  contact,
  working,
  reduced,
}: {
  id: string;
  rotation: number;
  contact: WorkPoint;
  working: boolean;
  reduced: boolean;
}) {
  const turn = reduced ? 0 : (rotation * Math.PI) / 180,
    scale = 1 + Math.sin(turn) * 0.08;
  const piece = '/professions/workshop-fixes-20261115/hot-glass.webp';
  return (
    <g className="pf-glassmaking" data-glass-turn={rotation}>
      <defs>
        <mask
          id={id + '-hot-glass'}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="960"
          height="640"
          style={{ maskType: 'alpha' }}
        >
          <image href={piece} x="400" y="160" width="330" height="220" />
        </mask>
        <linearGradient id={id + '-glass-light'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1c4" stopOpacity="0" />
          <stop offset=".48" stopColor="#fff5da" stopOpacity=".04" />
          <stop offset=".55" stopColor="#fff9e2" stopOpacity=".7" />
          <stop offset=".63" stopColor="#ffe5ac" stopOpacity=".08" />
          <stop offset="1" stopColor="#ffc87a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <image
        className="pf-blowpipe"
        href={professionToolArtwork('glass-blowpipe')}
        x="123"
        y="160"
        width="330"
        height="220"
      />
      <g transform={`translate(443 270) scale(1 ${scale}) translate(-443 -270)`}>
        <image className="pf-hot-glass" href={piece} x="400" y="160" width="330" height="220" />
        <g mask={'url(#' + id + '-hot-glass)'}>
          <rect
            x="390"
            y={160 + Math.sin(turn) * 48}
            width="340"
            height="220"
            fill={'url(#' + id + '-glass-light)'}
            opacity={working ? 0.65 : 0.3}
          />
          {working && (
            <ellipse cx={contact.x} cy={contact.y} rx="40" ry="32" fill="#ffde8b" opacity=".07" />
          )}
        </g>
      </g>
    </g>
  );
}
