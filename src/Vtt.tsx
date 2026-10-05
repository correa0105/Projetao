import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  MousePointer2,
  Hand,
  Ruler,
  Pencil,
  Square,
  Circle,
  Triangle,
  Type,
  BrickWall,
  DoorOpen,
  PanelsTopLeft,
  Sun,
  Eye,
  EyeOff,
  Undo2,
  Redo2,
  Download,
  Upload,
  Plus,
  Trash2,
  Copy,
  RotateCw,
  Lock,
  Unlock,
  Swords,
  Dices,
  BookOpen,
  Music,
  Settings2,
  HelpCircle,
  MessageSquare,
  Image,
  Users,
  Scan,
  Maximize2,
  Save,
  X,
  Layers,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import { api, post } from './api';
import type { Character, User } from './types';
import {
  documentSchema,
  newScene,
  newToken,
  snapPoint,
  distance,
  conditions,
  blockingWalls,
  intersection,
  type VttState,
  type VttDocument,
  type VttToken,
  type VttDrawing,
  type VttScene,
  type Point,
  type VttAsset,
} from '../shared/vtt';
import { renderVtt, tokenAt, type VttCamera } from './vtt-canvas';
import { useMusicInterlude } from './SiteMusic';
import './vtt.css';
type Tool =
  | 'select'
  | 'pan'
  | 'ruler'
  | 'pen'
  | 'rect'
  | 'circle'
  | 'cone'
  | 'line'
  | 'text'
  | 'wall'
  | 'door'
  | 'window'
  | 'reveal'
  | 'hide'
  | 'light'
  | 'ping';
type Tab =
  | 'scene'
  | 'token'
  | 'library'
  | 'sheet'
  | 'chat'
  | 'combat'
  | 'journal'
  | 'music'
  | 'table'
  | 'help';
