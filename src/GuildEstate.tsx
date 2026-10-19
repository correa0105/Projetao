import { useEffect, useRef, useState } from 'react';
import {
  Home,
  LandPlot,
  Minus,
  Plus,
  Move,
  RotateCw,
  Save,
  Undo2,
  Grid2X2,
  ShoppingBasket,
  Paintbrush,
  Archive,
} from 'lucide-react';
import { GuildEstateActors } from './GuildEstateActors';
import { House2ItemBorder } from './House2ItemBorder';
import './house2.css';
import { GuildEstateScenery } from './GuildEstateScenery';
import { GuildEstateShop } from './GuildEstateShop';
import { GuildEstateFurnitureLayer } from './GuildEstateFurnitureLayer';
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
  guildEstateFurnitureCatalog,
  guildEstateFurnitureRoom,
  guildEstateFurnitureSize,
  guildEstateFurnitureFlat,
  guildEstateFinishes,
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
  member: boolean;
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
    guildEstateSchema.parse(p.estate || defaultGuildEstate()),
  );
  const [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<GuildEstateItemId | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [shop, setShop] = useState(false),
    [placing, setPlacing] = useState<string | null>(null);
  const [snap, setSnap] = useState(false);
  const transformGesture = useRef<{
    id: string;
    kind: string;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    distance: number;
    angle: number;
  } | null>(null);
  const purchaseKeys = useRef<Record<string, string>>({});
  const gesture = useRef<{
    pointer: number;
    id?: string;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
    camera: Camera;
  } | null>(null);
  const editRevision = useRef(p.revision);
  const dirty =
    JSON.stringify(layout) !==
    JSON.stringify(guildEstateSchema.parse(p.estate || defaultGuildEstate()));
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
    if (roof) setCamera({ x: 30, y: 25, width: Math.max(46, 34 * ratio) });
  }, [ratio]);
  useEffect(() => {
    if (!editing) setLayout(guildEstateSchema.parse(p.estate || defaultGuildEstate()));
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
    if (p.editRequest && p.owner) beginEdit();
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
  function change(id: string, values: Record<string, unknown>) {
    if (busy || !p.owner) return false;
    const next = {
      ...layout,
      items: layout.items.map((i) => (i.id === id ? { ...i, ...values } : i)),
      furniture: layout.furniture.map((i) => (i.id === id ? { ...i, ...values } : i)),
    };
    if (guildEstateSchema.safeParse(next).success) {
      setLayout(next);
      setError('');
      return true;
    }
    setError(
      'Mantenha o centro da peça dentro da casa. O posicionamento junto às paredes é livre.',
    );
    return false;
  }
  function zoom(factor: number) {
    setCamera((c) => bounded({ ...c, width: c.width * factor }));
  }
  function beginEdit() {
    if (!p.owner || busy) return;
    if (!editing) {
      editRevision.current = p.revision;
      setLayout(guildEstateSchema.parse(p.estate || defaultGuildEstate()));
    }
    setEditing(true);
    setShop(false);
    setError('');
    setNotice('');
    focus();
  }
  function openShop() {
    if (busy) return;
    if (dirty) {
      setError('Salve ou cancele a edição antes de abrir a loja.');
      return;
    }
    setError('');
    setShop(true);
  }
  function placeFurniture(id: string, next = layout, revision = p.revision) {
    setLayout(guildEstateSchema.parse(next));
    editRevision.current = revision;
    setShop(false);
    setEditing(true);
    setSelected(id);
    const item = next.furniture.find((i) => i.id === id);
    setPlacing(item?.x === null ? id : null);
    focus(item && item.x !== null ? guildEstateFurnitureRoom(item)?.id : undefined);
    setNotice(
      item?.x === null
        ? 'Clique no piso de um cômodo para colocar o móvel.'
        : 'Arraste o móvel para reposicionar.',
    );
  }
  async function buy(catalog: string) {
    setBusy(true);
    setError('');
    const key = purchaseKeys.current[catalog] || crypto.randomUUID();
    purchaseKeys.current[catalog] = key;
    try {
      const r = await post<{ estate: GuildEstateLayout; revision: number; item_id: string }>(
        url('/guilds/' + p.guildId + '/estate/furniture'),
        { catalog_id: catalog, request_id: key },
      );
      await p.changed();
      delete purchaseKeys.current[catalog];
      placeFurniture(r.item_id, r.estate, r.revision);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
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
      setNotice('Sede, móveis e acabamentos salvos.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const chosen =
      layout.items.find((i) => i.id === selected) ||
      layout.furniture.find((i) => i.id === selected),
    definition = guildEstateItems.find((i) => i.id === detail),
    level = p.levels.find((i) => i.room === detail)?.level || 1;
  const h = guildEstateHouse,
    height = camera.width / ratio;
  const wallPaths =
    'M21 17H39V31H30.8 M29.2 31H21V17 M30 17V19.8 M30 21.2V26.8 M21 24H24.8 M26.2 24H33.8 M35.2 24H39';
  const finishes = layout.finishes,
    roofArt = guildEstateFinishes.roof.find((f) => f.id === finishes.roof)!,
    floorArt = guildEstateFinishes.floor.find((f) => f.id === finishes.floor)!,
    wallArt = guildEstateFinishes.walls.find((f) => f.id === finishes.walls)!;
  return (
    <div ref={stage} className="guild-estate" data-guild-estate="single-property">
      <svg
        ref={svg}
        className={'guild-estate-map' + (editing ? ' is-editing' : '')}
        viewBox={`${camera.x - camera.width / 2} ${camera.y - height / 2} ${camera.width} ${height}`}
        aria-label="Terreno da guilda com uma casa humilde de quatro cômodos"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (placing && editing) {
            const q = point(e.clientX, e.clientY);
            if (
              change(placing, {
                x: snap ? Math.round(q.x * 4) / 4 : q.x,
                y: snap ? Math.round(q.y * 4) / 4 : q.y,
              })
            )
              setPlacing(null);
            e.preventDefault();
            return;
          }
          if ((e.target as Element).closest('[data-estate-interactive]')) return;
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
          const t = transformGesture.current;
          if (t) {
            const q = point(e.clientX, e.clientY);
            if (t.kind === 'rotate')
              change(t.id, {
                rotation:
                  (((t.rotation + ((Math.atan2(q.y - t.y, q.x - t.x) - t.angle) * 180) / Math.PI) %
                    360) +
                    360) %
                  360,
              });
            else
              change(t.id, {
                scale: Math.max(
                  0.25,
                  Math.min(3, (t.scale * Math.hypot(q.x - t.x, q.y - t.y)) / t.distance),
                ),
              });
            return;
          }
          const g = gesture.current;
          if (!g || g.pointer !== e.pointerId) return;
          if (g.id) {
            const q = point(e.clientX, e.clientY);
            change(g.id, {
              x: snap ? Math.round((q.x - g.x) * 4) / 4 : q.x - g.x,
              y: snap ? Math.round((q.y - g.y) * 4) / 4 : q.y - g.y,
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
          transformGesture.current = null;
          if (gesture.current?.pointer === e.pointerId) gesture.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          transformGesture.current = null;
          gesture.current = null;
        }}
      >
        <defs>
          <pattern id="ge-paving" width="3" height="3" patternUnits="userSpaceOnUse">
            <image href="/vtt/terrain-expansion-20261015/cobblestone.webp" width="3" height="3" />
          </pattern>
          <pattern id="ge-masonry" width="2.4" height="2.4" patternUnits="userSpaceOnUse">
            <image href={wallArt.image} width="2.4" height="2.4" />
          </pattern>
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
            <image href={floorArt.image} width="3.6" height="3.6" filter="url(#ge-floor-tone)" />
          </pattern>
          <pattern id="ge-grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M1 0H0V1" fill="none" stroke="#e1d3aa" strokeWidth=".025" opacity=".32" />
          </pattern>
          <pattern id="ge-fence" width="2.5" height="2.5" patternUnits="userSpaceOnUse">
            <path d="M0 .3H2.5M0 1H2.5" stroke="#59452c" strokeWidth=".16" />
            <path d="M.1 0V1.25" stroke="#2e2519" strokeWidth=".23" />
          </pattern>
          <filter id="ge-floor-tone">
            <feColorMatrix type="saturate" values=".52" />
            <feComponentTransfer>
              <feFuncR type="linear" slope=".84" />
              <feFuncG type="linear" slope=".84" />
              <feFuncB type="linear" slope=".84" />
            </feComponentTransfer>
          </filter>
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
        <GuildEstateScenery wooded={finishes.trees} />
        <g data-guild-estate-house="illustrated-four-rooms">
          <image
            data-estate-interior="illustrated-overhead"
            href="/guild/estate-20261019/interior-oak-v2.webp"
            x="20.65"
            y="16.65"
            width="18.7"
            height="14.7"
            preserveAspectRatio="none"
          />
          {finishes.floor !== 'oak' &&
            guildEstateRooms.map((r) => (
              <rect
                key={r.id}
                x={r.x + 0.15}
                y={r.y + 0.15}
                width={r.width - 0.3}
                height={r.height - 0.3}
                fill="url(#ge-floor)"
              />
            ))}
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
            <GuildEstateFurnitureLayer
              items={layout.furniture}
              selected={selected}
              editing={editing}
              change={change}
              select={(id) => {
                setSelected(id);
                if (!editing && p.owner) {
                  beginEdit();
                  const i = layout.furniture.find((i) => i.id === id);
                  if (i) focus(guildEstateFurnitureRoom(i)?.id);
                }
              }}
              start={(i, e) => {
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
                  x: q.x - i.x!,
                  y: q.y - i.y!,
                  camera,
                };
                svg.current?.setPointerCapture(e.pointerId);
              }}
            />
            {layout.items.map((i) => {
              const spec = guildEstateItems.find((f) => f.id === i.id)!,
                art = guildEstateArt(i.id),
                w = art.width * 1.4 * i.scale,
                hh = art.height * 1.4 * i.scale;
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
        {!roof &&
          editing &&
          chosen &&
          chosen.x !== null &&
          (() => {
            const art =
              'catalog' in chosen
                ? guildEstateFurnitureCatalog.find((f) => f.id === chosen.catalog)!
                : guildEstateArt(chosen.id);
            const scale = chosen.scale ?? 1;
            return (
              <g
                data-estate-interactive="transform"
                transform={`translate(${chosen.x} ${chosen.y}) rotate(${chosen.rotation})`}
                onPointerDown={(e) => {
                  const handle = (e.target as Element)
                    .closest('[data-house2-handle]')
                    ?.getAttribute('data-house2-handle');
                  if (busy) return;
                  if (!handle) {
                    e.preventDefault();
                    e.stopPropagation();
                    const q = point(e.clientX, e.clientY);
                    gesture.current = {
                      pointer: e.pointerId,
                      id: chosen.id,
                      clientX: e.clientX,
                      clientY: e.clientY,
                      x: q.x - chosen.x!,
                      y: q.y - chosen.y!,
                      camera,
                    };
                    svg.current?.setPointerCapture(e.pointerId);
                    return;
                  }
                  e.preventDefault();
                  e.stopPropagation();
                  const q = point(e.clientX, e.clientY);
                  transformGesture.current = {
                    id: chosen.id,
                    kind: handle,
                    x: chosen.x!,
                    y: chosen.y!,
                    scale,
                    rotation: chosen.rotation,
                    distance: Math.max(0.01, Math.hypot(q.x - chosen.x!, q.y - chosen.y!)),
                    angle: Math.atan2(q.y - chosen.y!, q.x - chosen.x!),
                  };
                  svg.current?.setPointerCapture(e.pointerId);
                }}
              >
                <House2ItemBorder
                  width={art.width * 1.4 * scale}
                  height={art.height * 1.4 * scale}
                  pixel={camera.width / (stage.current?.clientWidth || 1000)}
                  rotation={chosen.rotation}
                  resize={(d) =>
                    change(chosen.id, { scale: Math.max(0.25, Math.min(3, scale + d)) })
                  }
                  turn={(d) => change(chosen.id, { rotation: (chosen.rotation + d + 360) % 360 })}
                />
              </g>
            );
          })()}
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
              href={roofArt.image}
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
      <GuildEstateActors
        guildId={p.guildId}
        characterId={p.characterId}
        member={p.member}
        svg={svg}
        roof={roof}
        focus={() => focus()}
        notice={setNotice}
      />
      {p.owner && (
        <div className="guild-estate-ownerbar" aria-label="Ferramentas da sede">
          <button type="button" onClick={beginEdit}>
            <Paintbrush size={17} />
            Editar sede
          </button>
          <button type="button" onClick={openShop}>
            <ShoppingBasket size={17} />
            Loja de móveis
          </button>
        </div>
      )}
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
        <div className="guild-estate-editor" aria-label="Editar sede e mobília">
          <h3>
            <Move size={16} />
            Editar sede <small>{4 + layout.furniture.length} itens</small>
          </h3>
          <p>Arraste para mover. Use as bordas para redimensionar e o controle acima para girar.</p>
          <label>
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />{' '}
            Encaixar na grade
          </label>
          <select
            disabled={busy}
            aria-label="Selecionar instalação"
            value={selected || ''}
            onChange={(e) => {
              const id = e.target.value as GuildEstateItemId;
              setSelected(id);
              const i = layout.items.find((i) => i.id === id);
              if (i) focus(guildEstateItemRoom(i)?.id);
              else {
                const f = layout.furniture.find((i) => i.id === id);
                if (f) focus(guildEstateFurnitureRoom(f)?.id);
              }
            }}
          >
            <option value="">Selecione uma instalação ou móvel</option>
            {guildEstateItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
            {layout.furniture.map((i) => (
              <option key={i.id} value={i.id}>
                {guildEstateFurnitureCatalog.find((f) => f.id === i.catalog)?.name}
                {i.x === null ? ' · guardado' : ''}
              </option>
            ))}
          </select>
          {chosen && (
            <div className="guild-estate-furniture-options">
              <label>
                Ângulo livre
                <input
                  aria-label="Rotação livre do item"
                  type="number"
                  min="0"
                  max="359.99"
                  step="1"
                  value={Number(chosen.rotation.toFixed(2))}
                  onChange={(e) =>
                    change(chosen.id, { rotation: (Number(e.target.value) + 360) % 360 })
                  }
                />
              </label>
              {(['x', 'y'] as const).map((axis) => (
                <label key={axis}>
                  Posição {axis.toUpperCase()}
                  <input
                    aria-label={'Posição ' + axis.toUpperCase()}
                    type="number"
                    step=".01"
                    value={chosen[axis] === null ? '' : Number(chosen[axis]!.toFixed(2))}
                    onChange={(e) => change(chosen.id, { [axis]: Number(e.target.value) })}
                  />
                </label>
              ))}
              <label>
                Tamanho
                <input
                  aria-label="Tamanho do móvel"
                  type="range"
                  min=".25"
                  max="3"
                  step=".1"
                  value={chosen.scale}
                  onChange={(e) => change(chosen.id, { scale: Number(e.target.value) })}
                />
              </label>
              {'catalog' in chosen &&
                (chosen.x === null ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPlacing(chosen.id);
                      setNotice('Clique no piso do cômodo para colocar o móvel.');
                    }}
                  >
                    Colocar no cômodo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      change(chosen.id, { x: null, y: null });
                      setPlacing(null);
                    }}
                  >
                    <Archive size={14} />
                    Guardar móvel
                  </button>
                ))}
            </div>
          )}
          <details className="guild-estate-finishes">
            <summary>Materiais da casa e jardim</summary>
            {(['roof', 'floor'] as const).map((kind) => (
              <label key={kind}>
                {{ roof: 'Telhado', floor: 'Piso', walls: 'Paredes' }[kind]}
                <select
                  disabled={busy}
                  aria-label={
                    {
                      roof: 'Material do telhado',
                      floor: 'Material do piso',
                      walls: 'Material das paredes',
                    }[kind]
                  }
                  value={finishes[kind]}
                  onChange={(e) =>
                    setLayout((l) => ({
                      ...l,
                      finishes: { ...l.finishes, [kind]: e.target.value },
                    }))
                  }
                >
                  {guildEstateFinishes[kind].map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                disabled={busy}
                checked={finishes.trees}
                onChange={(e) =>
                  setLayout((l) => ({ ...l, finishes: { ...l.finishes, trees: e.target.checked } }))
                }
              />
              Árvores ao redor da sede
            </label>
          </details>
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
                setLayout(guildEstateSchema.parse(p.estate || defaultGuildEstate()));
                setEditing(false);
                setPlacing(null);
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
        <p className="guild-estate-hint">Arraste para explorar · use Editar sede para decorar</p>
      )}
      {(error || notice) && (
        <p
          className={'guild-estate-feedback' + (error ? ' error' : '')}
          role={error ? 'alert' : 'status'}
        >
          {error || notice}
        </p>
      )}
      {shop && (
        <GuildEstateShop
          estate={layout}
          treasury={p.treasury ?? 0}
          busy={busy}
          error={error}
          close={() => setShop(false)}
          buy={(catalog) => void buy(catalog)}
          place={(id) => placeFurniture(id)}
        />
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
