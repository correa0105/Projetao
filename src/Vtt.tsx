import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type DragEvent as ReactDragEvent,
} from 'react';
import {
  MousePointer2,
  LassoSelect,
  ArrowDown,
  Ruler,
  Pencil,
  Square,
  Circle,
  Triangle,
  Slash,
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
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Map as MapIcon,
  FlipHorizontal2,
  FlipVertical2,
} from 'lucide-react';
import { api, post } from './api';
import { VttPrivateLibrary } from './VttPrivateLibrary';
import { VttChatText } from './VttChatText';
import { VttChatComposer } from './VttChatComposer';
import { VttMonsterEditor, customMonster } from './VttMonsterEditor';
import { monsterCustomDetails } from '../shared/vtt-monster-presets';
import type { Character, User } from './types';
import {
  documentSchema,
  newScene,
  newToken,
  snapPoint,
  distance,
  conditions,
  blockingWalls,
  activateScene,
  lightSchema,
  carveOpening,
  intersection,
  activateTokenVision,
  applyTokenDeath,
  viewerSees,
  sceneBossBars,
  bossStyles,
  bossStyleNames,
  visibleBossStyle,
  type VttMessage,
  type VttState,
  type VttDocument,
  type VttToken,
  type VttDrawing,
  type VttScene,
  type Point,
  type VttAsset,
  type VttFocusSignal,
} from '../shared/vtt';
import { renderVtt, tokenAt, drawingAt, segmentDistance, type VttCamera } from './vtt-canvas';
import type { AttackRequest } from '../shared/vtt-attack';
import { vttUpdateMessage } from '../shared/vtt-protocol';
import { pingDuration, type VttPing } from './vtt-ping';
import { VttSheet } from './VttSheet';
import { VttMonsterSheet, VttMonsterStatblock, type MonsterProfile } from './VttMonsterSheet';
import { VttDice } from './VttDice';
import { VttToolGroup } from './VttToolGroup';
import { VttHotbar, ActionShortcut } from './VttHotbar';
import { VttEffects } from './VttEffects';
import { VttAttackVisuals } from './VttAttackVisuals';
import { VttEffectSounds } from './VttEffectSounds';
import { useVttMediaPreferences } from './vtt-media-preferences';
import type { AttackVisualCommand } from '../shared/vtt-attack-visual';
import { VttSoundboard } from './VttSoundboard';
import { VttSoundCredits } from './VttSoundCredits';
import { useVttSounds } from './useVttSounds';
import { soundSettings, type SoundCommand } from '../shared/vtt-sounds';
import { VttRollHelp } from './VttRollHelp';
import { useVttCombat, VttTurnCarousel, VttCombatPanel } from './VttCombat';
import { effectEnds, type EffectPreset } from '../shared/vtt-effects';
import type { MonsterAction } from '../shared/vtt-monster-actions';
import { compendiumText, monsterDetails } from '../shared/vtt-compendium';
import { monsterArt } from '../shared/vtt-monster-art';
import { hpCommand } from '../shared/vtt-hp';
import { lassoSelection } from '../shared/vtt-selection';
import { movementBlocked } from '../shared/vtt-movement';
import { VttHpControl } from './VttHpControl';
import { VttBossBars } from './VttBossBars';
import { MapLibrary, MapSettings } from './VttMaps';
import { useMusicInterlude } from './SiteMusic';
import './vtt.css';
type Tool =
  | 'select'
  | 'lasso'
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
const barrierTools = new Set<Tool>(['wall', 'door', 'window', 'light']);
type Tab =
  | 'art'
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
  speed?: string;
  legacyDetails?: string;
  information?: { label: string; value: string }[];
  image?: string;
};
const monsterMime = 'application/x-alvorada-monster';
function monsterImage(entry: Entry) {
  return entry.image || monsterArt(entry.id, entry.name);
}
const tabs: { id: Tab; name: string; icon: typeof Sun }[] = [
  { id: 'chat', name: 'Chat', icon: MessageSquare },
  { id: 'art', name: 'Biblioteca de arte', icon: Image },
  { id: 'sheet', name: 'Fichas', icon: Users },
  { id: 'library', name: 'Biblioteca', icon: BookOpen },
  { id: 'music', name: 'Som', icon: Music },
  { id: 'combat', name: 'Combate', icon: Swords },
  { id: 'table', name: 'Configurações e ajuda', icon: Settings2 },
];
const toolList: { id: Tool; name: string; icon: typeof Sun; gm?: boolean }[] = [
  { id: 'select', name: 'Selecionar (V)', icon: MousePointer2 },
  { id: 'lasso', name: 'Seleção livre (L)', icon: LassoSelect, gm: true },
  { id: 'ruler', name: 'Régua (R)', icon: Ruler },
  { id: 'ping', name: 'Sinalizar ponto', icon: ArrowDown },
  { id: 'pen', name: 'Desenhar (P)', icon: Pencil, gm: true },
  { id: 'rect', name: 'Retângulo', icon: Square, gm: true },
  { id: 'circle', name: 'Área circular', icon: Circle, gm: true },
  { id: 'cone', name: 'Área de cone', icon: Triangle, gm: true },
  { id: 'line', name: 'Linha', icon: Slash, gm: true },
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
  return compendiumText(value);
}
function DiceIcon({ sides }: { sides: number }) {
  const path =
    sides === 4
      ? 'M12 2 22 21H2Z M12 2 12 15 2 21 M12 15 22 21'
      : sides === 6
        ? 'M4 4H20V20H4Z M4 4 8 8H20 M8 8V20'
        : sides === 8
          ? 'M12 2 22 12 12 22 2 12Z M2 12H22 M12 2V22'
          : sides === 10 || sides === 100
            ? 'M12 2 22 11 18 20 6 20 2 11Z M12 2 8 12 6 20 M8 12 18 20 M8 12 22 11'
            : sides === 12
              ? 'M7 2H17L23 10 19 21H5L1 10Z M7 2 9 8H16L17 2 M9 8 6 15 5 21 M6 15H18L19 21 M16 8 18 15 23 10 M1 10 6 15'
              : 'M12 1 22 7V17L12 23 2 17V7Z M12 1 7 8 2 7 M7 8 17 8 22 7 M7 8 6 17 2 17 M17 8 18 17 22 17 M6 17H18L12 23 M7 8 12 18 17 8';
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        d={path}
        fill="#81776c"
        fillOpacity=".28"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  const [draftValue, setDraftValue] = useState(String(value));
  useEffect(() => setDraftValue(String(value)), [value]);
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        value={draftValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          setDraftValue(e.currentTarget.value);
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        onBlur={() => setDraftValue(String(value))}
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
  const media = useVttMediaPreferences(user.id);
  const visualEffects = media.visualEffects;
  const [tool, setTool] = useState<Tool>('select'),
    [tab, setTab] = useState<Tab>('chat'),
    [layer, setLayer] = useState('tokens'),
    [selection, setSelection] = useState<string[]>([]),
    [attackTargetId, setAttackTargetId] = useState<string | null>(null),
    [attackBusy, setAttackBusy] = useState(false),
    [camera, setCamera] = useState<VttCamera>({ x: 1120, y: 840, zoom: 0.45 }),
    [bounds, setBounds] = useState({ width: 900, height: 700 }),
    [preview, setPreview] = useState(false),
    [previewViewerId, setPreviewViewerId] = useState<string | null>(null),
    [effectPreview, setEffectPreview] = useState<{
      tokenIds: string[];
      preset: EffectPreset;
      at: number;
    } | null>(null),
    [attack, setAttack] = useState<AttackRequest | null>(null),
    [joinRole, setJoinRole] = useState<'player' | 'spectator'>('player'),
    [showWalls, setShowWalls] = useState(true),
    [ruler, setRuler] = useState<Point[]>([]),
    [lasso, setLasso] = useState<Point[]>([]),
    [fogShape, setFogShape] = useState<'rect' | 'polygon' | 'brush'>('rect'),
    [fogPoints, setFogPoints] = useState<Point[]>([]),
    [fogPointer, setFogPointer] = useState<Point | null>(null),
    [draft, setDraft] = useState<VttDrawing | null>(null),
    [ping, setPing] = useState<VttPing | null>(null),
    [brushColor, setBrushColor] = useState('#dac28e'),
    [brushWidth, setBrushWidth] = useState(3),
    [brushFill, setBrushFill] = useState(true),
    [text, setText] = useState(''),
    [textEdit, setTextEdit] = useState<{
      point: Point;
      x: number;
      y: number;
      value: string;
    } | null>(null),
    [brushRadius, setBrushRadius] = useState(140),
    [panelOpen, setPanelOpen] = useState(true),
    [mapsOpen, setMapsOpen] = useState(false),
    [sheetId, setSheetId] = useState<string | null>(null),
    [diceOpen, setDiceOpen] = useState(false),
    [dice3d, setDice3d] = useState(true),
    [diceCount, setDiceCount] = useState(1),
    [diceSides, setDiceSides] = useState(20),
    [diceModifier, setDiceModifier] = useState(0),
    [olderMessages, setOlderMessages] = useState<VttMessage[]>([]),
    [historyEnd, setHistoryEnd] = useState(false),
    [settingsId, setSettingsId] = useState<string | null>(null),
    [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [library, setLibrary] = useState<'images' | 'monsters' | 'spells' | 'presets' | 'premium'>(
      'images',
    ),
    [presetVersion, setPresetVersion] = useState(0),
    [query, setQuery] = useState(''),
    [entry, setEntry] = useState<Entry | null>(null),
    [catalog, setCatalog] = useState<{ monsters: Entry[]; spells: Entry[] }>({
      monsters: [],
      spells: [],
    }),
    [chat, setChat] = useState(''),
    [formula, setFormula] = useState('1d20'),
    [privateRoll, setPrivateRoll] = useState(false),
    [chatControlsCollapsed, setChatControlsCollapsed] = useState(() => {
      try {
        return localStorage.getItem(`vtt-chat-controls:${user.id}`) === 'collapsed';
      } catch {
        return false;
      }
    }),
    [inviteInput, setInviteInput] = useState(''),
    [roomName, setRoomName] = useState('Mesa da Alvorada'),
    [journalId, setJournalId] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null),
    chatLog = useRef<HTMLDivElement>(null),
    chatStick = useRef(true),
    chatTop = useRef(0),
    chatHistoryAnchor = useRef<{ height: number; top: number } | null>(null),
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
      kind: 'pan' | 'tokens' | 'shape' | 'lasso';
      tool?: Tool;
      layer?: string;
      tokens: VttToken[];
      lasso?: Point[];
      additive?: boolean;
      baseSelection?: string[];
      path?: Point[];
    } | null>(null),
    focusSeen = useRef<{ roomId: string; at: number; id: string } | null>(null),
    focusFrame = useRef(0),
    contextRef = useRef<HTMLDivElement>(null);
  const music = useMusicInterlude();
  const sounds = useVttSounds(state?.id),
    soundQueue = useRef(Promise.resolve());
  function customizeChatControls(collapsed: boolean) {
    setChatControlsCollapsed(collapsed);
    try {
      localStorage.setItem(`vtt-chat-controls:${user.id}`, collapsed ? 'collapsed' : 'expanded');
    } catch {
      /* The controls still work when browser storage is unavailable. */
    }
  }
  useEffect(() => music.beginInterlude(), [music.beginInterlude]);
  stateRef.current = state;
  docRef.current = doc;
  const scene = doc?.scenes.find((s) => s.id === doc.activeScene),
    token = scene?.tokens.find((t) => t.id === selection[0]),
    selectedEffectTokens =
      scene?.tokens.filter((t) => selection.includes(t.id) && t.layer !== 'map') || [],
    attackTarget =
      token?.layer === 'tokens' && selection.length === 1
        ? scene?.tokens.find(
            (t) =>
              t.id === attackTargetId &&
              t.id !== token.id &&
              t.layer === 'tokens' &&
              !t.hidden &&
              (!preview ||
                !!viewerSees(
                  scene.tokens.find((v) => v.id === previewViewerId) || token,
                  t,
                  scene,
                )),
          )
        : undefined,
    gm = state?.is_gm === true,
    barrierEditing = gm && !preview && layer === 'lighting',
    selectedLight = barrierEditing ? scene?.lights.find((l) => l.id === selection[0]) : undefined,
    selectedWall =
      barrierEditing && showWalls ? scene?.walls.find((w) => w.id === selection[0]) : undefined,
    selectedDrawing = scene?.drawings.find((d) => d.id === selection[0]),
    spectator = state?.role === 'spectator',
    canToken = !spectator && (gm || token?.controller === user.id),
    viewer =
      scene?.tokens.find((t) => t.id === previewViewerId && t.layer === 'tokens' && !t.hidden) ||
      scene?.tokens.find(
        (t) =>
          t.controller === (spectator ? state?.viewingUser : user.id) &&
          t.layer === 'tokens' &&
          !t.hidden,
      ) ||
      (gm ? scene?.tokens.find((t) => t.layer === 'tokens' && !t.hidden) : null) ||
      null;
  function changeLayer(next: string, nextSelection: string[] = []) {
    if (next === layer) return;
    if (drag.current?.kind === 'shape' || drag.current?.kind === 'lasso') {
      drag.current = null;
      setDraft(null);
      setRuler([]);
      setLasso([]);
    }
    if (next !== 'lighting' && barrierTools.has(tool)) setTool('select');
    setContextMenu(null);
    setSelection(nextSelection);
    setLayer(next);
  }
  useEffect(() => {
    if (barrierEditing) return;
    if (barrierTools.has(tool)) {
      setTool('select');
      drag.current = null;
      setDraft(null);
      setRuler([]);
    }
    if (scene) {
      const editingIds = new Set([...scene.walls, ...scene.lights].map((v) => v.id));
      setSelection((current) =>
        current.some((id) => editingIds.has(id))
          ? current.filter((id) => !editingIds.has(id))
          : current,
      );
    }
  }, [barrierEditing, tool, scene?.id]);
  const resetDirty = () => {
    dirtyRef.current = false;
    setDirty(false);
  };
  function receive(next: VttState, reset = true) {
    if (stateRef.current?.id === next.id && next.revision < stateRef.current.revision) return;
    if (stateRef.current?.id !== next.id) {
      focusSeen.current = {
        roomId: next.id,
        at: next.focusSignal?.at || 0,
        id: next.focusSignal?.id || '',
      };
      setOlderMessages([]);
      chatStick.current = true;
      chatTop.current = 0;
      chatHistoryAnchor.current = null;
      setAttack(null);
      setPreview(false);
      setPreviewViewerId(null);
      setEffectPreview(null);
      setHistoryEnd(false);
      setSheetId(null);
    }
    if (
      stateRef.current?.id !== next.id ||
      stateRef.current?.document.activeScene !== next.document.activeScene
    ) {
      const s = next.document.scenes.find((s) => s.id === next.document.activeScene)!;
      setCamera({
        x: s.width / 2,
        y: s.height / 2,
        zoom: Math.min(bounds.width / (s.width + 100), bounds.height / (s.height + 100)),
      });
      setSelection([]);
      setAttackTargetId(null);
      setAttack(null);
      setSheetId(null);
    }
    stateRef.current = next;
    docRef.current = next.document;
    setState(next);
    setDoc(next.document);
    followSignal(next.focusSignal, next.id, next.document.activeScene);
    if (reset) resetDirty();
  }
  function followSignal(
    signal: VttFocusSignal | null,
    roomId = stateRef.current?.id,
    sceneId = docRef.current?.activeScene,
  ) {
    if (
      !signal ||
      !roomId ||
      signal.sceneId !== sceneId ||
      focusSeen.current?.roomId !== roomId ||
      signal.id === focusSeen.current?.id ||
      signal.at < (focusSeen.current?.at || 0)
    )
      return;
    focusSeen.current = { roomId, at: signal.at, id: signal.id };
    setPing({ x: signal.x, y: signal.y, at: Date.now() });
    cancelAnimationFrame(focusFrame.current);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCamera((c) => ({ ...c, x: signal.x, y: signal.y }));
      return;
    }
    const start = performance.now();
    let from: VttCamera | null = null;
    const animate = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / 550)),
        ease = 1 - Math.pow(1 - p, 3);
      setCamera((c) => {
        from ||= c;
        return {
          ...c,
          x: from.x + (signal.x - from.x) * ease,
          y: from.y + (signal.y - from.y) * ease,
        };
      });
      if (p < 1) focusFrame.current = requestAnimationFrame(animate);
    };
    focusFrame.current = requestAnimationFrame(animate);
  }
  useEffect(() => () => cancelAnimationFrame(focusFrame.current), []);
  useEffect(() => {
    if (!ping) return;
    const timer = setTimeout(() => setPing((p) => (p?.at === ping.at ? null : p)), pingDuration);
    return () => clearTimeout(timer);
  }, [ping]);
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
        const target = s.tokens.find((t) => t.id === token.id)!;
        const oldHp = target.hp;
        Object.assign(
          s.tokens.find((t) => t.id === token.id)!,
          patch,
        );
        applyTokenDeath(target, oldHp);
        if (['vision', 'light', 'dimLight'].some((key) => key in patch)) activateTokenVision(s);
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
  function editSelected(fn: (t: VttToken) => void) {
    if (!gm) return;
    editScene((s) => s.tokens.filter((t) => selection.includes(t.id)).forEach(fn));
  }
  function openMap(id: string) {
    edit((d) => activateScene(d, id));
    setSelection([]);
    setContextMenu(null);
    setMapsOpen(false);
    fit(docRef.current?.scenes.find((s) => s.id === id));
  }
  function createMap(folderId: string | null = null) {
    const next = newScene(crypto.randomUUID());
    next.folderId = folderId;
    edit((d) => {
      d.scenes.push(next);
      activateScene(d, next.id);
    });
    setSelection([]);
    setMapsOpen(false);
    fit(next);
    setSettingsId(next.id);
  }
  function saveMap(next: VttScene) {
    edit((d) => {
      d.scenes[d.scenes.findIndex((s) => s.id === next.id)] = next;
      if (next.archived && d.activeScene === next.id)
        activateScene(d, d.scenes.find((s) => !s.archived)!.id);
    });
    setSettingsId(null);
    setSelection([]);
    fit(docRef.current?.scenes.find((s) => s.id === docRef.current?.activeScene));
  }
  function removeMap(id: string) {
    edit((d) => {
      d.scenes = d.scenes.filter((s) => s.id !== id);
      if (d.activeScene === id) {
        activateScene(d, d.scenes.find((s) => !s.archived)!.id);
        d.initiative = [];
      }
    });
    setSettingsId(null);
    setSelection([]);
    fit(docRef.current?.scenes.find((s) => s.id === docRef.current?.activeScene));
  }
  useEffect(() => {
    if (!contextMenu) return;
    const outside = (e: PointerEvent) => {
      if ((e.target as Element)?.closest?.('canvas[data-selection-count]')) return;
      if (!contextRef.current?.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [contextMenu]);
  useEffect(() => {
    setTextEdit(null);
    setContextMenu(null);
    cancelAnimationFrame(focusFrame.current);
  }, [scene?.id, state?.id, tool, gm]);
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
  const combat = useVttCombat(state?.id, scene?.id, save, refreshRoom);
  async function act(fn: () => Promise<unknown>) {
    try {
      setNotice('');
      await fn();
    } catch (error) {
      setNotice((error as Error).name === 'ZodError' ? vttUpdateMessage : (error as Error).message);
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
    let next = await api<VttState>('/vtt/rooms/' + id);
    if (!next.is_gm && next.role === 'player')
      next = await post<VttState>(`/vtt/rooms/${id}/participation`, { role: 'player' });
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
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    api<typeof catalog>('/vtt/compendium')
      .then((c) => {
        if (!live) return;
        setCatalog(c);
        setEntry((current) =>
          current ? c.monsters.find((m) => m.id === current.id) || current : null,
        );
      })
      .catch((e) => live && setNotice(e.message));
    return () => {
      live = false;
    };
  }, [state?.premiumAccess, state?.premiumTokens]);
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
              if (
                next.revision !== stateRef.current.revision ||
                next.role !== stateRef.current.role ||
                next.viewingUser !== stateRef.current.viewingUser
              )
                receive(next);
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
    if (!state?.id) return;
    let live = true,
      pending = false;
    const id = state.id,
      timer = setInterval(async () => {
        if (!live || pending || document.hidden) return;
        pending = true;
        try {
          const signal = await api<VttFocusSignal | null>(`/vtt/rooms/${id}/signal`);
          if (live && stateRef.current?.id === id) followSignal(signal);
        } catch {
          /* The regular room poll reports participation and connection changes. */
        } finally {
          pending = false;
        }
      }, 750);
    return () => {
      live = false;
      clearInterval(timer);
      cancelAnimationFrame(focusFrame.current);
    };
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
    const draw = () =>
      renderVtt(
        c.getContext('2d')!,
        spectator && !scene.fog && !state?.viewingUser
          ? { ...scene, lighting: false }
          : effectPreview && gm
            ? {
                ...scene,
                tokens: scene.tokens.map((t) =>
                  !effectPreview.tokenIds.includes(t.id)
                    ? t
                    : effectPreview.preset.kind === 'death'
                      ? { ...t, deathAt: effectPreview.at }
                      : {
                          ...t,
                          effects: [
                            ...t.effects.filter((e) => e.kind !== effectPreview.preset.kind),
                            { ...effectPreview.preset, duration: 0, at: effectPreview.at },
                          ],
                        },
                ),
              }
            : scene,
        {
          camera,
          width: bounds.width,
          height: bounds.height,
          dpr,
          visualEffects,
          images: images.current,
          selected: selection,
          target: attackTarget?.id,
          currentTurn: combat.state?.active ? combat.state.currentId || undefined : undefined,
          nextTurn: combat.state?.active ? combat.state.nextId || undefined : undefined,
          gm,
          preview,
          viewer,
          layer,
          ruler,
          lasso,
          draft: fogPoints.length
            ? {
                id: 'fog-preview',
                kind: 'pen',
                points: [...fogPoints, ...(fogPointer ? [fogPointer] : [])],
                color: tool === 'reveal' ? '#96c9aa' : '#d29283',
                width: 2,
                fill: false,
                text: '',
                layer: 'tokens',
              }
            : draft,
          showWalls,
          ping,
          userId: spectator ? state?.viewingUser || '' : user.id,
        },
      );
    let frame = 0;
    const ends = visualEffects
      ? scene.tokens.flatMap((t) => t.effects.map(effectEnds)).filter((at) => at > Date.now())
      : [];
    const until = visualEffects
      ? Math.max(
          0,
          ...scene.tokens.map((t) => (t.deathAt ? t.deathAt + 1300 : 0)),
          ...ends,
          ping ? ping.at + pingDuration : 0,
        )
      : 0;
    const timers = ends.map((at) => window.setTimeout(draw, Math.max(0, at - Date.now() + 10)));
    const infinite =
      visualEffects &&
      (!!combat.state?.active ||
        !!effectPreview ||
        scene.tokens.some((t) => t.effects.some((e) => e.duration === 0 && e.kind !== 'death')));
    const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    const restartAnimation = () => {
      cancelAnimationFrame(frame);
      draw();
      if (!(infinite || until > Date.now()) || motionPreference.matches) return;
      let lastDraw = 0;
      const animate = (now: number) => {
        if (now - lastDraw >= 32 && !document.hidden) {
          draw();
          lastDraw = now;
        }
        if (infinite || Date.now() < until) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    };
    restartAnimation();
    motionPreference.addEventListener('change', restartAnimation);
    return () => {
      cancelAnimationFrame(frame);
      motionPreference.removeEventListener('change', restartAnimation);
      timers.forEach(clearTimeout);
    };
  }, [
    doc,
    camera,
    bounds,
    selection,
    attackTarget?.id,
    combat.state,
    preview,
    previewViewerId,
    state?.viewingUser,
    effectPreview,
    visualEffects,
    imageVersion,
    layer,
    ruler,
    lasso,
    draft,
    fogPoints,
    fogPointer,
    showWalls,
    ping,
    gm,
  ]);
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
      s.walls = s.walls.filter((w) => !(barrierEditing && showWalls && selection.includes(w.id)));
      s.lights = s.lights.filter((l) => !(barrierEditing && selection.includes(l.id)));
      s.drawings = s.drawings.filter((d) => !selection.includes(d.id));
    });
    setSelection([]);
    setContextMenu(null);
  }
  function duplicate() {
    if (!gm || !scene) return;
    const originals = scene.tokens.filter((t) => selection.includes(t.id));
    const copies = originals.map((t) => ({
      ...structuredClone(t),
      id: crypto.randomUUID(),
      x: t.x + scene.grid.size,
      y: t.y + scene.grid.size,
      bossStyle: null,
      deathAt: null,
    }));
    editScene((s) => s.tokens.push(...copies));
    setSelection(copies.map((t) => t.id));
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest('input,textarea,select,button,[contenteditable]'))
        return;
      if (e.key === 'Escape') {
        if (mapsOpen || settingsId || sheetId) return;
        setContextMenu(null);
        setSelection([]);
        setAttackTargetId(null);
        if (!attackBusy) setAttack(null);
        setDraft(null);
        setRuler([]);
        setLasso([]);
        if (
          drag.current?.kind === 'lasso' ||
          (drag.current?.kind === 'shape' && barrierTools.has(drag.current.tool!))
        )
          drag.current = null;
        setTool('select');
        setFogPoints([]);
        setFogPointer(null);
      }
      if (e.key === 'Enter' && fogPoints.length >= 3) {
        e.preventDefault();
        commitFog(fogPoints);
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
      const shortcuts: Record<string, Tool> = { v: 'select', l: 'lasso', r: 'ruler', p: 'pen' };
      const shortcut = shortcuts[e.key.toLowerCase()];
      if (shortcut && !e.ctrlKey && !e.metaKey && (shortcut !== 'lasso' || (gm && !preview))) {
        setTool(shortcut);
        setLasso([]);
        if (
          drag.current?.kind === 'lasso' ||
          (drag.current?.kind === 'shape' && barrierTools.has(drag.current.tool!))
        ) {
          drag.current = null;
          setRuler([]);
          setDraft(null);
        }
      }
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
        if (scene && token.layer === 'tokens' && movementBlocked(scene, token, p)) {
          setNotice('Uma parede, porta fechada ou janela fechada bloqueia o movimento.');
          return;
        }
        editToken(p);
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [
    doc,
    selection,
    gm,
    token,
    mapsOpen,
    settingsId,
    sheetId,
    fogPoints,
    tool,
    preview,
    layer,
    showWalls,
  ]);
  function commitFog(points: Point[], remember = true) {
    if (points.length < 3 || !gm) return;
    editScene((s) => {
      s.fog = true;
      s.fogMode = 'manual';
      s.lighting = false;
      if (s.fogAreas.length < 3000)
        s.fogAreas.push({
          id: crypto.randomUUID(),
          points: points.slice(0, 1000),
          reveal: tool === 'reveal',
        });
    }, remember);
    setFogPoints([]);
    setFogPointer(null);
  }
  function fogCircle(p: Point) {
    return Array.from({ length: 32 }, (_, i) => ({
      x: p.x + Math.cos((i * Math.PI) / 16) * brushRadius,
      y: p.y + Math.sin((i * Math.PI) / 16) * brushRadius,
    }));
  }
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
    cancelAnimationFrame(focusFrame.current);
    if (!scene || !doc || e.button === 2) return;
    if (barrierTools.has(tool) && !barrierEditing) return;
    const p = point(e),
      snap = e.altKey ? p : snapPoint(p, scene.grid);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (spectator) {
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
    if (tool === 'lasso' && e.button === 0) {
      if (!gm || preview) return;
      drag.current = {
        kind: 'lasso',
        start: p,
        last: p,
        screen: { x: e.clientX, y: e.clientY },
        camera,
        original: doc,
        tokens: [],
        lasso: [p],
        additive: e.shiftKey,
        baseSelection: selection,
      };
      setLasso([p]);
      setAttackTargetId(null);
      return;
    }
    if (tool === 'ping') {
      const position = {
        x: Math.max(0, Math.min(scene.width, p.x)),
        y: Math.max(0, Math.min(scene.height, p.y)),
      };
      if (gm)
        void act(async () => {
          await save();
          const signal = await post<VttFocusSignal>(`/vtt/rooms/${state!.id}/signal`, {
            ...position,
            sceneId: scene.id,
          });
          followSignal(signal);
        });
      else setPing({ ...position, at: Date.now() });
      return;
    }
    if (tool === 'text' && gm) {
      if (layer === 'lighting') changeLayer('tokens');
      const rect = e.currentTarget.getBoundingClientRect();
      setTextEdit({
        point: snap,
        x: Math.max(
          8,
          Math.min(rect.width - Math.min(244, rect.width - 16) - 8, e.clientX - rect.left),
        ),
        y: Math.max(8, Math.min(rect.height - 170, e.clientY - rect.top)),
        value: text,
      });
      setDraft(null);
      return;
    }
    if (tool === 'light' && gm) {
      const l = lightSchema.parse({
        id: crypto.randomUUID(),
        name: 'Fonte de luz',
        x: snap.x,
        y: snap.y,
        color: '#e9c887',
      });
      editScene((s) => {
        s.lights.push(l);
        s.lighting = true;
      });
      changeLayer('lighting');
      setSelection([l.id]);
      setTab('scene');
      return;
    }
    if (gm && (tool === 'reveal' || tool === 'hide')) {
      if (fogShape === 'polygon') {
        setFogPoints((points) =>
          points.length >= 1000 ||
          (points.length && Math.hypot(points.at(-1)!.x - p.x, points.at(-1)!.y - p.y) < 3)
            ? points
            : [...points, p],
        );
        setFogPointer(p);
      } else {
        drag.current = {
          kind: 'shape',
          start: p,
          last: p,
          screen: { x: e.clientX, y: e.clientY },
          camera,
          tokens: [],
          original: structuredClone(doc),
        };
        if (fogShape === 'brush') commitFog(fogCircle(p));
        else
          setDraft({
            id: crypto.randomUUID(),
            kind: 'rect',
            points: [p, p],
            color: tool === 'reveal' ? '#96c9aa' : '#d29283',
            width: 2,
            fill: false,
            text: '',
            layer: 'tokens',
          });
      }
      return;
    }
    if (tool === 'select') {
      if (barrierEditing) {
        const light = [...scene.lights]
          .reverse()
          .find((l) => Math.hypot(p.x - l.x, p.y - l.y) < 18 / camera.zoom);
        const wall = showWalls
          ? [...scene.walls].reverse().find((w) => segmentDistance(p, w.a, w.b) < 9 / camera.zoom)
          : undefined;
        if (light || wall) {
          setSelection([(light || wall)!.id]);
          setTab('scene');
          return;
        }
      }
      const hitScene =
        gm && preview
          ? {
              ...scene,
              tokens: scene.tokens.filter(
                (t) =>
                  !t.hidden &&
                  t.layer !== 'gm' &&
                  (!viewer ? t.layer === 'map' : t.layer === 'map' || viewerSees(viewer, t, scene)),
              ),
            }
          : scene;
      const hit = spectator ? null : tokenAt(p, hitScene, layer, gm && !preview);
      if (hit) {
        if (attackBusy) return;
        if (
          !e.shiftKey &&
          !e.ctrlKey &&
          !e.metaKey &&
          token &&
          token.layer === 'tokens' &&
          selection.length === 1 &&
          (gm || token.controller === user.id) &&
          hit.layer === 'tokens' &&
          !hit.hidden &&
          hit.id !== token.id
        ) {
          setAttackTargetId((id) => (id === hit.id ? null : hit.id));
          return;
        }
        const ids = e.shiftKey
          ? selection.includes(hit.id)
            ? selection.filter((id) => id !== hit.id)
            : [...selection, hit.id]
          : selection.includes(hit.id)
            ? selection
            : [hit.id];
        setSelection(ids);
        if (ids[0] !== token?.id || ids.length !== 1) setAttackTargetId(null);
        if (!preview && !hit.locked && (gm || hit.controller === user.id)) {
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
        }
        return;
      }
      const drawing = gm ? drawingAt(p, scene, layer, 8 / camera.zoom) : null;
      if (drawing) {
        setSelection([drawing.id]);
        setTab('scene');
        return;
      }
      setSelection([]);
      setAttackTargetId(null);
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
      tool,
      layer,
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
        layer: layer === 'map' || layer === 'gm' ? layer : 'tokens',
      });
    else setRuler([snap, snap]);
  }
  function pointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (fogPoints.length) {
      setFogPointer(point(e));
      return;
    }
    if (!d || !scene || !doc) return;
    if (
      d.kind === 'shape' &&
      barrierTools.has(d.tool!) &&
      (!barrierEditing || d.layer !== layer || d.tool !== tool)
    ) {
      drag.current = null;
      setDraft(null);
      setRuler([]);
      return;
    }
    const p = point(e);
    if (d.kind === 'lasso') {
      const path = d.lasso!;
      if (Math.hypot(p.x - path.at(-1)!.x, p.y - path.at(-1)!.y) >= 3 / d.camera.zoom) {
        d.lasso = path.length >= 1500 ? path.filter((_, i) => i % 2 === 0) : path;
        d.lasso = [...d.lasso, p];
        setLasso(d.lasso);
      }
      return;
    }
    if (gm && ['reveal', 'hide'].includes(tool) && fogShape === 'brush') {
      if (Math.hypot(p.x - d.start.x, p.y - d.start.y) > brushRadius * 0.3) {
        commitFog(fogCircle(p), false);
        d.start = p;
      }
      return;
    }
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
        const destination = {
          x: Math.max(0, Math.min(s.width, dest.x)),
          y: Math.max(0, Math.min(s.height, dest.y)),
        };
        if (t.layer === 'tokens' && movementBlocked(s, t, destination)) continue;
        if (!gm && (d.path?.length || 0) >= 2000) continue;
        if (!gm && (t.x !== destination.x || t.y !== destination.y))
          d.path = [...(d.path || []), destination];
        Object.assign(t, destination);
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
    if (d.kind === 'lasso') {
      if (gm && !preview) {
        const ids = lassoSelection(showWalls ? scene : { ...scene, walls: [] }, layer, [
          ...d.lasso!,
          point(e),
        ]);
        setSelection(d.additive ? [...new Set([...d.baseSelection!, ...ids])] : ids);
        setAttackTargetId(null);
      }
      setLasso([]);
      return;
    }
    if (gm && ['reveal', 'hide'].includes(tool)) {
      if (fogShape === 'rect' && draft) {
        const a = d.start,
          b = point(e);
        if (Math.hypot(b.x - a.x, b.y - a.y) > 3)
          commitFog([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]);
      }
      setDraft(null);
      return;
    }
    if (tool === 'ruler') {
      setRuler([]);
      return;
    }
    if (d.kind === 'tokens') {
      const current = docRef.current!.scenes.find((s) => s.id === docRef.current!.activeScene)!;
      if (
        !d.tokens.some((t) => {
          const next = current.tokens.find((n) => n.id === t.id);
          return next && (next.x !== t.x || next.y !== t.y);
        })
      )
        return;
      if (gm) {
        undo.current.push(d.original);
        redo.current = [];
        serial.current++;
        dirtyRef.current = true;
        setDirty(true);
        setDoc(structuredClone(docRef.current!));
      } else {
        const moved = docRef
          .current!.scenes.find((s) => s.id === docRef.current!.activeScene)!
          .tokens.find((t) => t.id === d.tokens[0]?.id);
        if (moved) {
          const p = { x: moved.x, y: moved.y, ...(d.path?.length ? { path: d.path } : {}) };
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
    if (d.kind === 'shape' && ['wall', 'door', 'window'].includes(d.tool || '')) {
      if (!barrierEditing || d.layer !== layer || d.tool !== tool) {
        setRuler([]);
        setDraft(null);
        return;
      }
      const b = e.altKey ? point(e) : snapPoint(point(e), scene.grid);
      if (Math.hypot(b.x - d.start.x, b.y - d.start.y) > 3)
        editScene((s) => {
          const opening = {
            id: crypto.randomUUID(),
            a: d.start,
            b,
            kind: tool as 'wall' | 'door' | 'window',
            open: false,
          };
          carveOpening(s, opening, () => crypto.randomUUID());
          s.walls.push(opening);
          if (!s.lighting) s.ambient = 0;
          s.lighting = true;
        });
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
  function commitText() {
    if (!gm || !textEdit?.value.trim()) return;
    const value = textEdit.value.trim().slice(0, 500);
    editScene((s) =>
      s.drawings.push({
        id: crypto.randomUUID(),
        kind: 'text',
        points: [textEdit.point],
        text: value,
        color: brushColor,
        width: brushWidth,
        fill: false,
        layer: layer === 'map' || layer === 'gm' ? layer : 'tokens',
      }),
    );
    setTextEdit(null);
    setText('');
  }
  function newMarker() {
    if (!scene) return;
    const t = newToken(crypto.randomUUID(), scene);
    t.x = camera.x;
    t.y = camera.y;
    t.layer = layer === 'lighting' ? 'tokens' : (layer as VttToken['layer']);
    editScene((s) => s.tokens.push(t));
    changeLayer(t.layer);
    setSelection([t.id]);
    setTab('token');
  }
  function addMonster(e: Entry, at?: Point, keepLibrary = false) {
    if (!scene || !gm || preview) return;
    const t = newToken(crypto.randomUUID(), scene);
    const size: Record<string, number> = { T: 0.5, S: 1, M: 1, L: 2, H: 3, G: 4 };
    Object.assign(t, {
      name: e.name,
      image: e.image || monsterArt(e.id, e.name),
      monster: customMonster(entryProfile(e), e.id),
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
        speed: Number(e.speed?.match(/\bwalk:\s*(\d+)/)?.[1] ?? 30),
        biography: '',
        details: e.details,
      },
    });
    const origin = at ? snapPoint(at, scene.grid) : camera;
    t.x = Math.max(
      Math.min(t.width / 2, scene.width / 2),
      Math.min(scene.width - t.width / 2, origin.x),
    );
    t.y = Math.max(
      Math.min(t.height / 2, scene.height / 2),
      Math.min(scene.height - t.height / 2, origin.y),
    );
    editScene((s) => s.tokens.push(t));
    changeLayer('tokens');
    setSelection([t.id]);
    setAttackTargetId(null);
    if (!keepLibrary) setTab('sheet');
  }
  function dragMonster(event: ReactDragEvent<HTMLElement>, id: string) {
    if (!gm || preview) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(monsterMime, id);
    event.dataTransfer.effectAllowed = 'copy';
  }
  function entryProfile(e: Entry): MonsterProfile {
    return {
      ...e,
      hp: e.hp ?? 10,
      ac: e.ac ?? 10,
      stats: e.stats ?? [10, 10, 10, 10, 10, 10],
      image: e.image || monsterArt(e.id, e.name),
    };
  }
  function tokenProfile(t: VttToken): MonsterProfile {
    const source = catalog.monsters.find(
      (e) =>
        (e.name === t.name || monsterArt(e.id, e.name) === t.image) &&
        (e.details === t.sheet?.details || e.legacyDetails === t.sheet?.details),
    );
    return {
      ...(source ? entryProfile(source) : {}),
      name: t.name,
      image: t.image,
      hp: t.hp,
      maxHp: t.maxHp,
      ac: t.ac,
      stats: t.sheet?.stats || [10, 10, 10, 10, 10, 10],
      source: t.sheet?.source,
      type: t.sheet?.race,
      details: t.monster
        ? monsterCustomDetails(t.monster)
        : (source?.details ?? t.sheet?.details ?? ''),
      actionDetails: t.sheet?.details,
      speed: t.monster?.speed || source?.speed || `${t.sheet?.speed ?? 30} ft`,
      ...(t.monster
        ? {
            size: t.monster.size,
            cr: t.monster.cr,
            information: t.monster.information,
            actions: t.monster.actions,
          }
        : {}),
    };
  }
  function useMonsterAction(t: VttToken, action: MonsterAction) {
    if (!gm || preview) return;
    setSheetId(null);
    if (action.attack)
      beginAttack({
        actorId: t.id,
        name: t.name + ' · ' + action.name,
        attack: action.attack,
        damage: action.damage,
      });
    else void act(() => send(action.damage.join('+'), t.name + ' · ' + action.name));
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
      userId: user.id,
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
          details: (kind === 'monster'
            ? monsterDetails(e)
            : tagText([e.entries, e.entriesHigherLevel])
          ).slice(0, 40000),
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
  function openSheet(t = token) {
    if (spectator) return;
    if (t && (t.characterId || t.sheet)) setSheetId(t.id);
    else {
      setTab('sheet');
      setPanelOpen(true);
    }
  }
  async function refreshRoom() {
    await save();
    receive(await api<VttState>(`/vtt/rooms/${state!.id}`));
  }
  function soundCommand(command: SoundCommand, roomId = stateRef.current?.id): Promise<void> {
    if (!roomId) return Promise.reject(Error('Abra uma mesa.'));
    const task = soundQueue.current
      .catch(() => {})
      .then(async () => {
        await save();
        const next = await post<VttState & { soundTime: number }>(
          `/vtt/rooms/${roomId}/sounds`,
          command,
        );
        if (stateRef.current?.id !== roomId) return;
        sounds.accept({
          revision: next.revision,
          serverTime: next.soundTime,
          soundboard: next.document.soundboard,
          music: next.document.music,
        });
        if (dirtyRef.current && docRef.current) {
          const merged = {
            ...docRef.current,
            soundboard: next.document.soundboard,
            music: next.document.music,
          };
          stateRef.current = next;
          setState(next);
          docRef.current = merged;
          setDoc(merged);
        } else receive(next);
      });
    soundQueue.current = task;
    return task;
  }
  async function playSound(sourceId: string) {
    if (!gm) throw Error('Somente o mestre controla os sons da mesa.');
    sounds.unlock();
    const board = sounds.snapshot?.soundboard || docRef.current!.soundboard,
      settings = soundSettings(sourceId, board);
    await soundCommand(
      sounds.active(sourceId) && settings.loop
        ? { kind: 'stop', sourceId }
        : { kind: 'play', sourceId },
    );
  }
  async function saveEffect(preset: EffectPreset) {
    edit((d) => {
      const i = d.effects.findIndex((e) => e.id === preset.id);
      if (i < 0) d.effects.push(preset);
      else d.effects[i] = preset;
    });
    await save();
  }
  async function applyEffect(id: string) {
    if (!gm || !selectedEffectTokens.length)
      throw Error('Selecione um ou mais tokens para aplicar o efeito.');
    await save();
    receive(
      await post<VttState>(`/vtt/rooms/${state!.id}/effects/${id}/apply`, {
        tokenIds: selectedEffectTokens.map((t) => t.id),
      }),
    );
  }
  async function shareSpell(name: string) {
    const found =
      catalog.spells.find((s) => s.name.toLowerCase() === name.toLowerCase()) ||
      doc?.custom.find((s) => s.kind === 'spell' && s.name.toLowerCase() === name.toLowerCase());
    if (!found) throw Error('Magia não encontrada na biblioteca da mesa.');
    await send('', '', found.id);
    setTab('chat');
  }
  function beginAttack(request: AttackRequest) {
    if (attackBusy || spectator) return;
    const actor = scene?.tokens.find((t) => t.id === request.actorId);
    if (!actor || (!gm && actor.controller !== user.id)) {
      setNotice('Você precisa controlar o token atacante.');
      return;
    }
    if (attackTargetId === actor.id) setAttackTargetId(null);
    changeLayer('tokens');
    setSelection([actor.id]);
    setTool('select');
    setSheetId(null);
    setAttack(request);
  }
  async function send(
    formulaValue = '',
    textValue = chat,
    spellId?: string,
    damage?: { actor_id: string; target_id: string },
    attackVisual?: AttackVisualCommand,
  ) {
    if (spectator) throw Error('Espectadores podem somente assistir à mesa.');
    await save();
    const next = await post<VttState & { createdMessageId: string }>(
      `/vtt/rooms/${state!.id}/messages`,
      {
        ...(spellId ? { spell_id: spellId } : {}),
        ...(damage ? { damage } : {}),
        ...(attackVisual ? { attack_visual: attackVisual } : {}),
        text: textValue,
        formula: formulaValue,
        private: privateRoll,
      },
    );
    setState(next);
    stateRef.current = next;
    setChat('');
    const rolled = next.messages.find((m) => m.id === next.createdMessageId)?.roll;
    return rolled ? { ...rolled, messageId: next.createdMessageId } : null;
  }
  async function applyRolledDamage(messageIds: string[], tokenId: string) {
    await save();
    const next = await post<VttState>(`/vtt/rooms/${state!.id}/damage`, {
      message_ids: messageIds,
      token_id: tokenId,
    });
    receive(next);
    const applied = new Set(messageIds);
    setOlderMessages((old) =>
      old.map((m) =>
        applied.has(m.id) ? { ...m, applied: [...new Set([...(m.applied || []), tokenId])] } : m,
      ),
    );
  }
  async function discardRolledDamage(messageIds: string[]) {
    await save();
    receive(
      await post<VttState>(`/vtt/rooms/${state!.id}/damage/discard`, { message_ids: messageIds }),
    );
  }
  async function importMonsterPreset(id: string, at: Point = camera) {
    await save();
    const before = new Set(scene?.tokens.map((t) => t.id));
    const next = await post<VttState>(
      `/vtt/rooms/${state!.id}/monster-presets/${id}/import`,
      snapPoint(at, scene!.grid),
    );
    receive(next);
    setPresetVersion((v) => v + 1);
    const added = next.document.scenes
      .find((s) => s.id === next.document.activeScene)
      ?.tokens.find((t) => !before.has(t.id));
    if (added) setSelection([added.id]);
  }
  useLayoutEffect(() => {
    const element = chatLog.current;
    if (!element) return;
    if (chatHistoryAnchor.current) {
      const anchor = chatHistoryAnchor.current;
      element.scrollTop = anchor.top + element.scrollHeight - anchor.height;
      chatHistoryAnchor.current = null;
    } else if (chatStick.current) element.scrollTop = element.scrollHeight;
    else element.scrollTop = chatTop.current;
    chatTop.current = element.scrollTop;
  }, [state?.id, state?.messages, olderMessages, tab, panelOpen]);
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
                const next = await post<VttState>('/vtt/join', {
                  invite: inviteInput.trim(),
                  role: joinRole,
                });
                receive(next);
              });
            }}
          >
            <label>
              Código de convite
              <input value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} />
            </label>
            <label>
              Entrar como
              <select
                aria-label="Entrar como"
                value={joinRole}
                onChange={(e) => setJoinRole(e.target.value as 'player' | 'spectator')}
              >
                <option value="player">Jogador · trazer meus personagens</option>
                <option value="spectator">Espectador · somente assistir</option>
              </select>
            </label>
            <button>Entrar na mesa</button>
          </form>
        </div>
      </section>
    );
  return (
    <section
      className="vtt-workspace"
      data-visual-effects={visualEffects ? 'on' : 'off'}
      aria-label="Mesa virtual"
    >
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
        {!gm && (
          <div className="vtt-participation">
            {!gm && (
              <select
                aria-label="Participação na mesa"
                value={state.role}
                disabled={busy}
                onChange={(e) =>
                  void act(async () => {
                    receive(
                      await post<VttState>(`/vtt/rooms/${state.id}/participation`, {
                        role: e.target.value,
                      }),
                    );
                    setSelection([]);
                    setSheetId(null);
                  })
                }
              >
                <option value="player">Jogador</option>
                <option value="spectator">Espectador</option>
              </select>
            )}
            {spectator && (
              <select
                aria-label="Ver pela visão de"
                value={state.viewingUser || ''}
                onChange={(e) =>
                  void act(async () =>
                    receive(
                      await api<VttState>(`/vtt/rooms/${state.id}/viewpoint`, {
                        method: 'PUT',
                        body: JSON.stringify({ userId: e.target.value || null }),
                      }),
                    ),
                  )
                }
              >
                <option value="">Escolher visão do jogador</option>
                {state.viewpoints.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <div className="vtt-top-actions">
          {gm && (
            <button
              aria-label="Biblioteca de mapas"
              title="Biblioteca de mapas"
              onClick={() => setMapsOpen(true)}
            >
              <MapIcon size={18} />
            </button>
          )}
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
          {gm && (
            <VttToolGroup
              label="Camadas"
              selected={layer}
              icon={Layers}
              options={[
                { id: 'map', name: 'Fundo · visível aos jogadores', icon: Image },
                { id: 'tokens', name: 'Tokens · jogadores', icon: Users },
                { id: 'gm', name: 'Mestre · oculto', icon: EyeOff },
                { id: 'lighting', name: 'Iluminação e barreiras', icon: Lightbulb },
              ]}
              choose={changeLayer}
            />
          )}
          {!spectator && (
            <button
              aria-label="Escolher dados"
              title="Escolher dados"
              aria-pressed={diceOpen}
              onClick={() => setDiceOpen((v) => !v)}
            >
              <Dices size={20} />
            </button>
          )}
          {toolList
            .filter(
              (t) =>
                (spectator ? t.id === 'pan' : gm || !t.gm) &&
                (!barrierTools.has(t.id) || barrierEditing),
            )
            .map(({ id, name, icon: Icon }) =>
              ['circle', 'cone', 'line', 'hide'].includes(id) ? null : id === 'rect' ? (
                <VttToolGroup
                  key="forms"
                  label="Formas"
                  options={toolList.filter((t) =>
                    ['rect', 'circle', 'cone', 'line'].includes(t.id),
                  )}
                  selected={tool}
                  choose={(id) => {
                    setFogPoints([]);
                    setFogPointer(null);
                    setDraft(null);
                    if (layer === 'lighting') changeLayer('tokens');
                    setTool(id as Tool);
                  }}
                />
              ) : id === 'reveal' ? (
                <VttToolGroup
                  key="fog"
                  label="Névoa"
                  selected={['reveal', 'hide'].includes(tool) ? tool + '-' + fogShape : ''}
                  options={[
                    { id: 'reveal-rect', name: 'Revelar área', icon: Eye },
                    { id: 'reveal-polygon', name: 'Revelar polígono', icon: Triangle },
                    { id: 'hide-rect', name: 'Ocultar área', icon: EyeOff },
                    { id: 'hide-polygon', name: 'Ocultar polígono', icon: Triangle },
                    { id: 'reveal-brush', name: 'Revelar com pincel', icon: Circle },
                    { id: 'hide-brush', name: 'Ocultar com pincel', icon: Circle },
                    { id: 'automatic', name: 'Visão automática dos tokens', icon: Eye },
                    { id: 'reset', name: 'Reiniciar névoa', icon: Trash2 },
                  ]}
                  choose={(id) => {
                    setFogPoints([]);
                    setFogPointer(null);
                    setDraft(null);
                    if (id === 'automatic') {
                      editScene(activateTokenVision);
                      setTool('select');
                    } else if (id === 'reset') {
                      editScene((s) => {
                        s.fog = true;
                        s.fogMode = 'manual';
                        s.lighting = false;
                        s.reveals = [];
                        s.fogAreas = [];
                      });
                      setTool('select');
                    } else {
                      const [mode, shape] = id.split('-');
                      setTool(mode as Tool);
                      setFogShape(shape as typeof fogShape);
                    }
                  }}
                />
              ) : (
                <button
                  key={id}
                  title={
                    id === 'lasso'
                      ? 'Seleção livre (L) · Arraste um contorno. Shift adiciona à seleção.'
                      : name
                  }
                  aria-label={name}
                  aria-pressed={tool === id}
                  disabled={id === 'lasso' && preview}
                  onClick={() => {
                    setLasso([]);
                    drag.current = null;
                    setFogPoints([]);
                    setFogPointer(null);
                    setContextMenu(null);
                    if (['wall', 'door', 'window', 'light'].includes(id)) {
                      setSelection([]);
                    } else if (
                      layer === 'lighting' &&
                      ['pen', 'rect', 'circle', 'cone', 'line', 'text'].includes(id)
                    )
                      changeLayer('tokens');
                    setTool(id);
                    setDraft(null);
                  }}
                >
                  <Icon size={19} />
                </button>
              ),
            )}
          {gm && (
            <>
              <div className="vtt-tool-separator" />
              <button
                aria-label="Excluir objetos selecionados"
                title="Excluir seleção (Delete)"
                disabled={!selection.length}
                onClick={removeSelected}
              >
                <Trash2 size={18} />
              </button>
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
          <VttDice messages={state.messages} roomId={state.id} enabled={dice3d && visualEffects} />
          <VttAttackVisuals
            roomId={state.id}
            messages={state.messages}
            scene={scene}
            camera={camera}
            bounds={bounds}
            enabled={visualEffects}
            gm={gm}
            preview={preview}
            viewer={viewer}
            soundEnabled={media.soundEnabled}
            soundVolume={media.soundVolume}
          />
          <VttEffectSounds
            roomId={state.id}
            scene={scene}
            gm={gm}
            preview={preview}
            viewer={viewer}
            enabled={media.soundEnabled}
            volume={media.soundVolume}
          />
          <VttBossBars
            bars={gm ? sceneBossBars(scene) : state.bossBars}
            visualEffects={visualEffects}
          />
          {!spectator && (
            <VttHotbar
              key={state.id}
              roomId={state.id}
              tokens={scene.tokens}
              sheetOpen={!!sheetId}
              roll={(formula, label, damage, visual) =>
                send(formula, label, undefined, damage, visual)
              }
              shareSpell={shareSpell}
              refresh={refreshRoom}
              gm={gm}
              applyEffect={applyEffect}
              playSound={playSound}
              soundActive={sounds.active}
              openSound={() => {
                setTab('music');
                setPanelOpen(true);
              }}
              onAttack={beginAttack}
              attack={attack}
              target={attackTarget}
              selectedTokenId={token?.id}
              attackBusy={attackBusy}
              onAttackBusy={setAttackBusy}
              applyDamage={
                gm || attackTarget?.controller === user.id ? applyRolledDamage : undefined
              }
              discardDamage={discardRolledDamage}
              closeAttack={() => setAttack(null)}
            />
          )}
          {gm && !sheetId && (
            <VttEffects
              presets={doc.effects}
              visualEffects={visualEffects}
              tokens={selectedEffectTokens}
              busy={busy}
              preview={(preset) =>
                setEffectPreview(
                  preset && selectedEffectTokens.length
                    ? { tokenIds: selectedEffectTokens.map((t) => t.id), preset, at: Date.now() }
                    : null,
                )
              }
              save={saveEffect}
              remove={async (id) => {
                edit((d) => {
                  d.effects = d.effects.filter((e) => e.id !== id);
                });
                await save();
              }}
              apply={applyEffect}
              clear={async () => {
                if (selectedEffectTokens.length) {
                  await save();
                  editSelected((t) => {
                    if (t.layer !== 'map') {
                      t.deathAt = null;
                      t.effects = [];
                    }
                  });
                  await save();
                }
              }}
              editDeath={async (patch) => {
                if (selectedEffectTokens.length) {
                  if (!('deathAutomatic' in patch)) await save();
                  editSelected((t) => {
                    if (t.layer !== 'map') Object.assign(t, patch);
                  });
                  await save();
                }
              }}
            />
          )}
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
            onDragOver={(e) => {
              if (gm && !preview && e.dataTransfer.types.includes(monsterMime)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }
            }}
            onDrop={(e) => {
              if (!gm || preview || !e.dataTransfer.types.includes(monsterMime)) return;
              e.preventDefault();
              const id = e.dataTransfer.getData(monsterMime);
              if (id.startsWith('preset:')) {
                void act(() => importMonsterPreset(id.slice(7), point(e)));
                return;
              }
              if (id.startsWith('premium:')) {
                const monster = catalog.monsters.find((m) => m.id === id.slice(8));
                if (monster)
                  addMonster(
                    { ...monster, image: '/api/vtt/premium-art/' + monster.id },
                    point(e),
                    true,
                  );
                return;
              }
              const monster = [
                ...catalog.monsters,
                ...doc.custom.filter((e) => e.kind === 'monster'),
              ].find((e) => e.id === id);
              if (monster) addMonster(monster, point(e), true);
            }}
            data-attacker-id={token?.layer === 'tokens' ? token.id : undefined}
            data-camera-x={camera.x}
            data-camera-y={camera.y}
            data-camera-zoom={camera.zoom}
            data-target-id={attackTarget?.id}
            data-selection-count={selection.length}
            data-selection-ids={selection.join(',')}
            onPointerCancel={() => {
              setLasso([]);
              setFogPoints([]);
              setFogPointer(null);
              setRuler([]);
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
              if (spectator || preview || attackBusy) return;
              setTool('select');
              const p = point(e),
                hit = tokenAt(p, scene, gm ? '*' : 'tokens', gm);
              if (hit) {
                changeLayer(hit.layer, selection.includes(hit.id) ? selection : [hit.id]);
                if (!selection.includes(hit.id)) setSelection([hit.id]);
                setAttackTargetId(null);
              } else if (gm) {
                const light = barrierEditing
                  ? scene.lights.find((l) => Math.hypot(p.x - l.x, p.y - l.y) < 18 / camera.zoom)
                  : null;
                const wall =
                  barrierEditing && showWalls
                    ? scene.walls.find((w) => segmentDistance(p, w.a, w.b) < 9 / camera.zoom)
                    : null;
                const drawing = drawingAt(p, scene, layer, 8 / camera.zoom);
                if (!(light || wall || drawing)) {
                  setContextMenu(null);
                  return;
                }
                setSelection([(light || wall || drawing)!.id]);
                setTab('scene');
              } else return;
              setContextMenu({
                x: Math.max(8, Math.min(e.clientX, innerWidth - 270)),
                y: Math.max(8, Math.min(e.clientY, innerHeight - 520)),
              });
            }}
            onWheel={(e) => {
              e.preventDefault();
              cancelAnimationFrame(focusFrame.current);
              const p = point(e),
                zoom = Math.min(5, Math.max(0.03, camera.zoom * Math.exp(-e.deltaY * 0.0015)));
              const rect = e.currentTarget.getBoundingClientRect(),
                dx = e.clientX - rect.left - bounds.width / 2,
                dy = e.clientY - rect.top - bounds.height / 2;
              setCamera({ zoom, x: p.x - dx / zoom, y: p.y - dy / zoom });
            }}
            onDoubleClick={(e) => {
              if (spectator || attackBusy) return;
              if (['reveal', 'hide'].includes(tool) && fogPoints.length >= 3) {
                commitFog(fogPoints);
                return;
              }
              const p = point(e);
              const door =
                barrierEditing && showWalls
                  ? scene.walls.find(
                      (w) =>
                        w.kind === 'door' &&
                        Math.hypot((w.a.x + w.b.x) / 2 - p.x, (w.a.y + w.b.y) / 2 - p.y) <
                          30 / camera.zoom,
                    )
                  : undefined;
              if (gm && door)
                editScene((s) => {
                  s.walls.find((w) => w.id === door.id)!.open = !door.open;
                });
              else {
                const hit = tokenAt(p, scene, gm ? '*' : 'tokens', gm);
                if (hit) {
                  setSelection([hit.id]);
                  setAttackTargetId(null);
                  openSheet(hit);
                }
              }
            }}
          />
          <VttTurnCarousel
            controls={combat}
            gm={gm}
            open={() => {
              setTab('combat');
              setPanelOpen(true);
            }}
          />
          {diceOpen && !spectator && (
            <div className="vtt-dice-picker" role="dialog" aria-label="Lançador de dados">
              <header>
                <strong>Lançar dados</strong>
                <button aria-label="Fechar lançador" onClick={() => setDiceOpen(false)}>
                  <X size={15} />
                </button>
              </header>
              <div className="vtt-dice-buttons">
                {[4, 6, 8, 10, 12, 20, 100].map((n) => (
                  <div className="vtt-dice-row" key={n}>
                    <button
                      aria-label={'Rolar 1d' + n}
                      disabled={busy || spectator}
                      onClick={() => {
                        setDiceSides(n);
                        setDiceCount(1);
                        void act(() =>
                          send(
                            '1d' +
                              n +
                              (diceModifier ? (diceModifier > 0 ? '+' : '') + diceModifier : ''),
                            '',
                          ),
                        );
                      }}
                    >
                      <DiceIcon sides={n} />D{n}
                    </button>
                    {[2, 3, 4, 5, 6].map((count) => (
                      <button
                        key={count}
                        aria-label={'Rolar ' + count + 'd' + n}
                        disabled={busy}
                        onClick={() => {
                          setDiceSides(n);
                          setDiceCount(count);
                          void act(() =>
                            send(
                              count +
                                'd' +
                                n +
                                (diceModifier ? (diceModifier > 0 ? '+' : '') + diceModifier : ''),
                              '',
                            ),
                          );
                        }}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <label>
                Fórmula personalizada
                <input
                  aria-label="Fórmula personalizada"
                  value={formula}
                  maxLength={100}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="4d6kh3"
                />
              </label>
              <button
                disabled={busy || !formula.trim()}
                onClick={() => void act(() => send(formula, ''))}
              >
                Rolar fórmula
              </button>
              <VttRollHelp />
              <label>
                Tipo de dado
                <select
                  aria-label="Tipo de dado manual"
                  value={diceSides}
                  onChange={(e) => setDiceSides(Number(e.target.value))}
                >
                  {[4, 6, 8, 10, 12, 20, 100].map((n) => (
                    <option key={n} value={n}>
                      D{n}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                label="Quantidade de dados"
                value={diceCount}
                min={1}
                max={100}
                onChange={setDiceCount}
              />
              <NumberField
                label="Modificador dos dados"
                value={diceModifier}
                min={-9999}
                max={9999}
                onChange={setDiceModifier}
              />
              <label className="vtt-check">
                <input
                  type="checkbox"
                  checked={dice3d}
                  onChange={(e) => setDice3d(e.target.checked)}
                />
                Dados 3D no tabuleiro
              </label>
              <label className="vtt-check">
                <input
                  type="checkbox"
                  checked={privateRoll}
                  onChange={(e) => setPrivateRoll(e.target.checked)}
                />
                Somente você e o mestre
              </label>
              <button
                className="vtt-gold"
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    send(
                      diceCount +
                        'd' +
                        diceSides +
                        (diceModifier ? (diceModifier > 0 ? '+' : '') + diceModifier : ''),
                      '',
                    ),
                  )
                }
              >
                Rolar {diceCount}d{diceSides}
              </button>
              {diceSides === 100 && <small>Percentual: dois d10, dezenas e unidades.</small>}
            </div>
          )}
          <div className="vtt-scene-pills">
            {gm && tool === 'lasso' && !preview && (
              <span role="status">
                Seleção livre · {selection.length} {selection.length === 1 ? 'objeto' : 'objetos'} ·
                Arraste o contorno · Shift adiciona · Delete exclui
              </span>
            )}
            {['reveal', 'hide'].includes(tool) && fogShape === 'polygon' && (
              <span>
                Clique nos vértices · Enter ou duplo clique para concluir · Esc para cancelar
              </span>
            )}
            <span>{scene.name}</span>
            {gm && (
              <button
                className={preview ? 'is-active' : ''}
                aria-pressed={preview}
                onClick={() => {
                  setPreviewViewerId(
                    preview
                      ? null
                      : token?.layer === 'tokens' && !token.hidden
                        ? token.id
                        : viewer?.id || null,
                  );
                  setPreview((v) => !v);
                }}
              >
                <Eye size={14} />
                Visão do jogador
              </button>
            )}
          </div>
          {gm && ['pen', 'rect', 'circle', 'cone', 'line', 'text'].includes(tool) && (
            <div className="vtt-draw-controls" aria-label="Opções de desenho">
              {['#dac28e', '#f0f0e7', '#22262e', '#de665b', '#72a586', '#71add1', '#ad83cd'].map(
                (color, i) => (
                  <button
                    key={color}
                    aria-label={
                      'Cor ' +
                      ['dourada', 'branca', 'escura', 'vermelha', 'verde', 'azul', 'roxa'][i]
                    }
                    aria-pressed={brushColor === color}
                    style={{ background: color }}
                    onClick={() => setBrushColor(color)}
                  />
                ),
              )}
              <label>
                Cor livre
                <input
                  aria-label="Cor livre da caneta"
                  type="color"
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                />
              </label>
              <NumberField
                label="Traço"
                value={brushWidth}
                min={1}
                max={100}
                onChange={setBrushWidth}
              />
            </div>
          )}
          <div className="vtt-map-footer">
            <span>
              {spectator
                ? 'Espectador · somente visualização'
                : effectPreview
                  ? 'Prévia do efeito · ainda não aplicado'
                  : ''}
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
          {gm && textEdit && (
            <div
              className="vtt-text-editor"
              style={{ left: textEdit.x, top: textEdit.y }}
              role="group"
              aria-label="Inserir texto no mapa"
            >
              <textarea
                autoFocus
                aria-label="Texto no mapa"
                placeholder="Digite o texto…"
                maxLength={500}
                rows={3}
                value={textEdit.value}
                onChange={(e) => setTextEdit({ ...textEdit, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setTextEdit(null);
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    commitText();
                  }
                }}
              />
              <div>
                <button disabled={!textEdit.value.trim()} onClick={commitText}>
                  Inserir texto
                </button>
                <button onClick={() => setTextEdit(null)}>Cancelar</button>
              </div>
              <small>Enter para inserir · Shift + Enter para nova linha</small>
            </div>
          )}
        </div>
        {panelOpen && (
          <aside className="vtt-panel">
            <nav className="vtt-panel-tabs" aria-label="Painéis da mesa">
              {tabs.map(({ id, name, icon: Icon }) => (
                <button
                  key={id}
                  aria-label={name}
                  title={name}
                  aria-pressed={
                    tab === id ||
                    (id === 'sheet' && (tab === 'token' || tab === 'journal')) ||
                    (id === 'table' && (tab === 'scene' || tab === 'help'))
                  }
                  onClick={() => {
                    setTab(id);
                    if (id === 'art') {
                      setLibrary('images');
                      setQuery('');
                      setEntry(null);
                    }
                    if (id === 'library' && library === 'images') {
                      setLibrary('monsters');
                      setQuery('');
                      setEntry(null);
                    }
                  }}
                >
                  <Icon size={17} />
                </button>
              ))}
            </nav>
            <div className={'vtt-panel-content' + (tab === 'chat' ? ' vtt-chat-panel' : '')}>
              <div className="vtt-panel-heading">
                <h2 hidden={tab === 'chat' && chatControlsCollapsed}>
                  {
                    tabs.find(
                      (t) =>
                        t.id ===
                        (tab === 'token' || tab === 'journal'
                          ? 'sheet'
                          : tab === 'scene' || tab === 'help'
                            ? 'table'
                            : tab),
                    )?.name
                  }
                </h2>
                {tab === 'chat' && (
                  <button
                    className="vtt-chat-collapse"
                    aria-expanded={!chatControlsCollapsed}
                    aria-controls="vtt-chat-controls"
                    onClick={() => customizeChatControls(!chatControlsCollapsed)}
                    title={
                      chatControlsCollapsed
                        ? 'Mostrar controles do chat'
                        : 'Minimizar controles do chat'
                    }
                  >
                    {chatControlsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    {chatControlsCollapsed ? 'Mostrar controles do chat' : 'Minimizar'}
                  </button>
                )}
                {gm && tab === 'token' && (
                  <button className="vtt-gold" onClick={newMarker}>
                    <Plus size={14} />
                    Token
                  </button>
                )}
              </div>
              {['sheet', 'token', 'journal'].includes(tab) && (
                <div className="vtt-subtabs">
                  <button aria-pressed={tab === 'sheet'} onClick={() => setTab('sheet')}>
                    Personagens
                  </button>
                  <button aria-pressed={tab === 'token'} onClick={() => setTab('token')}>
                    Token selecionado
                  </button>
                  <button aria-pressed={tab === 'journal'} onClick={() => setTab('journal')}>
                    Diário
                  </button>
                </div>
              )}
              {['table', 'scene', 'help'].includes(tab) && (
                <div className="vtt-subtabs">
                  <button aria-pressed={tab === 'table'} onClick={() => setTab('table')}>
                    Mesa
                  </button>
                  <button aria-pressed={tab === 'scene'} onClick={() => setTab('scene')}>
                    Mapa
                  </button>
                  <button aria-pressed={tab === 'help'} onClick={() => setTab('help')}>
                    <HelpCircle size={13} /> Ajuda
                  </button>
                </div>
              )}
              {tab === 'scene' && (
                <>
                  <label>
                    Mapa ativo
                    <select
                      value={scene.id}
                      onChange={(e) => openMap(e.target.value)}
                      disabled={!gm}
                    >
                      {doc.scenes
                        .filter((s) => !s.archived)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p className="vtt-muted">
                    {scene.width} × {scene.height} px ·{' '}
                    {scene.grid.type === 'none' ? 'sem grade' : scene.grid.size + ' px por célula'}
                  </p>
                  {gm && (
                    <>
                      <div className="vtt-row">
                        <button onClick={() => setMapsOpen(true)}>
                          <MapIcon size={15} />
                          Biblioteca de mapas
                        </button>
                        <button onClick={() => setSettingsId(scene.id)}>
                          <Settings2 size={15} />
                          Configurar mapa
                        </button>
                        <button onClick={() => createMap()}>
                          <Plus size={14} />
                          Novo mapa
                        </button>
                      </div>
                      <h3>Camadas</h3>
                      <label>
                        Opacidade da camada do mestre
                        <input
                          aria-label="Opacidade da camada do mestre"
                          type="range"
                          min=".05"
                          max="1"
                          step=".01"
                          value={scene.gmOpacity}
                          onChange={(e) =>
                            editScene((s) => {
                              s.gmOpacity = Number(e.target.value);
                            })
                          }
                        />
                        <span>{Math.round(scene.gmOpacity * 100)}%</span>
                      </label>
                      {selectedLight && (
                        <div className="vtt-object-detail">
                          <h3>Fonte de luz</h3>
                          <label>
                            Nome da luz
                            <input
                              value={selectedLight.name}
                              onChange={(e) =>
                                editScene((s) => {
                                  s.lights.find((l) => l.id === selectedLight.id)!.name =
                                    e.target.value || 'Fonte de luz';
                                })
                              }
                            />
                          </label>
                          <div className="vtt-two">
                            {(['bright', 'dim', 'x', 'y', 'angle', 'rotation'] as const).map(
                              (key) => (
                                <NumberField
                                  key={key}
                                  label={
                                    {
                                      bright: 'Luz forte',
                                      dim: 'Luz fraca adicional',
                                      x: 'Posição X da luz',
                                      y: 'Posição Y da luz',
                                      angle: 'Ângulo da luz',
                                      rotation: 'Rotação da luz',
                                    }[key]
                                  }
                                  value={selectedLight[key]}
                                  min={key === 'rotation' ? -360 : key === 'angle' ? 1 : 0}
                                  max={
                                    key === 'rotation' || key === 'angle'
                                      ? 360
                                      : key === 'bright' || key === 'dim'
                                        ? 10000
                                        : 16000
                                  }
                                  onChange={(n) =>
                                    editScene((s) => {
                                      s.lights.find((l) => l.id === selectedLight.id)![key] = n;
                                    })
                                  }
                                />
                              ),
                            )}
                          </div>
                          <label>
                            Cor da luz
                            <input
                              type="color"
                              value={selectedLight.color}
                              onChange={(e) =>
                                editScene((s) => {
                                  s.lights.find((l) => l.id === selectedLight.id)!.color =
                                    e.target.value;
                                })
                              }
                            />
                          </label>
                          <label className="vtt-check">
                            <input
                              type="checkbox"
                              checked={selectedLight.enabled}
                              onChange={(e) =>
                                editScene((s) => {
                                  s.lights.find((l) => l.id === selectedLight.id)!.enabled =
                                    e.target.checked;
                                })
                              }
                            />
                            Luz acesa
                          </label>
                          <button onClick={removeSelected}>
                            <Trash2 size={14} />
                            Excluir luz selecionada
                          </button>
                        </div>
                      )}
                      {(selectedDrawing || selectedWall) && (
                        <div className="vtt-object-detail">
                          <h3>{selectedWall ? 'Barreira selecionada' : 'Desenho selecionado'}</h3>
                          {selectedWall?.kind === 'door' && (
                            <button
                              onClick={() =>
                                editScene((s) => {
                                  s.walls.find((w) => w.id === selectedWall.id)!.open =
                                    !selectedWall.open;
                                })
                              }
                            >
                              {selectedWall.open ? 'Fechar porta' : 'Abrir porta'}
                            </button>
                          )}
                          <button onClick={removeSelected}>
                            <Trash2 size={14} />
                            Excluir objeto selecionado
                          </button>
                        </div>
                      )}
                      {barrierEditing && (
                        <label className="vtt-check">
                          <input
                            type="checkbox"
                            checked={showWalls}
                            onChange={(e) => {
                              setShowWalls(e.target.checked);
                              if (!e.target.checked)
                                setSelection((ids) =>
                                  ids.filter((id) => !scene.walls.some((w) => w.id === id)),
                                );
                            }}
                          />
                          Mostrar barreiras do mestre
                        </label>
                      )}
                      <div className="vtt-row">
                        <button
                          onClick={() =>
                            editScene((s) => {
                              s.fog = true;
                              s.fogMode = 'manual';
                              s.lighting = false;
                              s.fogAreas = [];
                              s.reveals = [
                                {
                                  x: s.width / 2,
                                  y: s.height / 2,
                                  radius: Math.hypot(s.width, s.height),
                                },
                              ];
                            })
                          }
                        >
                          Revelar tudo
                        </button>
                        <button
                          onClick={() =>
                            editScene((s) => {
                              s.reveals = [];
                              s.fogAreas = [];
                              s.lighting = false;
                              s.fog = true;
                              s.fogMode = 'manual';
                            })
                          }
                        >
                          Ocultar tudo
                        </button>
                      </div>
                      {barrierEditing && (
                        <>
                          <h3>Paredes, portas e janelas</h3>
                          {scene.walls.map((w, i) => (
                            <div className="vtt-list-row" key={w.id}>
                              <span>
                                {w.kind === 'wall'
                                  ? 'Parede'
                                  : w.kind === 'door'
                                    ? 'Porta'
                                    : 'Janela'}{' '}
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
                        </>
                      )}
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
                          max={gm ? 100000 : token.hp}
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
                          <h3>Barra de boss</h3>
                          <label>
                            Barra de boss
                            <select
                              aria-label="Estilo da barra de boss"
                              value={token.bossStyle ? visibleBossStyle(token.bossStyle) : ''}
                              onChange={(e) =>
                                editToken({
                                  bossStyle: e.target.value
                                    ? (e.target.value as VttToken['bossStyle'])
                                    : null,
                                })
                              }
                            >
                              <option value="">Não mostrar barra</option>
                              {bossStyles.map((style, i) => (
                                <option key={style} value={style}>
                                  {bossStyleNames[i]}
                                </option>
                              ))}
                            </select>
                          </label>
                          {monsterArt('', token.name) && (
                            <button
                              onClick={() => editToken({ image: monsterArt('', token.name) })}
                            >
                              Usar arte do monstro
                            </button>
                          )}
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
                          <NumberField
                            label="Nível de profundidade"
                            value={token.level}
                            min={-10000}
                            max={10000}
                            step={0.1}
                            onChange={(n) => editToken({ level: n })}
                          />
                          <p className="vtt-muted">0,1 à frente de 0; −0,1 atrás de 0.</p>
                          <div className="vtt-row">
                            <button onClick={() => editToken({ flipX: !token.flipX })}>
                              <FlipHorizontal2 size={15} />
                              Espelhar horizontal
                            </button>
                            <button onClick={() => editToken({ flipY: !token.flipY })}>
                              <FlipVertical2 size={15} />
                              Espelhar vertical
                            </button>
                          </div>
                          <label>
                            Controlado por
                            <select
                              value={token.controller || ''}
                              onChange={(e) => editToken({ controller: e.target.value || null })}
                            >
                              <option value="">Somente mestre</option>
                              {state.members
                                .filter((m) => m.id === user.id || m.role !== 'spectator')
                                .map((m) => (
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
                              setTab('art');
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
                            disabled={!canToken || (!gm && token.conditions.includes(c))}
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
                      <button onClick={() => openSheet()}>Abrir ficha do token</button>
                    </>
                  )}
                </>
              )}
              {(tab === 'library' || tab === 'art') && (
                <>
                  {tab === 'library' && (
                    <div className="vtt-subtabs">
                      {(['monsters', 'presets', 'premium', 'spells'] as const).map((k) => (
                        <button
                          key={k}
                          aria-pressed={library === k}
                          onClick={() => {
                            setLibrary(k);
                            setQuery('');
                            setEntry(null);
                            if (k === 'presets' || k === 'premium') setPresetVersion((v) => v + 1);
                          }}
                        >
                          {
                            {
                              monsters: 'Monstros',
                              presets: 'Presets de monstros',
                              premium: 'Galeria de monstros',
                              spells: 'Magias',
                            }[k]
                          }
                        </button>
                      ))}
                    </div>
                  )}
                  <label className="vtt-search">
                    Buscar na biblioteca
                    <input
                      aria-label="Buscar na biblioteca"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Nome, tipo, nível…"
                    />
                  </label>
                  {gm && library !== 'presets' && library !== 'premium' && (
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
                  {library === 'presets' || library === 'premium' ? (
                    <VttPrivateLibrary
                      kind={library}
                      gm={gm && !preview}
                      viewMonsters={() => {
                        setLibrary('monsters');
                        setQuery('');
                        setEntry(null);
                      }}
                      query={query}
                      loadKey={presetVersion}
                      importPreset={importMonsterPreset}
                      importPremium={(m) => addMonster(m as Entry)}
                      drag={dragMonster}
                    />
                  ) : library === 'images' ? (
                    <>
                      <details className="vtt-monster-gallery">
                        <summary>Tokens dos monstros · {catalog.monsters.length}</summary>
                        <div className="vtt-asset-grid">
                          {catalog.monsters
                            .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
                            .map((e) => (
                              <div
                                className="vtt-asset"
                                key={e.id}
                                draggable={gm && !preview}
                                onDragStart={(event) => dragMonster(event, e.id)}
                                title={gm ? 'Arraste para a mesa' : ''}
                              >
                                <img
                                  loading="lazy"
                                  src={e.image || monsterArt(e.id, e.name)}
                                  alt={e.name}
                                  draggable={false}
                                />
                                <span>{e.name}</span>
                                {gm && (
                                  <button onClick={() => addMonster(e)}>Adicionar token</button>
                                )}
                              </div>
                            ))}
                        </div>
                      </details>
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
                          {library === 'spells' && <h3>{entry.name}</h3>}
                          {library === 'spells' && (
                            <p>
                              {entry.source || 'Importação da mesa'} ·{' '}
                              {`Nível ${entry.level} · ${entry.school || ''}`}
                            </p>
                          )}
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
                          {library === 'spells' && entry.stats && (
                            <div className="vtt-stats">
                              {entry.stats.map((v, i) => (
                                <span key={i}>
                                  {['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'][i]}
                                  <b>{v}</b>
                                </span>
                              ))}
                            </div>
                          )}
                          {library === 'monsters' ? (
                            <VttMonsterStatblock
                              compact
                              monster={{
                                ...entryProfile(entry),
                                actionDetails:
                                  token?.name === entry.name ? token.sheet?.details : undefined,
                              }}
                              tokenId={token?.name === entry.name ? token.id : undefined}
                              gm={gm && !preview}
                              roll={send}
                              useAction={
                                token?.name === entry.name
                                  ? (action) => useMonsterAction(token, action)
                                  : undefined
                              }
                            />
                          ) : (
                            <pre>{entry.details}</pre>
                          )}
                          {gm && library === 'monsters' && (
                            <button className="vtt-gold" onClick={() => addMonster(entry)}>
                              Adicionar ao tabuleiro
                            </button>
                          )}
                          {library === 'spells' && (
                            <button onClick={() => void act(() => send('', '', entry.id))}>
                              Compartilhar no chat
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <p className="vtt-muted">
                            {catalog[library].length} entradas SRD 2024 · textos em inglês
                          </p>
                          {gm && library === 'monsters' && (
                            <p className="vtt-muted">Arraste um monstro para colocá-lo na mesa.</p>
                          )}
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
                                <button
                                  key={e.id}
                                  onClick={() => setEntry(e)}
                                  draggable={library === 'monsters' && gm && !preview}
                                  onDragStart={(event) => dragMonster(event, e.id)}
                                  title={
                                    library === 'monsters' && gm
                                      ? 'Arraste para a mesa ou clique para ver a ficha'
                                      : undefined
                                  }
                                >
                                  {library === 'monsters' && monsterImage(e) && (
                                    <img
                                      className={
                                        'vtt-monster-thumbnail' +
                                        (monsterImage(e).startsWith('/api/vtt/premium-art/')
                                          ? ' premium'
                                          : '')
                                      }
                                      loading="lazy"
                                      src={monsterImage(e)}
                                      alt=""
                                      draggable={false}
                                    />
                                  )}
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
              {spectator && tab === 'sheet' && (
                <p className="vtt-muted">
                  Espectadores acompanham a mesa sem trazer fichas. Escolha a visão de um jogador no
                  topo.
                </p>
              )}
              {tab === 'sheet' && !spectator && (
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
                          const imported = s.tokens.find(
                            (t) => t.characterId === c.id && t.controller === user.id,
                          )!;
                          setSelection([imported.id]);
                          setSheetId(imported.id);
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
                      {(token.characterId || !token.sheet) && <h3>{token.name}</h3>}
                      {token.characterId && (
                        <button className="vtt-gold" onClick={() => openSheet()}>
                          Abrir folha completa
                        </button>
                      )}
                      {(token.characterId || !token.sheet) && (
                        <p>
                          PV {token.hp}/{token.maxHp} · CA {token.ac}
                        </p>
                      )}
                      {token.sheet ? (
                        <>
                          {token.characterId ? (
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
                            </>
                          ) : (
                            <>
                              <button className="vtt-gold" onClick={() => openSheet()}>
                                Abrir folha completa
                              </button>
                              <VttMonsterStatblock
                                compact
                                monster={tokenProfile(token)}
                                tokenId={token.id}
                                gm={gm && !preview}
                                roll={send}
                                useAction={(action) => useMonsterAction(token, action)}
                              />
                            </>
                          )}
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
                  <section id="vtt-chat-controls" hidden={chatControlsCollapsed}>
                    {!spectator && (
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
                      </>
                    )}
                    {!historyEnd && (
                      <button
                        onClick={() =>
                          void act(async () => {
                            const all = [...olderMessages, ...state.messages];
                            const first = all.reduce(
                              (a, b) => (BigInt(a.id) < BigInt(b.id) ? a : b),
                              all[0],
                            );
                            const next = await api<{ messages: VttMessage[]; has_more: boolean }>(
                              `/vtt/rooms/${state.id}/messages${first ? '?before=' + first.id : ''}`,
                            );
                            if (chatLog.current)
                              chatHistoryAnchor.current = {
                                height: chatLog.current.scrollHeight,
                                top: chatLog.current.scrollTop,
                              };
                            setOlderMessages((v) => [...next.messages, ...v]);
                            setHistoryEnd(!next.has_more);
                          })
                        }
                      >
                        Carregar histórico anterior
                      </button>
                    )}
                  </section>
                  <div
                    className="vtt-chat-log"
                    aria-live="polite"
                    ref={chatLog}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      chatStick.current = el.scrollHeight - el.clientHeight - el.scrollTop <= 2;
                      chatTop.current = el.scrollTop;
                    }}
                  >
                    {[
                      ...new Map(
                        [...olderMessages, ...state.messages].map((m) => [m.id, m]),
                      ).values(),
                    ]
                      .sort((a, b) => Number(BigInt(a.id) - BigInt(b.id)))
                      .map((m) => (
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
                          <VttChatText
                            text={m.text}
                            onMediaLoad={() => {
                              const log = chatLog.current;
                              if (log && chatStick.current) log.scrollTop = log.scrollHeight;
                            }}
                          />
                          {m.spell && (
                            <section className="vtt-spell-message">
                              <h3>{m.spell.name}</h3>
                              <small>
                                {m.spell.level === 0 ? 'Truque' : 'Nível ' + m.spell.level} ·{' '}
                                {m.spell.school}
                              </small>
                              <dl>
                                {[
                                  ['Conjuração', m.spell.time],
                                  ['Alcance', m.spell.range],
                                  ['Componentes', m.spell.components],
                                  ['Duração', m.spell.duration],
                                ]
                                  .filter(([, v]) => v)
                                  .map(([k, v]) => (
                                    <div key={k}>
                                      <dt>{k}</dt>
                                      <dd>{v}</dd>
                                    </div>
                                  ))}
                              </dl>
                              <p>{m.spell.details}</p>
                            </section>
                          )}
                          {m.roll && (
                            <div className="vtt-roll">
                              <span>
                                {m.roll.formula}
                                <small>{m.roll.dice.join(' · ')}</small>
                                {!!m.roll.highlights?.length && (
                                  <small>
                                    {m.roll.highlights
                                      .map(
                                        (h) =>
                                          (h.kind === 'surge'
                                            ? 'Resultado excepcional'
                                            : h.kind === 'mishap'
                                              ? 'Contratempo'
                                              : 'Repetição') +
                                          ': ' +
                                          h.value,
                                      )
                                      .join(' · ')}
                                  </small>
                                )}
                              </span>
                              <b>{m.roll.total}</b>
                            </div>
                          )}
                          {m.roll &&
                            m.roll.total > 0 &&
                            !m.discarded &&
                            !spectator &&
                            (() => {
                              const target = m.damage
                                ? scene.tokens.find((t) => t.id === m.damage!.target_id)
                                : attackTarget || token;
                              if (
                                !target ||
                                target.layer !== 'tokens' ||
                                (!gm && target.controller !== user.id)
                              )
                                return null;
                              const applied = m.applied?.includes(target.id);
                              return (
                                <button
                                  className="vtt-chat-damage"
                                  disabled={busy || applied}
                                  onClick={() =>
                                    void act(() => applyRolledDamage([m.id], target.id))
                                  }
                                >
                                  {applied ? 'Dano aplicado em ' : 'Aplicar dano em '}
                                  {target.name}
                                </button>
                              );
                            })()}
                          {m.discarded && <small>Dano descartado</small>}
                        </article>
                      ))}
                  </div>
                  {!spectator && (
                    <VttChatComposer
                      text={chat}
                      onChange={setChat}
                      onSend={(text) => void act(() => send('', text))}
                      busy={busy}
                    />
                  )}
                </>
              )}
              {tab === 'combat' && (
                <VttCombatPanel
                  controls={combat}
                  gm={gm}
                  tokens={scene.tokens}
                  selected={selection}
                  selectAll={() => {
                    changeLayer('tokens');
                    setSelection(
                      scene.tokens
                        .filter((t) => t.layer === 'tokens' && !t.hidden)
                        .map((t) => t.id),
                    );
                    setAttackTargetId(null);
                    setTool('select');
                  }}
                />
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
                <VttSoundboard
                  key={state.id}
                  snapshot={sounds.snapshot}
                  assets={state.assets}
                  gm={gm}
                  command={(c) => soundCommand(c, state.id)}
                  upload={uploadAsset}
                  error={sounds.error}
                  unlock={sounds.unlock}
                  active={sounds.active}
                  preview={sounds.preview}
                  stopPreview={sounds.stopPreview}
                  previewing={sounds.previewing}
                />
              )}
              {tab === 'table' && (
                <>
                  <h3>Personalização</h3>
                  <label className="vtt-check">
                    <input
                      type="checkbox"
                      checked={visualEffects}
                      onChange={(e) => media.update({ visualEffects: e.target.checked })}
                    />
                    Mostrar efeitos visuais
                  </label>
                  <p className="vtt-muted">
                    Desative para reduzir o uso do computador. Preferência deste navegador; os
                    demais participantes continuam vendo os efeitos.
                  </p>
                  <label className="vtt-check">
                    <input
                      type="checkbox"
                      checked={media.soundEnabled}
                      onChange={(e) => media.update({ soundEnabled: e.target.checked })}
                    />
                    Som dos efeitos e ataques
                  </label>
                  <label>
                    Volume dos efeitos e ataques · {Math.round(media.soundVolume * 100)}%
                    <input
                      aria-label="Volume dos efeitos e ataques"
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(media.soundVolume * 100)}
                      onChange={(e) => media.update({ soundVolume: Number(e.target.value) / 100 })}
                    />
                  </label>
                  <p className="vtt-muted">
                    O controle de efeitos sonoros do site também se aplica. Ative o áudio neste
                    navegador na aba Som se ele estiver bloqueado.
                  </p>
                  <label className="vtt-check">
                    <input
                      type="checkbox"
                      checked={chatControlsCollapsed}
                      onChange={(e) => customizeChatControls(e.target.checked)}
                    />
                    Recolher controles do chat
                  </label>
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
                  <VttSoundCredits />
                </>
              )}
              {tab === 'help' && (
                <div className="vtt-help">
                  <h3>Comece por aqui</h3>
                  <ol>
                    <li>Em Biblioteca de arte, envie o mapa e clique em Mapa.</li>
                    <li>Em Configurações e ajuda → Mapa, ajuste a grade e a iluminação.</li>
                    <li>Importe seu personagem em Fichas ou adicione monstros na Biblioteca.</li>
                    <li>Escolha a camada em Camadas, na barra à esquerda.</li>
                    <li>Desenhe paredes, portas e janelas; ative a iluminação.</li>
                    <li>Selecione um token e confira a Visão do jogador.</li>
                    <li>Compartilhe o convite e escolha quem controla cada token.</li>
                  </ol>
                  <h3>Atalhos</h3>
                  <p>
                    V selecionar · R régua · P lápis. Roda do mouse: zoom no cursor. Shift+clique:
                    seleção múltipla. Alt+arraste: movimento sem grade. Delete: excluir. Ctrl+D:
                    duplicar. Ctrl+Z: desfazer. Ctrl+S: salvar. Esc: encerrar ferramenta.
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
                  <VttRollHelp />
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
      {!spectator &&
        sheetId &&
        scene.tokens.find((t) => t.id === sheetId) &&
        (scene.tokens.find((t) => t.id === sheetId)!.characterId ? (
          <VttSheet
            roomId={state.id}
            token={scene.tokens.find((t) => t.id === sheetId)!}
            close={() => setSheetId(null)}
            roll={send}
            onAttack={beginAttack}
            refresh={refreshRoom}
            shareSpell={shareSpell}
          />
        ) : (
          <VttMonsterSheet
            monster={tokenProfile(scene.tokens.find((t) => t.id === sheetId)!)}
            tokenId={sheetId}
            gm={gm && !preview}
            biography={scene.tokens.find((t) => t.id === sheetId)!.sheet?.biography || ''}
            close={() => setSheetId(null)}
            roll={send}
            useAction={(action) =>
              useMonsterAction(
                scene.tokens.find((t) => t.id === sheetId)!,
                action,
              )
            }
            editor={
              gm && !preview
                ? (done) => (
                    <VttMonsterEditor
                      key={sheetId}
                      roomId={state.id}
                      token={scene.tokens.find((t) => t.id === sheetId)!}
                      profile={tokenProfile(scene.tokens.find((t) => t.id === sheetId)!)}
                      done={done}
                      upload={async (file) => (await uploadAsset(file)).path}
                      save={async (next) => {
                        editScene((s) => {
                          const t = s.tokens.find((t) => t.id === sheetId);
                          if (t) Object.assign(t, next);
                        });
                        await save();
                        setPresetVersion((v) => v + 1);
                      }}
                    />
                  )
                : undefined
            }
          />
        ))}
      {gm && mapsOpen && (
        <MapLibrary
          doc={doc}
          edit={edit}
          activate={openMap}
          create={createMap}
          configure={(id) => setSettingsId(id)}
          close={() => {
            setSettingsId(null);
            setMapsOpen(false);
          }}
        />
      )}
      {gm && settingsId && doc.scenes.some((s) => s.id === settingsId) && (
        <MapSettings
          key={settingsId}
          scene={doc.scenes.find((s) => s.id === settingsId)!}
          doc={doc}
          assets={state.assets}
          close={() => setSettingsId(null)}
          save={saveMap}
          remove={() => removeMap(settingsId)}
          upload={uploadAsset}
        />
      )}
      {contextMenu && (token || selectedLight || selectedWall || selectedDrawing) && (
        <div
          className="vtt-context-menu"
          ref={contextRef}
          role="dialog"
          aria-label="Ações do objeto"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            maxHeight: `calc(100dvh - ${contextMenu.y + 8}px)`,
          }}
        >
          <header>
            <span>
              {token?.name || selectedLight?.name || (selectedWall ? 'Barreira' : 'Desenho')}
            </span>
            <button aria-label="Fechar ações" onClick={() => setContextMenu(null)}>
              <X size={13} />
            </button>
          </header>
          {token && (
            <>
              <button
                onClick={() => {
                  openSheet();
                  setContextMenu(null);
                }}
              >
                <Users size={14} />
                Abrir ficha
              </button>
              {gm && (
                <>
                  <VttHpControl
                    key={token.id}
                    token={token}
                    busy={busy}
                    apply={async (value) => {
                      editToken({ hp: hpCommand(value, token.hp, token.maxHp) });
                      await save();
                    }}
                  />
                  <button
                    disabled={
                      combat.busy ||
                      combat.state?.active ||
                      !selection.some((id) =>
                        scene.tokens.some((t) => t.id === id && t.layer === 'tokens' && !t.hidden),
                      )
                    }
                    onClick={() => {
                      void combat.send({
                        kind: 'add',
                        tokenIds: selection.filter((id) =>
                          scene.tokens.some(
                            (t) => t.id === id && t.layer === 'tokens' && !t.hidden,
                          ),
                        ),
                      });
                      setTab('combat');
                      setPanelOpen(true);
                      setContextMenu(null);
                    }}
                  >
                    Adicionar selecionados à ordem
                  </button>
                  <label>
                    Camada do objeto
                    <select
                      aria-label="Camada no menu"
                      value={token.layer}
                      onChange={(e) => {
                        const to = e.target.value as VttToken['layer'];
                        editSelected((t) => {
                          t.layer = to;
                        });
                        changeLayer(to, selection);
                      }}
                    >
                      <option value="map">Fundo · visível aos jogadores</option>
                      <option value="tokens">Tokens · jogadores</option>
                      <option value="gm">Mestre · somente você</option>
                    </select>
                  </label>
                  <NumberField
                    label="Nível de profundidade"
                    value={token.level}
                    min={-10000}
                    max={10000}
                    step={0.1}
                    onChange={(n) =>
                      editSelected((t) => {
                        t.level = n;
                      })
                    }
                  />
                  <p>
                    0,1 fica à frente de 0. −0,1 fica atrás. A ordem vale dentro da mesma camada.
                  </p>
                </>
              )}
              {canToken && (
                <>
                  <div className="vtt-two">
                    <button
                      onClick={() =>
                        gm
                          ? editSelected((t) => {
                              t.flipX = !t.flipX;
                            })
                          : editToken({ flipX: !token.flipX })
                      }
                    >
                      <FlipHorizontal2 size={15} />
                      Horizontal
                    </button>
                    <button
                      onClick={() =>
                        gm
                          ? editSelected((t) => {
                              t.flipY = !t.flipY;
                            })
                          : editToken({ flipY: !token.flipY })
                      }
                    >
                      <FlipVertical2 size={15} />
                      Vertical
                    </button>
                    <button
                      onClick={() =>
                        gm
                          ? editSelected((t) => {
                              t.rotation = (t.rotation + 45) % 360;
                            })
                          : editToken({ rotation: (token.rotation + 45) % 360 })
                      }
                    >
                      <RotateCw size={14} />
                      Girar 45°
                    </button>
                    <button
                      onClick={() =>
                        gm
                          ? editSelected((t) => {
                              t.rotation = (t.rotation + 90) % 360;
                            })
                          : editToken({ rotation: (token.rotation + 90) % 360 })
                      }
                    >
                      <RotateCw size={14} />
                      Girar 90°
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      gm
                        ? editSelected((t) => {
                            t.flipX = false;
                            t.flipY = false;
                            t.rotation = 0;
                          })
                        : editToken({ flipX: false, flipY: false, rotation: 0 })
                    }
                  >
                    Redefinir orientação
                  </button>
                </>
              )}
              {gm && (
                <>
                  <hr />
                  <button
                    onClick={() =>
                      editSelected((t) => {
                        t.locked = !t.locked;
                      })
                    }
                  >
                    {token.locked ? <Unlock size={14} /> : <Lock size={14} />}
                    {token.locked ? 'Desbloquear' : 'Bloquear'} movimento
                  </button>
                  <button
                    onClick={() =>
                      editSelected((t) => {
                        t.hidden = !t.hidden;
                      })
                    }
                  >
                    <EyeOff size={14} />
                    {token.hidden ? 'Mostrar aos jogadores' : 'Ocultar dos jogadores'}
                  </button>
                  <button onClick={duplicate}>
                    <Copy size={14} />
                    Duplicar seleção
                  </button>
                </>
              )}
            </>
          )}
          {gm && (
            <button className="vtt-delete" onClick={removeSelected}>
              <Trash2 size={14} />
              Excluir seleção
            </button>
          )}
        </div>
      )}
    </section>
  );
}
