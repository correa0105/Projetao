import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Focus, Minus, Plus, RotateCcw, RotateCw, Save, Trash2, Undo2, X } from 'lucide-react';
import type { AtlasMarker } from './atlas-types';
import { api } from './api';
import {
  KINGDOM_EDITOR_CATALOG,
  type KingdomEditorItem,
  type KingdomEditorKind,
  type KingdomEditorLayout,
} from '../shared/kingdom-editor';
import { createKingdomEdgeMist, kingdomEdgeMistDepth } from './kingdom-atmosphere';
import {
  KINGDOM_CAMERA_Y,
  KINGDOM_HEIGHT,
  KINGDOM_MAX_ZOOM,
  KINGDOM_MIN_ZOOM,
  KINGDOM_WIDTH,
  kingdomDirection,
  frames,
  paintKingdom,
  projectKingdom,
  spriteSize,
  unprojectKingdom,
  type KingdomAssets,
  type KingdomView,
  type KingdomViewport,
} from './kingdom-scene';
import './kingdom-map.css';

type KingdomMapProps = {
  markers: AtlasMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReady?: () => void;
};
type Controls = {
  zoom: (amount: number) => void;
  rotate: (amount: number) => void;
  reset: () => void;
  focus: (id: string) => void;
  refresh: () => void;
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const directions = [
  'Sul',
  'Sudoeste',
  'Oeste',
  'Noroeste',
  'Norte',
  'Nordeste',
  'Leste',
  'Sudeste',
];
// The regional scene starts empty; only items placed in the editor are drawn.
const editorGroups = ['Natureza', 'Construções', 'Marcos'] as const;

function ItemPreview({ kind, assets }: { kind: KingdomEditorKind; assets: KingdomAssets | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !assets) return;
    const { sheet, y, height, columns } = frames[kind];
    const width = columns[1] - columns[0];
    const scale = Math.min(52 / width, 54 / height);
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      assets[sheet],
      columns[0],
      y,
      width,
      height,
      (canvas.width - width * scale) / 2,
      canvas.height - height * scale,
      width * scale,
      height * scale,
    );
  }, [kind, assets]);
  return <canvas ref={ref} width={60} height={60} aria-hidden="true" />;
}

function loadIllustration(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(
      () => finish(new Error('A ilustração demorou para carregar.')),
      20000,
    );
    const onAbort = () => finish(new DOMException('Carregamento interrompido', 'AbortError'));
    function finish(error?: Error) {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve(image);
    }
    signal.addEventListener('abort', onAbort, { once: true });
    image.onload = () => {
      if (image.naturalWidth > 0) finish();
      else finish(new Error('A ilustração não pôde ser lida.'));
    };
    image.onerror = () => finish(new Error('Não foi possível carregar as ilustrações do reino.'));
    image.src = url;
  });
}

