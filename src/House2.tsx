import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowLeft,
  Armchair,
  Check,
  ChevronDown,
  Coins,
  DoorOpen,
  Grid2X2,
  Home,
  LandPlot,
  Map,
  Menu,
  Minus,
  Move,
  Plus,
  RotateCw,
  Save,
  Search,
  Settings,
  Undo2,
  Warehouse,
  X,
} from 'lucide-react';
import { api, post } from './api';
import { ScenePanel } from './ScenePanel';
import { Modal } from './components';
import { House2Village, House2VillageRoofs } from './House2Village';
import { boundHouse2Camera, initialHouse2Camera, type House2Camera } from './house2-camera';
import { House2Lighting } from './House2Lighting';
import { House2Interior, house2CutawayImage } from './House2Interior';
import { house2DayPhases, type House2DayPhase } from '../shared/house2-lighting';
import {
  house2Clamp,
  house2Furniture,
  house2Houses,
  house2Terrains,
  house2Landscape,
  house2World,
  house2VillagePlots,
  house2HousePlacement,
  house2DoorPoint,
  type House2Directory,
  type House2Item,
  type House2Layout,
  type House2Plot,
  type House2Scene,
} from '../shared/house-v2';
import type { Character, User } from './types';
import './house2.css';

const number = (n: number) => n.toLocaleString('pt-BR');
type Tool = 'terrain' | 'houses' | 'shop' | 'collection' | 'settings';
const toolNames: Record<Tool, string> = {
  terrain: 'Terrenos',
  houses: 'Casas vazias',
  shop: 'Mobília',
  collection: 'Minha coleção',
  settings: 'Vizinhança',
};
const toolIcons = {
  terrain: LandPlot,
  houses: Home,
  shop: Armchair,
  collection: Warehouse,
  settings: Settings,
};
type Camera = House2Camera;

