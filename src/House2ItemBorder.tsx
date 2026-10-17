import { house2BorderHandles, type House2BorderHandle } from './house2-item-transform';
import { house2RotatedSize } from '../shared/house-v2';
import { RotateCw } from 'lucide-react';

const names: Record<House2BorderHandle, string> = {
  nw: 'superior esquerda',
  n: 'superior',
  ne: 'superior direita',
  e: 'direita',
  se: 'inferior direita',
  s: 'inferior',
  sw: 'inferior esquerda',
  w: 'esquerda',
};

export function House2ItemBorder({
  width,
  height,
  pixel,
  rotation,
  resize,
  turn,
}: {
  width: number;
  height: number;
  pixel: number;
  rotation: number;
  resize: (delta: number) => void;
  turn: (degrees: number) => void;
}) {
  const halfW = width / 2,
    halfH = height / 2;
  const top = -house2RotatedSize(width, height, rotation).height / 2;
  return (
    <g className="h2-item-border" aria-label="Editar pelas bordas do item">
      <rect
        data-house2-selection-border="true"
        className="h2-item-border-hit"
        x={-halfW}
        y={-halfH}
        width={width}
        height={height}
      />
      <rect className="h2-item-border-line" x={-halfW} y={-halfH} width={width} height={height} />
      <line
        className="h2-item-border-line"
        transform={`rotate(${-rotation})`}
        x1={0}
        y1={top}
        x2={0}
        y2={top - 32 * pixel}
      />
      {Object.entries(house2BorderHandles).map(([key, [sx, sy]]) => {
        const handle = key as House2BorderHandle;
        const angle = ((Math.atan2(sy, sx) * 180) / Math.PI + rotation + 360) % 180;
        const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
        return (
          <g
            key={handle}
            data-house2-handle={handle}
            className="h2-item-handle"
            role="button"
            tabIndex={0}
            aria-label={`Redimensionar pela borda ${names[handle]}`}
            style={{ cursor: cursors[Math.round(angle / 45) % 4] }}
            transform={`translate(${sx * halfW} ${sy * halfH}) scale(${pixel})`}
            onKeyDown={(e) => {
              if (
                ['ArrowUp', 'ArrowRight', '+', '=', 'ArrowDown', 'ArrowLeft', '-'].includes(e.key)
              ) {
                e.preventDefault();
                e.stopPropagation();
                resize(['ArrowDown', 'ArrowLeft', '-'].includes(e.key) ? -0.05 : 0.05);
              }
            }}
          >
            <title>Arraste para redimensionar. Use as setas ou + e − pelo teclado.</title>
            <rect className="h2-handle-hit" x={-12} y={-12} width={24} height={24} />
            <rect className="h2-handle-mark" x={-4} y={-4} width={8} height={8} rx={1.5} />
          </g>
        );
      })}
      <g
        data-house2-handle="rotate"
        className="h2-item-handle h2-item-turn"
        role="button"
        tabIndex={0}
        aria-label="Girar pela borda do item"
        transform={`rotate(${-rotation}) translate(0 ${top - 32 * pixel}) scale(${pixel})`}
        onKeyDown={(e) => {
          if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            turn((['ArrowLeft', 'ArrowDown'].includes(e.key) ? -1 : 1) * (e.shiftKey ? 15 : 1));
          }
        }}
      >
        <title>Arraste para girar livremente em 360°. Setas: 1°. Shift: passos de 15°.</title>
        <circle className="h2-handle-hit" r={18} />
        <circle className="h2-handle-mark" r={12} />
        <RotateCw className="h2-turn-icon" x={-7} y={-7} width={14} height={14} strokeWidth={1.8} />
      </g>
    </g>
  );
}
