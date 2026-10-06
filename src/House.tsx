import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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
} from 'lucide-react';
import { api, post } from './api';
import { Modal } from './components';
import {
  houseCatalog,
  houseTemplates,
  roomKinds,
  type HouseState,
  type HousePlacement,
  type HouseItem,
  type HouseVariant,
} from '../shared/house';
import { achievementCatalog } from '../shared/achievements';
import { PetArt } from './PetShop';
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
  houseViewLabels,
  shiftHouseLayer,
} from '../shared/house-perspective';
import './house.css';
import frameQuads from '../shared/house-frame-quads.json';
type Index = {
  homes: { id: string; character_id: string; name: string; character_name: string }[];
  invites: { home_id: string; status: string; name: string; owner_name: string }[];
  variants: HouseVariant[];
  can_admin: boolean;
};
type Profile = { id: string; name: string; characters: { id: string; name: string }[] };
const labels = { sala: 'Sala', cozinha: 'Cozinha', varanda: 'Varanda', jardim: 'Jardim' };
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
function HousePicture({ item, facing }: { item: HouseItem; facing: number }) {
  const ref = useRef<HTMLImageElement>(null),
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
    <img
      ref={ref}
      className="house-picture"
      style={{ transform: matrix, visibility: matrix ? 'visible' : 'hidden' }}
      src={`/api/house/items/${item.id}/image`}
      alt={item.content.title || 'Lembrança'}
    />
  );
}
function ItemArt({ item, facing }: { item: HouseItem; facing?: number }) {
  const spec = houseCatalog.find((c) => c.id === item.catalog_id);
  return (
    <span
      className={`house-item-art ${item.catalog_id === 'frame' ? 'house-frame-art' : ''}`}
      data-facing={facing}
    >
      {item.has_image && (facing === undefined || [0, 1, 7].includes(facing)) && (
        <HousePicture item={item} facing={facing ?? 0} />
      )}
      <img
        src={
          facing === undefined
            ? item.catalog_id === 'frame'
              ? '/house/items/views/frame/0.webp'
              : spec?.image
            : `/house/items/views/${item.catalog_id}/${facing}.webp`
        }
        alt={spec?.name || 'Decoração'}
        onError={(e) => {
          if (e.currentTarget.src.includes('/house/items/views/') && spec)
            e.currentTarget.src = spec.image;
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
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [buy, setBuy] = useState(''),
    [read, setRead] = useState<HouseItem | null>(null),
    [gift, setGift] = useState<HouseItem | null>(null),
    [variant, setVariant] = useState(''),
    [presenceScale, setPresenceScale] = useState(0.19),
    [variantName, setVariantName] = useState(''),
    [variantFile, setVariantFile] = useState<File | null>(null),
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
  const stage = useRef<HTMLDivElement>(null),
    chatLog = useRef<HTMLDivElement>(null),
    followChat = useRef(true),
    dirtyRef = useRef(false),
    purchaseKey = useRef<string | null>(null),
    messageKey = useRef<string | null>(null),
    generation = useRef(0);
  const sound = useSoundEffects();
  const lastMessage = home?.messages.at(-1)?.id;
  useEffect(() => {
    if (tab === 'rp' && followChat.current && chatLog.current)
      chatLog.current.scrollTop = chatLog.current.scrollHeight;
  }, [lastMessage, tab, homeId]);
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
                    presence: v.presence,
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
    spec = houseCatalog.find((c) => c.id === buy);
  function edit(fn: (h: HouseState) => HouseState) {
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
    edit((h) => ({
      ...h,
      rooms: h.rooms.map((r) => ({
        ...r,
        placements: shiftHouseLayer(r.placements, id, direction),
      })),
    }));
  }
  function add(kind: HousePlacement['kind'], ref: string) {
    const id = crypto.randomUUID();
    const companion = home?.companions.find((c) => c.id === ref);
    const scale =
      kind === 'mount'
        ? 0.5 * (mounts.find((m) => m.id === companion?.mount_id)?.scale || 1)
        : kind === 'pet'
          ? (0.09 *
              petArtwork(companion?.pet_id || 'dog', companion?.appearance || 'original').width) /
            218
          : 0.17;
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
                  scale: Math.max(0.03, Math.min(0.55, scale)),
                  rotation: 0,
                  facing: 0,
                  layer: r.placements.length,
                },
              ],
            }
          : r,
      ),
    }));
    setSelected(id);
  }
  function drag(event: PointerEvent<HTMLButtonElement>, p: HousePlacement) {
    if (!home?.is_owner || busy) return;
    setSelected(p.id);
    const bounds = stage.current!.getBoundingClientRect(),
      factor = housePerspectiveScale(p.y),
      grab = {
        x: (event.clientX - bounds.left - p.x * bounds.width) / factor,
        y: (event.clientY - bounds.top - p.y * bounds.height) / factor,
      };
    let y = p.y;
    event.currentTarget.setPointerCapture(event.pointerId);
    const el = event.currentTarget;
    const move = (e: globalThis.PointerEvent) => {
      const position = houseDragPosition(
        { x: e.clientX - bounds.left, y: e.clientY - bounds.top },
        grab,
        bounds,
        y,
      );
      y = position.y;
      patch(p.id, position);
    };
    const end = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  function dragActor(event: PointerEvent<HTMLButtonElement>, p: HouseState['presence'][number]) {
    if (p.user_id !== user.id || busy) return;
    const bounds = stage.current!.getBoundingClientRect(),
      factor = housePerspectiveScale(p.y),
      grab = {
        x: (event.clientX - bounds.left - p.x * bounds.width) / factor,
        y: (event.clientY - bounds.top - p.y * bounds.height) / factor,
      };
    let x = p.x,
      y = p.y;
    const el = event.currentTarget;
    el.setPointerCapture(event.pointerId);
    const move = (e: globalThis.PointerEvent) => {
      ({ x, y } = houseDragPosition(
        { x: e.clientX - bounds.left, y: e.clientY - bounds.top },
        grab,
        bounds,
        y,
        0.1,
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
          }),
        });
      });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  function placed(ref: string) {
    return home?.rooms.some((r) => r.placements.some((p) => p.ref === ref));
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
    <section className="house-workspace" aria-label="House">
      <header className="house-header">
        <div>
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
        <>
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
          <div
            className="house-scene"
            ref={stage}
            style={{
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
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`house-piece ${selected === p.id ? 'selected' : ''}`}
                  aria-label={`${name}${home.is_owner ? ' · mover' : ''}`}
                  style={
                    {
                      left: `${p.x * 100}%`,
                      top: `${p.y * 100}%`,
                      width: `${p.scale * housePerspectiveScale(p.y) * (item ? houseViewWidth(item.catalog_id, p.facing ?? 0) : 1) * 100}%`,
                      transform: `translate(-50%,-100%) rotate(${p.rotation}deg)`,
                      zIndex: p.layer * 2 + 2,
                    } as CSSProperties
                  }
                  data-base-scale={p.scale}
                  data-depth-scale={housePerspectiveScale(p.y)}
                  data-facing={p.facing ?? 0}
                  data-layer={p.layer}
                  onPointerDown={(e) => drag(e, p)}
                  onClick={() => {
                    if (home.is_owner) setSelected(p.id);
                    else if (item && ['letter', 'frame'].includes(item.catalog_id)) setRead(item);
                  }}
                >
                  {item ? (
                    <ItemArt item={item} facing={p.facing ?? 0} />
                  ) : p.kind === 'pet' && companion ? (
                    <PetArt
                      pet={pets.find((a) => a.id === companion.pet_id) || pets[0]}
                      appearance={companion.appearance}
                    />
                  ) : companion ? (
                    <img src={ownedMountImage(companion as any)} alt={name} />
                  ) : null}
                </button>
              );
            })}
            {home.presence
              .filter((p) => p.room === room)
              .map((p) => (
                <button
                  key={p.user_id}
                  className="house-actor"
                  data-layer={p.layer}
                  aria-label={`${p.name}${p.user_id === user.id ? ' · mover personagem' : ''}`}
                  onPointerDown={(e) => dragActor(e, p)}
                  data-base-scale={p.scale}
                  data-depth-scale={housePerspectiveScale(p.y)}
                  style={{
                    left: `${p.x * 100}%`,
                    top: `${p.y * 100}%`,
                    width: `${p.scale * housePerspectiveScale(p.y) * 100}%`,
                    zIndex: p.layer,
                  }}
                >
                  <img
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
            {tab === 'rp' && (
              <div className="house-rp-overlay">
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
                  {!home.messages.length && <p>A primeira história ainda está por ser contada.</p>}
                </div>
                <form
                  className="house-rp-compose"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!character || busy || !text.trim()) return;
                    messageKey.current ||= crypto.randomUUID();
                    void run(async () => {
                      await post(`/house/${homeId}/messages`, {
                        character_id: character.id,
                        body: text,
                        idempotency_key: messageKey.current,
                      });
                      messageKey.current = null;
                      followChat.current = true;
                      setText('');
                      const v = await api<HouseState>(`/house/${homeId}`);
                      setHome((h) => (h ? { ...h, messages: v.messages } : h));
                    });
                  }}
                >
                  <input
                    aria-label={`Mensagem de ${character?.name || 'personagem'}`}
                    maxLength={2000}
                    disabled={busy || !character}
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
            <button aria-pressed={tab === 'rp'} onClick={() => toggle('rp')}>
              <MessageCircle size={17} />
              RP
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
          {tab && tab !== 'rp' && (
            <div className="house-panel">
              <button
                className="house-panel-close"
                aria-label="Fechar painel"
                onClick={() => setTab('')}
              >
                <X size={17} />
              </button>
              {tab === 'decor' && home.is_owner && (
                <>
                  <div className="house-settings">
                    <label>
                      Nome da casa
                      <input
                        maxLength={80}
                        value={home.name}
                        onChange={(e) => edit((h) => ({ ...h, name: e.target.value }))}
                      />
                    </label>
                    <label>
                      Cenário
                      <select
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
                  {choice && (
                    <div className="house-transform">
                      {choice.kind === 'item' && (
                        <label>
                          Direção
                          <select
                            aria-label="Direção da peça"
                            value={choice.facing ?? 0}
                            onChange={(e) => patch(choice.id, { facing: Number(e.target.value) })}
                          >
                            {houseViewLabels.map((label, i) => (
                              <option value={i} key={label}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        Tamanho
                        <input
                          aria-label="Tamanho da peça"
                          type="range"
                          min="3"
                          max="55"
                          value={choice.scale * 100}
                          onChange={(e) =>
                            patch(choice.id, { scale: Number(e.target.value) / 100 })
                          }
                        />
                      </label>
                      <label>
                        Giro
                        <input
                          aria-label="Giro da peça"
                          type="range"
                          min="-180"
                          max="180"
                          value={choice.rotation}
                          onChange={(e) => patch(choice.id, { rotation: Number(e.target.value) })}
                        />
                      </label>
                      <button onClick={() => patch(choice.id, { rotation: 0 })}>
                        <RotateCw size={16} />
                        Endireitar
                      </button>
                      <button onClick={() => order(choice.id, 1)}>Trazer à frente</button>
                      <button onClick={() => order(choice.id, -1)}>Enviar para trás</button>
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
                    </div>
                  )}
                  <p className="house-help">
                    Escolha uma peça e arraste pela cena. Ajuste tamanho, giro e ordem; salve quando
                    terminar.
                  </p>
                  <div className="house-inventory">
                    {home.inventory.map((item) => (
                      <div key={item.id} className="house-inventory-item">
                        <button disabled={placed(item.id)} onClick={() => add('item', item.id)}>
                          <ItemArt item={item} />
                          <strong>
                            {item.content.title ||
                              houseCatalog.find((c) => c.id === item.catalog_id)?.name}
                          </strong>
                          <small>{placed(item.id) ? 'Na casa' : 'Colocar'}</small>
                        </button>
                        {['letter', 'frame'].includes(item.catalog_id) && (
                          <div>
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
                          </div>
                        )}
                      </div>
                    ))}
                    {home.companions.map((c) => (
                      <button key={c.id} disabled={placed(c.id)} onClick={() => add(c.kind, c.id)}>
                        {c.kind === 'pet' ? (
                          <PetArt
                            pet={pets.find((p) => p.id === c.pet_id) || pets[0]}
                            appearance={c.appearance}
                          />
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
                      Sua coleção está vazia. Encontre móveis na aba Mobília ou receba lembranças de
                      missões.
                    </p>
                  )}
                </>
              )}
              {tab === 'shop' && home.is_owner && (
                <>
                  <div className="house-panel-heading">
                    <h3>Mobília & lembranças</h3>
                    <span>
                      {money(home.gold_cp || 0)} PO <a href="#shop">Ir ao Empório</a>
                    </span>
                  </div>
                  <div className="house-catalog">
                    {houseCatalog.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setBuy(c.id);
                          if (!sound.muted && sound.volume > 0) {
                            const audio = new Audio(`/audio/emporium/house-${c.id}.wav`);
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
                    O convite libera a visita e o RP. Você pode revogar o acesso a qualquer momento.
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
                      {home.presence
                        .filter((p) => p.user_id === user.id && p.room === room)
                        .map((p) => (
                          <label key={p.user_id}>
                            Camada do personagem
                            <select
                              aria-label="Camada do personagem"
                              value={p.layer}
                              disabled={busy}
                              onChange={(e) => {
                                const layer = Number(e.target.value);
                                void run(async () => {
                                  await api(`/house/${homeId}/presence`, {
                                    method: 'PUT',
                                    body: JSON.stringify({
                                      character_id: p.character_id,
                                      variant_id: p.variant_id,
                                      room: p.room,
                                      x: p.x,
                                      y: p.y,
                                      scale: p.scale,
                                      layer,
                                    }),
                                  });
                                  setHome((h) =>
                                    h
                                      ? {
                                          ...h,
                                          presence: h.presence.map((a) =>
                                            a.user_id === user.id ? { ...a, layer } : a,
                                          ),
                                        }
                                      : h,
                                  );
                                });
                              }}
                            >
                              <option value={602}>À frente de todos os objetos</option>
                              <option value={0}>Atrás de todos os objetos</option>
                              {(current?.placements || []).map((piece) => (
                                <option key={piece.id} value={piece.layer * 2 + 1}>
                                  Atrás de{' '}
                                  {home.inventory.find((i) => i.id === piece.ref)?.content.title ||
                                    houseCatalog.find(
                                      (c) =>
                                        c.id ===
                                        home.inventory.find((i) => i.id === piece.ref)?.catalog_id,
                                    )?.name ||
                                    home.companions.find((c) => c.id === piece.ref)?.name ||
                                    'objeto'}
                                </option>
                              ))}
                              {p.layer !== 0 &&
                                p.layer !== 602 &&
                                !current?.placements.some((v) => v.layer * 2 + 1 === p.layer) && (
                                  <option value={p.layer}>Camada atual</option>
                                )}
                            </select>
                          </label>
                        ))}
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
                        Arraste seu personagem para posicioná-lo. Crie versões com poses diferentes
                        enviando uma imagem transparente, ou guarde sua arte atual.
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void run(async () => {
                            const v = await post<HouseVariant>('/house/variants', {
                              character_id: character.id,
                              name: variantName,
                              ...(variantFile ? { image: await fileData(variantFile) } : {}),
                            });
                            await refreshIndex();
                            setVariant(v.id);
                            setVariantName('');
                            setVariantFile(null);
                            setNotice('Versão guardada.');
                          });
                        }}
                        className="house-settings"
                      >
                        <label>
                          Nome da versão
                          <input
                            required
                            minLength={2}
                            maxLength={60}
                            value={variantName}
                            onChange={(e) => setVariantName(e.target.value)}
                          />
                        </label>
                        <label>
                          Imagem da pose (opcional)
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => setVariantFile(e.target.files?.[0] || null)}
                          />
                        </label>
                        <button disabled={busy}>Guardar versão</button>
                      </form>
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
                              ? achievementCatalog.find((a) => a.code === r.achievement_code)?.title
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
        </>
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
            <button disabled={busy} type="submit">
              Comprar por {money(spec.price_cp)} PO
            </button>
            {error && <p role="alert">{error}</p>}
          </form>
        </Modal>
      )}
      {read && (
        <Modal
          title={
            read.content.title ||
            houseCatalog.find((c) => c.id === read.catalog_id)?.name ||
            'Lembrança'
          }
          close={() => setRead(null)}
        >
          <div className="house-letter">
            <ItemArt item={read} />
            <p>
              {read.content.text || houseCatalog.find((c) => c.id === read.catalog_id)?.description}
            </p>
            {read.sender_name && <small>Presente de {read.sender_name}</small>}
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
