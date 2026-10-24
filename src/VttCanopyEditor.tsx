import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Eye, Plus, Save, Trash2, Undo2, X } from 'lucide-react';
import type { Point, VttScene } from '../shared/vtt';
import {
  bindCanopy,
  canopySource,
  resolveCanopy,
  canopyAreaSchema,
  type CanopyArea,
} from '../shared/vtt-canopies';
import type { VttCamera } from './vtt-canvas';
import './vtt-canopies.css';

export function VttCanopyEditor({
  scene,
  camera,
  bounds,
  update,
  close,
  save,
  busy,
  navigation,
  selectedItemId,
}: {
  scene: VttScene;
  camera: VttCamera;
  bounds: { width: number; height: number };
  update: (areas: CanopyArea[], opacity?: number) => void;
  close: () => void;
  save: () => void;
  busy: boolean;
  navigation: {
    button: 'right' | 'left';
    holding: () => boolean;
    wheel: (e: React.WheelEvent<SVGSVGElement>) => void;
    down: (e: PointerEvent<SVGSVGElement>) => void;
    move: (e: PointerEvent<SVGSVGElement>) => void;
    up: (e: PointerEvent<SVGSVGElement>) => void;
  };
  selectedItemId?: string;
}) {
  const [method, setMethod] = useState('polygon'),
    [creating, setCreating] = useState(false),
    [points, setPoints] = useState<Point[]>([]),
    [selected, setSelected] = useState(''),
    [error, setError] = useState('');
  const [targetId, setTargetId] = useState(
    scene.tokens.some((t) => t.id === selectedItemId && t.layer === 'map')
      ? selectedItemId!
      : 'auto',
  );
  const navigating = useRef(false);
  const gesture = useRef<{
    start: Point;
    points: Point[];
    corner?: number;
    area?: CanopyArea;
  } | null>(null);
  const areas = scene.canopyAreas || [],
    rawArea = areas.find((a) => a.id === selected),
    area = rawArea ? resolveCanopy(rawArea, scene.tokens) : null;
  useEffect(() => {
    const next = areas.map((a) => {
      const t = !a.source && canopySource(a, scene.tokens);
      return t ? bindCanopy(a, t) : a;
    });
    if (next.some((a, i) => a !== areas[i])) update(next);
  }, []);
  const adjust = (a: CanopyArea, ps: Point[]) => {
    const t = a.source && scene.tokens.find((t) => t.id === a.source!.tokenId);
    return t ? bindCanopy({ ...a, points: ps }, t) : { ...a, points: ps };
  };
  const screen = (p: Point) => ({
    x: (p.x - camera.x) * camera.zoom + bounds.width / 2,
    y: (p.y - camera.y) * camera.zoom + bounds.height / 2,
  });
  const world = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(scene.width, (e.clientX - r.left - bounds.width / 2) / camera.zoom + camera.x),
      ),
      y: Math.max(
        0,
        Math.min(scene.height, (e.clientY - r.top - bounds.height / 2) / camera.zoom + camera.y),
      ),
    };
  };
  const shape = (ps: Point[]) =>
    ps
      .map(screen)
      .map((p) => p.x + ',' + p.y)
      .join(' ');
  const change = (patch: Partial<CanopyArea>) =>
    update(
      areas.map((a) =>
        a.id === selected
          ? patch.points
            ? adjust({ ...a, ...patch }, patch.points)
            : { ...a, ...patch }
          : a,
      ),
    );
  const add = (ps = points) => {
    const result = canopyAreaSchema.safeParse({
      id: crypto.randomUUID(),
      name: 'Área ' + (areas.length + 1),
      points: ps,
      opacity: 0.25,
      enabled: true,
    });
    if (!result.success) {
      setError('Marque pelo menos três pontos e uma área com tamanho visível.');
      return;
    }
    if (areas.length >= 80) return;
    const source =
      targetId === 'auto'
        ? canopySource(result.data, scene.tokens)
        : scene.tokens.find((t) => t.id === targetId && t.layer === 'map');
    const next = source ? bindCanopy(result.data, source) : result.data;
    update([...areas, next]);
    setSelected(result.data.id);
    setPoints([]);
    setCreating(false);
    setError('');
  };
  return (
    <div className="vtt-canopy-editor" aria-label="Editor de áreas de transparência">
      <svg
        className="vtt-canopy-selection"
        role="img"
        aria-label="Selecionar partes do mapa"
        viewBox={`0 0 ${bounds.width} ${bounds.height}`}
        onWheel={navigation.wheel}
        onPointerDown={(e) => {
          const p = world(e),
            target = e.target as SVGElement;
          const corner = target.dataset.corner;
          if (
            e.button === 1 ||
            (e.button === 0 && (navigation.holding() || e.ctrlKey)) ||
            (e.button === 2 && navigation.button === 'right') ||
            (e.button === 0 && (navigation.button === 'left' || e.pointerType === 'touch') &&
              !creating && !target.dataset.area && corner === undefined)
          ) {
            navigating.current = true;
            navigation.down(e);
            return;
          }
          if (e.button !== 0) return;
          if (corner !== undefined && area) {
            gesture.current = {
              start: p,
              points: area.points,
              corner: Number(corner),
              area: structuredClone(area),
            };
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          if (!creating) {
            const id = target.dataset.area;
            setSelected(id || '');
            return;
          }
          if (method === 'polygon') {
            setPoints((v) => [...v, p].slice(0, 128));
            return;
          }
          gesture.current = { start: p, points: [p] };
          setPoints([p]);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onContextMenu={e => e.preventDefault()}
        onPointerMove={(e) => {
          if (navigating.current) {
            navigation.move(e);
            return;
          }
          const g = gesture.current;
          if (!g) return;
          const p = world(e);
          if (g.corner !== undefined && g.area) {
            const ps = g.area.points.map((v, i) => (i === g.corner ? p : v));
            if (canopyAreaSchema.safeParse({ ...g.area, points: ps }).success)
              update(areas.map((a) => (a.id === g.area!.id ? adjust(a, ps) : a)));
          } else if (method === 'rect') {
            const a = g.start;
            g.points = [a, { x: p.x, y: a.y }, p, { x: a.x, y: p.y }];
            setPoints(g.points);
          } else if (
            Math.hypot(p.x - g.points.at(-1)!.x, p.y - g.points.at(-1)!.y) > 5 / camera.zoom &&
            g.points.length < 128
          ) {
            g.points = [...g.points, p];
            setPoints(g.points);
          }
        }}
        onPointerUp={(e) => {
          if (navigating.current) {
            navigating.current = false;
            navigation.up(e);
            return;
          }
          const g = gesture.current;
          gesture.current = null;
          if (g && g.corner === undefined) add(g.points);
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={(e) => {
          if (navigating.current) {
            navigating.current = false;
            navigation.up(e);
          }
          gesture.current = null;
          setPoints([]);
        }}
      >
        {areas.map((a) => (
          <polygon
            key={a.id}
            data-area={a.id}
            points={shape(resolveCanopy(a, scene.tokens)?.points || [])}
            className={selected === a.id ? 'selected' : ''}
            opacity={a.enabled ? 1 : 0.35}
          />
        ))}
        {points.length > 0 && <polyline points={shape(points)} className="draft" />}
        {creating &&
          points.map((p, i) => <circle key={i} cx={screen(p).x} cy={screen(p).y} r="4" />)}
        {!creating &&
          area?.points.map((p, i) => (
            <circle
              key={i}
              data-corner={i}
              cx={screen(p).x}
              cy={screen(p).y}
              r="7"
              tabIndex={0}
              role="button"
              aria-label={`Mover ponto ${i + 1}`}
              onKeyDown={(e) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
                e.preventDefault();
                const step = (e.shiftKey ? 10 : 1) / camera.zoom;
                const ps = area.points.map((v, j) =>
                  j !== i
                    ? v
                    : {
                        x: Math.max(
                          0,
                          Math.min(
                            scene.width,
                            v.x +
                              (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0),
                          ),
                        ),
                        y: Math.max(
                          0,
                          Math.min(
                            scene.height,
                            v.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0),
                          ),
                        ),
                      },
                );
                if (canopyAreaSchema.safeParse({ ...area, points: ps }).success)
                  change({ points: ps });
              }}
            />
          ))}
      </svg>
      <aside className="vtt-canopy-controls">
        <header>
          <Eye size={17} />
          <h3>Áreas de transparência</h3>
          <button aria-label="Fechar editor de transparência" onClick={close}>
            <X size={16} />
          </button>
        </header>
        <p>
          Marque copas, telhados ou partes do mapa que ficam sobre os personagens. Elas suavizam
          quando alguém passa por baixo.
        </p>
        <label>
          Objeto da seleção
          <select
            aria-label="Objeto da transparência"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="auto">Detectar o item automaticamente</option>
            <option value="background">Mapa de fundo</option>
            {scene.tokens
              .filter((t) => t.layer === 'map' && t.image && !t.animatedAsset)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span className="vtt-canopy-label-line">
            <span>Opacidade das árvores</span>
            <output>{Math.round((scene.canopyOpacity ?? 0.35) * 100)}%</output>
          </span>
          <input
            aria-label="Opacidade das árvores"
            type="range"
            min=".1"
            max=".8"
            step=".05"
            value={scene.canopyOpacity ?? 0.35}
            onChange={(e) => update(areas, Number(e.target.value))}
          />
        </label>
        <div className="vtt-canopy-row">
          <select
            aria-label="Modo de seleção de transparência"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPoints([]);
            }}
          >
            <option value="polygon">Polígono</option>
            <option value="free">Seleção livre</option>
            <option value="rect">Retângulo</option>
          </select>
          <button
            disabled={areas.length >= 80}
            onClick={() => {
              setCreating(true);
              setSelected('');
              setPoints([]);
            }}
          >
            <Plus size={14} />
            Nova área
          </button>
        </div>
        {creating && (
          <>
            <p className="vtt-canopy-hint">
              {method === 'polygon'
                ? 'Clique ao redor da parte desejada e conclua a seleção.'
                : 'Arraste para contornar a parte desejada.'}
            </p>
            <div className="vtt-canopy-row">
              {method === 'polygon' && (
                <button disabled={points.length < 3} onClick={() => add()}>
                  Concluir seleção
                </button>
              )}
              <button disabled={!points.length} onClick={() => setPoints((v) => v.slice(0, -1))}>
                <Undo2 size={14} />
                Ponto
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setPoints([]);
                }}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <label>
          Áreas do mapa
          <select
            aria-label="Áreas do mapa"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setCreating(false);
            }}
          >
            <option value="">Selecionar área ({areas.length})</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {area && (
          <>
            <p>
              {area.source
                ? 'Vinculada a ' +
                  (scene.tokens.find((t) => t.id === area.source!.tokenId)?.name || 'item') +
                  '. O recorte acompanha o objeto e respeita o PNG.'
                : 'Área do mapa de fundo.'}
            </p>
            <label>
              Nome da área
              <input
                aria-label="Nome da área transparente"
                maxLength={80}
                value={area.name}
                onChange={(e) => change({ name: e.target.value || 'Área' })}
              />
            </label>
            <label>
              <span className="vtt-canopy-label-line">
                <span>Opacidade sob personagens</span>
                <output>{Math.round(area.opacity * 100)}%</output>
              </span>
              <input
                aria-label="Opacidade da área"
                type="range"
                min=".1"
                max=".8"
                step=".05"
                value={area.opacity}
                onChange={(e) => change({ opacity: Number(e.target.value) })}
              />
            </label>
            <label className="vtt-canopy-toggle">
              <input
                type="checkbox"
                checked={area.enabled}
                onChange={(e) => change({ enabled: e.target.checked })}
              />
              Área ativa
            </label>
            <div className="vtt-canopy-row">
              <small>Arraste os pontos para ajustar o contorno.</small>
              <button
                aria-label="Remover área transparente"
                onClick={() => {
                  update(areas.filter((a) => a.id !== selected));
                  setSelected('');
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </>
        )}
        <button className="vtt-canopy-save" disabled={busy} onClick={save}>
          <Save size={15} />
          {busy ? 'Salvando…' : 'Salvar áreas'}
        </button>
      </aside>
    </div>
  );
}
