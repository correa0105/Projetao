import { useEffect, useRef, useState } from 'react';
import { Home, LandPlot, Minus, Plus, Move, RotateCw, Save, Undo2, Grid2X2 } from 'lucide-react';
import {
  defaultGuildEstate,
  guildEstateHouse,
  guildEstateWorld,
  guildEstateRooms,
  guildEstateItems,
  guildEstateArt,
  guildEstateItemSize,
  guildEstateItemRoom,
  guildEstateSchema,
  type GuildEstateLayout,
  type GuildEstateItemId,
} from '../shared/guild-estate';
import { house2Landscape } from '../shared/house-v2';
import { guildFacilityCost, guildFacilityMaxLevel } from '../shared/guild-facilities';
import { money } from '../shared/rules';
import { api, post } from './api';
import { Modal } from './components';
import './guild-estate.css';

type Camera = { x: number; y: number; width: number };
type Props = {
  guildId: string;
  characterId: string;
  revision: number;
  estate?: GuildEstateLayout;
  owner: boolean;
  levels: { room: string; level: number }[];
  treasury: number | null;
  focusRoom: string;
  focusRequest: number;
  editRequest: number;
  changed: () => Promise<void>;
};
export function GuildEstate(p: Props) {
  const svg = useRef<SVGSVGElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1.5),
    [camera, setCamera] = useState<Camera>({ x: 30, y: 25, width: 60 });
  const [roof, setRoof] = useState(true),
    [grid, setGrid] = useState(false),
    [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<GuildEstateLayout>(() =>
    structuredClone(p.estate || defaultGuildEstate()),
  );
  const [selected, setSelected] = useState<GuildEstateItemId | null>(null),
    [detail, setDetail] = useState<GuildEstateItemId | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const gesture = useRef<{
    pointer: number;
    id?: GuildEstateItemId;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
    camera: Camera;
  } | null>(null);
  const editRevision = useRef(p.revision);
  const dirty = JSON.stringify(layout) !== JSON.stringify(p.estate || defaultGuildEstate());
  const url = (path: string) =>
    path + (p.characterId ? '?character_id=' + encodeURIComponent(p.characterId) : '');
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const o = new ResizeObserver(() => {
      const r = node.getBoundingClientRect();
      setRatio(r.width / Math.max(1, r.height));
    });
    o.observe(node);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    if (roof) setCamera({ x: 30, y: 25, width: Math.max(60, 50 * ratio) });
  }, [ratio]);
  useEffect(() => {
    if (!editing) setLayout(structuredClone(p.estate || defaultGuildEstate()));
  }, [p.estate, p.revision, editing]);
  function focus(room?: string) {
    setRoof(false);
    const r = guildEstateRooms.find((r) => r.id === room);
    setCamera(
      r
        ? { x: r.x + r.width / 2, y: r.y + r.height / 2, width: Math.max(11, 11 * ratio) }
        : { x: 30, y: ratio < 0.8 ? 26 : 24, width: Math.max(24, 20 * ratio) },
    );
  }
  useEffect(() => {
    if (p.focusRequest) focus(p.focusRoom);
  }, [p.focusRequest]);
  useEffect(() => {
    if (p.editRequest && p.owner) {
      editRevision.current = p.revision;
      setEditing(true);
      setError('');
      setNotice('');
      focus();
    }
  }, [p.editRequest, p.owner]);
  function bounded(c: Camera) {
    const width = Math.max(8, Math.min(85, c.width)),
      height = width / ratio;
    return {
      x: width >= 60 ? 30 : Math.max(width / 2, Math.min(60 - width / 2, c.x)),
      y: height >= 50 ? 25 : Math.max(height / 2, Math.min(50 - height / 2, c.y)),
      width,
    };
  }
  function point(clientX: number, clientY: number) {
    const node = svg.current!,
      q = node.createSVGPoint();
    q.x = clientX;
    q.y = clientY;
    const matrix = node.getScreenCTM();
    return matrix ? q.matrixTransform(matrix.inverse()) : { x: 30, y: 25 };
  }
  function change(id: GuildEstateItemId, values: Partial<GuildEstateLayout['items'][number]>) {
    if(busy||!p.owner)return false;
    const next = {
      ...layout,
      items: layout.items.map((i) => (i.id === id ? { ...i, ...values } : i)),
    };
    if (guildEstateSchema.safeParse(next).success) {
      setLayout(next);
      setError('');
      return true;
    }
    setError('Posicione o item dentro de um cômodo, sem atravessar paredes ou outro item.');
    return false;
  }
  function zoom(factor: number) {
    setCamera((c) => bounded({ ...c, width: c.width * factor }));
  }
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const q = point(e.clientX, e.clientY),
        factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      setCamera((c) =>
        bounded({
          width: c.width * factor,
          x: q.x + (c.x - q.x) * factor,
          y: q.y + (c.y - q.y) * factor,
        }),
      );
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [ratio]);
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(url('/guilds/' + p.guildId + '/estate'), {
        method: 'PATCH',
        body: JSON.stringify({ estate: layout, revision: editRevision.current }),
      });
      await p.changed();
      setEditing(false);
      setNotice('Posições dos quatro itens salvas.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const chosen = layout.items.find((i) => i.id === selected),
    definition = guildEstateItems.find((i) => i.id === detail),
    level = p.levels.find((i) => i.room === detail)?.level || 1;
  const h = guildEstateHouse,
    height = camera.width / ratio;
  const wallPaths =
    'M21 17H39V31H26.9 M25.3 31H21V17 M30 17V19.8 M30 21.2V26.8 M30 28.2V31 M21 24H24.8 M26.2 24H33.8 M35.2 24H39';
  return (
    <div ref={stage} className="guild-estate" data-guild-estate="single-property">
      <svg
        ref={svg}
        className={'guild-estate-map' + (editing ? ' is-editing' : '')}
        viewBox={`${camera.x - camera.width / 2} ${camera.y - height / 2} ${camera.width} ${height}`}
        aria-label="Terreno da guilda com uma casa humilde de quatro cômodos"
        onPointerDown={(e) => {
          if (e.button !== 0 || (e.target as Element).closest('[data-estate-interactive]')) return;
          gesture.current = {
            pointer: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY,
            x: 0,
            y: 0,
            camera,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.pointer !== e.pointerId) return;
          if (g.id) {
            const q = point(e.clientX, e.clientY);
            change(g.id, {
              x: Math.round((q.x - g.x) * 4) / 4,
              y: Math.round((q.y - g.y) * 4) / 4,
            });
          } else {
            const b = e.currentTarget.getBoundingClientRect();
            setCamera(
              bounded({
                ...g.camera,
                x: g.camera.x - ((e.clientX - g.clientX) / b.width) * g.camera.width,
                y: g.camera.y - ((e.clientY - g.clientY) / b.width) * g.camera.width,
              }),
            );
          }
        }}
        onPointerUp={(e) => {
          if (gesture.current?.pointer === e.pointerId) gesture.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
      >
        <defs>
          <pattern id="ge-grass" width="8" height="8" patternUnits="userSpaceOnUse">
            <image
              href={house2Landscape}
              width="8"
              height="8"
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
          <pattern id="ge-earth" width="3" height="3" patternUnits="userSpaceOnUse">
            <image href="/vtt/terrain-v3-20261013/earth.webp" width="3" height="3" />
          </pattern>
          <pattern id="ge-floor" width="3.6" height="3.6" patternUnits="userSpaceOnUse">
            <image href="/vtt/terrain-v3-20261013/wood.webp" width="3.6" height="3.6" />
          </pattern>
          <pattern id="ge-grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M1 0H0V1" fill="none" stroke="#e1d3aa" strokeWidth=".025" opacity=".32" />
          </pattern>
          <pattern id="ge-fence" width="2.5" height="2.5" patternUnits="userSpaceOnUse">
            <path d="M0 .3H2.5M0 1H2.5" stroke="#59452c" strokeWidth=".16" />
            <path d="M.1 0V1.25" stroke="#2e2519" strokeWidth=".23" />
          </pattern>
          <filter id="ge-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx=".12"
              dy=".16"
              stdDeviation=".12"
              floodColor="#17120b"
              floodOpacity=".5"
            />
          </filter>
        </defs>
        <rect x="-60" y="-60" width="180" height="180" fill="url(#ge-grass)" />
        <rect
          data-guild-estate-land="single"
          x="7"
          y="5"
          width="46"
          height="40"
          rx=".4"
          fill="#918350"
          opacity=".07"
        />
        <path d="M26.1 45V31" stroke="url(#ge-earth)" strokeWidth="2.3" fill="none" />
        <g aria-label="Limites do terreno" opacity=".85">
          <path d="M7 45V5H53V45H28 M24.3 45H7" fill="none" stroke="#352b1d" strokeWidth=".25" />
          <path
            d="M7 5H53M7 45H24.3M28 45H53"
            fill="none"
            stroke="url(#ge-fence)"
            strokeWidth=".9"
          />
          {Array.from({ length: 17 }, (_, i) => (
            <g key={i}>
              <rect x="6.8" y={4.8 + i * 2.5} width=".4" height=".4" fill="#58402a" />
              <rect x="52.8" y={4.8 + i * 2.5} width=".4" height=".4" fill="#58402a" />
            </g>
          ))}
        </g>
        <g data-guild-estate-house="humble-four-rooms" filter="url(#ge-shadow)">
          <rect x={h.x} y={h.y} width={h.width} height={h.height} fill="url(#ge-floor)" />
          <rect x="30.4" y="17.4" width="8.2" height="6.2" fill="url(#ge-earth)" opacity=".38" />
          <path
            d={wallPaths}
            fill="none"
            stroke="#292016"
            strokeWidth=".65"
            strokeLinejoin="miter"
          />
          <path d={wallPaths} fill="none" stroke="#806141" strokeWidth=".36" />
          <path
            d="M25.3 31V29.4M30 19.8H28.6M30 26.8H31.4M24.8 24V22.6M33.8 24V25.4"
            stroke="#70502e"
            strokeWidth=".14"
          />
          <g stroke="#a7bdba" strokeWidth=".16">
            <path d="M23 17H24.5M35.5 17H37M21 19.3V20.8M39 26.4V28" />
          </g>
        </g>
        {!roof && (
          <>
            {guildEstateRooms.map((r) => (
              <text
                key={r.id}
                x={r.x + r.width / 2}
                y={r.y + 0.65}
                className="guild-estate-room-label"
                textAnchor="middle"
              >
                {r.name}
              </text>
            ))}
            {layout.items.map((i) => {
              const spec = guildEstateItems.find((f) => f.id === i.id)!,
                art = guildEstateArt(i.id),
                w = art.width * 1.4,
                hh = art.height * 1.4;
              const lv = p.levels.find((f) => f.room === i.id)?.level || 1;
              return (
                <g
                  key={i.id}
                  data-estate-interactive="item"
                  data-guild-estate-item={i.id}
                  data-x={i.x}
                  data-y={i.y}
                  data-rotation={i.rotation}
                  className={'guild-estate-item' + (selected === i.id ? ' selected' : '')}
                  transform={`translate(${i.x} ${i.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={spec.name + ' · nível ' + lv}
                  onClick={() => {
                    setSelected(i.id);
                    if (!editing) {
                      setError('');
                      setDetail(i.id);
                    }
                  }}
                  onPointerDown={(e) => {
                    if (!editing || busy || !p.owner || e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setSelected(i.id);
                    const q = point(e.clientX, e.clientY);
                    gesture.current = {
                      pointer: e.pointerId,
                      id: i.id,
                      clientX: e.clientX,
                      clientY: e.clientY,
                      x: q.x - i.x,
                      y: q.y - i.y,
                      camera,
                    };
                    svg.current?.setPointerCapture(e.pointerId);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(i.id);
                      if (!editing) setDetail(i.id);
                    }
                    if (
                      editing &&
                      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'r', 'R'].includes(e.key)
                    ) {
                      e.preventDefault();
                      setSelected(i.id);
                      if (e.key.toLowerCase() === 'r')
                        change(i.id, { rotation: ((i.rotation + 90) % 360) as 0 | 90 | 180 | 270 });
                      else
                        change(i.id, {
                          x:
                            i.x +
                            (e.key === 'ArrowLeft' ? -0.25 : e.key === 'ArrowRight' ? 0.25 : 0),
                          y: i.y + (e.key === 'ArrowUp' ? -0.25 : e.key === 'ArrowDown' ? 0.25 : 0),
                        });
                    }
                  }}
                >
                  <title>{spec.name + ' · nível ' + lv}</title>
                  <g transform={`rotate(${i.rotation})`}>
                    <rect
                      x={-w / 2 - 0.12}
                      y={-hh / 2 - 0.12}
                      width={w + 0.24}
                      height={hh + 0.24}
                      rx=".12"
                      className="guild-estate-selection"
                    />
                    <image
                      href={art.image}
                      x={-w / 2}
                      y={-hh / 2}
                      width={w}
                      height={hh}
                      preserveAspectRatio="xMidYMid meet"
                      filter="url(#ge-shadow)"
                    />
                  </g>
                  <text
                    x="0"
                    y={guildEstateItemSize(i.id, i.rotation).height / 2 + 0.55}
                    textAnchor="middle"
                    className="guild-estate-item-level"
                  >
                    Nv. {lv}
                  </text>
                </g>
              );
            })}
          </>
        )}
        {roof && (
          <g
            role="button"
            tabIndex={0}
            data-estate-interactive="roof"
            aria-label="Entrar na sede da guilda"
            className="guild-estate-roof"
            onClick={() => focus()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                focus();
              }
            }}
          >
            <image
              href="/vtt/houses-empty-20261014/house-001-roof.webp"
              x="19.2"
              y="14.8"
              width="21.6"
              height="18.4"
              preserveAspectRatio="none"
              filter="url(#ge-shadow)"
            />
            <text x="30" y="33" textAnchor="middle" className="guild-estate-enter">
              Entrar na sede
            </text>
          </g>
        )}
        {grid && (
          <rect x="7" y="5" width="46" height="40" fill="url(#ge-grid)" pointerEvents="none" />
        )}
      </svg>
      <div className="guild-estate-controls" aria-label="Controles do terreno">
        <button
          type="button"
          aria-label="Ver terreno completo"
          onClick={() => {
            setRoof(true);
            setCamera({ x: 30, y: 25, width: Math.max(60, 50 * ratio) });
          }}
        >
          <LandPlot size={17} />
          <span>Terreno</span>
        </button>
        <button type="button" aria-label="Ver os quatro cômodos" onClick={() => focus()}>
          <Home size={17} />
          <span>Casa</span>
        </button>
        <button type="button" aria-label="Aproximar sede" onClick={() => zoom(0.8)}>
          <Plus size={17} />
        </button>
        <button type="button" aria-label="Afastar sede" onClick={() => zoom(1.25)}>
          <Minus size={17} />
        </button>
        <button
          type="button"
          aria-label="Mostrar grade da sede"
          aria-pressed={grid}
          onClick={() => setGrid(!grid)}
        >
          <Grid2X2 size={17} />
        </button>
      </div>
      {editing && (
        <div className="guild-estate-editor" aria-label="Reposicionar instalações da guilda">
          <h3>
            <Move size={16} />
            Mobília da sede <small>4 itens</small>
          </h3>
          <p>Selecione e arraste. Use as setas para ajustar e R para girar.</p>
          <select
            aria-label="Selecionar instalação"
            value={selected || ''}
            onChange={(e) => {
              const id = e.target.value as GuildEstateItemId;
              setSelected(id);
              const i = layout.items.find((i) => i.id === id);
              if (i) focus(guildEstateItemRoom(i)?.id);
            }}
          >
            <option value="">Escolha um dos quatro itens</option>
            {guildEstateItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <div>
            {chosen && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  change(chosen.id, {
                    rotation: ((chosen.rotation + 90) % 360) as 0 | 90 | 180 | 270,
                  })
                }
              >
                <RotateCw size={15} />
                Girar item
              </button>
            )}
            <button type="button" disabled={busy || !dirty} onClick={() => void save()}>
              <Save size={15} />
              {busy ? 'Salvando…' : 'Salvar posições'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setLayout(structuredClone(p.estate || defaultGuildEstate()));
                setEditing(false);
                setError('');
              }}
            >
              <Undo2 size={15} />
              Cancelar
            </button>
          </div>
        </div>
      )}
      {!editing && !roof && (
        <p className="guild-estate-hint">
          Arraste o chão para explorar · clique em um dos quatro itens para evoluir
        </p>
      )}
      {(error || notice) && (
        <p
          className={'guild-estate-feedback' + (error ? ' error' : '')}
          role={error ? 'alert' : 'status'}
        >
          {error || notice}
        </p>
      )}
      {definition && (
        <Modal title={definition.name + ' · nível ' + level} close={() => !busy && setDetail(null)}>
          <div className="guild-estate-item-details">
            <img src={guildEstateArt(definition.id).image} alt="" />
            <p>Esta é uma das quatro instalações da sede. Suas melhorias pertencem à guilda.</p>
            <p>
              Nível {level}/{guildFacilityMaxLevel} · Tesouro:{' '}
              {p.treasury === null ? 'Disponível aos membros' : money(p.treasury)}
            </p>
            {level < guildFacilityMaxLevel && (
              <p>Próximo nível: {money(guildFacilityCost(level))} do tesouro.</p>
            )}
            {p.owner && level < guildFacilityMaxLevel && (
              <button
                type="button"
                className="button primary"
                disabled={busy || (p.treasury ?? 0) < guildFacilityCost(level)}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await post(
                      url('/guilds/' + p.guildId + '/facilities/' + definition.id + '/upgrade'),
                      { level: level + 1 },
                    );
                    await p.changed();
                    setNotice('Instalação evoluída.');
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Evoluindo…' : 'Evoluir instalação'}
              </button>
            )}
            {error && <p role="alert">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