export function House2({ character, user }: { character?: Character; user: User }) {
  const [directory, setDirectory] = useState<House2Directory | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [scene, setScene] = useState<House2Scene | null>(null);
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool | null>(null),
    [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState<House2Layout | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [interior, setInterior] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>(() =>
    initialHouse2Camera({ width: innerWidth, height: innerHeight }),
  );
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [dayPhase, setDayPhase] = useState<House2DayPhase>(() => {
    const saved = localStorage.getItem('alvorada-house2-day-phase');
    return saved && Object.hasOwn(house2DayPhases, saved) ? (saved as House2DayPhase) : 'afternoon';
  });
  useEffect(() => localStorage.setItem('alvorada-house2-day-phase', dayPhase), [dayPhase]);
  const [snap, setSnap] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    kind: 'plot' | 'house' | 'furniture';
    catalogId?: string;
    plotId: string;
    characterId: string;
    name: string;
    price: number;
    image?: string;
  } | null>(null);
  const [purchaseError, setPurchaseError] = useState('');
  const [grid, setGrid] = useState(false),
    [hover, setHover] = useState<string | null>(null);
  const [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState(''),
    [newTerrain, setNewTerrain] = useState('earth');
  const [createOpen, setCreateOpen] = useState(false);
  const mapRef = useRef<SVGSVGElement>(null),
    menuRef = useRef<HTMLDivElement>(null),
    triggerRef = useRef<HTMLButtonElement>(null);
  const epoch = useRef(0),
    mounted = useRef(true),
    purchaseKey = useRef<{ signature: string; key: string } | null>(null);
  const dirtyRef = useRef(false),
    busyRef = useRef(false),
    sceneIdRef = useRef(sceneId);
  const drag = useRef<{
    pointer: number;
    startX: number;
    startY: number;
    camera: Camera;
    kind: 'pan' | 'house' | 'item';
    id?: string;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  dirtyRef.current = !!draft;
  busyRef.current = busy;
  sceneIdRef.current = sceneId;
  const plot = scene?.plots.find((p) => p.id === selected);
  const canEdit = !!plot?.can_edit;
  const house = house2Houses.find((h) => h.id === plot?.house_id);
  const shownPlot =
    plot && draft?.house
      ? {
          ...plot,
          house_x: draft.house.x,
          house_y: draft.house.y,
          house_rotation: draft.house.rotation,
        }
      : plot;
  const shownItems: House2Item[] =
    draft && plot
      ? [
          ...(scene?.items.filter((i) => i.plot_id !== plot.id) || []),
          ...draft.items.map((i) => ({
            ...i,
            plot_id: plot.id,
            catalog_id: directory?.inventory.find((o) => o.id === i.id)?.catalog_id || '',
            scale: i.scale ?? 1,
          })),
        ]
      : scene?.items || [];
  const aspect = viewport.width / viewport.height;
  const boundedCamera = boundHouse2Camera(camera, viewport);
  const view = {
    x: boundedCamera.x - (boundedCamera.span * aspect) / 2,
    y: boundedCamera.y - boundedCamera.span / 2,
    width: boundedCamera.span * aspect,
    height: boundedCamera.span,
  };

  const reload = useCallback(async (id: string | null, silent = false) => {
    const version = ++epoch.current;
    if (!silent) setLoading(true);
    try {
      const [d, s] = await Promise.all([
        api<House2Directory>('/house-v2'),
        id ? api<House2Scene>('/house-v2/neighborhoods/' + id) : Promise.resolve(null),
      ]);
      if (!mounted.current || version !== epoch.current) return;
      setDirectory(d);
      setScene(s);
    } catch (e) {
      if (mounted.current && version === epoch.current) setNotice((e as Error).message);
    } finally {
      if (mounted.current && version === epoch.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current++;
    };
  }, []);
  useEffect(() => {
    void reload(sceneId);
  }, [sceneId, reload]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden && !busyRef.current && !dirtyRef.current)
        void reload(sceneIdRef.current, true);
    }, 15000);
    return () => clearInterval(timer);
  }, [reload]);
  useEffect(() => {
    if (!sceneId) return;
    document.body.classList.add('house2-immersive');
    const size = () => setViewport({ width: innerWidth, height: innerHeight });
    size();
    window.addEventListener('resize', size);
    return () => {
      document.body.classList.remove('house2-immersive');
      window.removeEventListener('resize', size);
    };
  }, [sceneId]);
  useEffect(() => {
    if (!draft) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [draft]);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: globalThis.PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);
  const guardDirty = () => {
    if (!draft) return false;
    setNotice('Salve ou descarte as mudanças do terreno antes de continuar.');
    return true;
  };
  function enter(id: string) {
    if (guardDirty()) return;
    setScene(null);
    setSceneId(id);
    setSelected(null);
    setInterior(null);
    setTool(null);
    setCamera(initialHouse2Camera(viewport));
    setMenu(false);
    setNotice('');
  }
  function leave() {
    if (guardDirty()) return;
    setSceneId(null);
    setScene(null);
    setSelected(null);
    setTool(null);
    setMenu(false);
  }
  function choose(p: House2Plot, focus = false) {
    if (busy || (p.id !== selected && guardDirty())) return;
    setSelected(p.id);
    setSelectedPiece(null);
    if (p.id !== selected) setInterior(null);
    if (focus)
      setCamera({ x: p.x + p.width / 2, y: p.y + p.height / 2, span: Math.max(19, 19 / aspect) });
    setTool('terrain');
  }
  function startDraft(): House2Layout | null {
    if (!plot?.can_edit || busy) return null;
    return (
      draft || {
        revision: plot.revision,
        house: plot.house_id
          ? {
              x: plot.house_x!,
              y: plot.house_y!,
              rotation: plot.house_rotation as 0 | 90 | 180 | 270,
            }
          : null,
        items: (scene?.items.filter((i) => i.plot_id === plot.id) || []).map((i) => ({
          id: i.id,
          x: i.x!,
          y: i.y!,
          rotation: i.rotation as 0 | 90 | 180 | 270,
          scale: i.scale ?? 1,
        })),
      }
    );
  }
  function requestPurchase(kind: 'plot' | 'house' | 'furniture', catalogId?: string) {
    if (!character || !plot || busy || (kind !== 'furniture' && guardDirty())) return;
    const spec =
      kind === 'house'
        ? house2Houses.find((h) => h.id === catalogId)
        : kind === 'furniture'
          ? house2Furniture.find((f) => f.id === catalogId)
          : null;
    setPurchaseError('');
    setConfirmation({
      kind,
      catalogId,
      plotId: plot.id,
      characterId: character.id,
      name: spec?.name ?? `Terreno ${plot.number}`,
      price: spec?.price ?? plot.price,
      image: spec?.image,
    });
  }
  async function buy(kind: 'plot' | 'house' | 'furniture', catalogId?: string) {
    if (!character || !plot || busy || (kind !== 'furniture' && guardDirty())) return;
    if (
      !confirmation ||
      confirmation.plotId !== plot.id ||
      confirmation.characterId !== character.id
    ) {
      setConfirmation(null);
      setNotice('Selecione novamente o terreno antes de comprar.');
      return;
    }
    const path =
      kind === 'plot'
        ? `/house-v2/plots/${plot.id}/purchase`
        : kind === 'house'
          ? `/house-v2/plots/${plot.id}/house`
          : '/house-v2/furniture';
    const body = {
      character_id: character.id,
      ...(catalogId ? { catalog_id: catalogId } : {}),
      ...(kind === 'furniture' ? { plot_id: plot.id } : {}),
    };
    const signature = JSON.stringify([path, body]);
    if (purchaseKey.current?.signature !== signature)
      purchaseKey.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    setNotice('');
    try {
      await post(path, { ...body, idempotency_key: purchaseKey.current.key });
      purchaseKey.current = null;
      setConfirmation(null);
      await reload(sceneId, true);
      setNotice(
        kind === 'plot'
          ? 'Terreno adquirido com créditos de teste. Agora escolha uma casa vazia.'
          : kind === 'house'
            ? 'Sua casa está pronta para mobiliar. Entre para ver o interior.'
            : 'Mobília adquirida. Coloque a peça pela Minha coleção.',
      );
      if (kind === 'plot') setTool('houses');
      if (kind === 'house') setInterior(plot.id);
    } catch (e) {
      setNotice((e as Error).message);
      setPurchaseError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!draft || !plot || busy) return;
    setBusy(true);
    setNotice('');
    try {
      await api(`/house-v2/plots/${plot.id}/layout`, {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      await reload(sceneId, true);
      setDraft(null);
      setNotice('Terreno salvo.');
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function place(item: House2Item) {
    const d = startDraft(),
      spec = house2Furniture.find((f) => f.id === item.catalog_id);
    if (!d || !spec || !plot || d.items.some((i) => i.id === item.id)) return;
    if (d.items.length >= 200) {
      setNotice('O terreno comporta até 200 peças nesta versão de testes.');
      return;
    }
    d.items.push({
      id: item.id,
      x: plot.x + plot.width / 2,
      y: plot.y + plot.height / 2,
      rotation: 0,
      scale: item.scale ?? 1,
    });
    setDraft(structuredClone(d));
    setSelectedPiece(item.id);
    setInterior(plot.id);
    setNotice('Arraste a peça dentro do seu terreno e salve as mudanças.');
  }
  function adjust(rotation = false, dx = 0, dy = 0) {
    const d = startDraft();
    if (!d || !plot || !selectedPiece || selectedPiece === 'house') return;
    const p = selectedPiece === 'house' ? d.house : d.items.find((i) => i.id === selectedPiece);
    const spec =
      selectedPiece === 'house'
        ? house
        : house2Furniture.find(
            (f) => f.id === directory?.inventory.find((i) => i.id === selectedPiece)?.catalog_id,
          );
    if (!p || !spec) return;
    Object.assign(
      p,
      house2Clamp(
        plot,
        {
          ...p,
          x: p.x + dx,
          y: p.y + dy,
          rotation: (rotation ? (p.rotation + 90) % 360 : p.rotation) as 0 | 90 | 180 | 270,
        },
        spec.width * ((p as { scale?: number }).scale ?? 1),
        spec.height * ((p as { scale?: number }).scale ?? 1),
      ),
    );
    setDraft(structuredClone(d));
  }
  function resizeItem(value: number) {
    const d = startDraft(),
      piece = d?.items.find((i) => i.id === selectedPiece),
      spec = house2Furniture.find(
        (f) => f.id === directory?.inventory.find((i) => i.id === selectedPiece)?.catalog_id,
      );
    if (!d || !piece || !spec || !plot || !Number.isFinite(value)) return;
    piece.scale = Math.max(0.25, Math.min(3, value));
    Object.assign(
      piece,
      house2Clamp(plot, piece, spec.width * piece.scale, spec.height * piece.scale),
    );
    setDraft(structuredClone(d));
  }
  function positionItem(axis: 'x' | 'y', value: number) {
    const d = startDraft(),
      piece = d?.items.find((i) => i.id === selectedPiece),
      spec = house2Furniture.find(
        (f) => f.id === directory?.inventory.find((i) => i.id === selectedPiece)?.catalog_id,
      );
    if (!d || !piece || !spec || !plot || !Number.isFinite(value)) return;
    Object.assign(
      piece,
      house2Clamp(
        plot,
        { ...piece, [axis]: value },
        spec.width * (piece.scale ?? 1),
        spec.height * (piece.scale ?? 1),
      ),
    );
    setDraft(structuredClone(d));
  }
  function storePiece() {
    const d = startDraft();
    if (!d || !selectedPiece || selectedPiece === 'house') return;
    d.items = d.items.filter((i) => i.id !== selectedPiece);
    setDraft(d);
    setSelectedPiece(null);
  }
  function world(clientX: number, clientY: number) {
    const matrix = mapRef.current?.getScreenCTM()?.inverse();
    return matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix) : new DOMPoint();
  }
  function pointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0 || busy || drag.current) return;
    if ((e.target as Element).closest('[data-house2-fixed]')) return;
    const pieceElement = (e.target as Element).closest('[data-house2-piece]');
    const id = pieceElement?.getAttribute('data-house2-piece') || undefined;
    const p = world(e.clientX, e.clientY);
    const value =
      id === 'house'
        ? draft?.house || (shownPlot && { x: shownPlot.house_x!, y: shownPlot.house_y! })
        : shownItems.find((i) => i.id === id);
    const edit =
      !!id &&
      id !== 'house' &&
      canEdit &&
      (id === 'house' || shownItems.some((i) => i.id === id && i.plot_id === plot?.id));
    if (edit) setSelectedPiece(id!);
    drag.current = {
      pointer: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      camera: { ...boundedCamera },
      kind: edit ? (id === 'house' ? 'house' : 'item') : 'pan',
      id,
      offsetX: value ? p.x - value.x! : 0,
      offsetY: value ? p.y - value.y! : 0,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const a = drag.current;
    if (!a || a.pointer !== e.pointerId) return;
    const dx = e.clientX - a.startX,
      dy = e.clientY - a.startY;
    if (!a.moved && Math.hypot(dx, dy) < 4) return;
    a.moved = true;
    if (a.kind === 'pan') {
      setCamera(
        boundHouse2Camera(
          {
            ...a.camera,
            x: a.camera.x - (dx * a.camera.span) / viewport.height,
            y: a.camera.y - (dy * a.camera.span) / viewport.height,
          },
          viewport,
        ),
      );
      return;
    }
    const d = startDraft(),
      p = world(e.clientX, e.clientY);
    if (!d || !plot) return;
    const piece = a.kind === 'house' ? d.house : d.items.find((i) => i.id === a.id);
    const spec =
      a.kind === 'house'
        ? house
        : house2Furniture.find(
            (f) => f.id === directory?.inventory.find((i) => i.id === a.id)?.catalog_id,
          );
    if (!piece || !spec) return;
    Object.assign(
      piece,
      house2Clamp(
        plot,
        {
          ...piece,
          x: snap ? Math.round((p.x - a.offsetX) * 2) / 2 : p.x - a.offsetX,
          y: snap ? Math.round((p.y - a.offsetY) * 2) / 2 : p.y - a.offsetY,
        },
        spec.width * ((piece as { scale?: number }).scale ?? 1),
        spec.height * ((piece as { scale?: number }).scale ?? 1),
      ),
    );
    setDraft(structuredClone(d));
  }
  function pointerUp(e: ReactPointerEvent<SVGSVGElement>, cancelled = false) {
    const a = drag.current;
    if (!a || a.pointer !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (a.moved || cancelled) return;
    if (a.kind !== 'pan') {
      setSelectedPiece(a.id!);
      if (a.kind === 'item') setTool('collection');
      return;
    }
    const found = (e.target as Element)
      .closest('[data-house2-plot]')
      ?.getAttribute('data-house2-plot');
    // Pointer capture retargets pointerup to the SVG; hit-test the original screen position.
    const hit =
      found ||
      document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest('[data-house2-plot]')
        ?.getAttribute('data-house2-plot');
    const p = scene?.plots.find((p) => p.id === hit);
    if (p) choose(p);
  }
  function zoom(factor: number) {
    setCamera((c) => {
      const current = boundHouse2Camera(c, viewport);
      return boundHouse2Camera({ ...current, span: current.span * factor }, viewport);
    });
  }
  async function createNeighborhood(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const n = await post<{ id: string }>('/house-v2/neighborhoods', {
        name: newName,
        description: '',
        terrain: newTerrain,
      });
      setCreateOpen(false);
      setNewName('');
      enter(n.id);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const balance = (
    <span className="h2-balance">
      <Coins size={15} /> {number(directory?.balance ?? 20000)} <small>créditos de teste</small>
    </span>
  );
  const selectedTransform =
    draft?.items.find((i) => i.id === selectedPiece) ??
    shownItems.find((i) => i.id === selectedPiece);
  const editor = canEdit && selectedPiece && (
    <div className="h2-piece-controls">
      <strong>
        {selectedPiece === 'house'
          ? house?.name
          : house2Furniture.find(
              (f) => f.id === directory?.inventory.find((i) => i.id === selectedPiece)?.catalog_id,
            )?.name}
      </strong>
      <span>Arraste livremente dentro do seu terreno.</span>
      <label className="h2-checkbox">
        <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />{' '}
        Encaixar na grade
      </label>
      {selectedPiece !== 'house' && (
        <div className="h2-item-size">
          <label>
            Tamanho do item <output>{Math.round((selectedTransform?.scale ?? 1) * 100)}%</output>
            <input
              aria-label="Tamanho do item"
              type="range"
              min={25}
              max={300}
              step={1}
              value={Math.round((selectedTransform?.scale ?? 1) * 100)}
              disabled={busy}
              onChange={(e) => resizeItem(Number(e.target.value) / 100)}
            />
          </label>
          <div className="h2-coordinates">
            {(['x', 'y'] as const).map((axis) => (
              <label key={axis}>
                {axis.toUpperCase()}
                <input
                  aria-label={'Posição ' + axis.toUpperCase()}
                  type="number"
                  step="0.01"
                  value={Number((selectedTransform?.[axis] ?? 0).toFixed(2))}
                  disabled={busy}
                  onChange={(e) => positionItem(axis, e.target.valueAsNumber)}
                />
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="h2-move-controls">
        <button
          aria-label="Mover para a esquerda"
          disabled={busy}
          onClick={() => adjust(false, -0.5, 0)}
        >
          ←
        </button>
        <button aria-label="Mover para cima" disabled={busy} onClick={() => adjust(false, 0, -0.5)}>
          ↑
        </button>
        <button aria-label="Mover para baixo" disabled={busy} onClick={() => adjust(false, 0, 0.5)}>
          ↓
        </button>
        <button
          aria-label="Mover para a direita"
          disabled={busy}
          onClick={() => adjust(false, 0.5, 0)}
        >
          →
        </button>
        <button aria-label="Girar peça" disabled={busy} onClick={() => adjust(true)}>
          <RotateCw size={16} />
        </button>
        {selectedPiece !== 'house' && (
          <button disabled={busy} onClick={storePiece}>
            <Warehouse size={16} /> Guardar
          </button>
        )}
      </div>
    </div>
  );

  if (!sceneId)
    return (
      <section className="house2-directory">
        <header className="h2-directory-hero">
          <span className="h2-eyebrow">
            UM LUGAR PARA CHAMAR DE SEU <b>EXPERIMENTAL</b>
          </span>
          <h1>
            House <em>2.0</em>
          </h1>
          <p>Encontre sua vizinhança. Escolha seu terreno. Construa sua história.</p>
          <div className="h2-test-note">
            {balance}
            <span>Compras de teste. O ouro e a House atual permanecem separados.</span>
          </div>
        </header>
        <div className="h2-directory-toolbar">
          <label className="h2-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar vizinhanças…"
              aria-label="Pesquisar vizinhanças"
            />
          </label>
          <select
            aria-label="Filtrar vizinhanças"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todas as vizinhanças</option>
            <option value="available">Com terrenos disponíveis</option>
            <option value="mine">Meus terrenos</option>
          </select>
          {user.administrador === 1 && (
            <button onClick={() => setCreateOpen(!createOpen)}>
              <Plus size={16} /> Nova vizinhança
            </button>
          )}
        </div>
        {createOpen && (
          <form className="h2-create" onSubmit={createNeighborhood}>
            <label>
              Nome
              <input
                required
                minLength={3}
                maxLength={80}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label>
              Terreno
              <select value={newTerrain} onChange={(e) => setNewTerrain(e.target.value)}>
                <option value="earth">Terra</option>
                <option value="grass">Gramado</option>
                <option value="stone">Pedra</option>
              </select>
            </label>
            <button disabled={busy}>Criar vizinhança 200 × 200</button>
          </form>
        )}
        {notice && (
          <p className="h2-notice" role="status">
            {notice}
          </p>
        )}
        {loading && !directory ? (
          <p>Carregando vizinhanças…</p>
        ) : (
          <div className="h2-neighborhoods">
            {directory?.neighborhoods
              .filter(
                (n) =>
                  `${n.name} ${n.description}`
                    .toLocaleLowerCase('pt-BR')
                    .includes(query.toLocaleLowerCase('pt-BR')) &&
                  (filter !== 'available' || n.available > 0) &&
                  (filter !== 'mine' || n.owned > 0),
              )
              .map((n, index) => (
                <button className="h2-neighborhood-card" key={n.id} onClick={() => enter(n.id)}>
                  <div
                    className="h2-card-map"
                    style={{ backgroundImage: `url(${house2Landscape})` }}
                    aria-hidden="true"
                  >
                    {[0, 1, 2].map((v) => (
                      <img
                        key={v}
                        src={house2Houses[(index * 5 + v * 2) % house2Houses.length].image}
                        alt=""
                      />
                    ))}
                    <span>200 × 200</span>
                  </div>
                  <div className="h2-card-description">
                    <span className="h2-eyebrow">
                      VIZINHANÇA {String(index + 1).padStart(2, '0')}
                    </span>
                    <h2>{n.name}</h2>
                    <p>{n.description}</p>
                    <footer>
                      <span>
                        <LandPlot size={15} /> {n.available} terrenos livres
                      </span>
                      {n.owned > 0 && (
                        <span>
                          <Check size={14} /> {n.owned} seu(s)
                        </span>
                      )}
                      <b>Explorar →</b>
                    </footer>
                  </div>
                </button>
              ))}
            {directory &&
              !directory.neighborhoods.some(
                (n) =>
                  `${n.name} ${n.description}`
                    .toLocaleLowerCase('pt-BR')
                    .includes(query.toLocaleLowerCase('pt-BR')) &&
                  (filter !== 'available' || n.available > 0) &&
                  (filter !== 'mine' || n.owned > 0),
              ) && <p>Nenhuma vizinhança encontrada para esse filtro.</p>}
          </div>
        )}
      </section>
    );

  return (
    <section className="house2-world" aria-label="Vizinhança House 2.0">
      <svg
        ref={mapRef}
        className="h2-map"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        aria-label="Mapa da vizinhança, 200 por 200 quadrados"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={(e) => pointerUp(e, true)}
        onWheel={(e) => {
          if (!(e.target as Element).closest('button')) zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12);
        }}
      >
        <defs>
          <pattern id="h2-earth" patternUnits="userSpaceOnUse" width="14" height="14">
            <image
              href={house2Terrains[scene?.neighborhood.terrain || 'earth']}
              width="14"
              height="14"
            />
          </pattern>
          <pattern id="h2-road" patternUnits="userSpaceOnUse" width="9" height="9">
            <image href="/vtt/terrain-expansion-20261015/cobblestone.webp" width="9" height="9" />
          </pattern>
          <pattern id="h2-grid" patternUnits="userSpaceOnUse" width="1" height="1">
            <path
              d="M 1 0 L 0 0 0 1"
              fill="none"
              stroke="#d8bf7e"
              strokeOpacity=".18"
              strokeWidth=".018"
            />
          </pattern>
          <filter id="h2-house-shadow" x="-20%" y="-20%" width="140%" height="145%">
            <feDropShadow dx=".12" dy=".28" stdDeviation=".19" floodOpacity=".7" />
          </filter>
        </defs>
        <House2Lighting phase={dayPhase} />
        <House2Village plots={scene?.plots ?? []} />
        {scene?.plots.map((p) => (
          <g
            key={p.id}
            data-house2-plot={p.id}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
          >
            <rect
              className={
                'h2-plot ' + (p.can_edit ? 'mine ' : '') + (p.id === selected ? 'selected' : '')
              }
              x={p.x + 0.1}
              y={p.y + 0.1}
              width={p.width - 0.2}
              height={p.height - 0.2}
              fill={p.character_id ? '#a8883d' : '#c8b375'}
              fillOpacity={p.id === selected ? '.06' : '0'}
              stroke={p.id === selected ? '#ecd18d' : p.can_edit ? '#bba267' : '#b8ab8b'}
              strokeWidth={p.id === selected ? 1.2 : 0.8}
              vectorEffect="non-scaling-stroke"
              strokeOpacity={p.id === selected ? '.8' : '0'}
              role="button"
              tabIndex={0}
              aria-label={`Terreno ${p.number}${p.owner_name ? ' · ' + p.owner_name : ' · disponível'}`}
              onFocus={() => setHover(p.id)}
              onBlur={() => setHover(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  choose(p, true);
                }
              }}
            >
              <title>
                {p.owner_name
                  ? `${p.owner_name} · ${p.player_name}`
                  : `Terreno ${p.number} · disponível`}
              </title>
            </rect>
            {!p.house_id && p.character_id && (
              <g pointerEvents="none">
                <text x={p.x + p.width / 2} y={p.y + p.height / 2} className="h2-lot-label">
                  {p.character_id ? p.owner_name : String(p.number).padStart(2, '0')}
                </text>
                <text x={p.x + p.width / 2} y={p.y + p.height / 2 + 1.1} className="h2-lot-caption">
                  {p.character_id ? 'TERRENO ADQUIRIDO' : 'DISPONÍVEL'}
                </text>
              </g>
            )}
          </g>
        ))}
        {grid && (
          <rect
            x={house2World.x}
            y={house2World.y}
            width="200"
            height="200"
            fill="url(#h2-grid)"
            pointerEvents="none"
          />
        )}
        {scene?.plots
          .filter((p) => p.house_id)
          .map((original) => {
            const p = original.id === shownPlot?.id ? shownPlot : original,
              spec = house2Houses.find((h) => h.id === p.house_id);
            if (!spec) return null;
            return (
              <g
                key={p.id}
                transform={`translate(${p.house_x} ${p.house_y}) rotate(${p.house_rotation})`}
                pointerEvents="none"
              >
                <House2Interior
                  id={spec.id}
                  instance={p.id}
                  width={spec.width}
                  height={spec.height}
                />
              </g>
            );
          })}
        <g filter="url(#h2-shadow-item)">
          {shownItems.map((item) => {
            const spec = house2Furniture.find((f) => f.id === item.catalog_id);
            if (!spec) return null;
            const editable = item.plot_id === selected && canEdit;
            return (
              <g
                key={item.id}
                data-house2-plot={item.plot_id!}
                data-house2-piece={editable ? item.id : undefined}
                transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}
                className={editable ? 'h2-editable' : ''}
              >
                <title>{spec.name}</title>
                <image
                  href={spec.image}
                  x={(-spec.width * item.scale) / 2}
                  y={(-spec.height * item.scale) / 2}
                  width={spec.width * item.scale}
                  height={spec.height * item.scale}
                />
                {selectedPiece === item.id && (
                  <rect
                    x={(-spec.width * item.scale) / 2}
                    y={(-spec.height * item.scale) / 2}
                    width={spec.width * item.scale}
                    height={spec.height * item.scale}
                    fill="none"
                    stroke="#f2d891"
                    strokeWidth="1.1"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}
        </g>
        <House2VillageRoofs
          plots={scene?.plots ?? []}
          interior={interior}
          selected={selected}
          hover={hover}
          onHover={setHover}
          choose={choose}
          enter={(p) => {
            if (p.id !== selected && guardDirty()) return;
            setSelected(p.id);
            setInterior(interior === p.id ? null : p.id);
            setSelectedPiece(null);
          }}
        />
        <rect
          data-house2-day-phase={dayPhase}
          x={house2World.x}
          y={house2World.y}
          width={200}
          height={200}
          fill={house2DayPhases[dayPhase].tint}
          opacity={house2DayPhases[dayPhase].tintOpacity}
          pointerEvents="none"
        />
        {hover &&
          (() => {
            const p = scene?.plots.find((p) => p.id === hover);
            if (!p) return null;
            return (
              <g
                className="h2-owner-tooltip"
                pointerEvents="none"
                transform={`translate(${p.x + 6} ${p.y - 0.5})`}
              >
                <rect
                  x="-5.9"
                  y="-1.9"
                  width="11.8"
                  height="1.9"
                  rx=".18"
                  fill="#121311"
                  stroke="#bca16a"
                  strokeWidth=".035"
                />
                <text y="-1.1">
                  {p.owner_name
                    ? `Casa de ${p.owner_name}`
                    : `Terreno ${p.number} · ${number(p.price)} créditos`}
                </text>
                <text y="-.4" className="h2-tooltip-player">
                  {p.player_name || 'Disponível para compra'}
                </text>
              </g>
            );
          })()}
      </svg>
      <div className="h2-world-heading">
        <strong>{scene?.neighborhood.name || 'Vizinhança'}</strong>
        <span>200 × 200 · House 2.0 · testes</span>
      </div>
      <div className="h2-unified" ref={menuRef}>
        <button
          className="h2-menu-trigger"
          ref={triggerRef}
          aria-expanded={menu}
          aria-controls="h2-controls"
          onClick={() => {
            setMenu(!menu);
            setTool(null);
          }}
        >
          <Menu size={18} /> House 2.0 <ChevronDown size={14} />
        </button>
        {menu && (
          <nav className="h2-controls" id="h2-controls" aria-label="Controles da vizinhança">
            {balance}
            <p>{character ? character.name : 'Selecione um personagem no site para comprar.'}</p>
            {(Object.keys(toolNames) as Tool[]).map((k) => {
              const Icon = toolIcons[k];
              return (
                <button
                  key={k}
                  onClick={() => {
                    setTool(k);
                    setMenu(false);
                    setCatalogQuery('');
                  }}
                >
                  <Icon size={17} />
                  {toolNames[k]}
                </button>
              );
            })}
            <button
              onClick={() => {
                const p = scene?.plots.find((p) => p.can_edit);
                if (p) {
                  choose(p, true);
                  setMenu(false);
                } else {
                  setTool('terrain');
                  setMenu(false);
                  setNotice('Selecione um terreno disponível no mapa.');
                }
              }}
            >
              <Map size={17} /> Meu terreno
            </button>
            <button onClick={leave}>
              <ArrowLeft size={17} /> Outras vizinhanças
            </button>
          </nav>
        )}
      </div>
      <div className="h2-map-controls">
        <button aria-label="Aproximar mapa" onClick={() => zoom(0.75)}>
          <Plus size={17} />
        </button>
        <button aria-label="Afastar mapa" onClick={() => zoom(1.33)}>
          <Minus size={17} />
        </button>
        <button
          aria-label="Centralizar vizinhança"
          onClick={() => setCamera(initialHouse2Camera(viewport))}
        >
          <Map size={17} />
        </button>
      </div>
      <div className="h2-map-hint">
        <Move size={14} /> Arraste para explorar · role para aproximar
      </div>
      {loading && !scene && <div className="h2-map-loading">Abrindo a vizinhança…</div>}
      {notice && (
        <div className="h2-world-notice" role="status">
          {notice}
          <button aria-label="Fechar aviso" onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      )}
      {draft && (
        <div className="h2-save-bar">
          <span>Alterações no seu terreno</span>
          <button disabled={busy} onClick={save}>
            <Save size={15} /> Salvar
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setDraft(null);
              setSelectedPiece(null);
            }}
          >
            <Undo2 size={15} /> Descartar
          </button>
        </div>
      )}
      {tool && (
        <ScenePanel id="house2" title={toolNames[tool]} close={() => setTool(null)}>
          <div className="h2-panel">
            {balance}
            {tool === 'settings' ? (
              <>
                <p>{scene?.neighborhood.description}</p>
                <label className="h2-day-phase">
                  Luz do cenário
                  <select
                    aria-label="Horário do cenário"
                    value={dayPhase}
                    onChange={(e) => setDayPhase(e.target.value as House2DayPhase)}
                  >
                    {Object.entries(house2DayPhases).map(([id, phase]) => (
                      <option key={id} value={id}>
                        {phase.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Mapa de 200 × 200 quadrados. Terrenos de 12 × 12, distribuídos entre jardins e
                  caminhos do vilarejo.
                </p>
                <label className="h2-checkbox">
                  <input
                    type="checkbox"
                    checked={grid}
                    onChange={(e) => setGrid(e.target.checked)}
                  />
                  <Grid2X2 size={16} /> Mostrar grade
                </label>
                <p>
                  Somente o dono pode editar cada terreno. Vizinhos podem explorar e consultar as
                  casas.
                </p>
                <button onClick={leave}>
                  <ArrowLeft size={16} /> Pesquisar outras vizinhanças
                </button>
              </>
            ) : (
              <>
                <div className="h2-plot-summary">
                  {plot ? (
                    <>
                      <span className="h2-eyebrow">
                        TERRENO {String(plot.number).padStart(2, '0')} · 12 × 12
                      </span>
                      <h3>
                        {plot.owner_name ? `Casa de ${plot.owner_name}` : 'Um espaço para sua casa'}
                      </h3>
                      {plot.player_name && (
                        <p>
                          {plot.player_name}
                          {canEdit ? ' · seu terreno' : ' · somente visita'}
                        </p>
                      )}
                      {plot.house_id && (
                        <button
                          onClick={() => {
                            setInterior(interior === plot.id ? null : plot.id);
                            setCamera({
                              x: plot.x + 6,
                              y: plot.y + 6,
                              span: Math.max(19, 19 / aspect),
                            });
                          }}
                        >
                          <DoorOpen size={16} />
                          {interior === plot.id ? 'Ver telhado' : 'Entrar na casa'}
                        </button>
                      )}
                    </>
                  ) : (
                    <p>
                      Selecione um terreno no mapa para conhecer o proprietário ou consultar a
                      compra.
                    </p>
                  )}
                </div>
                {tool === 'terrain' && (
                  <>
                    {plot && !plot.character_id && (
                      <>
                        <p>
                          O terreno inteiro será seu para construir e decorar. Custo:{' '}
                          {number(plot.price)} créditos de teste.
                        </p>
                        <p>
                          As casas nos terrenos livres são modelos ilustrativos. Depois de comprar o
                          terreno, você escolhe sua casa separadamente.
                        </p>
                        <button
                          className="h2-primary"
                          disabled={!character || busy || (directory?.balance ?? 0) < plot.price}
                          onClick={() => requestPurchase('plot')}
                        >
                          <LandPlot size={16} /> Comprar terreno · {number(plot.price)}
                        </button>
                        {!character && <p>Selecione um personagem para comprar.</p>}
                      </>
                    )}
                    {canEdit && !house && (
                      <button
                        className="h2-primary"
                        onClick={() => {
                          setTool('houses');
                          setCatalogQuery('');
                        }}
                      >
                        <Home size={16} /> Escolher casa vazia
                      </button>
                    )}
                    {canEdit && house && (
                      <>
                        <p>A casa é fixa no terreno. Ajuste a mobília pela sua coleção.</p>
                        <button
                          onClick={() => {
                            setTool('collection');
                            setCatalogQuery('');
                          }}
                        >
                          <Armchair size={16} /> Decorar terreno
                        </button>
                        {editor}
                      </>
                    )}
                    <h4>Meus terrenos nesta vizinhança</h4>
                    {scene?.plots
                      .filter((p) => p.can_edit)
                      .map((p) => (
                        <button key={p.id} onClick={() => choose(p, true)}>
                          Terreno {p.number} · {p.owner_name}
                        </button>
                      ))}
                  </>
                )}
                {['houses', 'shop', 'collection'].includes(tool) && !canEdit && (
                  <p>
                    Selecione um terreno seu. Compras e decoração ficam disponíveis apenas nos
                    terrenos que você adquiriu.
                  </p>
                )}
                {canEdit && tool === 'houses' && (
                  <>
                    {house ? (
                      <p>{house.name} já foi adquirida para este terreno.</p>
                    ) : (
                      <>
                        <p>Casas do VTT com interiores vazios, prontas para receber sua mobília.</p>
                        <label className="h2-search">
                          <Search size={15} />
                          <input
                            aria-label="Pesquisar casas"
                            placeholder="Pesquisar casas…"
                            value={catalogQuery}
                            onChange={(e) => setCatalogQuery(e.target.value)}
                          />
                        </label>
                        <div className="h2-catalog">
                          {house2Houses
                            .filter((h) =>
                              h.name
                                .toLocaleLowerCase('pt-BR')
                                .includes(catalogQuery.toLocaleLowerCase('pt-BR')),
                            )
                            .map((h) => (
                              <button
                                key={h.id}
                                disabled={
                                  !character ||
                                  busy ||
                                  !!draft ||
                                  (directory?.balance ?? 0) < h.price
                                }
                                onClick={() => requestPurchase('house', h.id)}
                              >
                                <img
                                  src={house2CutawayImage(h.id) || h.image}
                                  alt=""
                                  loading="lazy"
                                />
                                <strong>{h.name.replace(' · vazia', '')}</strong>
                                <small>{number(h.price)} créditos · comprar</small>
                              </button>
                            ))}
                        </div>
                      </>
                    )}
                  </>
                )}
                {canEdit && tool === 'shop' && (
                  <>
                    <p>
                      As mesmas 100 peças da mobília do VTT. A compra entra na sua coleção de teste.
                    </p>
                    <label className="h2-search">
                      <Search size={15} />
                      <input
                        aria-label="Pesquisar mobília"
                        placeholder="Pesquisar mobília…"
                        value={catalogQuery}
                        onChange={(e) => setCatalogQuery(e.target.value)}
                      />
                    </label>
                    <div className="h2-catalog">
                      {house2Furniture
                        .filter((f) =>
                          f.name
                            .toLocaleLowerCase('pt-BR')
                            .includes(catalogQuery.toLocaleLowerCase('pt-BR')),
                        )
                        .map((f) => (
                          <button
                            key={f.id}
                            disabled={!character || busy || (directory?.balance ?? 0) < f.price}
                            onClick={() => requestPurchase('furniture', f.id)}
                          >
                            <img src={f.image} alt="" loading="lazy" />
                            <strong>{f.name}</strong>
                            <small>{number(f.price)} créditos · comprar</small>
                          </button>
                        ))}
                    </div>
                  </>
                )}
                {canEdit && tool === 'collection' && (
                  <>
                    {editor}
                    <button
                      onClick={() => {
                        setTool('shop');
                        setCatalogQuery('');
                      }}
                    >
                      <Plus size={16} /> Comprar mobília
                    </button>
                    <p className="h2-collection-intro">
                      PEÇAS QUE JÁ SÃO SUAS · sem compra nesta lista
                    </p>
                    <div className="h2-collection-list">
                      {directory?.inventory
                        .filter((i) => !i.plot_id || i.plot_id === selected)
                        .map((i) => {
                          const spec = house2Furniture.find((f) => f.id === i.catalog_id);
                          if (!spec) return null;
                          const placed = draft
                            ? draft.items.some((p) => p.id === i.id)
                            : i.plot_id === selected;
                          return (
                            <button
                              key={i.id}
                              disabled={busy}
                              onClick={() => (placed ? setSelectedPiece(i.id) : place(i))}
                            >
                              <img src={spec.image} alt="" />
                              <strong>{spec.name}</strong>
                              <span className="h2-owned-badge">
                                {placed ? 'No terreno' : 'Guardado'}
                              </span>
                              <small>{placed ? 'Ajustar peça →' : '+ Colocar no terreno'}</small>
                            </button>
                          );
                        })}
                    </div>
                    {!directory?.inventory.length && <p>Sua coleção de teste está vazia.</p>}
                  </>
                )}
              </>
            )}
          </div>
        </ScenePanel>
      )}

      {confirmation && (
        <Modal
          title="Confirmar compra"
          close={() => {
            if (!busy) setConfirmation(null);
          }}
          dismissOnBackdrop={!busy}
          dismissOnEscape={!busy}
        >
          <div className="h2-purchase-confirmation">
            {confirmation.image && <img src={confirmation.image} alt="" />}
            <h3>{confirmation.name}</h3>
            <p>Esta compra usa apenas créditos de teste.</p>
            <dl>
              <div>
                <dt>Preço</dt>
                <dd>{number(confirmation.price)} créditos</dd>
              </div>
              <div>
                <dt>Seu saldo</dt>
                <dd>{number(directory?.balance ?? 0)} créditos</dd>
              </div>
              <div>
                <dt>Saldo após a compra</dt>
                <dd>{number((directory?.balance ?? 0) - confirmation.price)} créditos</dd>
              </div>
            </dl>
            {purchaseError && <p role="alert">{purchaseError}</p>}
            <div className="h2-confirm-actions">
              <button disabled={busy} onClick={() => setConfirmation(null)}>
                Cancelar
              </button>
              <button
                className="h2-primary"
                disabled={busy || (directory?.balance ?? 0) < confirmation.price}
                onClick={() => buy(confirmation.kind, confirmation.catalogId)}
              >
                {busy ? 'Concluindo…' : 'Confirmar compra'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