type Entry = {
  id: string;
  name: string;
  details: string;
  hp?: number;
  ac?: number;
  stats?: number[];
  size?: string;
  cr?: string;
  level?: number;
  type?: string;
  source?: string;
  school?: string;
  range?: string;
  time?: string;
  duration?: string;
  components?: string;
};
const tabs: { id: Tab; name: string; icon: typeof Sun }[] = [
  { id: 'scene', name: 'Cena', icon: Layers },
  { id: 'token', name: 'Token', icon: MousePointer2 },
  { id: 'library', name: 'Bibliotecas', icon: BookOpen },
  { id: 'sheet', name: 'Ficha', icon: Users },
  { id: 'chat', name: 'Dados e chat', icon: Dices },
  { id: 'combat', name: 'Combate', icon: Swords },
  { id: 'journal', name: 'Diário', icon: BookOpen },
  { id: 'music', name: 'Música', icon: Music },
  { id: 'table', name: 'Mesa', icon: Settings2 },
  { id: 'help', name: 'Ajuda', icon: HelpCircle },
];
const toolList: { id: Tool; name: string; icon: typeof Sun; gm?: boolean }[] = [
  { id: 'select', name: 'Selecionar (V)', icon: MousePointer2 },
  { id: 'pan', name: 'Mover mapa (H)', icon: Hand },
  { id: 'ruler', name: 'Régua (R)', icon: Ruler },
  { id: 'ping', name: 'Sinalizar ponto', icon: Scan },
  { id: 'pen', name: 'Desenhar (P)', icon: Pencil, gm: true },
  { id: 'rect', name: 'Retângulo', icon: Square, gm: true },
  { id: 'circle', name: 'Área circular', icon: Circle, gm: true },
  { id: 'cone', name: 'Área de cone', icon: Triangle, gm: true },
  { id: 'line', name: 'Linha', icon: Ruler, gm: true },
  { id: 'text', name: 'Texto', icon: Type, gm: true },
  { id: 'wall', name: 'Barreira de luz', icon: BrickWall, gm: true },
  { id: 'door', name: 'Porta', icon: DoorOpen, gm: true },
  { id: 'window', name: 'Janela', icon: PanelsTopLeft, gm: true },
  { id: 'light', name: 'Fonte de luz', icon: Lightbulb, gm: true },
  { id: 'reveal', name: 'Revelar névoa', icon: Eye, gm: true },
  { id: 'hide', name: 'Ocultar área', icon: EyeOff, gm: true },
];
function download(name: string, bytes: Blob) {
  const url = URL.createObjectURL(bytes),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function tagText(value: unknown): string {
  if (typeof value === 'string')
    return value.replace(/\{@\w+(?: ([^}]*))?\}/g, (_, content = '') => content.split('|')[0]);
  if (Array.isArray(value)) return value.map(tagText).join('\n');
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return [o.name, o.entries, o.items, o.entry].filter(Boolean).map(tagText).join('\n');
  }
  return '';
}
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 16000,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </label>
  );
}
export function Vtt({ characters, user }: { characters: Character[]; user: User }) {
  const [rooms, setRooms] = useState<{ id: string; name: string; is_owner: boolean }[]>([]),
    [canCreate, setCanCreate] = useState(false),
    [state, setState] = useState<VttState | null>(null),
    [doc, setDoc] = useState<VttDocument | null>(null),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [tool, setTool] = useState<Tool>('select'),
    [tab, setTab] = useState<Tab>('scene'),
    [layer, setLayer] = useState('tokens'),
    [selection, setSelection] = useState<string[]>([]),
    [camera, setCamera] = useState<VttCamera>({ x: 1120, y: 840, zoom: 0.45 }),
    [bounds, setBounds] = useState({ width: 900, height: 700 }),
    [preview, setPreview] = useState(false),
    [showWalls, setShowWalls] = useState(true),
    [ruler, setRuler] = useState<Point[]>([]),
    [draft, setDraft] = useState<VttDrawing | null>(null),
    [ping, setPing] = useState<Point | null>(null),
    [brushColor, setBrushColor] = useState('#dac28e'),
    [brushWidth, setBrushWidth] = useState(3),
    [brushFill, setBrushFill] = useState(true),
    [text, setText] = useState(''),
    [brushRadius, setBrushRadius] = useState(140),
    [panelOpen, setPanelOpen] = useState(true);
  const [library, setLibrary] = useState<'images' | 'monsters' | 'spells'>('images'),
    [query, setQuery] = useState(''),
    [entry, setEntry] = useState<Entry | null>(null),
    [catalog, setCatalog] = useState<{ monsters: Entry[]; spells: Entry[] }>({
      monsters: [],
      spells: [],
    }),
    [chat, setChat] = useState(''),
    [formula, setFormula] = useState('1d20'),
    [privateRoll, setPrivateRoll] = useState(false),
    [inviteInput, setInviteInput] = useState(''),
    [roomName, setRoomName] = useState('Mesa da Alvorada'),
    [journalId, setJournalId] = useState(''),
    [audioError, setAudioError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null),
    images = useRef(new Map<string, HTMLImageElement>()),
    [imageVersion, setImageVersion] = useState(0),
    stateRef = useRef(state),
    docRef = useRef(doc),
    dirtyRef = useRef(false),
    serial = useRef(0),
    savePromise = useRef<Promise<void> | null>(null),
    undo = useRef<VttDocument[]>([]),
    redo = useRef<VttDocument[]>([]),
    drag = useRef<{
      start: Point;
      last: Point;
      screen: Point;
      camera: VttCamera;
      original: VttDocument;
      kind: 'pan' | 'tokens' | 'shape';
      tokens: VttToken[];
    } | null>(null),
    musicRef = useRef<HTMLAudioElement | null>(null);
  const music = useMusicInterlude();
  useEffect(() => music.beginInterlude(), [music.beginInterlude]);
  stateRef.current = state;
  docRef.current = doc;
  const scene = doc?.scenes.find((s) => s.id === doc.activeScene),
    token = scene?.tokens.find((t) => t.id === selection[0]),
    gm = state?.is_gm === true,
    canToken = gm || token?.controller === user.id;
  const resetDirty = () => {
    dirtyRef.current = false;
    setDirty(false);
  };
  function receive(next: VttState, reset = true) {
    stateRef.current = next;
    docRef.current = next.document;
    setState(next);
    setDoc(next.document);
    if (reset) resetDirty();
  }
  function edit(fn: (d: VttDocument) => void, remember = true) {
    if (!gm || !docRef.current) return;
    if (remember) {
      undo.current.push(structuredClone(docRef.current));
      if (undo.current.length > 30) undo.current.shift();
      redo.current = [];
    }
    const next = structuredClone(docRef.current);
    fn(next);
    docRef.current = next;
    serial.current++;
    dirtyRef.current = true;
    setDirty(true);
    setDoc(next);
  }
  function editScene(fn: (s: VttScene) => void, remember = true) {
    edit((d) => fn(d.scenes.find((s) => s.id === d.activeScene)!), remember);
  }
  function editToken(patch: Partial<VttToken>) {
    if (!token) return;
    if (gm)
      editScene((s) => {
        Object.assign(
          s.tokens.find((t) => t.id === token.id)!,
          patch,
        );
      });
    else if (canToken) {
      void act(async () => {
        receive(
          await api<VttState>(`/vtt/rooms/${state!.id}/tokens/${token.id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
          }),
        );
      });
    }
  }
  const save = useCallback(async () => {
    if (savePromise.current) return savePromise.current;
    if (!stateRef.current?.is_gm || !dirtyRef.current) return;
    const promise = (async () => {
      setBusy(true);
      try {
        while (dirtyRef.current && docRef.current && stateRef.current) {
          const at = serial.current;
          const response = await api<VttState>(`/vtt/rooms/${stateRef.current.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              revision: stateRef.current.revision,
              document: documentSchema.parse(docRef.current),
            }),
          });
          stateRef.current = response;
          setState(response);
          if (at === serial.current) {
            docRef.current = response.document;
            setDoc(response.document);
            dirtyRef.current = false;
            setDirty(false);
          }
        }
      } finally {
        setBusy(false);
        savePromise.current = null;
      }
    })();
    savePromise.current = promise;
    return promise;
  }, []);
  async function act(fn: () => Promise<void>) {
    try {
      setNotice('');
      await fn();
    } catch (error) {
      setNotice((error as Error).message);
    }
  }
  function fit(s = scene) {
    if (s)
      setCamera({
        x: s.width / 2,
        y: s.height / 2,
        zoom: Math.max(
          0.03,
          Math.min(bounds.width / (s.width + 100), bounds.height / (s.height + 100)),
        ),
      });
  }
  async function openRoom(id: string) {
    await save();
    const next = await api<VttState>('/vtt/rooms/' + id);
    receive(next);
    setSelection([]);
    undo.current = [];
    redo.current = [];
    const s = next.document.scenes.find((s) => s.id === next.document.activeScene)!;
    setCamera({
      x: s.width / 2,
      y: s.height / 2,
      zoom: Math.min(bounds.width / (s.width + 100), bounds.height / (s.height + 100)),
    });
  }
  useEffect(() => {
    let live = true;
    api<{ rooms: typeof rooms; can_create: boolean }>('/vtt')
      .then((r) => {
        if (live) {
          setRooms(r.rooms);
          setCanCreate(r.can_create);
          if (r.rooms[0]) void openRoom(r.rooms[0].id).catch((e) => setNotice(e.message));
        }
      })
      .catch((e) => setNotice(e.message));
    api<typeof catalog>('/vtt/compendium')
      .then((c) => live && setCatalog(c))
      .catch((e) => setNotice(e.message));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setBounds({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      }),
    );
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [Boolean(state), panelOpen]);
  useEffect(() => {
    if (!dirty || drag.current) return;
    const timer = setTimeout(() => {
      void save().catch((e) => setNotice(e.message));
    }, 1200);
    return () => clearTimeout(timer);
  }, [doc, dirty, save]);
  useEffect(() => {
    if (!state?.id) return;
    const id = state.id,
      timer = setInterval(() => {
        if (document.hidden || dirtyRef.current || savePromise.current || drag.current) return;
        void api<VttState>('/vtt/rooms/' + id)
          .then((next) => {
            if (stateRef.current?.id === id && !dirtyRef.current && !drag.current) {
              if (next.revision !== stateRef.current.revision) receive(next);
              else {
                setState(next);
                stateRef.current = next;
              }
            }
          })
          .catch(() => {});
      }, 3000);
    return () => clearInterval(timer);
  }, [state?.id]);
  useEffect(() => {
    if (!scene) return;
    for (const path of [scene.background, ...scene.tokens.map((t) => t.image)]) {
      if (!path || images.current.has(path)) continue;
      const image = new window.Image();
      image.onload = () => setImageVersion((v) => v + 1);
      image.onerror = () => setNotice('Uma imagem não pôde ser carregada. Confira a biblioteca.');
      image.src = path;
      images.current.set(path, image);
    }
  }, [scene]);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !scene) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(bounds.width * dpr);
    c.height = Math.round(bounds.height * dpr);
    renderVtt(c.getContext('2d')!, scene, {
      camera,
      width: bounds.width,
      height: bounds.height,
      dpr,
      images: images.current,
      selected: selection,
      gm,
      preview,
      viewer: token || scene.tokens.find((t) => t.controller === user.id) || null,
      layer,
      ruler,
      draft,
      showWalls,
      ping,
    });
  }, [
    doc,
    camera,
    bounds,
    selection,
    preview,
    imageVersion,
    layer,
    ruler,
    draft,
    showWalls,
    ping,
    gm,
  ]);
  useEffect(() => {
    if (!doc || !state) return;
    const config = doc.music;
    let audio = musicRef.current;
    if (!audio) {
      audio = new Audio();
      musicRef.current = audio;
    }
    const path = config.assetId ? '/api/vtt/assets/' + config.assetId : '';
    if (path && audio.src !== new URL(path, location.href).href) audio.src = path;
    audio.loop = config.loop;
    audio.volume = music.muted ? 0 : music.volume * config.volume;
    if (config.playing && path && audio.volume > 0) {
      void audio
        .play()
        .then(() => setAudioError(''))
        .catch(() => setAudioError('Clique em Ativar áudio para ouvir a trilha.'));
    } else audio.pause();
  }, [doc?.music, music.muted, music.volume, state?.id]);
  useEffect(
    () => () => {
      musicRef.current?.pause();
    },
    [],
  );
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, []);
  function history(back: boolean) {
    if (!gm || !docRef.current) return;
    const from = back ? undo.current : redo.current,
      to = back ? redo.current : undo.current;
    const next = from.pop();
    if (next) {
      to.push(structuredClone(docRef.current));
      docRef.current = next;
      setDoc(next);
      serial.current++;
      dirtyRef.current = true;
      setDirty(true);
    }
  }
  function removeSelected() {
    if (!gm) return;
    editScene((s) => {
      s.tokens = s.tokens.filter((t) => !selection.includes(t.id));
    });
    setSelection([]);
  }
  function duplicate() {
    if (!gm || !scene) return;
    const originals = scene.tokens.filter((t) => selection.includes(t.id));
    const copies = originals.map((t) => ({
      ...structuredClone(t),
      id: crypto.randomUUID(),
      x: t.x + scene.grid.size,
      y: t.y + scene.grid.size,
    }));
    editScene((s) => s.tokens.push(...copies));
    setSelection(copies.map((t) => t.id));
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest('input,textarea,select,button,[contenteditable]'))
        return;
      if (e.key === 'Escape') {
        setSelection([]);
        setDraft(null);
        setRuler([]);
        setTool('select');
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        history(!e.shiftKey);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void act(save);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicate();
      }
      const shortcuts: Record<string, Tool> = { v: 'select', h: 'pan', r: 'ruler', p: 'pen' };
      if (shortcuts[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey)
        setTool(shortcuts[e.key.toLowerCase()]);
      if (e.key.startsWith('Arrow') && token && canToken) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : scene?.grid.size || 70,
          p = {
            x: Math.max(
              0,
              token.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0),
            ),
            y: Math.max(
              0,
              token.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0),
            ),
          };
        editToken(p);
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [doc, selection, gm, token]);
  function point(e: { clientX: number; clientY: number }): Point {
    const rect = canvas.current!.getBoundingClientRect();
    return {
      x:
        (((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * bounds.width) / camera.zoom +
        camera.x,
      y:
        (((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * bounds.height) / camera.zoom +
        camera.y,
    };
  }
  function pointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!scene || !doc) return;
    const p = point(e),
      snap = e.altKey ? p : snapPoint(p, scene.grid);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'ping') {
      setPing(p);
      setTimeout(() => setPing(null), 1800);
      return;
    }
    if (tool === 'light' && gm) {
      const t = newToken(crypto.randomUUID(), scene);
      Object.assign(t, {
        name: 'Luz',
        x: snap.x,
        y: snap.y,
        width: 24,
        height: 24,
        light: 20,
        dimLight: 20,
        vision: 0,
        color: '#e9c887',
      });
      editScene((s) => s.tokens.push(t));
      setSelection([t.id]);
      setTab('token');
      return;
    }
    if (tool === 'reveal' && gm) {
      editScene((s) => {
        s.fog = true;
        s.reveals.push({ x: p.x, y: p.y, radius: brushRadius });
      });
      return;
    }
    if (tool === 'hide' && gm) {
      editScene((s) => {
        s.fog = true;
        s.reveals = s.reveals.filter(
          (r) => Math.hypot(r.x - p.x, r.y - p.y) > brushRadius + r.radius * 0.3,
        );
      });
      return;
    }
    if (tool === 'select') {
      const hit = tokenAt(p, scene, layer, gm);
      if (hit) {
        const ids = e.shiftKey
          ? selection.includes(hit.id)
            ? selection.filter((id) => id !== hit.id)
            : [...selection, hit.id]
          : selection.includes(hit.id)
            ? selection
            : [hit.id];
        setSelection(ids);
        setTab('token');
        if (!hit.locked && (gm || hit.controller === user.id)) {
          drag.current = {
            kind: 'tokens',
            start: p,
            last: p,
            screen: { x: e.clientX, y: e.clientY },
            camera,
            original: structuredClone(doc),
            tokens: scene.tokens.filter(
              (t) => ids.includes(t.id) && (gm || t.controller === user.id) && !t.locked,
            ),
          };
          if (gm) {
            undo.current.push(structuredClone(doc));
            redo.current = [];
          }
        }
        return;
      }
      setSelection([]);
    }
    if (tool === 'pan' || tool === 'select' || e.button === 1) {
      drag.current = {
        kind: 'pan',
        start: p,
        last: p,
        screen: { x: e.clientX, y: e.clientY },
        camera,
        original: doc,
        tokens: [],
      };
      return;
    }
    if (tool === 'ruler') {
      setRuler([snap, snap]);
      drag.current = {
        kind: 'shape',
        start: snap,
        last: snap,
        screen: p,
        camera,
        original: doc,
        tokens: [],
      };
      return;
    }
    if (!gm) return;
    drag.current = {
      kind: 'shape',
      start: snap,
      last: snap,
      screen: p,
      camera,
      original: doc,
      tokens: [],
    };
    if (!['wall', 'door', 'window'].includes(tool))
      setDraft({
        id: crypto.randomUUID(),
        kind: tool as VttDrawing['kind'],
        points: [snap, snap],
        color: brushColor,
        width: brushWidth,
        fill: brushFill,
        text,
        layer: layer as VttDrawing['layer'],
      });
    else setRuler([snap, snap]);
  }
  function pointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (!d || !scene || !doc) return;
    const p = point(e);
    d.last = p;
    if (d.kind === 'pan') {
      setCamera({
        ...d.camera,
        x: d.camera.x - (e.clientX - d.screen.x) / d.camera.zoom,
        y: d.camera.y - (e.clientY - d.screen.y) / d.camera.zoom,
      });
      return;
    }
    if (d.kind === 'tokens') {
      const next = structuredClone(docRef.current!);
      const s = next.scenes.find((s) => s.id === next.activeScene)!;
      for (const original of d.tokens) {
        const t = s.tokens.find((t) => t.id === original.id)!,
          to = { x: original.x + p.x - d.start.x, y: original.y + p.y - d.start.y };
        const grid =
          s.grid.type === 'square'
            ? {
                ...s.grid,
                offsetX: s.grid.offsetX + t.width / 2,
                offsetY: s.grid.offsetY + t.height / 2,
              }
            : s.grid;
        const dest = e.altKey ? to : snapPoint(to, grid);
        t.x = Math.max(0, Math.min(s.width, dest.x));
        t.y = Math.max(0, Math.min(s.height, dest.y));
      }
      docRef.current = next;
      setDoc(next);
      return;
    }
    const snap = e.altKey ? p : snapPoint(p, scene.grid);
    if (['ruler', 'wall', 'door', 'window'].includes(tool)) setRuler([d.start, snap]);
    else
      setDraft((current) =>
        current
          ? {
              ...current,
              points: tool === 'pen' ? [...current.points.slice(0, 1499), p] : [d.start, snap],
            }
          : null,
      );
  }
  function pointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (!d || !scene) return;
    drag.current = null;
    if (d.kind === 'tokens') {
      if (gm) {
        serial.current++;
        dirtyRef.current = true;
        setDirty(true);
        setDoc(structuredClone(docRef.current!));
      } else {
        const moved = docRef
          .current!.scenes.find((s) => s.id === docRef.current!.activeScene)!
          .tokens.find((t) => t.id === d.tokens[0]?.id);
        if (moved) {
          const p = { x: moved.x, y: moved.y };
          void api<VttState>(`/vtt/rooms/${state!.id}/tokens/${moved.id}`, {
            method: 'PATCH',
            body: JSON.stringify(p),
          })
            .then(receive)
            .catch((error) => {
              docRef.current = d.original;
              setDoc(d.original);
              setNotice(error.message);
            });
        }
      }
      return;
    }
    if (d.kind === 'shape' && gm && ['wall', 'door', 'window'].includes(tool)) {
      const b = e.altKey ? point(e) : snapPoint(point(e), scene.grid);
      if (Math.hypot(b.x - d.start.x, b.y - d.start.y) > 3)
        editScene((s) =>
          s.walls.push({
            id: crypto.randomUUID(),
            a: d.start,
            b,
            kind: tool as 'wall' | 'door' | 'window',
            open: false,
          }),
        );
      setRuler([]);
    } else if (d.kind === 'shape' && draft && gm) {
      editScene((s) => s.drawings.push(draft));
      setDraft(null);
    }
  }
  async function uploadAsset(file: File) {
    await save();
    const type =
      file.type ||
      (/\.mp3$/i.test(file.name)
        ? 'audio/mpeg'
        : /\.wav$/i.test(file.name)
          ? 'audio/wav'
          : 'application/octet-stream');
    const response = await fetch(
      `/api/vtt/rooms/${state!.id}/assets?name=${encodeURIComponent(file.name.slice(0, 120))}`,
      { method: 'POST', headers: { 'Content-Type': type }, body: file },
    );
    const a = await response.json();
    if (!response.ok) throw Error(a.error);
    setState((current) => (current ? { ...current, assets: [a, ...current.assets] } : current));
    return a as VttAsset;
  }
  function newMarker() {
    if (!scene) return;
    const t = newToken(crypto.randomUUID(), scene);
    t.x = camera.x;
    t.y = camera.y;
    t.layer = layer as VttToken['layer'];
    editScene((s) => s.tokens.push(t));
    setSelection([t.id]);
    setTab('token');
  }
  function addMonster(e: Entry) {
    if (!scene || !gm) return;
    const t = newToken(crypto.randomUUID(), scene);
    const size: Record<string, number> = { T: 0.5, S: 1, M: 1, L: 2, H: 3, G: 4 };
    Object.assign(t, {
      name: e.name,
      x: camera.x,
      y: camera.y,
      width: scene.grid.size * (size[e.size || 'M'] || 1),
      height: scene.grid.size * (size[e.size || 'M'] || 1),
      hp: e.hp || 10,
      maxHp: e.hp || 10,
      ac: e.ac || 10,
      color: '#ae6158',
      sheet: {
        source: e.source || 'Compêndio importado',
        race: e.type || '',
        class: '',
        level: 0,
        stats: e.stats || [10, 10, 10, 10, 10, 10],
        speed: 30,
        biography: '',
        details: e.details,
      },
    });
    editScene((s) => s.tokens.push(t));
    setSelection([t.id]);
    setTab('sheet');
  }
  async function exportImage() {
    if (!scene) return;
    const factor = Math.min(1, 4096 / Math.max(scene.width, scene.height)),
      out = document.createElement('canvas');
    out.width = Math.round(scene.width * factor);
    out.height = Math.round(scene.height * factor);
    renderVtt(out.getContext('2d')!, scene, {
      camera: { x: scene.width / 2, y: scene.height / 2, zoom: factor },
      width: out.width,
      height: out.height,
      dpr: 1,
      images: images.current,
      selected: [],
      gm,
      preview,
      viewer: token || null,
      layer,
      ruler: [],
      draft: null,
      showWalls: false,
      ping: null,
    });
    await new Promise<void>((resolve) =>
      out.toBlob((blob) => {
        if (blob) download(scene.name + '.png', blob);
        else setNotice('Não foi possível exportar a imagem.');
        resolve();
      }, 'image/png'),
    );
  }
  async function importJson(file: File) {
    if (file.size > 10 * 1024 * 1024) throw Error('JSON deve ter até 10 MB.');
    const raw = JSON.parse(await file.text());
    if (raw.document || raw.version === 1) {
      const next = documentSchema.parse(raw.document || raw);
      edit((d) => Object.assign(d, next));
      setNotice('Mesa importada. Arquivos usam as referências da biblioteca desta mesa.');
      return;
    }
    const entries: VttDocument['custom'] = [];
    for (const [kind, key] of [
      ['monster', 'monster'],
      ['spell', 'spell'],
    ] as const)
      for (const e of raw[key] || []) {
        if (e._copy) continue;
        entries.push({
          id: crypto.randomUUID(),
          kind,
          name: String(e.name).slice(0, 150),
          details: tagText([
            e.trait,
            e.action,
            e.bonus,
            e.reaction,
            e.legendary,
            e.entries,
            e.entriesHigherLevel,
          ]).slice(0, 40000),
          hp: Math.max(1, Number(e.hp?.average) || 10),
          ac: Number(typeof e.ac?.[0] === 'number' ? e.ac[0] : e.ac?.[0]?.ac) || 10,
          stats: [e.str, e.dex, e.con, e.int, e.wis, e.cha].map((v) => Number(v) || 10),
          size: e.size?.[0] || 'M',
          level: Number(e.level) || 0,
          type: typeof e.type === 'string' ? e.type : e.type?.type || '',
          cr: String(e.cr?.cr ?? e.cr ?? '0'),
        });
      }
    if (!entries.length)
      throw Error(
        'JSON precisa de monster/spell do 5etools ou uma mesa exportada. Entradas _copy precisam estar resolvidas.',
      );
    edit((d) => {
      d.custom.push(...entries);
      documentSchema.parse(d);
    });
    setNotice(`${entries.length} entradas adicionadas à biblioteca da mesa.`);
  }
  async function send(formulaValue = '', textValue = chat) {
    await save();
    const next = await post<VttState>(`/vtt/rooms/${state!.id}/messages`, {
      text: textValue,
      formula: formulaValue,
      private: privateRoll,
    });
    setState(next);
    stateRef.current = next;
    setChat('');
  }
  const journal = doc?.journal.find((j) => j.id === journalId);
  if (!state || !doc || !scene)
    return (
      <section className="vtt-lobby">
        <span className="vtt-eyebrow">A mesa está posta</span>
        <h1>Mesa virtual</h1>
        <p>Mapas, personagens e histórias no mesmo lugar.</p>
        {notice && <p role="alert">{notice}</p>}
        <div className="vtt-lobby-card">
          <Swords size={40} />
          <h2>Preparar uma aventura</h2>
          {canCreate ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  const next = await post<VttState>('/vtt', { name: roomName });
                  receive(next);
                  setRooms((list) => [
                    ...list,
                    { id: next.id, name: next.document.name, is_owner: true },
                  ]);
                });
              }}
            >
              <label>
                Nome da mesa
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  maxLength={100}
                />
              </label>
              <button className="vtt-gold" type="submit">
                Criar mesa
              </button>
            </form>
          ) : (
            <p>Peça ao mestre o código de convite para entrar.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                const next = await post<VttState>('/vtt/join', { invite: inviteInput.trim() });
                receive(next);
              });
            }}
          >
            <label>
              Código de convite
              <input value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} />
            </label>
            <button>Entrar na mesa</button>
          </form>
        </div>
      </section>
    );
  return (
    <section className="vtt-workspace" aria-label="Mesa virtual">
      <header className="vtt-top">
        <div className="vtt-brand">
          <Swords size={22} />
          <div>
            <span>MESA VIRTUAL</span>
            <strong>{doc.name}</strong>
          </div>
        </div>
        <select
          aria-label="Escolher mesa"
          value={state.id}
          onChange={(e) => void act(() => openRoom(e.target.value))}
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
          {!rooms.some((r) => r.id === state.id) && <option value={state.id}>{doc.name}</option>}
        </select>
        <div className="vtt-top-actions">
          <span className={dirty ? 'vtt-unsaved' : 'vtt-saved'}>
            {busy ? 'Salvando…' : dirty ? 'Alterações pendentes' : 'Salvo'}
          </span>
          {gm && (
            <button title="Salvar (Ctrl+S)" aria-label="Salvar mesa" onClick={() => void act(save)}>
              <Save size={17} />
            </button>
          )}
          <button
            title="Exportar imagem PNG"
            aria-label="Exportar imagem PNG"
            onClick={() => void act(exportImage)}
          >
            <Download size={17} />
          </button>
          <button
            title="Tela cheia"
            aria-label="Tela cheia"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void stage.current?.parentElement?.requestFullscreen();
            }}
          >
            <Maximize2 size={17} />
          </button>
          <button aria-label="Alternar painel" onClick={() => setPanelOpen((v) => !v)}>
            <Settings2 size={17} />
          </button>
        </div>
      </header>
      {notice && (
        <div className="vtt-notice" role="alert">
          {notice}
          <button aria-label="Fechar aviso" onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className={`vtt-layout ${!panelOpen ? 'panel-closed' : ''}`}>
        <nav className="vtt-tools" aria-label="Ferramentas da mesa">
          {toolList
            .filter((t) => gm || !t.gm)
            .map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                title={name}
                aria-label={name}
                aria-pressed={tool === id}
                onClick={() => {
                  setTool(id);
                  setDraft(null);
                }}
              >
                <Icon size={19} />
              </button>
            ))}
          {gm && (
            <>
              <div className="vtt-tool-separator" />
              <button aria-label="Desfazer" title="Desfazer (Ctrl+Z)" onClick={() => history(true)}>
                <Undo2 size={18} />
              </button>
              <button
                aria-label="Refazer"
                title="Refazer (Ctrl+Shift+Z)"
                onClick={() => history(false)}
              >
                <Redo2 size={18} />
              </button>
            </>
          )}
        </nav>
        <div className="vtt-stage" ref={stage}>
          <canvas
            ref={canvas}
            aria-label="Tabuleiro da mesa"
            tabIndex={0}
            style={{
              cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair',
            }}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={() => {
              const d = drag.current;
              drag.current = null;
              if (d) {
                docRef.current = d.original;
                setDoc(d.original);
              }
              setDraft(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setTool('select');
            }}
            onWheel={(e) => {
              e.preventDefault();
              const p = point(e),
                zoom = Math.min(5, Math.max(0.03, camera.zoom * Math.exp(-e.deltaY * 0.0015)));
              const rect = e.currentTarget.getBoundingClientRect(),
                dx = e.clientX - rect.left - bounds.width / 2,
                dy = e.clientY - rect.top - bounds.height / 2;
              setCamera({ zoom, x: p.x - dx / zoom, y: p.y - dy / zoom });
            }}
            onDoubleClick={(e) => {
              const p = point(e);
              const door = scene.walls.find(
                (w) =>
                  w.kind === 'door' &&
                  Math.hypot((w.a.x + w.b.x) / 2 - p.x, (w.a.y + w.b.y) / 2 - p.y) <
                    30 / camera.zoom,
              );
              if (gm && door)
                editScene((s) => {
                  s.walls.find((w) => w.id === door.id)!.open = !door.open;
                });
              else if (token) setTab('sheet');
            }}
          />
          <div className="vtt-scene-pills">
            <span>{scene.name}</span>
            {gm && (
              <select
                aria-label="Camada ativa"
                value={layer}
                onChange={(e) => {
                  setLayer(e.target.value);
                  setSelection([]);
                }}
              >
                <option value="tokens">Tokens e objetos</option>
                <option value="map">Mapa</option>
                <option value="gm">Mestre · oculto</option>
              </select>
            )}
            {gm && (
              <button
                className={preview ? 'is-active' : ''}
                aria-pressed={preview}
                onClick={() => setPreview((v) => !v)}
              >
                <Eye size={14} />
                Visão do jogador
              </button>
            )}
          </div>
          <div className="vtt-map-footer">
            <span>
              {toolList.find((t) => t.id === tool)?.name} · {scene.grid.scale} {scene.grid.unit} por
              célula
            </span>
            <div>
              <button
                aria-label="Diminuir zoom"
                onClick={() => setCamera((c) => ({ ...c, zoom: Math.max(0.03, c.zoom * 0.8) }))}
              >
                −
              </button>
              <span>{Math.round(camera.zoom * 100)}%</span>
              <button
                aria-label="Aumentar zoom"
                onClick={() => setCamera((c) => ({ ...c, zoom: Math.min(5, c.zoom * 1.25) }))}
              >
                +
              </button>
              <button onClick={() => fit()} title="Enquadrar mapa">
                <Scan size={15} />
              </button>
            </div>
          </div>
        </div>
        {panelOpen && (
          <aside className="vtt-panel">
            <nav className="vtt-panel-tabs" aria-label="Painéis da mesa">
              {tabs.map(({ id, name, icon: Icon }) => (
                <button
                  key={id}
                  aria-label={name}
                  title={name}
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                >
                  <Icon size={17} />
                </button>
              ))}
            </nav>
            <div className="vtt-panel-content">
              <div className="vtt-panel-heading">
                <h2>{tabs.find((t) => t.id === tab)?.name}</h2>
                {gm && tab === 'token' && (
                  <button className="vtt-gold" onClick={newMarker}>
                    <Plus size={14} />
                    Token
                  </button>
                )}
              </div>
              {tab === 'scene' && (
                <>
                  <label>
                    Cena
                    <select
                      value={scene.id}
                      onChange={(e) => {
                        edit((d) => (d.activeScene = e.target.value));
                        setSelection([]);
                        fit(doc.scenes.find((s) => s.id === e.target.value));
                      }}
                      disabled={!gm}
                    >
                      {doc.scenes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {gm && (
                    <>
                      <div className="vtt-row">
                        <button
                          onClick={() => {
                            const s = newScene(crypto.randomUUID());
                            edit((d) => {
                              d.scenes.push(s);
                              d.activeScene = s.id;
                            });
                            fit(s);
                          }}
                        >
                          <Plus size={14} />
                          Nova
                        </button>
                        <button
                          onClick={() => {
                            const s = {
                              ...structuredClone(scene),
                              id: crypto.randomUUID(),
                              name: scene.name + ' · cópia',
                            };
                            s.tokens = s.tokens.map((t) => ({ ...t, id: crypto.randomUUID() }));
                            s.walls = s.walls.map((w) => ({ ...w, id: crypto.randomUUID() }));
                            edit((d) => {
                              d.scenes.push(s);
                              d.activeScene = s.id;
                            });
                          }}
                        >
                          <Copy size={14} />
                          Duplicar
                        </button>
                        <button
                          aria-label="Excluir cena"
                          disabled={doc.scenes.length < 2}
                          onClick={() => {
                            if (confirm('Excluir esta cena e seus objetos?'))
                              edit((d) => {
                                d.scenes = d.scenes.filter((s) => s.id !== scene.id);
                                d.activeScene = d.scenes[0].id;
                                d.initiative = [];
                              });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <label>
                        Nome da cena
                        <input
                          value={scene.name}
                          onChange={(e) => editScene((s) => (s.name = e.target.value || 'Cena'))}
                        />
                      </label>
                      <div className="vtt-two">
                        <NumberField
                          label="Largura do mapa"
                          value={scene.width}
                          min={280}
                          onChange={(v) => editScene((s) => (s.width = v))}
                        />
                        <NumberField
                          label="Altura do mapa"
                          value={scene.height}
                          min={280}
                          onChange={(v) => editScene((s) => (s.height = v))}
                        />
                      </div>
                      <label>
                        Cor de fundo
                        <input
                          type="color"
                          value={scene.backgroundColor}
                          onChange={(e) => editScene((s) => (s.backgroundColor = e.target.value))}
                        />
                      </label>
                      <button
                        onClick={() => {
                          setTab('library');
                          setLibrary('images');
                        }}
                      >
                        <Image size={15} />
                        Escolher mapa na biblioteca
                      </button>
                      <button onClick={() => editScene((s) => (s.background = ''))}>
                        Remover imagem do mapa
                      </button>
                      <h3>Grade e medidas</h3>
                      <label>
                        Tipo de grade
                        <select
                          value={scene.grid.type}
                          onChange={(e) =>
                            editScene(
                              (s) => (s.grid.type = e.target.value as VttScene['grid']['type']),
                            )
                          }
                        >
                          <option value="square">Quadrada</option>
                          <option value="hex-flat">Hexagonal · horizontal</option>
                          <option value="hex-point">Hexagonal · vertical</option>
                          <option value="none">Sem grade</option>
                        </select>
                      </label>
                      <div className="vtt-two">
                        <NumberField
                          label="Tamanho da célula"
                          value={scene.grid.size}
                          min={10}
                          max={500}
                          onChange={(v) => editScene((s) => (s.grid.size = v))}
                        />
                        <NumberField
                          label="Escala da célula"
                          value={scene.grid.scale}
                          min={0.1}
                          max={1000}
                          step={0.1}
                          onChange={(v) => editScene((s) => (s.grid.scale = v))}
                        />
                      </div>
                      <label>
                        Unidade
                        <select
                          value={scene.grid.unit}
                          onChange={(e) =>
                            editScene((s) => (s.grid.unit = e.target.value as 'ft' | 'm'))
                          }
                        >
                          <option value="ft">Pés</option>
                          <option value="m">Metros</option>
                        </select>
                      </label>
                      <label>
                        Medida das diagonais
                        <select
                          value={scene.grid.diagonal}
                          onChange={(e) =>
                            editScene(
                              (s) =>
                                (s.grid.diagonal = e.target.value as VttScene['grid']['diagonal']),
                            )
                          }
                        >
                          <option value="five">D&D · mesma distância</option>
                          <option value="alternating">Alternada · 5 / 10</option>
                          <option value="euclidean">Euclidiana</option>
                          <option value="manhattan">Soma dos eixos</option>
                        </select>
                      </label>
                      <div className="vtt-two">
                        <NumberField
                          label="Deslocamento X da grade"
                          value={scene.grid.offsetX}
                          min={-500}
                          max={500}
                          onChange={(v) => editScene((s) => (s.grid.offsetX = v))}
                        />
                        <NumberField
                          label="Deslocamento Y da grade"
                          value={scene.grid.offsetY}
                          min={-500}
                          max={500}
                          onChange={(v) => editScene((s) => (s.grid.offsetY = v))}
                        />
                      </div>
                      <label>
                        Cor da grade
                        <input
                          type="color"
                          value={scene.grid.color}
                          onChange={(e) => editScene((s) => (s.grid.color = e.target.value))}
                        />
                      </label>
                      <label>
                        Opacidade da grade
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step=".01"
                          value={scene.grid.opacity}
                          onChange={(e) =>
                            editScene((s) => (s.grid.opacity = Number(e.target.value)))
                          }
                        />
                      </label>
                      <label className="vtt-check">
                        <input
                          type="checkbox"
                          checked={scene.grid.snap}
                          onChange={(e) => editScene((s) => (s.grid.snap = e.target.checked))}
                        />
                        Encaixar objetos na grade
                      </label>
                      <h3>Luz e exploração</h3>
                      <label className="vtt-check">
                        <input
                          type="checkbox"
                          checked={scene.lighting}
                          onChange={(e) => editScene((s) => (s.lighting = e.target.checked))}
                        />
                        Iluminação dinâmica
                      </label>
                      <label>
                        Luz ambiente
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step=".01"
                          value={scene.ambient}
                          onChange={(e) => editScene((s) => (s.ambient = Number(e.target.value)))}
                        />
                      </label>
                      <label className="vtt-check">
                        <input
                          type="checkbox"
                          checked={scene.fog}
                          onChange={(e) => editScene((s) => (s.fog = e.target.checked))}
                        />
                        Névoa manual
                      </label>
                      <label className="vtt-check">
                        <input
                          type="checkbox"
                          checked={scene.restrictMovement}
                          onChange={(e) =>
                            editScene((s) => (s.restrictMovement = e.target.checked))
                          }
                        />
                        Barreiras impedem movimento dos jogadores
                      </label>
                      <label className="vtt-check">
                        <input
                          type="checkbox"
                          checked={showWalls}
                          onChange={(e) => setShowWalls(e.target.checked)}
                        />
                        Mostrar barreiras do mestre
                      </label>
                      <div className="vtt-row">
                        <button
                          onClick={() =>
                            editScene(
                              (s) =>
                                (s.reveals = [
                                  {
                                    x: s.width / 2,
                                    y: s.height / 2,
                                    radius: Math.hypot(s.width, s.height),
                                  },
                                ]),
                            )
                          }
                        >
                          Revelar tudo
                        </button>
                        <button
                          onClick={() =>
                            editScene((s) => {
                              s.reveals = [];
                              s.fog = true;
                            })
                          }
                        >
                          Ocultar tudo
                        </button>
                      </div>
                      <h3>Paredes, portas e janelas</h3>
                      {scene.walls.map((w, i) => (
                        <div className="vtt-list-row" key={w.id}>
                          <span>
                            {w.kind === 'wall' ? 'Parede' : w.kind === 'door' ? 'Porta' : 'Janela'}{' '}
                            {i + 1}
                          </span>
                          {w.kind === 'door' && (
                            <button
                              onClick={() =>
                                editScene(
                                  (s) => (s.walls.find((v) => v.id === w.id)!.open = !w.open),
                                )
                              }
                            >
                              {w.open ? 'Fechar' : 'Abrir'}
                            </button>
                          )}
                          <button
                            aria-label={`Excluir barreira ${i + 1}`}
                            onClick={() =>
                              editScene((s) => (s.walls = s.walls.filter((v) => v.id !== w.id)))
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      <h3>Desenho e áreas</h3>
                      <label>
                        Cor
                        <input
                          type="color"
                          value={brushColor}
                          onChange={(e) => setBrushColor(e.target.value)}
                        />
                      </label>
                      <NumberField
                        label="Espessura"
                        value={brushWidth}
                        min={1}
                        max={100}
                        onChange={setBrushWidth}
                      />
                      <label className="vtt-check">
                        <input
                          type="checkbox"
                          checked={brushFill}
                          onChange={(e) => setBrushFill(e.target.checked)}
                        />
                        Preencher áreas
                      </label>
                      <label>
                        Texto da ferramenta
                        <input
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          maxLength={500}
                        />
                      </label>
                      <NumberField
                        label="Raio do pincel de névoa"
                        value={brushRadius}
                        min={5}
                        max={5000}
                        onChange={setBrushRadius}
                      />
                      <button onClick={() => editScene((s) => (s.drawings = []))}>
                        Limpar desenhos desta cena
                      </button>
                    </>
                  )}
                </>
              )}
              {tab === 'token' && (
                <>
                  {!token ? (
                    <p className="vtt-muted">
                      Selecione um token no tabuleiro ou adicione um pela biblioteca.
                    </p>
                  ) : (
                    <>
                      <label>
                        Nome
                        <input
                          value={token.name}
                          disabled={!gm}
                          onChange={(e) => editToken({ name: e.target.value || 'Token' })}
                        />
                      </label>
                      <div className="vtt-two">
                        <NumberField
                          label="PV atual"
                          value={token.hp}
                          min={-10000}
                          max={100000}
                          disabled={!canToken}
                          onChange={(v) => editToken({ hp: v })}
                        />
                        <NumberField
                          label="PV máximo"
                          value={token.maxHp}
                          min={1}
                          max={100000}
                          disabled={!gm}
                          onChange={(v) => editToken({ maxHp: v })}
                        />
                        <NumberField
                          label="Classe de armadura"
                          value={token.ac}
                          max={100}
                          disabled={!gm}
                          onChange={(v) => editToken({ ac: v })}
                        />
                        <NumberField
                          label="Rotação"
                          value={token.rotation}
                          min={-360}
                          max={360}
                          disabled={!gm}
                          onChange={(v) => editToken({ rotation: v })}
                        />
                      </div>
                      {gm && (
                        <>
                          <div className="vtt-two">
                            <NumberField
                              label="Largura do token"
                              value={token.width}
                              min={8}
                              max={8000}
                              onChange={(v) => editToken({ width: v })}
                            />
                            <NumberField
                              label="Altura do token"
                              value={token.height}
                              min={8}
                              max={8000}
                              onChange={(v) => editToken({ height: v })}
                            />
                          </div>
                          <label>
                            Cor da borda
                            <input
                              type="color"
                              value={token.color}
                              onChange={(e) => editToken({ color: e.target.value })}
                            />
                          </label>
                          <label>
                            Camada do token
                            <select
                              value={token.layer}
                              onChange={(e) =>
                                editToken({ layer: e.target.value as VttToken['layer'] })
                              }
                            >
                              <option value="tokens">Tokens</option>
                              <option value="map">Mapa</option>
                              <option value="gm">Mestre</option>
                            </select>
                          </label>
                          <label>
                            Controlado por
                            <select
                              value={token.controller || ''}
                              onChange={(e) => editToken({ controller: e.target.value || null })}
                            >
                              <option value="">Somente mestre</option>
                              {state.members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="vtt-check">
                            <input
                              type="checkbox"
                              checked={token.locked}
                              onChange={(e) => editToken({ locked: e.target.checked })}
                            />
                            Bloquear movimento
                          </label>
                          <label className="vtt-check">
                            <input
                              type="checkbox"
                              checked={token.hidden}
                              onChange={(e) => editToken({ hidden: e.target.checked })}
                            />
                            Ocultar dos jogadores
                          </label>
                          <label className="vtt-file-button">
                            Trocar imagem
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file)
                                  void act(async () => {
                                    const a = await uploadAsset(file);
                                    editToken({ image: a.path });
                                  });
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            onClick={() => {
                              setLibrary('images');
                              setTab('library');
                            }}
                          >
                            Usar imagem da biblioteca
                          </button>
                          <h3>Visão e iluminação</h3>
                          <NumberField
                            label={`Visão no escuro (${scene.grid.unit})`}
                            value={token.vision}
                            max={10000}
                            onChange={(v) => editToken({ vision: v })}
                          />
                          <div className="vtt-two">
                            <NumberField
                              label={`Luz forte (${scene.grid.unit})`}
                              value={token.light}
                              max={10000}
                              onChange={(v) => editToken({ light: v })}
                            />
                            <NumberField
                              label={`Luz fraca adicional (${scene.grid.unit})`}
                              value={token.dimLight}
                              max={10000}
                              onChange={(v) => editToken({ dimLight: v })}
                            />
                          </div>
                          <NumberField
                            label="Ângulo da luz"
                            value={token.lightAngle}
                            min={1}
                            max={360}
                            onChange={(v) => editToken({ lightAngle: v })}
                          />
                          <label>
                            Cor da luz
                            <input
                              type="color"
                              value={token.lightColor}
                              onChange={(e) => editToken({ lightColor: e.target.value })}
                            />
                          </label>
                          <label>
                            Notas do mestre
                            <textarea
                              value={token.notes}
                              onChange={(e) => editToken({ notes: e.target.value })}
                              maxLength={4000}
                            />
                          </label>
                          <div className="vtt-row">
                            <button onClick={duplicate}>
                              <Copy size={14} />
                              Duplicar
                            </button>
                            <button onClick={removeSelected}>
                              <Trash2 size={14} />
                              Excluir
                            </button>
                          </div>
                        </>
                      )}
                      <h3>Condições</h3>
                      <div className="vtt-conditions">
                        {conditions.map((c) => (
                          <button
                            key={c}
                            disabled={!canToken}
                            aria-pressed={token.conditions.includes(c)}
                            onClick={() =>
                              editToken({
                                conditions: token.conditions.includes(c)
                                  ? token.conditions.filter((v) => v !== c)
                                  : [...token.conditions, c],
                              })
                            }
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setTab('sheet')}>Abrir ficha do token</button>
                    </>
                  )}
                </>
              )}
              {tab === 'library' && (
                <>
                  <div className="vtt-subtabs">
                    {(['images', 'monsters', 'spells'] as const).map((k) => (
                      <button
                        key={k}
                        aria-pressed={library === k}
                        onClick={() => {
                          setLibrary(k);
                          setQuery('');
                          setEntry(null);
                        }}
                      >
                        {k === 'images' ? 'Imagens' : k === 'monsters' ? 'Monstros' : 'Magias'}
                      </button>
                    ))}
                  </div>
                  <label className="vtt-search">
                    Buscar na biblioteca
                    <input
                      aria-label="Buscar na biblioteca"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Nome, tipo, nível…"
                    />
                  </label>
                  {gm && (
                    <label className="vtt-file-button">
                      <Upload size={14} />
                      {library === 'images' ? 'Enviar imagem' : 'Importar JSON do 5etools'}
                      <input
                        type="file"
                        accept={
                          library === 'images'
                            ? 'image/png,image/jpeg,image/webp'
                            : '.json,application/json'
                        }
                        multiple={library === 'images'}
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          void act(async () => {
                            for (const file of files)
                              library === 'images'
                                ? await uploadAsset(file)
                                : await importJson(file);
                          });
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  {library === 'images' ? (
                    <>
                      <div className="vtt-asset-grid">
                        <div className="vtt-asset">
                          <img src="/vtt/crypt.svg" alt="Mapa da cripta" />
                          <span>Cripta esquecida</span>
                          {gm && (
                            <button
                              onClick={() =>
                                editScene((s) => {
                                  s.background = '/vtt/crypt.svg';
                                  s.width = 2240;
                                  s.height = 1680;
                                })
                              }
                            >
                              Usar como mapa
                            </button>
                          )}
                        </div>
                        {state.assets
                          .filter(
                            (a) =>
                              a.kind === 'image' &&
                              a.name.toLowerCase().includes(query.toLowerCase()),
                          )
                          .map((a) => (
                            <div className="vtt-asset" key={a.id}>
                              <img src={a.path} alt={a.name} />
                              <span>{a.name}</span>
                              {gm && (
                                <>
                                  <button
                                    onClick={() => {
                                      editScene((s) => {
                                        s.background = a.path;
                                        if (a.width && a.height) {
                                          s.width = Math.max(280, a.width);
                                          s.height = Math.max(280, a.height);
                                        }
                                      });
                                    }}
                                  >
                                    Mapa
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (token) editToken({ image: a.path });
                                      else {
                                        const t = newToken(crypto.randomUUID(), scene);
                                        t.name = a.name.replace(/\.[^.]+$/, '');
                                        t.image = a.path;
                                        t.x = camera.x;
                                        t.y = camera.y;
                                        editScene((s) => s.tokens.push(t));
                                        setSelection([t.id]);
                                      }
                                    }}
                                  >
                                    Token
                                  </button>
                                  <button
                                    aria-label={`Excluir ${a.name}`}
                                    onClick={() =>
                                      void act(async () => {
                                        await save();
                                        await api(`/vtt/rooms/${state.id}/assets/${a.id}`, {
                                          method: 'DELETE',
                                        });
                                        setState((s) =>
                                          s
                                            ? {
                                                ...s,
                                                assets: s.assets.filter((v) => v.id !== a.id),
                                              }
                                            : s,
                                        );
                                      })
                                    }
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <>
                      {entry ? (
                        <div className="vtt-statblock">
                          <button onClick={() => setEntry(null)}>
                            <ChevronLeft size={14} />
                            Voltar à lista
                          </button>
                          <h3>{entry.name}</h3>
                          <p>
                            {entry.source || 'Importação da mesa'} ·{' '}
                            {library === 'monsters'
                              ? `ND ${entry.cr} · CA ${entry.ac} · PV ${entry.hp}`
                              : `Nível ${entry.level} · ${entry.school || ''}`}
                          </p>
                          {entry.range && (
                            <p>
                              Alcance: {entry.range} · {entry.time}
                            </p>
                          )}
                          {entry.duration && (
                            <p>
                              Duração: {entry.duration} · {entry.components}
                            </p>
                          )}
                          {entry.stats && (
                            <div className="vtt-stats">
                              {entry.stats.map((v, i) => (
                                <span key={i}>
                                  {['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'][i]}
                                  <b>{v}</b>
                                </span>
                              ))}
                            </div>
                          )}
                          <pre>{entry.details}</pre>
                          {gm && library === 'monsters' && (
                            <button className="vtt-gold" onClick={() => addMonster(entry)}>
                              Adicionar ao tabuleiro
                            </button>
                          )}
                          {library === 'spells' && (
                            <button
                              onClick={() =>
                                void act(() =>
                                  send('', `${entry.name}\n${entry.details.slice(0, 1800)}`),
                                )
                              }
                            >
                              Compartilhar no chat
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <p className="vtt-muted">
                            {catalog[library].length} entradas SRD 2024 · textos em inglês
                          </p>
                          <div className="vtt-compendium">
                            {[
                              ...catalog[library],
                              ...doc.custom.filter(
                                (e) => e.kind === (library === 'monsters' ? 'monster' : 'spell'),
                              ),
                            ]
                              .filter((e) =>
                                `${e.name} ${e.type || ''} ${e.level ?? ''} ${e.cr || ''}`
                                  .toLowerCase()
                                  .includes(query.toLowerCase()),
                              )
                              .map((e) => (
                                <button key={e.id} onClick={() => setEntry(e)}>
                                  <span>{e.name}</span>
                                  <small>
                                    {library === 'monsters'
                                      ? `ND ${e.cr}`
                                      : e.level === 0
                                        ? 'Truque'
                                        : `Nível ${e.level}`}
                                  </small>
                                </button>
                              ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                  <a
                    className="vtt-credits"
                    href="https://www.dndbeyond.com/srd"
                    target="_blank"
                    rel="noreferrer"
                  >
                    SRD 5.2.1 · Wizards of the Coast · CC BY 4.0
                  </a>
                </>
              )}
              {tab === 'sheet' && (
                <>
                  <h3>Trazer personagem do site</h3>
                  <p className="vtt-muted">
                    Cria uma cópia de sessão com ficha e retrato. PV e condições da mesa não alteram
                    o personagem do site.
                  </p>
                  {characters.map((c) => (
                    <button
                      className="vtt-list-row"
                      key={c.id}
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await save();
                          const next = await post<VttState>(
                            `/vtt/rooms/${state.id}/characters/${c.id}`,
                            {},
                          );
                          receive(next);
                          const s = next.document.scenes.find(
                            (s) => s.id === next.document.activeScene,
                          )!;
                          setSelection([s.tokens.at(-1)!.id]);
                        })
                      }
                    >
                      <Users size={14} />
                      {c.name}
                      <small>
                        {c.class} · {c.level}
                      </small>
                    </button>
                  ))}
                  {token && (
                    <>
                      <h3>{token.name}</h3>
                      <p>
                        PV {token.hp}/{token.maxHp} · CA {token.ac}
                      </p>
                      {token.sheet ? (
                        <>
                          <p>
                            {token.sheet.race} · {token.sheet.class} · Nível {token.sheet.level}
                          </p>
                          <div className="vtt-stats">
                            {token.sheet.stats.map((v, i) => (
                              <button
                                key={i}
                                title={`Rolar ${['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'][i]}`}
                                onClick={() =>
                                  void act(() =>
                                    send(
                                      `1d20${Math.floor((v - 10) / 2) >= 0 ? '+' : ''}${Math.floor((v - 10) / 2)}`,
                                      `${token.name} · ${['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'][i]}`,
                                    ),
                                  )
                                }
                              >
                                {['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'][i]}
                                <b>{v}</b>
                              </button>
                            ))}
                          </div>
                          <p>Deslocamento: {token.sheet.speed} ft</p>
                          <p>{token.sheet.biography}</p>
                          <details>
                            <summary>Ficha completa e ações</summary>
                            <pre className="vtt-sheet-details">{token.sheet.details}</pre>
                          </details>
                          <button
                            onClick={() =>
                              download(
                                token.name + '-ficha.json',
                                new Blob([JSON.stringify(token.sheet, null, 2)], {
                                  type: 'application/json',
                                }),
                              )
                            }
                          >
                            Exportar ficha JSON
                          </button>
                        </>
                      ) : (
                        <p className="vtt-muted">
                          Marcador sem ficha. Use a importação ou um monstro do compêndio.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
              {tab === 'chat' && (
                <>
                  <div className="vtt-dice-buttons">
                    {[4, 6, 8, 10, 12, 20, 100].map((n) => (
                      <button key={n} onClick={() => void act(() => send('1d' + n, ''))}>
                        d{n}
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(() => send(formula, ''));
                    }}
                  >
                    <label>
                      Rolagem
                      <input
                        value={formula}
                        onChange={(e) => setFormula(e.target.value)}
                        placeholder="2d6+3 ou 2d20kh1"
                        maxLength={100}
                      />
                    </label>
                    <button className="vtt-gold">Rolar dados</button>
                  </form>
                  <label className="vtt-check">
                    <input
                      type="checkbox"
                      checked={privateRoll}
                      onChange={(e) => setPrivateRoll(e.target.checked)}
                    />
                    Somente você e o mestre
                  </label>
                  <div className="vtt-chat-log" aria-live="polite">
                    {state.messages.map((m) => (
                      <article key={m.id}>
                        <header>
                          <strong>{m.author}</strong>
                          <small>
                            {m.private
                              ? 'Privado'
                              : new Date(m.created_at).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                          </small>
                        </header>
                        <p>{m.text}</p>
                        {m.roll && (
                          <div className="vtt-roll">
                            <span>
                              {m.roll.formula}
                              <small>{m.roll.dice.join(' + ')}</small>
                            </span>
                            <b>{m.roll.total}</b>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(() => send('', chat));
                    }}
                  >
                    <label>
                      Mensagem
                      <textarea
                        value={chat}
                        onChange={(e) => setChat(e.target.value)}
                        maxLength={2000}
                        rows={2}
                      />
                    </label>
                    <button>Enviar à mesa</button>
                  </form>
                  <h3>Macros</h3>
                  {doc.macros.map((m) => (
                    <div className="vtt-list-row" key={m.id}>
                      <button onClick={() => void act(() => send(m.formula, m.name))}>
                        {m.name}
                      </button>
                      {gm && (
                        <button
                          aria-label={'Excluir macro ' + m.name}
                          onClick={() =>
                            edit((d) => (d.macros = d.macros.filter((v) => v.id !== m.id)))
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  {gm && (
                    <button
                      onClick={() => {
                        const name = prompt('Nome da macro');
                        if (name)
                          edit((d) => d.macros.push({ id: crypto.randomUUID(), name, formula }));
                      }}
                    >
                      Salvar rolagem como macro
                    </button>
                  )}
                </>
              )}
              {tab === 'combat' && (
                <>
                  <div className="vtt-round">
                    <span>Rodada</span>
                    <b>{doc.round}</b>
                  </div>
                  {gm && (
                    <>
                      <button
                        onClick={() => {
                          if (!token) return;
                          edit((d) => {
                            d.initiative = d.initiative.filter((v) => v.tokenId !== token.id);
                            d.initiative.push({ tokenId: token.id, value: 0 });
                            d.initiative.sort((a, b) => b.value - a.value);
                          });
                        }}
                      >
                        Adicionar token selecionado
                      </button>
                      <div className="vtt-row">
                        <button
                          onClick={() =>
                            edit((d) => {
                              if (!d.initiative.length) return;
                              d.turn = (d.turn + 1) % d.initiative.length;
                              if (d.turn === 0) d.round++;
                            })
                          }
                        >
                          Próximo turno <ChevronRight size={14} />
                        </button>
                        <button
                          onClick={() =>
                            edit((d) => {
                              d.initiative.sort((a, b) => b.value - a.value);
                              d.turn = 0;
                            })
                          }
                        >
                          Ordenar
                        </button>
                      </div>
                    </>
                  )}
                  {doc.initiative.map((i, index) => {
                    const t = scene.tokens.find((t) => t.id === i.tokenId);
                    return t ? (
                      <div
                        className={`vtt-initiative ${doc.turn === index ? 'active' : ''}`}
                        key={i.tokenId}
                      >
                        <button
                          onClick={() => {
                            setSelection([t.id]);
                            setCamera((c) => ({ ...c, x: t.x, y: t.y }));
                          }}
                        >
                          {t.name}
                          <small>
                            {t.hp}/{t.maxHp} PV
                          </small>
                        </button>
                        <input
                          aria-label={'Iniciativa de ' + t.name}
                          type="number"
                          value={i.value}
                          disabled={!gm}
                          onChange={(e) =>
                            edit(
                              (d) =>
                                (d.initiative.find((v) => v.tokenId === i.tokenId)!.value =
                                  Number(e.target.value) || 0),
                            )
                          }
                        />
                        {gm && (
                          <button
                            aria-label={'Remover ' + t.name + ' da iniciativa'}
                            onClick={() =>
                              edit(
                                (d) =>
                                  (d.initiative = d.initiative.filter((v) => v.tokenId !== t.id)),
                              )
                            }
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ) : null;
                  })}
                  {gm && (
                    <button
                      onClick={() =>
                        edit((d) => {
                          d.initiative = [];
                          d.turn = 0;
                          d.round = 1;
                        })
                      }
                    >
                      Encerrar combate
                    </button>
                  )}
                </>
              )}
              {tab === 'journal' && (
                <>
                  {gm && (
                    <button
                      onClick={() => {
                        const id = crypto.randomUUID();
                        edit((d) =>
                          d.journal.push({
                            id,
                            title: 'Nova anotação',
                            text: '',
                            image: '',
                            public: false,
                          }),
                        );
                        setJournalId(id);
                      }}
                    >
                      <Plus size={14} />
                      Anotação ou handout
                    </button>
                  )}
                  {doc.journal.map((j) => (
                    <button className="vtt-list-row" key={j.id} onClick={() => setJournalId(j.id)}>
                      {j.title}
                      <small>{j.public ? 'Compartilhado' : 'Mestre'}</small>
                    </button>
                  ))}
                  {journal && (
                    <>
                      <label>
                        Título
                        <input
                          value={journal.title}
                          disabled={!gm}
                          onChange={(e) =>
                            edit(
                              (d) =>
                                (d.journal.find((j) => j.id === journal.id)!.title =
                                  e.target.value || 'Anotação'),
                            )
                          }
                        />
                      </label>
                      <label>
                        Texto
                        <textarea
                          value={journal.text}
                          disabled={!gm}
                          onChange={(e) =>
                            edit(
                              (d) =>
                                (d.journal.find((j) => j.id === journal.id)!.text = e.target.value),
                            )
                          }
                          maxLength={40000}
                          rows={12}
                        />
                      </label>
                      {journal.image && (
                        <img className="vtt-handout" src={journal.image} alt={journal.title} />
                      )}{' '}
                      {gm && (
                        <>
                          <label>
                            Imagem
                            <select
                              value={journal.image}
                              onChange={(e) =>
                                edit(
                                  (d) =>
                                    (d.journal.find((j) => j.id === journal.id)!.image =
                                      e.target.value),
                                )
                              }
                            >
                              <option value="">Sem imagem</option>
                              {state.assets
                                .filter((a) => a.kind === 'image')
                                .map((a) => (
                                  <option key={a.id} value={a.path}>
                                    {a.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="vtt-check">
                            <input
                              type="checkbox"
                              checked={journal.public}
                              onChange={(e) =>
                                edit(
                                  (d) =>
                                    (d.journal.find((j) => j.id === journal.id)!.public =
                                      e.target.checked),
                                )
                              }
                            />
                            Mostrar aos jogadores
                          </label>
                          <button
                            onClick={() => {
                              edit(
                                (d) => (d.journal = d.journal.filter((j) => j.id !== journal.id)),
                              );
                              setJournalId('');
                            }}
                          >
                            Excluir anotação
                          </button>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
              {tab === 'music' && (
                <>
                  <p className="vtt-muted">
                    Trilha compartilhada da mesa. Cada participante controla seu volume nas
                    configurações de som do site.
                  </p>
                  {gm && (
                    <label className="vtt-file-button">
                      <Upload size={14} />
                      Enviar MP3, WAV ou OGG
                      <input
                        type="file"
                        accept="audio/mpeg,audio/wav,audio/ogg,audio/webm"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            void act(async () => {
                              await uploadAsset(file);
                            });
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  <label>
                    Trilha
                    <select
                      disabled={!gm}
                      value={doc.music.assetId || ''}
                      onChange={(e) => edit((d) => (d.music.assetId = e.target.value || null))}
                    >
                      <option value="">Sem trilha</option>
                      {state.assets
                        .filter((a) => a.kind === 'audio')
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {gm && (
                    <>
                      <button
                        onClick={() => edit((d) => (d.music.playing = !d.music.playing))}
                        disabled={!doc.music.assetId}
                      >
                        {doc.music.playing ? 'Pausar na mesa' : 'Tocar na mesa'}
                      </button>
                      <label className="vtt-check">
                        <input
                          type="checkbox"
                          checked={doc.music.loop}
                          onChange={(e) => edit((d) => (d.music.loop = e.target.checked))}
                        />
                        Repetir música
                      </label>
                      <label>
                        Volume da mesa
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step=".01"
                          value={doc.music.volume}
                          onChange={(e) => edit((d) => (d.music.volume = Number(e.target.value)))}
                        />
                      </label>
                    </>
                  )}
                  {audioError && <p>{audioError}</p>}
                  <button
                    onClick={() =>
                      void musicRef.current
                        ?.play()
                        .then(() => setAudioError(''))
                        .catch(() =>
                          setAudioError(
                            'Escolha uma trilha e habilite música nas configurações de som.',
                          ),
                        )
                    }
                  >
                    Ativar áudio neste navegador
                  </button>
                </>
              )}
              {tab === 'table' && (
                <>
                  {gm && (
                    <>
                      <label>
                        Nome da mesa
                        <input
                          value={doc.name}
                          onChange={(e) => edit((d) => (d.name = e.target.value || 'Mesa'))}
                        />
                      </label>
                      <h3>Convite dos jogadores</h3>
                      <p className="vtt-muted">
                        Compartilhe o código. É necessário entrar no site para participar.
                      </p>
                      <textarea readOnly value={state.invite || ''} rows={2} />
                      <button
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(state.invite || '')
                            .then(() => setNotice('Convite copiado.'))
                        }
                      >
                        Copiar código
                      </button>
                      <button
                        onClick={() =>
                          void act(async () => {
                            await save();
                            const next = await post<{ invite: string }>(
                              `/vtt/rooms/${state.id}/invite`,
                              {},
                            );
                            setState((s) => (s ? { ...s, invite: next.invite } : s));
                          })
                        }
                      >
                        Revogar convite e gerar outro
                      </button>
                    </>
                  )}
                  <h3>Participantes</h3>
                  {state.members.map((m) => (
                    <div className="vtt-list-row" key={m.id}>
                      <span>
                        {m.name}
                        {m.id === user.id ? ' · você' : ''}
                      </span>
                      {gm && m.id !== user.id && (
                        <button
                          aria-label={'Remover participante ' + m.name}
                          onClick={() =>
                            void act(async () => {
                              await save();
                              receive(
                                await api<VttState>(`/vtt/rooms/${state.id}/members/${m.id}`, {
                                  method: 'DELETE',
                                }),
                              );
                            })
                          }
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  {gm && (
                    <>
                      <h3>Arquivo da mesa</h3>
                      <button
                        onClick={() =>
                          download(
                            doc.name + '.json',
                            new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
                          )
                        }
                      >
                        Exportar mesa JSON
                      </button>
                      <label className="vtt-file-button">
                        Importar mesa JSON
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void act(() => importJson(f));
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <p className="vtt-muted">
                        O JSON preserva as configurações e referências aos arquivos desta
                        biblioteca; o PNG exporta a cena renderizada.
                      </p>
                      <button
                        onClick={() =>
                          void act(async () => {
                            await save();
                            const name = prompt('Nome da nova mesa');
                            if (name) {
                              const next = await post<VttState>('/vtt', { name });
                              receive(next);
                              setRooms((list) => [...list, { id: next.id, name, is_owner: true }]);
                            }
                          })
                        }
                      >
                        Criar outra mesa
                      </button>
                    </>
                  )}
                  <button
                    onClick={() =>
                      void act(async () => {
                        const next = await api<VttState>('/vtt/rooms/' + state.id);
                        if (
                          dirty &&
                          !confirm('Descartar alterações pendentes e carregar a mesa salva?')
                        )
                          return;
                        receive(next);
                      })
                    }
                  >
                    Recarregar versão salva
                  </button>
                </>
              )}
              {tab === 'help' && (
                <div className="vtt-help">
                  <h3>Comece por aqui</h3>
                  <ol>
                    <li>Em Bibliotecas, envie o mapa e clique em Mapa.</li>
                    <li>Em Cena, ajuste tamanho, grade, escala e diagonais.</li>
                    <li>Importe seu personagem em Ficha ou adicione monstros.</li>
                    <li>Desenhe paredes, portas e janelas; ative a iluminação.</li>
                    <li>Selecione um token e confira a Visão do jogador.</li>
                    <li>Compartilhe o convite e escolha quem controla cada token.</li>
                  </ol>
                  <h3>Atalhos</h3>
                  <p>
                    V selecionar · H mover · R régua · P lápis. Roda do mouse: zoom no cursor.
                    Shift+clique: seleção múltipla. Alt+arraste: movimento sem grade. Delete:
                    excluir. Ctrl+D: duplicar. Ctrl+Z: desfazer. Ctrl+S: salvar. Esc: encerrar
                    ferramenta.
                  </p>
                  <h3>Portas e luz</h3>
                  <p>
                    Paredes e portas fechadas bloqueiam luz. Janelas deixam a luz passar e impedem
                    movimento. Clique duas vezes no centro de uma porta para abri-la. Raios de visão
                    e luz usam a unidade configurada na cena.
                  </p>
                  <h3>Dados</h3>
                  <p>
                    Use 2d6+3, 2d20kh1 (vantagem) ou 2d20kl1 (desvantagem). Rolagens são feitas no
                    servidor e ficam no histórico da mesa.
                  </p>
                  <h3>Salvamento</h3>
                  <p>
                    Alterações do mestre são salvas automaticamente. Se outra sessão editar a mesma
                    mesa, exporte seu rascunho ou recarregue a versão salva pelo painel Mesa.
                  </p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
