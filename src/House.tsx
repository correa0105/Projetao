import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  Fragment,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import {
  Save,
  Package,
  ShoppingBag,
  Users,
  MessageCircle,
  Plus,
  RotateCw,
  Trash2,
  X,
  Gift,
  ImagePlus,
  Armchair,
  ChevronDown,
  Send,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Scan,
  Settings,
} from 'lucide-react';
import { api, post } from './api';
import { Modal } from './components';
import { HouseItemReader } from './HouseItemReader';
import { HouseWarp } from './HouseWarp';
import { ItemInfoButton } from './ItemInfoButton';
import {
  houseCatalog,
  houseDefaultFacing,
  houseDefaultScale,
  houseItemImage,
  houseFacingOptions,
  houseTurnFacing,
  houseTemplates,
  roomKinds,
  type HouseState,
  type HousePlacement,
  type HouseItem,
  type HouseVariant,
} from '../shared/house';
import { achievementCatalog } from '../shared/achievements';
import { OwnedPetArt } from './OwnedPetArt';
import { pets } from '../shared/pets';
import { mounts, ownedMountImage } from '../shared/mounts';
import { characterHeightScale } from '../shared/character-stature';
import { petArtwork } from './pet-art';
import type { Character, User } from './types';
import { money } from '../shared/rules';
import { useSoundEffects } from './SiteMusic';
import {
  housePerspectiveScale,
  houseDragPosition,
  houseViewWidth,
  houseFloorScale,
  houseFloorDragPosition,
  houseHearthLight,
  housePaintLayer,
  houseDepthLayers,
} from '../shared/house-perspective';
import './house.css';
import frameQuads from '../shared/house-frame-quads.json';
import {
  houseCornerLabels,
  houseDistortionHandlePositions,
  houseMoveDistortionCorner,
} from '../shared/house-distortion';
type Index = {
  homes: { id: string; character_id: string; name: string; character_name: string }[];
  invites: { home_id: string; status: string; name: string; owner_name: string }[];
  variants: HouseVariant[];
  catalog: typeof houseCatalog;
  can_admin: boolean;
};
type Profile = { id: string; name: string; characters: { id: string; name: string }[] };
const labels = { sala: 'Sala', cozinha: 'Cozinha', varanda: 'Varanda', jardim: 'Jardim' };
function pinnedRpPreference(userId: string) {
  try {
    return localStorage.getItem(`house-rp-pinned:${userId}`) === 'true';
  } catch {
    return false;
  }
}
const fileData = (file: File) =>
  new Promise<string>((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) {
      reject(Error('A imagem deve ter até 5 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
function HousePicture({
  item,
  facing,
  backing,
}: {
  item: HouseItem;
  facing: number;
  backing: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null),
    [matrix, setMatrix] = useState('');
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const quad = (frameQuads as Record<string, number[][]>)[String(facing)];
    if (!quad) return;
    const resize = () => {
      const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad.map(([x, y]) => [
        x * parent.clientWidth,
        y * parent.clientHeight,
      ]);
      const dx1 = x1 - x2,
        dx2 = x3 - x2,
        dx3 = x0 - x1 + x2 - x3,
        dy1 = y1 - y2,
        dy2 = y3 - y2,
        dy3 = y0 - y1 + y2 - y3,
        det = dx1 * dy2 - dx2 * dy1;
      const g = Math.abs(det) > 1e-8 ? (dx3 * dy2 - dx2 * dy3) / det : 0,
        h = Math.abs(det) > 1e-8 ? (dx1 * dy3 - dx3 * dy1) / det : 0;
      setMatrix(
        `matrix3d(${(x1 - x0 + g * x1) / 100},${(y1 - y0 + g * y1) / 100},0,${g / 100},${(x3 - x0 + h * x3) / 140},${(y3 - y0 + h * y3) / 140},0,${h / 140},0,0,1,0,${x0},${y0},0,1)`,
      );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    return () => observer.disconnect();
  }, [facing]);
  return (
    <span
      ref={ref}
      className="house-frame-surface"
      style={{ transform: matrix, visibility: matrix ? 'visible' : 'hidden' }}
    >
      {backing && (
        <span className="house-frame-wood" role="img" aria-label="Fundo de madeira do quadro" />
      )}
      {item.has_image && (
        <img
          className="house-picture"
          draggable={false}
          src={`/api/house/items/${item.id}/image`}
          alt={item.content.title || 'Lembrança'}
        />
      )}
    </span>
  );
}
function ItemArt({
  item,
  facing,
  backing = false,
}: {
  item: HouseItem;
  facing?: number;
  backing?: boolean;
}) {
  const spec = houseCatalog.find((c) => c.id === item.catalog_id);
  return (
    <span
      className={`house-item-art ${item.catalog_id === 'frame' ? 'house-frame-art' : ''}`}
      data-facing={facing}
    >
      {item.catalog_id === 'frame' &&
        (item.has_image || backing) &&
        (facing === undefined || [0, 1, 7].includes(facing)) && (
          <HousePicture item={item} facing={facing ?? 0} backing={backing} />
        )}
      <img
        draggable={false}
        src={
          facing === undefined
            ? item.catalog_id === 'frame'
              ? '/house/items/views/frame/0.webp'
              : spec?.image
            : houseItemImage(item.catalog_id, facing)
        }
        alt={spec?.name || 'Decoração'}
        onError={(e) => {
          if (e.currentTarget.src.includes('/house/items/views/') && spec)
            e.currentTarget.src = `/house/items/${spec.id}.webp`;
        }}
      />
    </span>
  );
}
export function House({
  character,
  user,
  onPurchased,
}: {
  character?: Character;
  user: User;
  onPurchased: () => Promise<void>;
}) {
  const [index, setIndex] = useState<Index | null>(null),
    [homeId, setHomeId] = useState(''),
    [home, setHome] = useState<HouseState | null>(null),
    [room, setRoom] = useState<(typeof roomKinds)[number]>('sala'),
    [tab, setTab] = useState(''),
    [selected, setSelected] = useState(''),
    [distorting, setDistorting] = useState(''),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [buy, setBuy] = useState(''),
    [read, setRead] = useState<HouseItem | null>(null),
    [deleting, setDeleting] = useState<HouseItem | null>(null),
    [gift, setGift] = useState<HouseItem | null>(null),
    [variant, setVariant] = useState(''),
    [presenceScale, setPresenceScale] = useState(0.19),
    [text, setText] = useState(''),
    [query, setQuery] = useState(''),
    [people, setPeople] = useState<{ id: string; name: string }[]>([]),
    [recipient, setRecipient] = useState<Profile | null>(null),
    [title, setTitle] = useState(''),
    [dedication, setDedication] = useState(''),
    [picture, setPicture] = useState<File | null>(null),
    [rules, setRules] = useState<any[]>([]),
    [missions, setMissions] = useState<{ id: string; title: string }[]>([]),
    [rewardCatalog, setRewardCatalog] = useState('rug'),
    [rewardKind, setRewardKind] = useState('count'),
    [rewardValue, setRewardValue] = useState('1'),
    [grantReason, setGrantReason] = useState('');
  const [rpPinned, setRpPinned] = useState(() => pinnedRpPreference(user.id));
  const [chatActive, setChatActive] = useState(false);
  const [speeches, setSpeeches] = useState<
    Record<string, { id: string; body: string; characterId: string; expires: number }>
  >({});
  const seenMessages = useRef<{ home: string; ids: Set<string> }>({ home: '', ids: new Set() });
  const [speechPositions, setSpeechPositions] = useState<
    Record<string, { x: number; y: number; width: number; tail: number }>
  >({});
  useEffect(() => {
    setRpPinned(pinnedRpPreference(user.id));
  }, [user.id]);
  const stageSlot = useRef<HTMLDivElement>(null);
  const [sceneSize, setSceneSize] = useState({ width: 0, height: 0 });
  const [viewportTop, setViewportTop] = useState(82);
  useLayoutEffect(() => {
    document.body.classList.add('house-immersive');
    const header = document.querySelector<HTMLElement>('.main-shell > .page-header');
    const resize = () =>
      setViewportTop(header ? Math.max(0, header.getBoundingClientRect().bottom + 8) : 8);
    const observer = new ResizeObserver(resize);
    if (header) observer.observe(header);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      document.body.classList.remove('house-immersive');
    };
  }, []);
  useLayoutEffect(() => {
    const slot = stageSlot.current;
    if (!slot) return;
    const resize = () => {
      const width = Math.max(0, Math.min(slot.clientWidth, (slot.clientHeight * 16) / 9));
      setSceneSize({ width, height: (width * 9) / 16 });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(slot);
    resize();
    return () => observer.disconnect();
  }, [home?.id]);
  const stage = useRef<HTMLDivElement>(null),
    chatLog = useRef<HTMLDivElement>(null),
    chatForm = useRef<HTMLFormElement>(null),
    chatInput = useRef<HTMLInputElement>(null),
    resumeChatInput = useRef(false),
    followChat = useRef(true),
    dirtyRef = useRef(false),
    activeDrag = useRef(false),
    purchaseKey = useRef<string | null>(null),
    messageKey = useRef<string | null>(null),
    generation = useRef(0);
  const [viewControls, setViewControls] = useState<{
    left: number;
    right: number;
    top: number;
  } | null>(null);
  const [pieceGeometry, setPieceGeometry] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  useLayoutEffect(() => {
    const scene = stage.current;
    const piece = scene?.querySelector<HTMLElement>('.house-piece.selected');
    if (!scene || !piece) {
      setViewControls(null);
      setPieceGeometry(null);
      return;
    }
    const update = () => {
      const bounds = scene.getBoundingClientRect(),
        rect = piece.getBoundingClientRect();
      setViewControls({
        left: Math.max(17, Math.min(bounds.width - 17, rect.left - bounds.left - 19)),
        right: Math.max(17, Math.min(bounds.width - 17, rect.right - bounds.left + 19)),
        top: Math.max(18, Math.min(bounds.height - 18, rect.top - bounds.top + rect.height / 2)),
      });
      const placement = home?.rooms
        .find((r) => r.kind === room)
        ?.placements.find((p) => p.id === selected);
      if (placement)
        setPieceGeometry({
          x: placement.x * scene.clientWidth,
          y: placement.y * scene.clientHeight,
          width: piece.clientWidth,
          height: piece.clientHeight,
        });
    };
    const observer = new ResizeObserver(update);
    observer.observe(piece);
    update();
    return () => observer.disconnect();
  }, [selected, home, room, sceneSize]);
  const sound = useSoundEffects();
  const lastMessage = home?.messages.at(-1)?.id;
  useEffect(() => {
    if (!home || seenMessages.current.home !== home.id) {
      seenMessages.current = {
        home: home?.id || '',
        ids: new Set(home?.messages.map((m) => m.id)),
      };
      setSpeeches({});
      return;
    }
    const incoming = home.messages.filter((message) => !seenMessages.current.ids.has(message.id));
    seenMessages.current.ids = new Set(home.messages.map((m) => m.id));
    if (incoming.length)
      setSpeeches((previous) => {
        const next = { ...previous };
        for (const message of incoming)
          next[message.user_id] = {
            id: message.id,
            body: message.body,
            characterId: message.character_id,
            expires: Date.now() + 12000,
          };
        return next;
      });
  }, [home?.id, home?.messages]);
  useEffect(() => {
    const expirations = Object.values(speeches).map((speech) => speech.expires);
    if (!expirations.length) return;
    const timer = setTimeout(
      () =>
        setSpeeches((previous) =>
          Object.fromEntries(
            Object.entries(previous).filter(([, speech]) => speech.expires > Date.now()),
          ),
        ),
      Math.max(0, Math.min(...expirations) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [speeches]);
  useLayoutEffect(() => {
    const scene = stage.current;
    if (!scene) return;
    const actors = Array.from(scene.querySelectorAll<HTMLElement>('.house-actor'));
    const update = () => {
      const bounds = scene.getBoundingClientRect(),
        width = Math.min(260, scene.clientWidth - 24);
      const next: typeof speechPositions = {};
      for (const actor of actors) {
        const rect = actor.querySelector('img')!.getBoundingClientRect();
        const center = rect.left - bounds.left + rect.width / 2;
        const x = Math.max(width / 2 + 12, Math.min(scene.clientWidth - width / 2 - 12, center));
        next[actor.dataset.houseActor!] = {
          x,
          y: Math.min(
            scene.clientHeight - 16,
            Math.max(Math.min(128, scene.clientHeight - 16), rect.top - bounds.top - 12),
          ),
          width,
          tail: Math.max(16, Math.min(width - 16, center - x + width / 2)),
        };
      }
      setSpeechPositions(next);
    };
    const observer = new ResizeObserver(update);
    for (const actor of actors) observer.observe(actor);
    update();
    return () => observer.disconnect();
  }, [home?.presence, room, sceneSize]);
  useEffect(() => {
    if ((tab === 'rp' || rpPinned) && followChat.current && chatLog.current)
      chatLog.current.scrollTop = chatLog.current.scrollHeight;
  }, [lastMessage, tab, homeId, rpPinned]);
  useEffect(() => {
    const leaveComposer = (event: Event) => {
      if (!chatForm.current?.contains(event.target as Node)) resumeChatInput.current = false;
      if (
        !chatForm.current?.contains(event.target as Node) &&
        !chatLog.current?.contains(event.target as Node)
      ) {
        setChatActive(false);
        followChat.current = true;
        if (chatLog.current) chatLog.current.scrollTop = chatLog.current.scrollHeight;
      }
    };
    document.addEventListener('pointerdown', leaveComposer, true);
    document.addEventListener('focusin', leaveComposer, true);
    return () => {
      document.removeEventListener('pointerdown', leaveComposer, true);
      document.removeEventListener('focusin', leaveComposer, true);
    };
  }, []);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    if (character)
      setPresenceScale(
        (0.19 * characterHeightScale(character.race, character.species_size)) / 0.875,
      );
  }, [character?.id]);
  async function refreshIndex() {
    const v = await api<Index>('/house');
    setIndex(v);
    return v;
  }
  useEffect(() => {
    let active = true;
    void api<Index>('/house')
      .then((v) => {
        if (!active) return;
        setIndex(v);
        setHomeId(v.homes.find((h) => h.character_id === character?.id)?.id || '');
        setHome(null);
        setDirty(false);
        setSelected('');
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [character?.id]);
  async function load(id = homeId, discard = false) {
    if (!id) return;
    const v = await api<HouseState>(`/house/${id}`);
    if (dirtyRef.current && !discard) {
      setHome((h) =>
        h
          ? {
              ...h,
              inventory: v.inventory,
              items: v.items,
              companions: v.companions,
              presence: v.presence,
              messages: v.messages,
              invites: v.invites,
              gold_cp: v.gold_cp,
            }
          : v,
      );
      return;
    }
    setHome(v);
    setDirty(false);
    dirtyRef.current = false;
    setSelected('');
  }
  useEffect(() => {
    const current = ++generation.current;
    setHome(null);
    setDirty(false);
    dirtyRef.current = false;
    setError('');
    if (!homeId) return;
    void api<HouseState>(`/house/${homeId}`)
      .then((v) => {
        if (current !== generation.current) return;
        setHome(v);
        if (v.is_owner)
          void post(`/house/${homeId}/rewards`, {})
            .then(() => api<HouseState>(`/house/${homeId}`))
            .then((next) => {
              if (current === generation.current && !dirtyRef.current) setHome(next);
            })
            .catch((e) => setError(e.message));
      })
      .catch((e) => current === generation.current && setError(e.message));
    return () => {
      generation.current++;
    };
  }, [homeId]);
  useEffect(() => {
    if (!homeId) return;
    let active = true;
    const timer = setInterval(() => {
      if (document.hidden) return;
      void api<HouseState>(`/house/${homeId}`)
        .then((v) => {
          if (active)
            setHome((prev) =>
              prev
                ? {
                    ...prev,
                    presence: activeDrag.current ? prev.presence : v.presence,
                    messages: v.messages,
                    ...(!dirtyRef.current
                      ? {
                          revision: v.revision,
                          rooms: v.rooms,
                          inventory: v.inventory,
                          items: v.items,
                          invites: v.invites,
                        }
                      : {}),
                  }
                : v,
            );
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            setHome(null);
          }
        });
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [homeId]);
  useEffect(() => {
    if (tab !== 'guests' && !gift && tab !== 'rewards') return;
    let active = true;
    const timer = setTimeout(() => {
      void api<{ items: { id: string; name: string }[] }>(
        `/profiles?q=${encodeURIComponent(query)}`,
      )
        .then((v) => active && setPeople(v.items.filter((p) => p.id !== user.id)))
        .catch((e) => active && setError(e.message));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, tab, gift, user.id]);
  useEffect(() => {
    if (tab !== 'rewards' || !index?.can_admin) return;
    void api<{ rules: any[]; missions: { id: string; title: string }[] }>('/house/admin/rewards')
      .then((v) => {
        setRules(v.rules);
        setMissions(v.missions);
      })
      .catch((e) => setError(e.message));
  }, [tab, index?.can_admin]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const current = home?.rooms.find((r) => r.kind === room),
    choice = current?.placements.find((p) => p.id === selected),
    spec = (index?.catalog || houseCatalog).find((c) => c.id === buy),
    ownActor = home?.presence.find((p) => p.user_id === user.id && p.room === room);
  const choiceItem =
    home?.inventory.find((i) => i.id === choice?.ref) ||
    home?.items.find((i) => i.id === choice?.ref);
  const choiceViews = houseFacingOptions(choiceItem?.catalog_id || '');
  const distortionHandles =
    choice && pieceGeometry && distorting === choice.id
      ? houseDistortionHandlePositions(pieceGeometry, choice.rotation, choice.distortion)
      : null;
  function edit(fn: (h: HouseState) => HouseState) {
    if (busy) return;
    setHome((h) => (h ? fn(h) : h));
    setDirty(true);
    dirtyRef.current = true;
  }
  function patch(id: string, value: Partial<HousePlacement>) {
    edit((h) => ({
      ...h,
      rooms: h.rooms.map((r) => ({
        ...r,
        placements: r.placements.map((p) => (p.id === id ? { ...p, ...value } : p)),
      })),
    }));
  }
  function order(id: string, direction: -1 | 1) {
    const piece = current?.placements.find((p) => p.id === id);
    if (piece)
      patch(id, { depth_layer: Math.max(1, Math.min(6, (piece.depth_layer ?? 3) - direction)) });
  }
  function add(kind: HousePlacement['kind'], ref: string) {
    if (busy) return;
    const id = crypto.randomUUID();
    const companion = home?.companions.find((c) => c.id === ref);
    const scale =
      kind === 'mount'
        ? 0.5 * (mounts.find((m) => m.id === companion?.mount_id)?.scale || 1)
        : kind === 'pet'
          ? (0.09 *
              petArtwork(companion?.pet_id || 'dog', companion?.appearance || 'original').width) /
            218
          : houseDefaultScale(home?.inventory.find((item) => item.id === ref)?.catalog_id || '');
    edit((h) => ({
      ...h,
      rooms: h.rooms.map((r) =>
        r.kind === room
          ? {
              ...r,
              placements: [
                ...r.placements,
                {
                  id,
                  kind,
                  ref,
                  x: 0.5,
                  y: 0.82,
                  scale: Math.max(0.03, Math.min(0.8, scale)),
                  rotation: 0,
                  facing:
                    kind === 'item'
                      ? houseDefaultFacing(
                          home?.inventory.find((item) => item.id === ref)?.catalog_id || '',
                        )
                      : 0,
                  layer: r.placements.length,
                  depth_layer: 3,
                },
              ],
            }
          : r,
      ),
    }));
    setSelected(id);
  }
  function drag(event: PointerEvent<HTMLButtonElement>, p: HousePlacement) {
    if (!home?.is_owner || busy || event.button !== 0) return;
    event.preventDefault();
    activeDrag.current = true;
    setSelected(p.id);
    const bounds = sceneBounds(),
      factor = pieceDepthScale(p),
      grab = {
        x: (event.clientX - bounds.left - p.x * bounds.width) / factor,
        y: (event.clientY - bounds.top - p.y * bounds.height) / factor,
      };
    let y = p.y;
    event.currentTarget.setPointerCapture(event.pointerId);
    const el = event.currentTarget;
    const move = (e: globalThis.PointerEvent) => {
      const bounds = sceneBounds();
      const solve = floorPerspective(p)
        ? (
            cursor: { x: number; y: number },
            grab: { x: number; y: number },
            bounds: { width: number; height: number },
            previousY: number,
          ) => houseFloorDragPosition(cursor, grab, bounds, previousY, current?.template)
        : houseDragPosition;
      const position = solve(
        { x: e.clientX - bounds.left, y: e.clientY - bounds.top },
        grab,
        bounds,
        y,
      );
      y = position.y;
      patch(p.id, position);
    };
    const end = () => {
      activeDrag.current = false;
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  function dragDistortion(
    event: PointerEvent<HTMLButtonElement>,
    p: HousePlacement,
    corner: number,
  ) {
    if (!home?.is_owner || busy || !pieceGeometry || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    activeDrag.current = true;
    const el = event.currentTarget,
      pointerId = event.pointerId;
    el.setPointerCapture(pointerId);
    const start = { x: event.clientX, y: event.clientY };
    const geometry = pieceGeometry,
      original = p.distortion?.[corner] ?? { x: 0, y: 0 };
    const radians = (p.rotation * Math.PI) / 180,
      cos = Math.cos(radians),
      sin = Math.sin(radians);
    const move = (e: globalThis.PointerEvent) => {
      const x = e.clientX - start.x,
        y = e.clientY - start.y;
      patch(p.id, {
        distortion: houseMoveDistortionCorner(
          p.distortion,
          corner,
          original.x + (x * cos + y * sin) / geometry.width,
          original.y + (-x * sin + y * cos) / geometry.height,
        ),
      });
    };
    const end = () => {
      activeDrag.current = false;
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  function dragActor(event: PointerEvent<HTMLButtonElement>, p: HouseState['presence'][number]) {
    if (p.user_id !== user.id || busy || event.button !== 0) return;
    event.preventDefault();
    activeDrag.current = true;
    setSelected(`actor:${p.user_id}`);
    const bounds = sceneBounds(),
      factor = houseFloorScale(p.y, current?.template),
      grab = {
        x: (event.clientX - bounds.left - p.x * bounds.width) / factor,
        y: (event.clientY - bounds.top - p.y * bounds.height) / factor,
      };
    let x = p.x,
      y = p.y;
    const el = event.currentTarget;
    el.setPointerCapture(event.pointerId);
    const move = (e: globalThis.PointerEvent) => {
      const bounds = sceneBounds();
      ({ x, y } = houseFloorDragPosition(
        { x: e.clientX - bounds.left, y: e.clientY - bounds.top },
        grab,
        bounds,
        y,
        current?.template,
      ));
      setHome((h) =>
        h
          ? { ...h, presence: h.presence.map((a) => (a.user_id === user.id ? { ...a, x, y } : a)) }
          : h,
      );
    };
    const end = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      void run(async () => {
        try {
          await api(`/house/${homeId}/presence`, {
            method: 'PUT',
            body: JSON.stringify({
              character_id: p.character_id,
              variant_id: p.variant_id,
              room: p.room,
              x,
              y,
              scale: p.scale,
              layer: p.layer,
              depth_layer: p.depth_layer ?? undefined,
            }),
          });
        } finally {
          activeDrag.current = false;
        }
      });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  function sceneBounds() {
    const el = stage.current!,
      rect = el.getBoundingClientRect();
    return {
      left: rect.left + el.clientLeft,
      top: rect.top + el.clientTop,
      width: el.clientWidth,
      height: el.clientHeight,
    };
  }
  function changeActorLayer(depth_layer: number) {
    if (!ownActor) return;
    const actor = ownActor;
    void run(async () => {
      await api(`/house/${homeId}/presence`, {
        method: 'PUT',
        body: JSON.stringify({
          character_id: actor.character_id,
          variant_id: actor.variant_id,
          room: actor.room,
          x: actor.x,
          y: actor.y,
          scale: actor.scale,
          layer: actor.layer,
          depth_layer,
        }),
      });
      setHome((h) =>
        h
          ? {
              ...h,
              presence: h.presence.map((a) => (a.user_id === user.id ? { ...a, depth_layer } : a)),
            }
          : h,
      );
    });
  }
  function placementName(piece: HousePlacement) {
    const item =
      home?.inventory.find((i) => i.id === piece.ref) ||
      home?.items.find((i) => i.id === piece.ref);
    return (
      item?.content.title ||
      houseCatalog.find((c) => c.id === item?.catalog_id)?.name ||
      home?.companions.find((c) => c.id === piece.ref)?.name ||
      'objeto'
    );
  }
  function placed(ref: string) {
    return home?.rooms.some((r) => r.placements.some((p) => p.ref === ref));
  }
  function floorPerspective(p: HousePlacement) {
    const item =
      home?.inventory.find((i) => i.id === p.ref) || home?.items.find((i) => i.id === p.ref);
    return item?.catalog_id !== 'frame';
  }
  function pieceDepthScale(p: HousePlacement) {
    return floorPerspective(p)
      ? houseFloorScale(p.y, current?.template)
      : housePerspectiveScale(p.y);
  }
  async function openRecipient(id: string) {
    setRecipient(await api<Profile>(`/profiles/${encodeURIComponent(id)}`));
  }
  function toggle(name: string) {
    if (name === 'rp') followChat.current = true;
    setTab((v) => (v === name ? '' : name));
    setError('');
    setRecipient(null);
  }
  return (
    <section
      className="house-workspace"
      aria-label="House"
      style={{ '--house-top': `${viewportTop}px` } as CSSProperties}
    >
      <header className="house-header">
        <a className="house-exit" href="#overview" aria-label="Sair da House" title="Sair da House">
          <ArrowLeft size={20} />
        </a>
        <div className="house-heading">
          <span className="eyebrow">Seu lugar na Alvorada</span>
          <h2>{home?.name || 'House'}</h2>
        </div>
        <div className="house-header-actions">
          <select
            aria-label="Escolher casa"
            value={homeId}
            onChange={(e) => {
              if (dirty) {
                setError('Salve ou descarte as mudanças antes de trocar de casa.');
                return;
              }
              setHomeId(e.target.value);
            }}
          >
            <option value="">Suas casas e convites</option>
            {index?.homes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
            {index?.invites
              .filter((i) => i.status === 'accepted')
              .map((i) => (
                <option key={i.home_id} value={i.home_id}>
                  {i.name} · {i.owner_name}
                </option>
              ))}
          </select>
          {character && !index?.homes.some((h) => h.character_id === character.id) && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const h = await post<{ id: string }>('/house', { character_id: character.id });
                  await refreshIndex();
                  setHomeId(h.id);
                })
              }
            >
              <Plus size={16} />
              Criar minha casa
            </button>
          )}
          {home?.is_owner && (
            <>
              <button
                disabled={busy || !dirty}
                onClick={() =>
                  void run(async () => {
                    const v = await api<{ revision: number }>(`/house/${homeId}`, {
                      method: 'PUT',
                      body: JSON.stringify({
                        revision: home.revision,
                        name: home.name,
                        rooms: home.rooms,
                      }),
                    });
                    setHome((h) => (h ? { ...h, revision: v.revision } : h));
                    setDirty(false);
                    dirtyRef.current = false;
                    setNotice('Casa salva.');
                    await load();
                    await refreshIndex();
                  })
                }
              >
                <Save size={16} />
                {dirty ? 'Salvar mudanças' : 'Salvo'}
              </button>
              {dirty && (
                <button disabled={busy} onClick={() => void run(() => load(homeId, true))}>
                  Descartar
                </button>
              )}
            </>
          )}
        </div>
      </header>
      {error && (
        <p className="house-feedback" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="house-feedback" role="status">
          {notice}
        </p>
      )}
      {!!index?.invites.some((i) => i.status === 'pending') && (
        <div className="house-invitations">
          {index.invites
            .filter((i) => i.status === 'pending')
            .map((i) => (
              <div key={i.home_id}>
                <span>
                  {i.owner_name} convidou você para {i.name}.
                </span>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(`/house/${i.home_id}/invites/${encodeURIComponent(user.id)}`, {
                        method: 'PUT',
                        body: JSON.stringify({ status: 'accepted' }),
                      });
                      await refreshIndex();
                      setHomeId(i.home_id);
                    })
                  }
                >
                  Aceitar
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(`/house/${i.home_id}/invites/${encodeURIComponent(user.id)}`, {
                        method: 'PUT',
                        body: JSON.stringify({ status: 'declined' }),
                      });
                      await refreshIndex();
                    })
                  }
                >
                  Recusar
                </button>
              </div>
            ))}
        </div>
      )}
      {!home && (
        <div className="house-welcome">
          <img src="/house/rooms/hall-hearth.webp" alt="Sala de pedra com lareira" />
          <div>
            <Armchair size={28} />
            <h3>Um lugar para suas histórias</h3>
            <p>Monte os ambientes, guarde lembranças e receba seus companheiros.</p>
            {!character && <a href="#characters">Selecione um personagem para criar sua casa.</a>}
          </div>
        </div>
      )}
      {home && (
        <div className={`house-body ${tab && tab !== 'rp' ? 'has-panel' : ''}`}>
          <nav className="house-dock" aria-label="Controles da casa">
            {home.is_owner && (
              <>
                <button aria-pressed={tab === 'decor'} onClick={() => toggle('decor')}>
                  <Package size={17} />
                  Decorar
                </button>
                <button aria-pressed={tab === 'shop'} onClick={() => toggle('shop')}>
                  <ShoppingBag size={17} />
                  Mobília
                </button>
                <button aria-pressed={tab === 'guests'} onClick={() => toggle('guests')}>
                  <Users size={17} />
                  Convidados
                </button>
              </>
            )}
            <button aria-pressed={tab === 'rp' || rpPinned} onClick={() => toggle('rp')}>
              <MessageCircle size={17} />
              RP
            </button>
            <button aria-pressed={tab === 'settings'} onClick={() => toggle('settings')}>
              <Settings size={17} />
              Configurações
            </button>
            <button aria-pressed={tab === 'versions'} onClick={() => toggle('versions')}>
              <ImagePlus size={17} />
              Personagem
            </button>
            {index?.can_admin && (
              <button aria-pressed={tab === 'rewards'} onClick={() => toggle('rewards')}>
                <Gift size={17} />
                Recompensas
              </button>
            )}
          </nav>
          <div className="house-center">
            <nav className="house-rooms" aria-label="Ambientes da casa">
              {roomKinds.map((k) => (
                <button
                  key={k}
                  aria-pressed={room === k}
                  onClick={() => {
                    setRoom(k);
                    setSelected('');
                  }}
                >
                  {labels[k]}
                </button>
              ))}
              {!home.is_owner && <span>Visitando {home.owner_name}</span>}
            </nav>
            <div className="house-stage-slot" ref={stageSlot}>
              <div
                className="house-scene"
                ref={stage}
                style={{
                  width: sceneSize.width,
                  height: sceneSize.height,
                  backgroundImage: `url(${houseTemplates.find((t) => t.id === current?.template)?.image})`,
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setSelected('');
                }}
              >
                {current?.placements.map((p) => {
                  const item =
                      home.inventory.find((i) => i.id === p.ref) ||
                      home.items.find((i) => i.id === p.ref),
                    companion = home.companions.find((c) => c.id === p.ref);
                  const name = item
                    ? item.content.title || houseCatalog.find((c) => c.id === item.catalog_id)?.name
                    : companion?.name;
                  const width =
                    p.scale *
                    pieceDepthScale(p) *
                    (item ? houseViewWidth(item.catalog_id, p.facing ?? 0) : 1);
                  const furniture = item && !['frame', 'letter'].includes(item.catalog_id);
                  const light =
                    current?.template === 'hall-hearth' && furniture
                      ? houseHearthLight(p.x, p.y)
                      : null;
                  return (
                    <Fragment key={p.id}>
                      <button
                        type="button"
                        className={`house-piece ${selected === p.id ? 'selected' : ''}`}
                        aria-label={`${name}${home.is_owner ? ' · mover' : ''}`}
                        style={
                          {
                            left: `${p.x * 100}%`,
                            top: `${p.y * 100}%`,
                            width: `${width * 100}%`,
                            '--house-room-filter': light
                              ? `brightness(${light.brightness}) saturate(.86) contrast(1.04)`
                              : 'none',
                            transform: `translate(-50%,-100%) rotate(${p.rotation}deg)`,
                            zIndex: housePaintLayer(p.depth_layer, p.layer * 2 + 2),
                          } as CSSProperties
                        }
                        data-house-piece={p.id}
                        data-base-scale={p.scale}
                        data-depth-scale={pieceDepthScale(p)}
                        data-facing={p.facing ?? 0}
                        data-layer={p.layer}
                        data-depth-layer={p.depth_layer ?? 3}
                        title={
                          item &&
                          (['letter', 'frame'].includes(item.catalog_id) || item.content.text)
                            ? 'Dois cliques para abrir'
                            : undefined
                        }
                        onPointerDown={(e) => drag(e, p)}
                        onClick={() => {
                          if (home.is_owner) setSelected(p.id);
                        }}
                        onDoubleClick={() => {
                          if (
                            item &&
                            (['letter', 'frame'].includes(item.catalog_id) || item.content.text)
                          )
                            setRead(item);
                        }}
                      >
                        <HouseWarp distortion={p.distortion}>
                          {companion && (
                            <span
                              className="house-companion-shadow"
                              aria-hidden="true"
                              style={{ height: `${width * sceneSize.width * 0.11}px` }}
                            />
                          )}
                          {furniture && (
                            <span
                              className={`house-floor-shadow ${item.catalog_id === 'rug' ? 'house-rug-shadow' : ''}`}
                              aria-hidden="true"
                              data-shadow-facing={p.facing ?? 0}
                              style={
                                {
                                  '--house-shadow-image': `url("${houseItemImage(item.catalog_id, p.facing ?? 0)}")`,
                                  '--house-shadow-blur': `${width * sceneSize.width * 0.006}px`,
                                  '--house-shadow-offset': `${width * sceneSize.width * 0.003}px`,
                                } as CSSProperties
                              }
                            />
                          )}
                          {item ? (
                            <ItemArt
                              item={item}
                              facing={p.facing ?? 0}
                              backing={p.frame_backing === true}
                            />
                          ) : p.kind === 'pet' && companion ? (
                            <OwnedPetArt pet={companion} />
                          ) : companion ? (
                            <img src={ownedMountImage(companion as any)} alt={name} />
                          ) : null}
                        </HouseWarp>
                      </button>
                    </Fragment>
                  );
                })}
                {home.is_owner && choice?.kind === 'item' && viewControls && !distortionHandles && (
                  <div className="house-view-controls" aria-label="Vistas do item selecionado">
                    {([-1, 1] as const).map((direction) => (
                      <button
                        key={direction}
                        type="button"
                        disabled={busy}
                        aria-label={
                          direction < 0 ? 'Virar item à esquerda' : 'Virar item à direita'
                        }
                        style={{
                          left: direction < 0 ? viewControls.left : viewControls.right,
                          top: viewControls.top,
                          transform: 'translate(-50%, -50%)',
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          const item =
                            home.inventory.find((i) => i.id === choice.ref) ||
                            home.items.find((i) => i.id === choice.ref);
                          if (item)
                            patch(choice.id, {
                              facing: houseTurnFacing(
                                item.catalog_id,
                                choice.facing ?? 0,
                                direction,
                              ),
                            });
                        }}
                      >
                        {direction < 0 ? <ChevronLeft size={21} /> : <ChevronRight size={21} />}
                      </button>
                    ))}
                  </div>
                )}
                {home.is_owner && choice && distortionHandles && (
                  <div
                    className="house-distortion-controls"
                    aria-label="Pontos de distorção da imagem"
                  >
                    <svg aria-hidden="true" width="100%" height="100%">
                      <polygon
                        points={distortionHandles.map((point) => `${point.x},${point.y}`).join(' ')}
                      />
                    </svg>
                    {distortionHandles.map((point, index) => (
                      <button
                        key={index}
                        type="button"
                        disabled={busy}
                        aria-label={`Distorcer canto ${houseCornerLabels[index]}`}
                        title={`Arraste o canto ${houseCornerLabels[index]}`}
                        style={{ left: point.x, top: point.y, transform: 'translate(-50%, -50%)' }}
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => dragDistortion(event, choice, index)}
                      >
                        <span aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
                {home.presence
                  .filter((p) => p.room === room)
                  .map((p) => (
                    <button
                      key={p.user_id}
                      className={`house-actor ${selected === `actor:${p.user_id}` ? 'selected' : ''}`}
                      data-layer={p.layer}
                      data-depth-layer={p.depth_layer ?? 3}
                      aria-label={`${p.name}${p.user_id === user.id ? ' · mover personagem' : ''}`}
                      onPointerDown={(e) => dragActor(e, p)}
                      onClick={() => {
                        if (p.user_id === user.id) setSelected(`actor:${p.user_id}`);
                      }}
                      data-base-scale={p.scale}
                      data-house-actor={p.user_id}
                      data-depth-scale={houseFloorScale(p.y, current?.template)}
                      style={{
                        left: `${p.x * 100}%`,
                        top: `${p.y * 100}%`,
                        width: `${p.scale * houseFloorScale(p.y, current?.template) * 100}%`,
                        zIndex: housePaintLayer(p.depth_layer, p.layer),
                        transform: 'translate(-50%, -100%)',
                      }}
                    >
                      <img
                        draggable={false}
                        src={
                          p.variant_id
                            ? `/api/house/variants/${p.variant_id}/image`
                            : `/api/profiles/${encodeURIComponent(p.user_id)}/characters/${p.character_id}/portrait`
                        }
                        alt={p.name}
                      />
                      <span>{p.name}</span>
                    </button>
                  ))}
                <div className="house-speech-bubbles" aria-label="Falas dos personagens">
                  {home.presence
                    .filter(
                      (p) => p.room === room && speeches[p.user_id]?.characterId === p.character_id,
                    )
                    .map((p) => {
                      const speech = speeches[p.user_id],
                        position = speechPositions[p.user_id];
                      if (!position) return null;
                      return (
                        <div
                          key={speech.id}
                          className="house-speech-bubble"
                          data-speaker={p.user_id}
                          title={`${p.name}: ${speech.body}`}
                          style={
                            {
                              left: position.x,
                              top: position.y,
                              width: position.width,
                              '--speech-tail': `${position.tail}px`,
                            } as CSSProperties
                          }
                        >
                          <strong>{p.name}</strong>
                          <p>{speech.body}</p>
                        </div>
                      );
                    })}
                </div>
                {(tab === 'rp' || rpPinned) && (
                  <div className={`house-rp-overlay ${chatActive ? 'chat-active' : ''}`}>
                    <div
                      className="house-rp-log"
                      role="log"
                      aria-label="Conversa de RP"
                      ref={chatLog}
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        followChat.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
                      }}
                    >
                      {home.messages.map((m) => (
                        <p key={m.id}>
                          <strong>{m.name}:</strong> {m.body}
                        </p>
                      ))}
                      {!home.messages.length && (
                        <p>A primeira história ainda está por ser contada.</p>
                      )}
                    </div>
                    <form
                      className="house-rp-compose"
                      aria-busy={busy}
                      ref={chatForm}
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!character || busy || !text.trim()) return;
                        messageKey.current ||= crypto.randomUUID();
                        const submitted = {
                          body: text,
                          key: messageKey.current,
                          characterId: character.id,
                          homeId,
                          generation: generation.current,
                        };
                        resumeChatInput.current = true;
                        chatInput.current?.focus({ preventScroll: true });
                        void run(async () => {
                          try {
                            await post(`/house/${submitted.homeId}/messages`, {
                              character_id: submitted.characterId,
                              body: submitted.body,
                              idempotency_key: submitted.key,
                            });
                            if (submitted.generation !== generation.current) return;
                            const untouched = messageKey.current === submitted.key;
                            if (untouched) messageKey.current = null;
                            followChat.current = true;
                            setText((draft) =>
                              untouched && draft === submitted.body ? '' : draft,
                            );
                            const v = await api<HouseState>(`/house/${submitted.homeId}`);
                            setHome((h) =>
                              h?.id === submitted.homeId ? { ...h, messages: v.messages } : h,
                            );
                          } finally {
                            if (
                              submitted.generation === generation.current &&
                              resumeChatInput.current
                            )
                              chatInput.current?.focus({ preventScroll: true });
                          }
                        });
                      }}
                    >
                      <input
                        ref={chatInput}
                        aria-label={`Mensagem de ${character?.name || 'personagem'}`}
                        maxLength={2000}
                        disabled={!character}
                        onFocus={() => {
                          resumeChatInput.current = true;
                          setChatActive(true);
                        }}
                        value={text}
                        onChange={(e) => {
                          setText(e.target.value);
                          messageKey.current = null;
                        }}
                        placeholder="Escreva sua mensagem de RP…"
                      />
                      <button
                        aria-label="Enviar"
                        title="Enviar mensagem de RP"
                        disabled={busy || !character || !text.trim()}
                      >
                        <Send size={22} />
                      </button>
                    </form>
                  </div>
                )}
                <div className="house-scene-caption">
                  {houseTemplates.find((t) => t.id === current?.template)?.name}
                </div>
              </div>
            </div>
          </div>
          <aside className="house-sidebar" aria-label="Painel da casa">
            <div className="house-sidebar-top">
              <strong>
                {{
                  decor: 'Decorar',
                  shop: 'Mobília',
                  guests: 'Convidados',
                  versions: 'Personagem',
                  rewards: 'Recompensas',
                  settings: 'Configurações',
                }[tab] || (choice ? 'Ajustes da peça' : 'Personagem')}
              </strong>
              {tab && tab !== 'rp' && (
                <button aria-label="Fechar painel" onClick={() => setTab('')}>
                  <X size={17} />
                </button>
              )}
            </div>
            {home.is_owner && choice && (
              <section className="house-inspector" aria-label="Ajustes da peça">
                <h3>{placementName(choice)}</h3>
                <fieldset
                  className="house-transform"
                  disabled={busy}
                  aria-label="Controles da peça"
                >
                  {choice.kind === 'item' && (
                    <>
                      <label>
                        Direção
                        <select
                          aria-label="Direção da peça"
                          value={choice.facing ?? 0}
                          onChange={(e) => patch(choice.id, { facing: Number(e.target.value) })}
                        >
                          {!choiceViews.some((view) => view.value === (choice.facing ?? 0)) && (
                            <option value={choice.facing} disabled>
                              Vista salva · escolha outra direção
                            </option>
                          )}
                          {choiceViews.map(({ label, value }) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {home.inventory.find((item) => item.id === choice.ref)?.catalog_id ===
                        'frame' && (
                        <label className="house-frame-backing-toggle">
                          <input
                            type="checkbox"
                            checked={choice.frame_backing === true}
                            onChange={(event) =>
                              patch(choice.id, { frame_backing: event.target.checked })
                            }
                          />
                          Manter fundo de madeira
                        </label>
                      )}
                    </>
                  )}
                  <label>
                    Tamanho
                    <input
                      aria-label="Tamanho da peça"
                      type="range"
                      min="3"
                      max="80"
                      step="0.1"
                      value={choice.scale * 100}
                      onChange={(e) => patch(choice.id, { scale: Number(e.target.value) / 100 })}
                    />
                  </label>
                  <button
                    type="button"
                    aria-pressed={distorting === choice.id}
                    onClick={() => setDistorting((id) => (id === choice.id ? '' : choice.id))}
                  >
                    <Scan size={16} />
                    {distorting === choice.id ? 'Concluir distorção' : 'Distorcer imagem'}
                  </button>
                  {distorting === choice.id && (
                    <small className="house-distortion-hint">
                      Arraste os quatro pontos. Cada canto pode variar até 12%. Use Salvar mudanças
                      para guardar.
                    </small>
                  )}
                  <button
                    type="button"
                    onClick={() => patch(choice.id, { distortion: undefined, rotation: 0 })}
                  >
                    <RotateCw size={16} />
                    Restaurar forma
                  </button>
                  <button onClick={() => order(choice.id, 1)}>Trazer à frente</button>
                  <button onClick={() => order(choice.id, -1)}>Enviar para trás</button>
                  <label>
                    Camada da peça
                    <select
                      aria-label="Camada da peça"
                      value={choice.depth_layer ?? 3}
                      onChange={(event) =>
                        patch(choice.id, { depth_layer: Number(event.target.value) })
                      }
                    >
                      {houseDepthLayers.map((layer) => (
                        <option key={layer} value={layer}>
                          Camada {layer}
                        </option>
                      ))}
                    </select>
                    <small>1 à frente · 6 ao fundo</small>
                  </label>
                  <button
                    onClick={() => {
                      edit((h) => ({
                        ...h,
                        rooms: h.rooms.map((r) => ({
                          ...r,
                          placements: r.placements.filter((p) => p.id !== choice.id),
                        })),
                      }));
                      setSelected('');
                    }}
                  >
                    <Package size={16} />
                    Guardar
                  </button>
                  {home.inventory.find((i) => i.id === choice.ref) && (
                    <button
                      onClick={() => setRead(home.inventory.find((i) => i.id === choice.ref)!)}
                    >
                      Ver lembrança
                    </button>
                  )}
                </fieldset>
              </section>
            )}
            {ownActor && (
              <div className="house-actor-controls" aria-label="Camadas do personagem">
                <label>
                  Camada do personagem
                  <select
                    aria-label="Camada do personagem"
                    value={ownActor.depth_layer ?? 3}
                    disabled={busy}
                    onChange={(e) => changeActorLayer(Number(e.target.value))}
                  >
                    {houseDepthLayers.map((layer) => (
                      <option value={layer} key={layer}>
                        Camada {layer}
                      </option>
                    ))}
                  </select>
                  <small>1 à frente · 6 ao fundo</small>
                </label>
                <button
                  disabled={busy || ownActor.depth_layer === 6}
                  onClick={() => changeActorLayer(6)}
                >
                  Atrás da mobília
                </button>
                <button
                  disabled={busy || ownActor.depth_layer === 1}
                  onClick={() => changeActorLayer(1)}
                >
                  À frente da mobília
                </button>
              </div>
            )}
            {tab && tab !== 'rp' && (
              <div className="house-panel" role="region" aria-label="Opções da casa">
                {tab === 'settings' && (
                  <section className="house-settings" aria-label="Configurações de RP">
                    <h3>Conversa de RP</h3>
                    <label className="house-rp-setting">
                      <input
                        type="checkbox"
                        checked={rpPinned}
                        onChange={(event) => {
                          const pinned = event.target.checked;
                          setRpPinned(pinned);
                          followChat.current = true;
                          try {
                            localStorage.setItem(`house-rp-pinned:${user.id}`, String(pinned));
                          } catch {
                            /* Optional browser preference. */
                          }
                        }}
                      />
                      Manter RP aberto
                    </label>
                    <small>
                      Deixe a conversa visível enquanto usa os outros controles. Clique no campo de
                      fala para consultar o histórico.
                    </small>
                  </section>
                )}
                {tab === 'decor' && home.is_owner && (
                  <>
                    <div className="house-settings">
                      <label>
                        Nome da casa
                        <input
                          maxLength={80}
                          disabled={busy}
                          value={home.name}
                          onChange={(e) => edit((h) => ({ ...h, name: e.target.value }))}
                        />
                      </label>
                      <label>
                        Cenário
                        <select
                          disabled={busy}
                          value={current?.template}
                          onChange={(e) =>
                            edit((h) => ({
                              ...h,
                              rooms: h.rooms.map((r) =>
                                r.kind === room ? { ...r, template: e.target.value } : r,
                              ),
                            }))
                          }
                        >
                          {houseTemplates
                            .filter((t) => t.kind === room)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <p className="house-help">
                      Escolha uma peça e arraste pela cena. Ajuste a direção, o tamanho e as camadas
                      neste painel; salve quando terminar.
                    </p>
                    <div className="house-inventory">
                      {home.inventory.map((item) => (
                        <div
                          key={item.id}
                          className="house-inventory-item"
                          data-house-inventory={item.id}
                        >
                          <button
                            disabled={busy || placed(item.id)}
                            onClick={() => add('item', item.id)}
                          >
                            <ItemArt item={item} />
                            <strong>
                              {item.content.title ||
                                houseCatalog.find((c) => c.id === item.catalog_id)?.name}
                            </strong>
                            <small>{placed(item.id) ? 'Na casa' : 'Colocar'}</small>
                          </button>
                          <div>
                            {['letter', 'frame'].includes(item.catalog_id) && (
                              <>
                                <button onClick={() => setRead(item)}>Ler</button>
                                <button
                                  disabled={placed(item.id) || busy}
                                  onClick={() => {
                                    setGift(item);
                                    setQuery('');
                                    setRecipient(null);
                                  }}
                                >
                                  <Gift size={13} />
                                  Oferecer
                                </button>
                              </>
                            )}
                            <button
                              disabled={busy}
                              aria-label={`Excluir ${item.content.title || houseCatalog.find((c) => c.id === item.catalog_id)?.name}`}
                              onClick={() => setDeleting(item)}
                            >
                              <Trash2 size={13} />
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                      {home.companions.map((c) => (
                        <button
                          key={c.id}
                          disabled={busy || placed(c.id)}
                          onClick={() => add(c.kind, c.id)}
                        >
                          {c.kind === 'pet' ? (
                            <OwnedPetArt pet={c} />
                          ) : (
                            <img src={ownedMountImage(c as any)} alt={c.name} />
                          )}
                          <strong>{c.name}</strong>
                          <small>{placed(c.id) ? 'Na casa' : 'Colocar companheiro'}</small>
                        </button>
                      ))}
                    </div>
                    {!home.inventory.length && !home.companions.length && (
                      <p>
                        Sua coleção está vazia. Encontre móveis na aba Mobília ou receba lembranças
                        de missões.
                      </p>
                    )}
                  </>
                )}
                {tab === 'shop' && home.is_owner && (
                  <>
                    <div className="house-panel-heading">
                      <h3>Mobília & lembranças</h3>
                      <span>
                        {home.gold_unlimited ? '∞' : money(home.gold_cp || 0)} PO{' '}
                        <a href="#shop">Ir ao Empório</a>
                      </span>
                    </div>
                    <div className="house-catalog">
                      {(index?.catalog || houseCatalog).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setBuy(c.id);
                            if (!sound.muted && sound.volume > 0) {
                              const audio = new Audio(c.audio_path);
                              audio.volume = sound.volume;
                              void audio.play().catch(() => {});
                            }
                            setTitle('');
                            setDedication('');
                            setPicture(null);
                            purchaseKey.current = crypto.randomUUID();
                          }}
                        >
                          <img src={c.image} alt="" />
                          <strong>{c.name}</strong>
                          <span>{money(c.price_cp)} PO</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {tab === 'guests' && home.is_owner && (
                  <>
                    <h3>Receber companheiros</h3>
                    <p>
                      O convite libera a visita e o RP. Você pode revogar o acesso a qualquer
                      momento.
                    </p>
                    <label>
                      Buscar jogador
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Nome do jogador"
                      />
                    </label>
                    <div className="house-people">
                      {people.map((p) => (
                        <button
                          key={p.id}
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await post(`/house/${homeId}/invites`, { user_id: p.id });
                              await load();
                              setNotice(`Convite enviado a ${p.name}.`);
                            })
                          }
                        >
                          Convidar {p.name}
                        </button>
                      ))}
                    </div>
                    <ul className="house-guest-list">
                      {home.invites.map((i) => (
                        <li key={i.user_id}>
                          <span>
                            {i.name} ·{' '}
                            {i.status === 'accepted'
                              ? 'Aceito'
                              : i.status === 'pending'
                                ? 'Pendente'
                                : i.status === 'declined'
                                  ? 'Recusado'
                                  : 'Revogado'}
                          </span>
                          {['accepted', 'pending'].includes(i.status) && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  await api(
                                    `/house/${homeId}/invites/${encodeURIComponent(i.user_id)}`,
                                    { method: 'PUT', body: JSON.stringify({ status: 'revoked' }) },
                                  );
                                  await load();
                                })
                              }
                            >
                              Revogar
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {tab === 'versions' && (
                  <>
                    <h3>Seu personagem na casa</h3>
                    {character ? (
                      <>
                        <label>
                          Aparência
                          <select
                            aria-label="Aparência do personagem"
                            value={variant}
                            onChange={(e) => setVariant(e.target.value)}
                          >
                            <option value="">Arte atual</option>
                            {index?.variants
                              .filter((v) => v.character_id === character.id)
                              .map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Tamanho do personagem
                          <input
                            aria-label="Tamanho do personagem"
                            type="range"
                            min="5"
                            max="45"
                            value={presenceScale * 100}
                            onChange={(e) => setPresenceScale(Number(e.target.value) / 100)}
                          />
                        </label>
                        <div className="house-inline">
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await api(`/house/${homeId}/presence`, {
                                  method: 'PUT',
                                  body: JSON.stringify({
                                    character_id: character.id,
                                    variant_id: variant || null,
                                    room,
                                    x:
                                      home.presence.find(
                                        (p) => p.user_id === user.id && p.room === room,
                                      )?.x ||
                                      [0.45, 0.64, 0.26, 0.82].find(
                                        (x) =>
                                          !home.presence.some(
                                            (p) => p.room === room && Math.abs(p.x - x) < 0.14,
                                          ),
                                      ) ||
                                      0.5,
                                    y:
                                      home.presence.find(
                                        (p) => p.user_id === user.id && p.room === room,
                                      )?.y || 0.84,
                                    scale: presenceScale,
                                    depth_layer: ownActor?.depth_layer ?? 1,
                                  }),
                                });
                                const v = await api<HouseState>(`/house/${homeId}`);
                                setHome((h) => (h ? { ...h, presence: v.presence } : h));
                              })
                            }
                          >
                            Entrar na cena
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await api(`/house/${homeId}/presence`, { method: 'DELETE' });
                                setHome((h) =>
                                  h
                                    ? {
                                        ...h,
                                        presence: h.presence.filter((p) => p.user_id !== user.id),
                                      }
                                    : h,
                                );
                              })
                            }
                          >
                            Sair da cena
                          </button>
                        </div>
                        <p className="house-help">
                          Arraste seu personagem para posicioná-lo e escolha sua camada no painel.
                        </p>
                      </>
                    ) : (
                      <p>Selecione um personagem no menu Personagem.</p>
                    )}
                  </>
                )}
                {tab === 'rewards' && index?.can_admin && (
                  <>
                    <h3>Mobília da guilda</h3>
                    <label>
                      Peça
                      <select
                        value={rewardCatalog}
                        onChange={(e) => setRewardCatalog(e.target.value)}
                      >
                        {houseCatalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <details>
                      <summary>Conceder a um personagem</summary>
                      <label>
                        Buscar jogador
                        <input value={query} onChange={(e) => setQuery(e.target.value)} />
                      </label>
                      <div className="house-people">
                        {people.map((p) => (
                          <button key={p.id} onClick={() => void run(() => openRecipient(p.id))}>
                            {p.name}
                          </button>
                        ))}
                      </div>
                      <label>
                        Motivo
                        <input
                          maxLength={300}
                          value={grantReason}
                          onChange={(e) => setGrantReason(e.target.value)}
                        />
                      </label>
                      {recipient?.characters.map((c) => (
                        <button
                          key={c.id}
                          disabled={busy || grantReason.trim().length < 3}
                          onClick={() =>
                            void run(async () => {
                              await post('/house/admin/grants', {
                                character_id: c.id,
                                catalog_id: rewardCatalog,
                                reason: grantReason,
                                idempotency_key: crypto.randomUUID(),
                              });
                              setNotice(`Peça concedida a ${c.name}.`);
                            })
                          }
                        >
                          Conceder a {c.name}
                        </button>
                      ))}
                    </details>
                    <form
                      className="house-settings"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(async () => {
                          const data = {
                            catalog_id: rewardCatalog,
                            ...(rewardKind === 'mission'
                              ? { mission_id: rewardValue }
                              : rewardKind === 'achievement'
                                ? { achievement_code: rewardValue }
                                : { mission_count: Number(rewardValue) }),
                          };
                          const r = await post('/house/admin/rewards', data);
                          setRules((v) => [...v, r]);
                          setNotice('Recompensa vinculada ao histórico.');
                        });
                      }}
                    >
                      <label>
                        Vínculo
                        <select
                          value={rewardKind}
                          onChange={(e) => {
                            setRewardKind(e.target.value);
                            setRewardValue(
                              e.target.value === 'count'
                                ? '1'
                                : e.target.value === 'achievement'
                                  ? achievementCatalog[0].code
                                  : missions[0]?.id || '',
                            );
                          }}
                        >
                          <option value="count">Missões concluídas</option>
                          <option value="mission">Missão específica</option>
                          <option value="achievement">Conquista</option>
                        </select>
                      </label>
                      <label>
                        Requisito
                        {rewardKind === 'count' ? (
                          <input
                            required
                            type="number"
                            min="1"
                            max="10000"
                            value={rewardValue}
                            onChange={(e) => setRewardValue(e.target.value)}
                          />
                        ) : (
                          <select
                            value={rewardValue}
                            onChange={(e) => setRewardValue(e.target.value)}
                          >
                            {rewardKind === 'mission'
                              ? missions.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.title}
                                  </option>
                                ))
                              : achievementCatalog.map((a) => (
                                  <option key={a.code} value={a.code}>
                                    {a.title}
                                  </option>
                                ))}
                          </select>
                        )}
                      </label>
                      <button disabled={busy}>Vincular recompensa</button>
                    </form>
                    <ul className="house-guest-list">
                      {rules.map((r) => (
                        <li key={r.id}>
                          <span>
                            {houseCatalog.find((c) => c.id === r.catalog_id)?.name} ·{' '}
                            {r.mission_count
                              ? `${r.mission_count} missões`
                              : r.achievement_code
                                ? achievementCatalog.find((a) => a.code === r.achievement_code)
                                    ?.title
                                : missions.find((m) => m.id === r.mission_id)?.title}{' '}
                            · {r.active ? 'Ativa' : 'Inativa'}
                          </span>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await api(`/house/admin/rewards/${r.id}`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ active: !r.active }),
                                });
                                setRules((v) =>
                                  v.map((x) => (x.id === r.id ? { ...x, active: !r.active } : x)),
                                );
                              })
                            }
                          >
                            {r.active ? 'Desativar' : 'Ativar'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            {!tab && !choice && (
              <p className="house-sidebar-hint">
                Escolha uma opção à esquerda ou uma peça na cena.
              </p>
            )}
          </aside>
        </div>
      )}
      {buy && spec && home && (
        <Modal
          title={spec.name}
          close={() => {
            if (!busy) setBuy('');
          }}
        >
          <form
            className="house-buy"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const image = picture ? await fileData(picture) : undefined;
                purchaseKey.current ||= crypto.randomUUID();
                await post('/house/purchase', {
                  character_id: home.character_id,
                  catalog_id: buy,
                  idempotency_key: purchaseKey.current,
                  content: { title, text: dedication },
                  ...(image ? { image } : {}),
                });
                setBuy('');
                purchaseKey.current = null;
                await load();
                await onPurchased();
                setNotice('Peça guardada na coleção da casa.');
              });
            }}
          >
            <img src={spec.image} alt={spec.name} />
            <p>{spec.description}</p>
            <blockquote>{spec.speech}</blockquote>
            {['letter', 'frame'].includes(buy) && (
              <>
                <label>
                  {buy === 'letter' ? 'Assunto' : 'Nome da lembrança'}
                  <input
                    maxLength={80}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      purchaseKey.current = crypto.randomUUID();
                    }}
                  />
                </label>
                <label>
                  {buy === 'letter' ? 'Sua carta' : 'Dedicatória'}
                  <textarea
                    maxLength={3000}
                    value={dedication}
                    onChange={(e) => {
                      setDedication(e.target.value);
                      purchaseKey.current = crypto.randomUUID();
                    }}
                  />
                </label>
                {buy === 'frame' && (
                  <label>
                    Imagem
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        setPicture(e.target.files?.[0] || null);
                        purchaseKey.current = crypto.randomUUID();
                      }}
                    />
                  </label>
                )}
              </>
            )}
            <div className="item-purchase-actions">
              <button disabled={busy} type="submit">
                Comprar por {money(spec.price_cp)} PO
              </button>
              <ItemInfoButton
                item={{ ...spec, id: `house-${spec.id}`, category: 'Itens de House' }}
              />
            </div>
            {error && <p role="alert">{error}</p>}
          </form>
        </Modal>
      )}
      {read && <HouseItemReader item={read} close={() => setRead(null)} />}
      {deleting && home?.is_owner && (
        <Modal
          title="Excluir item da House?"
          close={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="stack">
            <p>
              Deseja realmente excluir{' '}
              <strong>
                {deleting.content.title ||
                  houseCatalog.find((c) => c.id === deleting.catalog_id)?.name}
              </strong>
              ?
            </p>
            <p>
              A peça será retirada do inventário da House e da decoração. Essa ação não devolve
              ouro.
            </p>
            <div className="house-inline">
              <button type="button" disabled={busy} onClick={() => setDeleting(null)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                className="danger"
                onClick={() =>
                  void run(async () => {
                    const item = deleting,
                      id = homeId,
                      currentGeneration = generation.current;
                    await api(`/house/items/${item.id}`, { method: 'DELETE' });
                    const fresh = await api<HouseState>(`/house/${id}`);
                    if (currentGeneration !== generation.current) return;
                    setHome((h) =>
                      h?.id === id
                        ? dirtyRef.current
                          ? {
                              ...h,
                              revision: fresh.revision,
                              inventory: fresh.inventory,
                              items: fresh.items,
                              rooms: h.rooms.map((room) => ({
                                ...room,
                                placements: room.placements.filter(
                                  (piece) => !(piece.kind === 'item' && piece.ref === item.id),
                                ),
                              })),
                            }
                          : fresh
                        : h,
                    );
                    if (choice?.ref === item.id) {
                      setSelected('');
                      setDistorting('');
                    }
                    setDeleting(null);
                    setNotice('Item excluído da House.');
                  })
                }
              >
                Excluir item
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
          </div>
        </Modal>
      )}
      {gift && (
        <Modal
          title="Oferecer uma lembrança"
          close={() => {
            if (!busy) setGift(null);
          }}
        >
          <div className="stack">
            <p>
              {gift.content.title || houseCatalog.find((c) => c.id === gift.catalog_id)?.name} será
              transferido para o inventário do personagem escolhido.
            </p>
            <label>
              Buscar jogador
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="house-people">
              {people.map((p) => (
                <button key={p.id} onClick={() => void run(() => openRecipient(p.id))}>
                  {p.name}
                </button>
              ))}
            </div>
            {recipient && (
              <>
                <h4>{recipient.name}</h4>
                {recipient.characters.map((c) => (
                  <button
                    key={c.id}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await post(`/house/items/${gift.id}/gift`, { character_id: c.id });
                        setGift(null);
                        await load();
                        setNotice(`Lembrança enviada a ${c.name}.`);
                      })
                    }
                  >
                    Oferecer a {c.name}
                  </button>
                ))}
              </>
            )}
            {error && <p role="alert">{error}</p>}
          </div>
        </Modal>
      )}
    </section>
  );
}
