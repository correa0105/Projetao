import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Focus,
  Copy,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import type { AtlasMarker } from './atlas-types';
import { api } from './api';
import {
  KINGDOM_EDITOR_CATALOG,
  KINGDOM_BACKGROUND_MAX_BYTES,
  KINGDOM_UNITS_PER_PIXEL,
  type KingdomBackgroundMeta,
  type KingdomEditorView,
  type KingdomEditorItem,
  type KingdomEditorKind,
  type KingdomEditorLayout,
} from '../shared/kingdom-editor';
import {
  KINGDOM_CAMERA_Y,
  KINGDOM_MAX_ZOOM,
  KINGDOM_MIN_ZOOM,
  KINGDOM_TILT,
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
  getView: () => KingdomView;
  setHome: (view: KingdomView) => void;
  setEditorMode: () => void;
  nudgeSelection: (screenX: number, screenY: number) => void;
  duplicateSelection: () => void;
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const EDITOR_MIN_ZOOM = 0.03;
const EDITOR_MAX_ZOOM = 32;
const defaultHome: KingdomView = { x: 0, y: 0, zoom: 1, angle: 0 };
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
      60000,
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
  const [homeZoom, setHomeZoom] = useState(1);
  const [direction, setDirection] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTool, setEditorTool] = useState<'pan' | 'select' | 'place'>('pan');
  const [editorGroup, setEditorGroup] = useState<(typeof editorGroups)[number]>('Natureza');
  const [editorKind, setEditorKind] = useState<KingdomEditorKind>('pine');
  const [editorItems, setEditorItems] = useState<KingdomEditorItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [nudgeStep, setNudgeStep] = useState(12);
  const [selectionBox, setSelectionBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [mapConfig, setMapConfig] = useState<{
    background: KingdomBackgroundMeta;
    home: KingdomView;
  } | null>(null);
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [viewBusy, setViewBusy] = useState(false);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
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
    selectedItemIds,
    nudgeStep,
  });
  useLayoutEffect(() => {
    editorRef.current.open = editorOpen;
    editorRef.current.tool = editorTool;
    editorRef.current.kind = editorKind;
    editorRef.current.selectedItemIds = selectedItemIds;
    editorRef.current.nudgeStep = nudgeStep;
  }, [editorOpen, editorTool, editorKind, selectedItemIds, nudgeStep]);

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
  const selectEditorItems = (ids: string[]) => {
    editorRef.current.selectedItemIds = ids;
    setSelectedItemIds(ids);
    controlsRef.current?.refresh();
  };
  const selectedEditorItem =
    selectedItemIds.length === 1
      ? editorItems.find((item) => item.id === selectedItemIds[0])
      : null;
  const selectedSet = new Set(selectedItemIds);
  const background = mapConfig?.background;

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<KingdomBackgroundMeta>('/kingdom/editor-background/meta'),
      api<KingdomEditorView>('/kingdom/editor-view'),
    ])
      .then(([background, saved]) => {
        if (alive) setMapConfig({ background, home: saved.exists ? saved : defaultHome });
      })
      .catch((error: Error) => {
        if (alive) {
          setEditorMessage(error.message);
          setStatus('error');
        }
      });
    return () => {
      alive = false;
    };
  }, [retry]);
  async function uploadBackground(file: File) {
    if (file.size > KINGDOM_BACKGROUND_MAX_BYTES) {
      setEditorMessage('O fundo deve ter no máximo 128 MB.');
      return;
    }
    setBackgroundBusy(true);
    setEditorMessage('Enviando fundo…');
    try {
      const saved = await api<KingdomBackgroundMeta>('/kingdom/editor-background', {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      setMapConfig({ background: saved, home: defaultHome });
      setEditorMessage(`Fundo salvo: ${saved.width} × ${saved.height} px.`);
    } catch (error) {
      setEditorMessage((error as Error).message);
    } finally {
      setBackgroundBusy(false);
    }
  }
  async function resetBackground() {
    setBackgroundBusy(true);
    try {
      const restored = await api<KingdomBackgroundMeta>('/kingdom/editor-background', {
        method: 'DELETE',
      });
      setMapConfig({ background: restored, home: defaultHome });
      setEditorMessage('Fundo original restaurado.');
    } catch (error) {
      setEditorMessage((error as Error).message);
    } finally {
      setBackgroundBusy(false);
    }
  }
  async function saveCurrentView() {
    const current = controlsRef.current?.getView();
    if (!current) return;
    setViewBusy(true);
    setEditorMessage('Salvando visão…');
    try {
      const saved = await api<KingdomEditorView>('/kingdom/editor-view', {
        method: 'PUT',
        body: JSON.stringify({
          ...current,
          angle: ((current.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
        }),
      });
      controlsRef.current?.setHome(saved);
      setEditorMessage('Visão atual salva como 100%. Ela será restaurada ao voltar ao mapa.');
    } catch (error) {
      setEditorMessage((error as Error).message);
    } finally {
      setViewBusy(false);
    }
  }
  async function resetCurrentView() {
    setViewBusy(true);
    try {
      await api<KingdomEditorView>('/kingdom/editor-view', { method: 'DELETE' });
      controlsRef.current?.setHome(defaultHome);
      controlsRef.current?.reset();
      setEditorMessage('Enquadramento inicial restaurado.');
    } catch (error) {
      setEditorMessage((error as Error).message);
    } finally {
      setViewBusy(false);
    }
  }

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
    if (!host || !canvasHost || !mapConfig) return;
    const { background } = mapConfig;
    const canvas = document.createElement('canvas');
    canvas.className = 'kingdom-map__ground';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      setStatus('error');
      return;
    }
    canvasHost.append(canvas);
    const abort = new AbortController();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false,
      ready = false,
      frame = 0,
      dirty = true;
    let assets: KingdomAssets | null = null;
    let viewport: KingdomViewport = {
      width: 1,
      height: 1,
      scale: 1,
      tilt: background.exists ? 1 : KINGDOM_TILT,
      mapWidth: background.width * KINGDOM_UNITS_PER_PIXEL,
      mapHeight: background.height * KINGDOM_UNITS_PER_PIXEL,
    };
    const home: KingdomView = { ...mapConfig.home };
    const view: KingdomView = { ...home };
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
    host.dataset.mapWidth = String(viewport.mapWidth);
    host.dataset.mapHeight = String(viewport.mapHeight);
    host.dataset.imageWidth = String(background.width);
    host.dataset.imageHeight = String(background.height);
    host.dataset.customBackground = String(background.exists);
    host.dataset.tilt = String(viewport.tilt);
    setStatus('loading');
    setZoom(view.zoom);
    setHomeZoom(home.zoom);
    setDirection(kingdomDirection(view.angle));

    function zoomBounds() {
      return editorRef.current.open
        ? { min: EDITOR_MIN_ZOOM, max: EDITOR_MAX_ZOOM }
        : { min: home.zoom * KINGDOM_MIN_ZOOM, max: home.zoom * KINGDOM_MAX_ZOOM };
    }

    function sync() {
      const bounds = zoomBounds();
      host!.dataset.direction = String(kingdomDirection(view.angle));
      host!.dataset.angle = view.angle.toFixed(6);
      host!.dataset.zoom = view.zoom.toFixed(4);
      host!.dataset.homeZoom = home.zoom.toFixed(4);
      host!.dataset.homeAngle = home.angle.toFixed(6);
      host!.dataset.minZoom = bounds.min.toFixed(4);
      host!.dataset.maxZoom = bounds.max.toFixed(4);
      host!.dataset.panX = view.x.toFixed(3);
      host!.dataset.panY = view.y.toFixed(3);
      setZoom(view.zoom);
      setDirection(kingdomDirection(view.angle));
      dirty = true;
    }
    function constrained(next: KingdomView): KingdomView {
      const bounds = zoomBounds();
      const normalized = { ...next, zoom: clamp(next.zoom, bounds.min, bounds.max) };
      const zero = { ...normalized, x: 0, y: 0 };
      const corners = [
        [0, 0],
        [viewport.width, 0],
        [0, viewport.height],
        [viewport.width, viewport.height],
      ].map(([x, y]) => unprojectKingdom(x, y, zero, viewport));
      // The camera anchor sits below the viewport centre. Use each projected
      // side separately so every physical edge can reach its screen edge.
      const minX = -viewport.mapWidth / 2 - Math.min(...corners.map((point) => point.x));
      const maxX = viewport.mapWidth / 2 - Math.max(...corners.map((point) => point.x));
      const minY = -viewport.mapHeight / 2 - Math.min(...corners.map((point) => point.y));
      const maxY = viewport.mapHeight / 2 - Math.max(...corners.map((point) => point.y));
      return {
        ...normalized,
        x: minX <= maxX ? clamp(next.x, minX, maxX) : (minX + maxX) / 2,
        y: minY <= maxY ? clamp(next.y, minY, maxY) : (minY + maxY) / 2,
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
      const bounds = zoomBounds();
      view.zoom = clamp(view.zoom * amount, bounds.min, bounds.max);
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
          editorRef.current.open ? editorRef.current.selectedItemIds : [],
          null,
          reduced.matches ? 0 : now / 1000,
        );
        dirty = false;
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
        tilt: viewport.tilt,
        mapWidth: viewport.mapWidth,
        mapHeight: viewport.mapHeight,
      };
      host!.dataset.baseScale = viewport.scale.toFixed(6);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      ctx!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx!.imageSmoothingEnabled = true;
      ctx!.imageSmoothingQuality = 'high';
      Object.assign(view, constrained(view));
      dirty = true;
    }
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    sync();
    const local = (event: { clientX: number; clientY: number }) => {
      const rect = host!.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    let movingItems: {
      ids: string[];
      hitId: string;
      original: KingdomEditorItem[];
      wasSelected: boolean;
      toggleOnClick: boolean;
    } | null = null;
    let marquee: { start: { x: number; y: number }; add: boolean } | null = null;
    let pendingPlace: { at: { x: number; y: number }; kind: KingdomEditorKind } | null = null;
    let pendingClearSelection = false;
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
    function screenDelta(dx: number, dy: number) {
      const x = viewport.width / 2;
      const y = viewport.height * KINGDOM_CAMERA_Y;
      const from = unprojectKingdom(x, y, view, viewport);
      const to = unprojectKingdom(x + dx, y + dy, view, viewport);
      return { x: to.x - from.x, y: to.y - from.y };
    }
    function movedGroup(original: KingdomEditorItem[], ids: string[], dx: number, dy: number) {
      const group = original.filter((item) => ids.includes(item.id));
      if (!group.length) return original;
      const allowedX = clamp(
        dx,
        -viewport.mapWidth / 2 - Math.min(...group.map((item) => item.x)),
        viewport.mapWidth / 2 - Math.max(...group.map((item) => item.x)),
      );
      const allowedY = clamp(
        dy,
        -viewport.mapHeight / 2 - Math.min(...group.map((item) => item.y)),
        viewport.mapHeight / 2 - Math.max(...group.map((item) => item.y)),
      );
      return original.map((item) =>
        ids.includes(item.id)
          ? { ...item, x: Math.round(item.x + allowedX), y: Math.round(item.y + allowedY) }
          : item,
      );
    }
    function hoverItem(event: PointerEvent) {
      if (!ready || !editorRef.current.open || editorRef.current.tool === 'pan') {
        host!.dataset.hoverItem = 'false';
        return;
      }
      const at = local(event);
      host!.dataset.hoverItem = String(!!hitEditorItem(at.x, at.y));
    }
    function leaveItem() {
      host!.dataset.hoverItem = 'false';
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
        if (event.ctrlKey) {
          const hit = hitEditorItem(at.x, at.y);
          if (hit) {
            const wasSelected = editorRef.current.selectedItemIds.includes(hit.id);
            movingItems = {
              ids: wasSelected ? [...editorRef.current.selectedItemIds] : [hit.id],
              hitId: hit.id,
              original: editorRef.current.items.map((item) => ({ ...item })),
              wasSelected,
              toggleOnClick: true,
            };
          } else {
            marquee = { start: at, add: event.shiftKey };
            setSelectionBox({ x: at.x, y: at.y, width: 0, height: 0 });
          }
          startPointer = at;
          startView = { ...view };
          dragging = false;
          hadMultiTouch = false;
          host!.setPointerCapture(event.pointerId);
          pointers.set(event.pointerId, at);
          event.preventDefault();
          return;
        }
        if (editorRef.current.tool !== 'pan' && !event.altKey) {
          const hit = hitEditorItem(at.x, at.y);
          if (hit) {
            const wasSelected = editorRef.current.selectedItemIds.includes(hit.id);
            movingItems = {
              ids: wasSelected ? [...editorRef.current.selectedItemIds] : [hit.id],
              hitId: hit.id,
              original: editorRef.current.items.map((item) => ({ ...item })),
              wasSelected,
              toggleOnClick: false,
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
        if (editorRef.current.tool === 'place') {
          pendingPlace = { at, kind: editorRef.current.kind };
        } else if (editorRef.current.tool === 'select') {
          pendingClearSelection = true;
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
      if (marquee && pointers.size === 1) {
        dragging = Math.hypot(at.x - startPointer.x, at.y - startPointer.y) > 3;
        setSelectionBox({
          x: Math.min(at.x, marquee.start.x),
          y: Math.min(at.y, marquee.start.y),
          width: Math.abs(at.x - marquee.start.x),
          height: Math.abs(at.y - marquee.start.y),
        });
        event.preventDefault();
        return;
      }
      if (movingItems && pointers.size === 1) {
        if (Math.hypot(at.x - startPointer.x, at.y - startPointer.y) <= 3) return;
        dragging = true;
        const from = unprojectKingdom(startPointer.x, startPointer.y, startView, viewport);
        const to = unprojectKingdom(at.x, at.y, startView, viewport);
        const next = movedGroup(
          movingItems.original,
          movingItems.ids,
          to.x - from.x,
          to.y - from.y,
        );
        editorRef.current.items = next;
        setEditorItems(next);
        dirty = true;
        host!.dataset.dragging = 'true';
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
      if (pendingPlace && !dragging && !hadMultiTouch) {
        const point = unprojectKingdom(pendingPlace.at.x, pendingPlace.at.y, view, viewport);
        if (
          Math.abs(point.x) <= viewport.mapWidth / 2 &&
          Math.abs(point.y) <= viewport.mapHeight / 2
        ) {
          const definition = KINGDOM_EDITOR_CATALOG.find(
            (entry) => entry.kind === pendingPlace!.kind,
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
          selectEditorItems([item.id]);
        }
        pendingPlace = null;
        event.preventDefault();
        return;
      }
      pendingPlace = null;
      if (marquee) {
        const at = local(event);
        const left = Math.min(marquee.start.x, at.x),
          right = Math.max(marquee.start.x, at.x);
        const top = Math.min(marquee.start.y, at.y),
          bottom = Math.max(marquee.start.y, at.y);
        const matches = dragging
          ? editorRef.current.items
              .filter((item) => {
                const point = projectKingdom(item.x, item.y, view, viewport);
                const size = spriteSize(
                  item,
                  assets!,
                  viewport.scale * view.zoom,
                  kingdomDirection(view.angle),
                );
                return (
                  point.x + size.width * 0.6 >= left &&
                  point.x - size.width * 0.6 <= right &&
                  point.y + 8 >= top &&
                  point.y - size.height <= bottom
                );
              })
              .map((item) => item.id)
          : [];
        selectEditorItems(
          marquee.add ? [...new Set([...editorRef.current.selectedItemIds, ...matches])] : matches,
        );
        marquee = null;
        setSelectionBox(null);
        dragging = false;
        event.preventDefault();
        return;
      }
      if (movingItems) {
        if (dragging) {
          if (!movingItems.wasSelected) selectEditorItems(movingItems.ids);
          undoRef.current.push(movingItems.original);
          setUndoCount(undoRef.current.length);
          setEditorUnsaved(true);
          setEditorMessage('');
        } else if (movingItems.toggleOnClick) {
          const ids = editorRef.current.selectedItemIds;
          selectEditorItems(
            ids.includes(movingItems.hitId)
              ? ids.filter((id) => id !== movingItems!.hitId)
              : [...ids, movingItems.hitId],
          );
        } else {
          selectEditorItems(movingItems.ids);
        }
        movingItems = null;
        dragging = false;
        host!.dataset.dragging = 'false';
        event.preventDefault();
        return;
      }
      if (pendingClearSelection && !dragging) selectEditorItems([]);
      pendingClearSelection = false;
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
        editorRef.current.open &&
        !/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName)
      ) {
        const key = event.key.toLowerCase();
        if (event.ctrlKey && key === 'a') {
          selectEditorItems(editorRef.current.items.map((item) => item.id));
          event.preventDefault();
          return;
        }
        if ((key === 'delete' || key === 'backspace') && editorRef.current.selectedItemIds.length) {
          const selected = new Set(editorRef.current.selectedItemIds);
          changeItems(editorRef.current.items.filter((item) => !selected.has(item.id)));
          selectEditorItems([]);
          event.preventDefault();
          return;
        }
        if (key === 'escape') {
          selectEditorItems([]);
          event.preventDefault();
          return;
        }
        if (
          editorRef.current.selectedItemIds.length &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)
        ) {
          const step = editorRef.current.nudgeStep * (event.shiftKey ? 5 : 1);
          controlsRef.current?.nudgeSelection(
            key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0,
            key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0,
          );
          event.preventDefault();
          return;
        }
      }
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
      reset: () => animateTo({ ...home }, 450),
      focus: (id) => {
        if (!ready || pointers.size) return;
        const item = editorRef.current.items.find((entry) => entry.id === id);
        if (item) animateTo({ ...view, x: item.x, y: item.y });
      },
      refresh: () => {
        dirty = true;
      },
      getView: () => ({ ...constrained(view) }),
      setHome: (next) => {
        Object.assign(home, next);
        host!.dataset.homeX = String(home.x);
        host!.dataset.homeY = String(home.y);
        setHomeZoom(home.zoom);
        sync();
      },
      setEditorMode: () => {
        if (!editorRef.current.open) animateTo(view, 220);
        sync();
      },
      nudgeSelection: (screenX, screenY) => {
        const ids = editorRef.current.selectedItemIds;
        if (!ids.length) return;
        const delta = screenDelta(screenX, screenY);
        const next = movedGroup(editorRef.current.items, ids, delta.x, delta.y);
        if (
          next.some(
            (item, index) =>
              item.x !== editorRef.current.items[index].x ||
              item.y !== editorRef.current.items[index].y,
          )
        )
          changeItems(next);
      },
      duplicateSelection: () => {
        const original = editorRef.current.items;
        const ids = editorRef.current.selectedItemIds;
        if (!ids.length) return;
        if (original.length + ids.length > 500) {
          setEditorMessage('O rascunho aceita no máximo 500 itens.');
          return;
        }
        const delta = screenDelta(24, 24);
        const moved = movedGroup(
          original.filter((item) => ids.includes(item.id)),
          ids,
          delta.x,
          delta.y,
        );
        const copies = moved.map((item) => ({ ...item, id: crypto.randomUUID() }));
        changeItems([...original, ...copies]);
        selectEditorItems(copies.map((item) => item.id));
      },
    };
    host.addEventListener('pointerdown', pointerDown);
    host.addEventListener('pointermove', hoverItem);
    host.addEventListener('pointerleave', leaveItem);
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
                ? background.exists
                  ? `/api/kingdom/editor-background/image?v=${background.revision}`
                  : '/kingdom/ground-trails.png'
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
        viewport.mapWidth = loaded.ground.naturalWidth * KINGDOM_UNITS_PER_PIXEL;
        viewport.mapHeight = loaded.ground.naturalHeight * KINGDOM_UNITS_PER_PIXEL;
        host.dataset.mapWidth = String(viewport.mapWidth);
        host.dataset.mapHeight = String(viewport.mapHeight);
        host.dataset.imageWidth = String(loaded.ground.naturalWidth);
        host.dataset.imageHeight = String(loaded.ground.naturalHeight);
        Object.assign(view, constrained(view));
        setEditorAssets(loaded);
        host.dataset.groveCount = '0';
        ready = true;
        dirty = true;
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
      host.removeEventListener('pointermove', hoverItem);
      host.removeEventListener('pointerleave', leaveItem);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerUp);
      host.removeEventListener('click', suppressDragClick, true);
      host.removeEventListener('wheel', wheel);
      host.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', wake);
      reduced.removeEventListener('change', wake);
      canvas.remove();
      canvas.width = 1;
      canvas.height = 1;
      assets = null;
    };
  }, [retry, mapConfig]);

  useEffect(() => {
    controlsRef.current?.setEditorMode();
  }, [editorOpen]);

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
      data-editor-open={editorOpen}
      data-direction={direction}
      tabIndex={0}
      role="region"
      aria-label="Mapa ilustrado do Reino do Norte"
      aria-describedby="kingdom-instructions"
    >
      <p id="kingdom-instructions" className="sr-only">
        Arraste para explorar. Use a roda do mouse ou dois dedos para aproximar. Q e E giram o mapa
        em oito direções; setas deslocam e Home volta ao centro do reino. No editor, Ctrl + arrastar
        seleciona uma área.
      </p>
      <div ref={canvasHostRef} className="kingdom-map__canvas" />
      {selectionBox && (
        <div
          className="kingdom-map__selection-box"
          style={{
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.width,
            height: selectionBox.height,
          }}
          aria-hidden="true"
        />
      )}
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
            Clique no chão para adicionar. Arraste um item para movê-lo; arraste o chão para
            navegar. Ctrl + arrastar marca uma área e Ctrl + clique alterna itens no grupo.
          </p>
          <div className="kingdom-editor__background">
            <strong>Fundo do mapa</strong>
            <small>
              {background?.exists
                ? `${background.width} × ${background.height} px · seu rascunho`
                : 'Fundo original do reino'}
            </small>
            <input
              ref={backgroundInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void uploadBackground(file);
                event.currentTarget.value = '';
              }}
            />
            <div>
              <button
                type="button"
                disabled={backgroundBusy}
                onClick={() => backgroundInputRef.current?.click()}
              >
                <Upload size={15} /> {backgroundBusy ? 'Enviando…' : 'Enviar background'}
              </button>
              {background?.exists && (
                <button
                  type="button"
                  disabled={backgroundBusy}
                  onClick={() => void resetBackground()}
                >
                  Restaurar original
                </button>
              )}
            </div>
            <small>PNG, JPEG ou WebP · até 128 MB · navegação ajustada à imagem.</small>
          </div>
          <div className="kingdom-editor__view">
            <strong>Enquadramento inicial</strong>
            <small>Use o zoom, arraste e gire; depois salve a visão atual como 100%.</small>
            <div>
              <button
                type="button"
                disabled={viewBusy || status !== 'ready'}
                onClick={() => void saveCurrentView()}
              >
                <Focus size={15} /> {viewBusy ? 'Salvando…' : 'Definir visão atual como 100%'}
              </button>
              <button
                type="button"
                disabled={viewBusy || status !== 'ready'}
                onClick={() => void resetCurrentView()}
              >
                Restaurar visão inicial
              </button>
            </div>
          </div>
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
                    className={selectedSet.has(item.id) ? 'is-active' : ''}
                    aria-pressed={selectedSet.has(item.id)}
                    onClick={(event) => {
                      selectEditorItems(
                        event.ctrlKey
                          ? selectedSet.has(item.id)
                            ? selectedItemIds.filter((id) => id !== item.id)
                            : [...selectedItemIds, item.id]
                          : [item.id],
                      );
                      setEditorTool('select');
                      if (!event.ctrlKey) controlsRef.current?.focus(item.id);
                    }}
                  >
                    {index + 1}.{' '}
                    {KINGDOM_EDITOR_CATALOG.find((entry) => entry.kind === item.kind)?.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {editorItems.length > 0 && (
            <div className="kingdom-editor__bulk">
              <span>
                {selectedItemIds.length} selecionado{selectedItemIds.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => selectEditorItems(editorItems.map((item) => item.id))}
              >
                Selecionar todos
              </button>
              <button
                type="button"
                disabled={!selectedItemIds.length}
                onClick={() => selectEditorItems([])}
              >
                Limpar
              </button>
            </div>
          )}
          {selectedItemIds.length > 0 && (
            <div className="kingdom-editor__selection">
              <strong>
                {selectedEditorItem
                  ? KINGDOM_EDITOR_CATALOG.find((item) => item.kind === selectedEditorItem.kind)
                      ?.label
                  : `${selectedItemIds.length} itens selecionados`}
              </strong>
              <span>
                Arraste no mapa ou use as setas para mover{' '}
                {selectedEditorItem ? 'o item' : 'o grupo'}.
              </span>
              <div className="kingdom-editor__move">
                <label>
                  Passo das setas{' '}
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={nudgeStep}
                    onChange={(event) =>
                      setNudgeStep(clamp(Number(event.target.value) || 1, 1, 100))
                    }
                  />{' '}
                  px
                </label>
                <div role="group" aria-label="Mover seleção">
                  <button
                    type="button"
                    aria-label="Mover seleção para cima"
                    onClick={() => controlsRef.current?.nudgeSelection(0, -nudgeStep)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Mover seleção para a esquerda"
                    onClick={() => controlsRef.current?.nudgeSelection(-nudgeStep, 0)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label="Mover seleção para baixo"
                    onClick={() => controlsRef.current?.nudgeSelection(0, nudgeStep)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Mover seleção para a direita"
                    onClick={() => controlsRef.current?.nudgeSelection(nudgeStep, 0)}
                  >
                    →
                  </button>
                </div>
                <small>Teclado: setas; Shift + setas move cinco passos.</small>
              </div>
              <div className="kingdom-editor__adjust">
                <span>Tamanho</span>
                <button
                  type="button"
                  aria-label="Diminuir seleção"
                  onClick={() =>
                    changeItems(
                      editorItems.map((item) =>
                        selectedSet.has(item.id)
                          ? { ...item, height: Math.max(80, Math.round(item.height * 0.9)) }
                          : item,
                      ),
                    )
                  }
                >
                  −
                </button>
                <output>
                  {selectedEditorItem ? Math.round(selectedEditorItem.height) : 'grupo'}
                </output>
                <button
                  type="button"
                  aria-label="Aumentar seleção"
                  onClick={() =>
                    changeItems(
                      editorItems.map((item) =>
                        selectedSet.has(item.id)
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
                  aria-label="Girar seleção para a esquerda"
                  onClick={() =>
                    changeItems(
                      editorItems.map((item) =>
                        selectedSet.has(item.id)
                          ? { ...item, direction: (item.direction + 7) % 8 }
                          : item,
                      ),
                    )
                  }
                >
                  ↶
                </button>
                <output>
                  {selectedEditorItem ? `${selectedEditorItem.direction * 45}°` : 'grupo'}
                </output>
                <button
                  type="button"
                  aria-label="Girar seleção para a direita"
                  onClick={() =>
                    changeItems(
                      editorItems.map((item) =>
                        selectedSet.has(item.id)
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
                className="kingdom-editor__duplicate"
                type="button"
                disabled={editorItems.length + selectedItemIds.length > 500}
                onClick={() => controlsRef.current?.duplicateSelection()}
              >
                <Copy size={15} /> Duplicar {selectedEditorItem ? 'item' : 'grupo'}
              </button>
              <button
                className="kingdom-editor__delete"
                type="button"
                onClick={() => {
                  changeItems(editorItems.filter((item) => !selectedSet.has(item.id)));
                  selectEditorItems([]);
                }}
              >
                <Trash2 size={15} /> Excluir{' '}
                {selectedEditorItem ? 'item' : `${selectedItemIds.length} itens`}
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
                selectEditorItems([]);
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
            disabled={
              status !== 'ready' ||
              zoom <= (editorOpen ? EDITOR_MIN_ZOOM : homeZoom * KINGDOM_MIN_ZOOM) + 0.001
            }
            onClick={() => controlsRef.current?.zoom(1 / 1.18)}
          >
            <Minus size={16} />
          </button>
          <output aria-label="Aproximação do mapa">{Math.round((zoom / homeZoom) * 100)}%</output>
          <button
            aria-label="Aproximar mapa"
            disabled={
              status !== 'ready' ||
              zoom >= (editorOpen ? EDITOR_MAX_ZOOM : homeZoom * KINGDOM_MAX_ZOOM) - 0.001
            }
            onClick={() => controlsRef.current?.zoom(1.18)}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label="Centralizar mapa"
            title="Voltar à visão de 100% · Home"
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