export function KingdomMap({ markers, selectedId, onSelect, onReady }: KingdomMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const latest = useRef({ markers, selectedId, onSelect, onReady });
  latest.current = { markers, selectedId, onSelect, onReady };
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [direction, setDirection] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTool, setEditorTool] = useState<'pan' | 'select' | 'place'>('pan');
  const [editorGroup, setEditorGroup] = useState<(typeof editorGroups)[number]>('Natureza');
  const [editorKind, setEditorKind] = useState<KingdomEditorKind>('pine');
  const [editorItems, setEditorItems] = useState<KingdomEditorItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [editorLoading, setEditorLoading] = useState(true);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorUnsaved, setEditorUnsaved] = useState(false);
  const [editorMessage, setEditorMessage] = useState('');
  const [editorAssets, setEditorAssets] = useState<KingdomAssets | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const undoRef = useRef<KingdomEditorItem[][]>([]);
  const editorRef = useRef({
    open: editorOpen,
    tool: editorTool,
    kind: editorKind,
    items: editorItems,
    selectedItemId,
  });
  useLayoutEffect(() => {
    editorRef.current.open = editorOpen;
    editorRef.current.tool = editorTool;
    editorRef.current.kind = editorKind;
    editorRef.current.selectedItemId = selectedItemId;
  }, [editorOpen, editorTool, editorKind, selectedItemId]);

  const changeItems = (items: KingdomEditorItem[], remember = true) => {
    if (remember) {
      undoRef.current.push(editorRef.current.items.map((item) => ({ ...item })));
      setUndoCount(undoRef.current.length);
    }
    editorRef.current.items = items;
    setEditorItems(items);
    setEditorUnsaved(true);
    setEditorMessage('');
    controlsRef.current?.refresh();
  };
  const selectEditorItem = (id: string | null) => {
    editorRef.current.selectedItemId = id;
    setSelectedItemId(id);
    controlsRef.current?.refresh();
  };
  const selectedEditorItem = editorItems.find((item) => item.id === selectedItemId);

  useEffect(() => {
    let alive = true;
    api<KingdomEditorLayout>('/kingdom/editor-draft')
      .then((draft) => {
        if (!alive) return;
        editorRef.current.items = draft.items;
        setEditorItems(draft.items);
        setEditorRevision(draft.revision);
        setEditorLoading(false);
      })
      .catch((error: Error) => {
        if (!alive) return;
        setEditorLoading(false);
        setEditorMessage(error.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!editorUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editorUnsaved]);
  async function saveEditorDraft() {
    setEditorSaving(true);
    setEditorMessage('');
    const snapshot = JSON.stringify(editorRef.current.items);
    try {
      const saved = await api<KingdomEditorLayout>('/kingdom/editor-draft', {
        method: 'PUT',
        body: JSON.stringify({ revision: editorRevision, items: JSON.parse(snapshot) }),
      });
      setEditorRevision(saved.revision);
      if (JSON.stringify(editorRef.current.items) === snapshot) setEditorUnsaved(false);
      setEditorMessage('Rascunho salvo. Você pode continuar editando depois.');
    } catch (error) {
      setEditorMessage((error as Error).message);
    } finally {
      setEditorSaving(false);
    }
  }

  useEffect(() => {
    const host = hostRef.current,
      canvasHost = canvasHostRef.current;
    if (!host || !canvasHost) return;
    const canvas = document.createElement('canvas');
    const mistCanvas = document.createElement('canvas');
    canvas.className = 'kingdom-map__ground';
    mistCanvas.className = 'kingdom-map__edge-mist';
    canvas.setAttribute('aria-hidden', 'true');
    mistCanvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d', { alpha: false });
    const mistContext = mistCanvas.getContext('2d');
    if (!ctx || !mistContext) {
      setStatus('error');
      return;
    }
    canvasHost.append(canvas, mistCanvas);
    const atmosphere = createKingdomEdgeMist();
    const abort = new AbortController();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false,
      ready = false,
      frame = 0,
      dirty = true,
      mistDirty = true,
      lastMistPaint = 0;
    let assets: KingdomAssets | null = null;
    let viewport: KingdomViewport = { width: 1, height: 1, scale: 1 };
    const home = { x: 0, y: 0 };
    const view: KingdomView = { ...home, zoom: 1, angle: 0 };
    let animation: { start: number; from: KingdomView; to: KingdomView; duration: number } | null =
      null;
    const pointers = new Map<number, { x: number; y: number }>();
    let dragging = false,
      hadMultiTouch = false,
      distance = 0,
      lastDrag = 0;
    let startPointer = { x: 0, y: 0 },
      startView = { ...view };
    host.dataset.assets = 'loading';
    host.dataset.homeX = String(home.x);
    host.dataset.homeY = String(home.y);
    host.dataset.minZoom = String(KINGDOM_MIN_ZOOM);
    host.dataset.maxZoom = String(KINGDOM_MAX_ZOOM);
    setStatus('loading');
    setZoom(1);
    setDirection(0);

    function sync() {
      host!.dataset.direction = String(kingdomDirection(view.angle));
      host!.dataset.zoom = view.zoom.toFixed(4);
      host!.dataset.panX = view.x.toFixed(3);
      host!.dataset.panY = view.y.toFixed(3);
      setZoom(view.zoom);
      setDirection(kingdomDirection(view.angle));
      dirty = true;
      mistDirty = true;
    }
    function constrained(next: KingdomView): KingdomView {
      const zero = { ...next, x: 0, y: 0 };
      const corners = [
        [0, 0],
        [viewport.width, 0],
        [0, viewport.height],
        [viewport.width, viewport.height],
      ].map(([x, y]) => unprojectKingdom(x, y, zero, viewport));
      // The camera anchor sits below the viewport centre. Use each projected
      // side separately so every physical edge can reach its screen edge.
      const minX = -KINGDOM_WIDTH / 2 - Math.min(...corners.map((point) => point.x));
      const maxX = KINGDOM_WIDTH / 2 - Math.max(...corners.map((point) => point.x));
      const minY = -KINGDOM_HEIGHT / 2 - Math.min(...corners.map((point) => point.y));
      const maxY = KINGDOM_HEIGHT / 2 - Math.max(...corners.map((point) => point.y));
      return {
        ...next,
        x: minX <= maxX ? clamp(next.x, minX, maxX) : (minX + maxX) / 2,
        y: minY <= maxY ? clamp(next.y, minY, maxY) : (minY + maxY) / 2,
        zoom: clamp(next.zoom, KINGDOM_MIN_ZOOM, KINGDOM_MAX_ZOOM),
      };
    }
    function animateTo(next: KingdomView, duration = 350) {
      const to = constrained(next);
      if (reduced.matches) {
        Object.assign(view, to);
        animation = null;
        sync();
      } else animation = { start: performance.now(), from: { ...view }, to, duration };
      dirty = true;
    }
    function zoomAt(
      amount: number,
      x = viewport.width / 2,
      y = viewport.height * KINGDOM_CAMERA_Y,
    ) {
      animation = null;
      const before = unprojectKingdom(x, y, view, viewport);
      view.zoom = clamp(view.zoom * amount, KINGDOM_MIN_ZOOM, KINGDOM_MAX_ZOOM);
      const after = unprojectKingdom(x, y, view, viewport);
      view.x += before.x - after.x;
      view.y += before.y - after.y;
      Object.assign(view, constrained(view));
      sync();
    }
    function tick(now: number) {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      if (!ready || !assets || document.hidden) return;
      if (animation) {
        const progress = clamp((now - animation.start) / animation.duration, 0, 1);
        const t = 1 - (1 - progress) ** 3;
        for (const key of ['x', 'y', 'zoom', 'angle'] as const)
          view[key] = animation.from[key] + (animation.to[key] - animation.from[key]) * t;
        if (progress >= 1) animation = null;
        sync();
      }
      if (dirty) {
        paintKingdom(
          ctx!,
          assets,
          editorRef.current.items,
          view,
          viewport,
          editorRef.current.open ? editorRef.current.selectedItemId : null,
          null,
          reduced.matches ? 0 : now / 1000,
        );
        dirty = false;
      }
      if (mistDirty || (!reduced.matches && now - lastMistPaint >= 1000 / 24)) {
        const time = reduced.matches ? 0 : now / 1000;
        atmosphere.paintEdgeMist(mistContext!, view, viewport, time);
        mistDirty = false;
        lastMistPaint = now;
      }
    }
    function resize() {
      const rect = host!.getBoundingClientRect();
      const width = Math.max(1, rect.width),
        height = Math.max(1, rect.height);
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      viewport = {
        width,
        height,
        scale: Math.min(1.05, Math.max(0.27, width / 3800)) * 0.384 * 0.85,
      };
      host!.dataset.baseScale = viewport.scale.toFixed(6);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      mistCanvas.width = canvas.width;
      mistCanvas.height = canvas.height;
      ctx!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      mistContext!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx!.imageSmoothingEnabled = true;
      ctx!.imageSmoothingQuality = 'high';
      Object.assign(view, constrained(view));
      dirty = true;
      mistDirty = true;
      host!.dataset.edgeMistDepth = kingdomEdgeMistDepth(width, height).toFixed(1);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    sync();
    const local = (event: { clientX: number; clientY: number }) => {
      const rect = host!.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    let movingItem: { id: string; original: KingdomEditorItem[] } | null = null;
    function hitEditorItem(x: number, y: number) {
      const direction = kingdomDirection(view.angle);
      return [...editorRef.current.items].reverse().find((item) => {
        const at = projectKingdom(item.x, item.y, view, viewport);
        const size = spriteSize(item, assets!, viewport.scale * view.zoom, direction);
        return (
          x >= at.x - size.width * 0.6 &&
          x <= at.x + size.width * 0.6 &&
          y >= at.y - size.height &&
          y <= at.y + 8
        );
      });
    }
    function pointerDown(event: PointerEvent) {
      if (
        !ready ||
        event.button > 0 ||
        (event.target as Element).closest(
          '.kingdom-map__controls, .kingdom-editor, .kingdom-map__editor-toggle',
        )
      )
        return;
      animation = null;
      const at = local(event);
      if (editorRef.current.open && event.isPrimary) {
        if (editorRef.current.tool === 'place') {
          const point = unprojectKingdom(at.x, at.y, view, viewport);
          if (Math.abs(point.x) > KINGDOM_WIDTH / 2 || Math.abs(point.y) > KINGDOM_HEIGHT / 2)
            return;
          const definition = KINGDOM_EDITOR_CATALOG.find(
            (entry) => entry.kind === editorRef.current.kind,
          )!;
          const item: KingdomEditorItem = {
            id: crypto.randomUUID(),
            kind: definition.kind,
            x: Math.round(point.x),
            y: Math.round(point.y),
            height: definition.height,
            direction: 0,
          };
          changeItems([...editorRef.current.items, item]);
          selectEditorItem(item.id);
          event.preventDefault();
          return;
        }
        if (editorRef.current.tool === 'select') {
          const hit = hitEditorItem(at.x, at.y);
          selectEditorItem(hit?.id ?? null);
          if (hit) {
            movingItem = {
              id: hit.id,
              original: editorRef.current.items.map((item) => ({ ...item })),
            };
            startPointer = at;
            startView = { ...view };
            dragging = false;
            hadMultiTouch = false;
            host!.setPointerCapture(event.pointerId);
            pointers.set(event.pointerId, at);
            event.preventDefault();
            return;
          }
        }
      }
      pointers.set(event.pointerId, at);
      if (pointers.size === 1) {
        startPointer = at;
        startView = { ...view };
        dragging = false;
        hadMultiTouch = false;
      } else {
        hadMultiTouch = true;
        dragging = true;
        const pair = [...pointers.values()];
        distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      }
      if (!(event.target as Element).closest('button, .kingdom-house'))
        host!.setPointerCapture(event.pointerId);
    }
    function pointerMove(event: PointerEvent) {
      if (!pointers.has(event.pointerId)) return;
      const at = local(event);
      pointers.set(event.pointerId, at);
      if (movingItem && pointers.size === 1) {
        const from = unprojectKingdom(startPointer.x, startPointer.y, startView, viewport);
        const to = unprojectKingdom(at.x, at.y, startView, viewport);
        const initial = movingItem.original.find((item) => item.id === movingItem!.id)!;
        const next = editorRef.current.items.map((item) =>
          item.id === movingItem!.id
            ? {
                ...item,
                x: Math.round(
                  clamp(initial.x + to.x - from.x, -KINGDOM_WIDTH / 2, KINGDOM_WIDTH / 2),
                ),
                y: Math.round(
                  clamp(initial.y + to.y - from.y, -KINGDOM_HEIGHT / 2, KINGDOM_HEIGHT / 2),
                ),
              }
            : item,
        );
        editorRef.current.items = next;
        setEditorItems(next);
        dirty = true;
        if (Math.hypot(at.x - startPointer.x, at.y - startPointer.y) > 3) dragging = true;
        event.preventDefault();
        return;
      }
      if (pointers.size > 1) {
        const pair = [...pointers.values()];
        const nextDistance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        if (distance > 0)
          zoomAt(nextDistance / distance, (pair[0].x + pair[1].x) / 2, (pair[0].y + pair[1].y) / 2);
        distance = nextDistance;
      } else {
        if (Math.hypot(at.x - startPointer.x, at.y - startPointer.y) > 5) dragging = true;
        if (!dragging) return;
        const from = unprojectKingdom(startPointer.x, startPointer.y, startView, viewport);
        const to = unprojectKingdom(at.x, at.y, startView, viewport);
        const proposed = {
          ...view,
          x: startView.x + from.x - to.x,
          y: startView.y + from.y - to.y,
        };
        const bounds = constrained(proposed);
        const elastic = (value: number, limit: number) =>
          limit + Math.tanh((value - limit) / 200) * 90;
        view.x = elastic(proposed.x, bounds.x);
        view.y = elastic(proposed.y, bounds.y);
        sync();
      }
      host!.dataset.dragging = 'true';
      event.preventDefault();
    }
    function pointerUp(event: PointerEvent) {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (host!.hasPointerCapture(event.pointerId)) host!.releasePointerCapture(event.pointerId);
      if (movingItem) {
        if (dragging) {
          undoRef.current.push(movingItem.original);
          setUndoCount(undoRef.current.length);
          setEditorUnsaved(true);
          setEditorMessage('');
        }
        movingItem = null;
        dragging = false;
        host!.dataset.dragging = 'false';
        event.preventDefault();
        return;
      }
      if (dragging || hadMultiTouch) lastDrag = performance.now();
      if (pointers.size === 1) {
        startPointer = [...pointers.values()][0];
        startView = { ...view };
        distance = 0;
      } else if (!pointers.size) {
        dragging = false;
        host!.dataset.dragging = 'false';
        animateTo(view, 390);
      }
    }
    function suppressDragClick(event: MouseEvent) {
      if (
        event.detail === 0 ||
        !(event.target as Element).closest('.kingdom-place, .kingdom-house')
      )
        return;
      if (performance.now() - lastDrag < 220) {
        event.stopPropagation();
        event.preventDefault();
      }
    }
    function wheel(event: WheelEvent) {
      if (!ready || (event.target as Element).closest('.kingdom-editor')) return;
      event.preventDefault();
      const at = local(event);
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.height : 1);
      zoomAt(Math.exp(-clamp(delta, -240, 240) * 0.0015), at.x, at.y);
    }
    function keydown(event: KeyboardEvent) {
      if (
        !ready ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName)
      )
        return;
      const key = event.key.toLowerCase();
      if (key === 'q' || key === 'e') controlsRef.current?.rotate(key === 'q' ? -1 : 1);
      else if (key === 'home') controlsRef.current?.reset();
      else if (key === '+' || key === '=') zoomAt(1.15);
      else if (key === '-') zoomAt(1 / 1.15);
      else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        const dx = key === 'arrowleft' ? -105 : key === 'arrowright' ? 105 : 0;
        const dy = key === 'arrowup' ? -90 : key === 'arrowdown' ? 90 : 0;
        const from = unprojectKingdom(
          viewport.width / 2,
          viewport.height * KINGDOM_CAMERA_Y,
          view,
          viewport,
        );
        const to = unprojectKingdom(
          viewport.width / 2 + dx,
          viewport.height * KINGDOM_CAMERA_Y + dy,
          view,
          viewport,
        );
        animateTo({ ...view, x: view.x + to.x - from.x, y: view.y + to.y - from.y }, 180);
      } else return;
      event.preventDefault();
    }
    function wake() {
      dirty = true;
      mistDirty = true;
    }
    controlsRef.current = {
      zoom: (amount) => zoomAt(amount),
      rotate: (amount) => {
        const target = animation?.to.angle ?? view.angle;
        animateTo(
          { ...view, angle: ((Math.round(target / (Math.PI / 4)) + amount) * Math.PI) / 4 },
          320,
        );
      },
      reset: () => animateTo({ ...home, zoom: 1, angle: 0 }, 450),
      focus: (id) => {
        if (!ready || pointers.size) return;
        const item = editorRef.current.items.find((entry) => entry.id === id);
        if (item) animateTo({ ...view, x: item.x, y: item.y });
      },
      refresh: () => {
        dirty = true;
      },
    };
    host.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove, { passive: false });
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    host.addEventListener('click', suppressDragClick, true);
    host.addEventListener('wheel', wheel, { passive: false });
    host.addEventListener('keydown', keydown);
    document.addEventListener('visibilitychange', wake);
    reduced.addEventListener('change', wake);
    frame = requestAnimationFrame(tick);
    Promise.all(
      [
        'ground',
        'structures',
        'nature',
        'landmarks',
        'settlements',
        'town',
        'seaport',
        'craft',
        'frontier',
      ].map(
        async (name) =>
          [
            name,
            await loadIllustration(
              name === 'ground'
                ? '/kingdom/ground-trails.png'
                : name === 'nature'
                  ? '/kingdom/nature.png'
                  : `/kingdom/structures/atlases/${({ town: 'town-buildings', seaport: 'harbor-buildings', craft: 'craft-buildings', frontier: 'frontier-buildings' } as Record<string, string>)[name] ?? name}.png`,
              abort.signal,
            ),
          ] as const,
      ),
    )
      .then((entries) => {
        if (disposed) return;
        const loaded = Object.fromEntries(entries) as unknown as KingdomAssets;
        assets = loaded;
        setEditorAssets(loaded);
        host.dataset.groveCount = '0';
        ready = true;
        dirty = true;
        mistDirty = true;
        host.dataset.assets = 'ready';
        setStatus('ready');
        latest.current.onReady?.();
      })
      .catch((error: unknown) => {
        if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return;
        host.dataset.assets = 'error';
        setStatus('error');
      });
    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controlsRef.current = null;
      pointers.clear();
      host.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerUp);
      host.removeEventListener('click', suppressDragClick, true);
      host.removeEventListener('wheel', wheel);
      host.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', wake);
      reduced.removeEventListener('change', wake);
      canvas.remove();
      mistCanvas.remove();
      canvas.width = 1;
      canvas.height = 1;
      mistCanvas.width = 1;
      mistCanvas.height = 1;
      assets = null;
    };
  }, [retry]);

  useEffect(() => {
    controlsRef.current?.refresh();
  }, [markers, selectedId]);
  return (
    <div
      ref={hostRef}
      className="kingdom-map"
      data-stage="terrain"
      data-renderer="canvas2d"
      data-status={status}
      data-direction={direction}
      tabIndex={0}
      role="region"
      aria-label="Mapa ilustrado do Reino do Norte"
      aria-describedby="kingdom-instructions"
    >
      <p id="kingdom-instructions" className="sr-only">
        Arraste para explorar. Use a roda do mouse ou dois dedos para aproximar. Q e E giram o mapa
        em oito direções; setas deslocam e Home volta ao centro do reino.
      </p>
      <div ref={canvasHostRef} className="kingdom-map__canvas" />
      <button
        className="kingdom-map__editor-toggle"
        type="button"
        disabled={editorLoading}
        aria-expanded={editorOpen}
        aria-controls="kingdom-editor"
        onClick={() => {
          setEditorOpen((open) => !open);
          setEditorTool('pan');
        }}
      >
        {editorLoading ? 'Carregando editor…' : editorOpen ? 'Fechar editor' : 'Editar mapa'}
        {editorUnsaved && (
          <span className="kingdom-map__unsaved-dot" aria-label="Alterações não salvas" />
        )}
      </button>
      {editorOpen && (
        <aside id="kingdom-editor" className="kingdom-editor" aria-label="Editor do mapa do reino">
          <div className="kingdom-editor__heading">
            <div>
              <strong>Editor do reino</strong>
              <small>Seu rascunho · {editorItems.length} itens</small>
            </div>
            <button type="button" aria-label="Fechar editor" onClick={() => setEditorOpen(false)}>
              <X size={17} />
            </button>
          </div>
          <p className="kingdom-editor__hint">
            Escolha um item e clique no mapa. Em Selecionar, arraste o item para ajustar a posição.
            Navegar mantém o arraste da câmera.
          </p>
          <div className="kingdom-editor__tools" role="group" aria-label="Ferramenta do editor">
            {(['pan', 'select', 'place'] as const).map((tool) => (
              <button
                key={tool}
                type="button"
                className={editorTool === tool ? 'is-active' : ''}
                aria-pressed={editorTool === tool}
                onClick={() => setEditorTool(tool)}
              >
                {{ pan: 'Navegar', select: 'Selecionar', place: 'Adicionar' }[tool]}
              </button>
            ))}
          </div>
          <div className="kingdom-editor__groups" role="group" aria-label="Categoria de itens">
            {editorGroups.map((group) => (
              <button
                key={group}
                type="button"
                className={editorGroup === group ? 'is-active' : ''}
                aria-pressed={editorGroup === group}
                onClick={() => setEditorGroup(group)}
              >
                {group}
              </button>
            ))}
          </div>
          <div className="kingdom-editor__catalog" aria-label="Itens disponíveis">
            {KINGDOM_EDITOR_CATALOG.filter((item) => item.group === editorGroup).map((item) => (
              <button
                key={item.kind}
                type="button"
                className={editorKind === item.kind && editorTool === 'place' ? 'is-active' : ''}
                aria-pressed={editorKind === item.kind && editorTool === 'place'}
                onClick={() => {
                  setEditorKind(item.kind);
                  setEditorTool('place');
                }}
              >
                <ItemPreview kind={item.kind} assets={editorAssets} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          {editorItems.length > 0 && (
            <div className="kingdom-editor__placed" aria-label="Itens colocados">
              <strong>Itens colocados</strong>
              <div>
                {editorItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={selectedItemId === item.id ? 'is-active' : ''}
                    aria-pressed={selectedItemId === item.id}
                    onClick={() => {
                      selectEditorItem(item.id);
                      setEditorTool('select');
                      controlsRef.current?.focus(item.id);
                    }}
                  >
                    {index + 1}.{' '}
                    {KINGDOM_EDITOR_CATALOG.find((entry) => entry.kind === item.kind)?.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedEditorItem && (
            <div className="kingdom-editor__selection">
              <strong>
                {
                  KINGDOM_EDITOR_CATALOG.find((item) => item.kind === selectedEditorItem.kind)
                    ?.label
                }
              </strong>
              <span>Selecionado no mapa</span>
              <div className="kingdom-editor__adjust">
                <span>Tamanho</span>
                <button
                  type="button"
                  aria-label="Diminuir item"
                  onClick={() =>
                    changeItems(
                      editorItems.map((item) =>
                        item.id === selectedEditorItem.id
                          ? { ...item, height: Math.max(80, Math.round(item.height * 0.9)) }
                          : item,
                      ),
                    )
                  }
                >
                  −
                </button>
                <output>{Math.round(selectedEditorItem.height)}</output>
                <button
                  type="button"
                  aria-label="Aumentar item"
                  onClick={() =>
                    changeItems(
                      editorItems.map((item) =>
                        item.id === selectedEditorItem.id
                          ? { ...item, height: Math.min(1200, Math.round(item.height * 1.1)) }
                          : item,
                      ),
                    )
                  }
                >
                  +
                </button>
              </div>
              <div className="kingdom-editor__adjust">
                <span>Orientação</span>
                <button
                  type="button"
                  aria-label="Girar item para a esquerda"
                  onClick={() =>
                    changeItems(
                      editorItems.map((item) =>
                        item.id === selectedEditorItem.id
                          ? { ...item, direction: (item.direction + 7) % 8 }
                          : item,
                      ),
                    )
                  }
                >
                  ↶
                </button>
                <output>{selectedEditorItem.direction * 45}°</output>
                <button
                  type="button"
                  aria-label="Girar item para a direita"
                  onClick={() =>
                    changeItems(
                      editorItems.map((item) =>
                        item.id === selectedEditorItem.id
                          ? { ...item, direction: (item.direction + 1) % 8 }
                          : item,
                      ),
                    )
                  }
                >
                  ↷
                </button>
              </div>
              <button
                className="kingdom-editor__delete"
                type="button"
                onClick={() => {
                  changeItems(editorItems.filter((item) => item.id !== selectedEditorItem.id));
                  selectEditorItem(null);
                }}
              >
                <Trash2 size={15} /> Excluir item
              </button>
            </div>
          )}
          {editorMessage && (
            <p className="kingdom-editor__message" role="status">
              {editorMessage}
            </p>
          )}
          <div className="kingdom-editor__footer">
            <button
              type="button"
              disabled={!undoCount}
              onClick={() => {
                const previous = undoRef.current.pop();
                if (!previous) return;
                setUndoCount(undoRef.current.length);
                changeItems(previous, false);
                selectEditorItem(null);
              }}
            >
              <Undo2 size={15} /> Desfazer
            </button>
            <button
              type="button"
              className="kingdom-editor__save"
              disabled={editorLoading || editorSaving || !editorUnsaved}
              onClick={() => void saveEditorDraft()}
            >
              <Save size={15} /> {editorSaving ? 'Salvando…' : 'Salvar rascunho'}
            </button>
          </div>
        </aside>
      )}
      <div className="kingdom-map__controls" aria-label="Navegação pelo reino">
        <div className="kingdom-map__turns">
          <button
            aria-label="Girar mapa para a esquerda"
            title="Girar à esquerda · Q"
            disabled={status !== 'ready'}
            onClick={() => controlsRef.current?.rotate(-1)}
          >
            <RotateCcw size={16} />
          </button>
          <output className="kingdom-map__direction" aria-label="Direção da visão">
            {directions[direction]}
          </output>
          <button
            aria-label="Girar mapa para a direita"
            title="Girar à direita · E"
            disabled={status !== 'ready'}
            onClick={() => controlsRef.current?.rotate(1)}
          >
            <RotateCw size={16} />
          </button>
        </div>
        <div className="kingdom-map__zoom">
          <button
            aria-label="Afastar mapa"
            disabled={status !== 'ready' || zoom <= KINGDOM_MIN_ZOOM + 0.001}
            onClick={() => controlsRef.current?.zoom(1 / 1.18)}
          >
            <Minus size={16} />
          </button>
          <output aria-label="Aproximação do mapa">{Math.round(zoom * 100)}%</output>
          <button
            aria-label="Aproximar mapa"
            disabled={status !== 'ready' || zoom >= KINGDOM_MAX_ZOOM - 0.001}
            onClick={() => controlsRef.current?.zoom(1.18)}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label="Centralizar mapa"
            title="Centralizar em Vigília · Home"
            disabled={status !== 'ready'}
            onClick={() => controlsRef.current?.reset()}
          >
            <Focus size={17} />
          </button>
        </div>
      </div>
      {status !== 'ready' && (
        <div className="kingdom-map__status" role={status === 'error' ? 'alert' : 'status'}>
          <span>
            {status === 'error'
              ? 'Não foi possível abrir as ilustrações do reino.'
              : 'Desdobrando os caminhos do Norte…'}
          </span>
          {status === 'error' && (
            <button className="button outline" onClick={() => setRetry((value) => value + 1)}>
              Tentar novamente
            </button>
          )}
        </div>
      )}
    </div>
  );
}
