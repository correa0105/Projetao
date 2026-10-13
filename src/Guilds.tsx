import { useState, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import {
  Shield,
  Users,
  Coins,
  Trophy,
  Settings2,
  Plus,
  Lock,
  ArrowLeft,
  Save,
  Home,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, post } from './api';
import type { User, Character } from './types';
import {
  crestSchema,
  guildDocumentSchema,
  guildRooms,
  guildDecor,
  type Crest,
  type GuildDocument,
  type CommunitySettings,
} from '../shared/guilds';
import {
  houseItemImage,
  houseFacingOptions,
  houseDefaultFacing,
  houseDefaultScale,
  houseTurnFacing,
} from '../shared/house';
import { GuildCrest } from './GuildCrest';
import { CrestEditor } from './GuildCrestEditor';
import { Modal } from './components';
import { visitProfile } from './HallOfFame';
import {
  guildFurnitureGeometry,
  guildFurnitureVisibleRect,
} from './guild-furniture-geometry';
import { GuildFurnitureArt } from './GuildFurnitureArt';
import {
  GuildPerspectiveControls,
  type GuildPieceGeometry,
} from './GuildPerspectiveControls';
import { guildRoomPerspective } from '../shared/guild-perspective';
import './guild-perspective.css';
import './guilds.css';
type Settings = { document: CommunitySettings; revision: number; can_edit: boolean };
type Entry = {
  id: string;
  name: string;
  crest: Crest;
  prestige: number;
  members: number;
  rank: string;
};
type Directory = {
  items: Entry[];
  mine: string | null;
  invites: { guild_id: string; name: string; crest: Crest }[];
};
type Guild = {
  id: string;
  document: GuildDocument;
  revision: number;
  is_owner: boolean;
  is_member: boolean;
  owner_id: string;
  level: number;
  rank: string;
  prestige: number;
  treasury_cp: number | null;
  room_unlocks: CommunitySettings['room_unlocks'];
  members: { user_id: string; name: string; character_name: string }[];
  upgrades: { object_id: string; level: number }[];
  ledger: { kind: string; amount_cp: string; created_at: string }[];
  weekly: {
    week: string;
    items: {
      mission_id: string;
      template: CommunitySettings['missions'][number];
      progress: number;
      claimed_at: string | null;
    }[];
  } | null;
};
export function Guilds({
  user,
  characters,
  onPurchased,
}: {
  user: User;
  characters: Character[];
  onPurchased: () => void | Promise<void>;
}) {
  const [directory, setDirectory] = useState<Directory | null>(null),
    [settings, setSettings] = useState<Settings | null>(null),
    [g, setG] = useState<Guild | null>(null),
    [target, setTarget] = useState(
      new URLSearchParams(location.hash.split('?')[1] || '').get('id') || '',
    ),
    [tab, setTab] = useState('house'),
    [room, setRoom] = useState('main'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [founding, setFounding] = useState(false),
    [character, setCharacter] = useState(characters[0]?.id || ''),
    [doc, setDoc] = useState<GuildDocument | null>(null),
    [config, setConfig] = useState<CommunitySettings | null>(null),
    [selected, setSelected] = useState(''),
    [search, setSearch] = useState(''),
    [people, setPeople] = useState<{ id: string; name: string }[]>([]),
    [decor, setDecor] = useState(guildDecor[0]?.id || '');
  const request = useRef(crypto.randomUUID());
  const scene = useRef<HTMLDivElement>(null);
  const refreshTurnControls = useRef<(() => void) | null>(null);
  const [perspectiveEditing, setPerspectiveEditing] = useState('');
  const [pieceGeometry, setPieceGeometry] = useState<GuildPieceGeometry | null>(null);
  const grab = useRef<{
    id: string;
    pointer: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [turnControls, setTurnControls] = useState<{
    left: number;
    right: number;
    top: number;
  } | null>(null);
  async function load() {
    const [d, s] = await Promise.all([
      api<Directory>('/guilds'),
      api<Settings>('/community/settings'),
    ]);
    setDirectory(d);
    setSettings(s);
    if (target) setG(await api<Guild>('/guilds/' + target));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (!document.hidden && !doc) void load().catch((e) => setError(e.message));
    }, 30000);
    return () => clearInterval(timer);
  }, [target, Boolean(doc)]);
  useEffect(() => {
    const fn = () => {
      setTarget(new URLSearchParams(location.hash.split('?')[1] || '').get('id') || '');
      setDoc(null);
      setG(null);
      setRoom('main');
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  useEffect(() => {
    if (!g?.is_owner) return;
    let active = true;
    const timer = setTimeout(
      () =>
        void api<{ items: { id: string; name: string }[] }>(
          '/profiles?q=' + encodeURIComponent(search),
        )
          .then(
            (r) =>
              active &&
              setPeople(r.items.filter((p) => !g.members.some((m) => m.user_id === p.id))),
          )
          .catch((e) => active && setError(e.message)),
      250,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, g?.id, g?.members.length]);
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
  const current = doc || g?.document,
    obj = current?.placements.find((p) => p.id === selected),
    level = g?.upgrades.find((u) => u.object_id === selected)?.level || 1,
    upgrade = settings?.document.upgrades.find((u) => u.catalog === obj?.catalog),
    roomInfo = guildRooms.find((r) => r.id === room)!,
    editable = Boolean(doc && g?.is_owner);
  useLayoutEffect(() => {
    const stage = scene.current;
    if (!stage || !editable || !obj || obj.room !== room) {
      setTurnControls(null);
      setPieceGeometry(null);
      return;
    }
    const image = stage.querySelector<HTMLImageElement>(
      '[data-guild-piece="' + obj.id + '"] img',
    );
    if (!image) return;
    const update = () => {
      const bounds = stage.getBoundingClientRect(),
        r = guildFurnitureVisibleRect(image);
      if (!r) {
        setTurnControls(null);
        return;
      }
      const width = stage.clientWidth,
        height = stage.clientHeight,
        originX = bounds.left + stage.clientLeft,
        originY = bounds.top + stage.clientTop;
      const geometry = guildFurnitureGeometry(image);
      if (geometry)
        setPieceGeometry({
          width,
          height,
          base: {
            ...geometry.base,
            left: geometry.base.left - originX,
            top: geometry.base.top - originY,
          },
          points: geometry.points.map((p) => ({ x: p.x - originX, y: p.y - originY })),
        });
      setTurnControls({
        left: (Math.max(18, Math.min(width - 18, r.left - originX - 20)) / width) * 100,
        right: (Math.max(18, Math.min(width - 18, r.right - originX + 20)) / width) * 100,
        top:
          (Math.max(18, Math.min(height - 18, (r.top + r.bottom) / 2 - originY)) / height) *
          100,
      });
    };
    refreshTurnControls.current = update;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    observer.observe(image);
    return () => {
      observer.disconnect();
      if (refreshTurnControls.current === update) refreshTurnControls.current = null;
    };
  }, [editable, obj?.id, obj?.x, obj?.y, obj?.scale, obj?.facing, obj?.perspective, room]);
  function updateObject(values: Partial<GuildDocument['placements'][number]>) {
    setDoc((d) =>
      d
        ? {
            ...d,
            placements: d.placements.map((p) => (p.id === selected ? { ...p, ...values } : p)),
          }
        : d,
    );
  }
  return (
    <section className="guild-page">
      <header className="guild-page-heading">
        <span className="social-eyebrow">Um brasão. Oito histórias. Um lar.</span>
        <h1>{g?.document.name || 'Guildas da Alvorada'}</h1>
        <p>
          {g?.document.description || 'Encontre sua companhia e construa um lugar para voltar.'}
        </p>
        <div className="guild-actions">
          {target && (
            <button onClick={() => (location.hash = 'guild')}>
              <ArrowLeft size={15} />
              Todas as guildas
            </button>
          )}
          {directory?.mine && directory.mine !== target && (
            <button onClick={() => (location.hash = 'guild?id=' + directory.mine)}>
              <Home size={15} />
              Minha guilda
            </button>
          )}
          {settings?.can_edit && (
            <button onClick={() => setConfig(structuredClone(settings.document))}>
              <Settings2 size={15} />
              Painel administrativo
            </button>
          )}
        </div>
      </header>
      {error && (
        <p className="guild-feedback error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="guild-feedback" role="status">
          {notice}
        </p>
      )}
      {!directory ? (
        <p role="status">Abrindo o registro das guildas…</p>
      ) : !target ? (
        <>
          <div className="guild-introduction">
            <img src="/guild/rooms/main.webp" alt="Salão modesto de uma nova guilda" />
            <div>
              <span className="social-eyebrow">O primeiro capítulo</span>
              <h2>Uma sede para chamar de sua</h2>
              <p>
                Sua guilda começa com ferraria, salão principal, sala de estar e sala de reunião.
                Reúna até oito jogadores, personalize o brasão e a decoração e escreva novas
                crônicas em companhia.
              </p>
              <strong>
                {settings?.document.founding_po === null
                  ? 'Custo aguardando configuração do administrador'
                  : settings?.document.founding_po.toLocaleString('pt-BR') + ' PO para fundar'}
              </strong>
              {!directory.mine && (
                <button
                  disabled={busy || !characters.length || settings?.document.founding_po === null}
                  onClick={() => {
                    request.current = crypto.randomUUID();
                    setDoc(guildDocumentSchema.parse({ name: 'Nova guilda' }));
                    setFounding(true);
                  }}
                >
                  <Plus size={17} />
                  Fundar uma guilda
                </button>
              )}
              {!characters.length && (
                <small>Crie um personagem para fundar ou entrar em uma guilda.</small>
              )}
            </div>
          </div>
          {directory.invites.length > 0 && (
            <section className="guild-paper">
              <h2>Convites recebidos</h2>
              <label>
                Representar com
                <select value={character} onChange={(e) => setCharacter(e.target.value)}>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {directory.invites.map((i) => (
                <div className="guild-invite" key={i.guild_id}>
                  <GuildCrest crest={i.crest} size={55} />
                  <strong>{i.name}</strong>
                  <button
                    disabled={busy || !character}
                    onClick={() =>
                      void run(async () => {
                        await post('/guilds/' + i.guild_id + '/join', { character_id: character });
                        location.hash = 'guild?id=' + i.guild_id;
                      })
                    }
                  >
                    Aceitar
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api('/guilds/' + i.guild_id + '/invites', { method: 'DELETE' });
                        await load();
                      })
                    }
                  >
                    Recusar
                  </button>
                </div>
              ))}
            </section>
          )}
          <h2 className="guild-section-title">
            <Trophy size={22} />
            Ranking das guildas
          </h2>
          <div className="guild-directory">
            {directory.items.map((e, i) => (
              <button key={e.id} onClick={() => (location.hash = 'guild?id=' + e.id)}>
                <span className="guild-ranking-number">{String(i + 1).padStart(2, '0')}</span>
                <GuildCrest crest={e.crest} size={85} />
                <h3>{e.name}</h3>
                <small>
                  {e.rank} · {e.members}/8 jogadores
                </small>
                <strong>{e.prestige} prestígio</strong>
              </button>
            ))}
            {!directory.items.length && <p>O registro aguarda o primeiro brasão.</p>}
          </div>
        </>
      ) : !g ? (
        <p role="status">Abrindo a sede…</p>
      ) : (
        <>
          <div className="guild-summary">
            <GuildCrest crest={current!.crest} size={110} />
            <div>
              <span className="social-eyebrow">Patente {g.rank}</span>
              <h2>Nível {g.level}</h2>
              <span>
                {g.prestige} prestígio · {g.members.length}/8 jogadores
              </span>
            </div>
            {g.is_member && (
              <strong>
                <Coins size={18} /> {((g.treasury_cp || 0) / 100).toLocaleString('pt-BR')} PO
                <small>Tesouro da guilda</small>
              </strong>
            )}
            {g.is_owner && (
              <button disabled={busy} onClick={() => setDoc(structuredClone(g.document))}>
                <Settings2 size={16} />
                Personalizar sede
              </button>
            )}
          </div>
          <nav className="guild-tabs" aria-label="Áreas da guilda">
            {[
              ['house', 'Sede', Home],
              ['missions', 'Missões semanais', Trophy],
              ['members', 'Companhia', Users],
            ].map(([id, name, Icon]) => {
              const I = Icon as typeof Home;
              return (
                <button
                  key={String(id)}
                  aria-pressed={tab === id}
                  onClick={() => setTab(String(id))}
                >
                  <I size={16} />
                  {String(name)}
                </button>
              );
            })}
          </nav>
          {tab === 'house' && (
            <>
              <nav className="guild-room-tabs" aria-label="Salas da sede">
                {guildRooms.map((r) => {
                  const locked =
                    !r.starter && g.level < g.room_unlocks[r.id as keyof typeof g.room_unlocks];
                  return (
                    <button
                      key={r.id}
                      disabled={locked}
                      title={
                        locked
                          ? 'Libera no nível ' + g.room_unlocks[r.id as keyof typeof g.room_unlocks]
                          : r.name
                      }
                      aria-pressed={room === r.id}
                      onClick={() => {
                        setRoom(r.id);
                        setSelected('');
                      }}
                    >
                      {locked && <Lock size={13} />} {r.name}
                      {locked && (
                        <small>Nv. {g.room_unlocks[r.id as keyof typeof g.room_unlocks]}</small>
                      )}
                    </button>
                  );
                })}
              </nav>
              <div className={`guild-house-layout ${editable ? 'is-editing' : ''}`}>
                <div
                  ref={scene}
                  className={`guild-room ambience-${current!.ambience}`}
                  style={{ backgroundImage: `url('${roomInfo.image}')` }}
                  aria-label={roomInfo.name}
                >
                  <span className="guild-room-caption">{roomInfo.name}</span>
                  {current!.placements
                    .filter((p) => p.room === room)
                    .sort((a, b) => a.y - b.y)
                    .map((p) => (
                      <button
                        className={`guild-furniture ${selected === p.id ? 'selected' : ''}`}
                        key={p.id}
                        type="button"
                        data-guild-piece={p.id}
                        data-facing={p.facing}
                        aria-label={guildDecor.find((i) => i.id === p.catalog)?.name || p.catalog}
                        style={
                          {
                            left: p.x * 100 + '%',
                            top: p.y * 100 + '%',
                            width: p.scale * 100 + '%',
                          } as CSSProperties
                        }
                        onClick={() => setSelected(p.id)}
                        onPointerDown={(e) => {
                          if (!editable || busy || e.button !== 0) return;
                          e.preventDefault();
                          setSelected(p.id);
                          const r = scene.current!.getBoundingClientRect();
                          grab.current = {
                            id: p.id,
                            pointer: e.pointerId,
                            x: (e.clientX - r.left) / r.width - p.x,
                            y: (e.clientY - r.top) / r.height - p.y,
                            startX: e.clientX,
                            startY: e.clientY,
                          };
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (!editable || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
                          const point = grab.current;
                          if (
                            !point ||
                            point.id !== p.id ||
                            point.pointer !== e.pointerId ||
                            Math.hypot(e.clientX - point.startX, e.clientY - point.startY) < 3
                          )
                            return;
                          const r = scene.current!.getBoundingClientRect();
                          setDoc((d) =>
                            d
                              ? {
                                  ...d,
                                  placements: d.placements.map((o) =>
                                    o.id === p.id
                                      ? {
                                          ...o,
                                          x: Math.max(
                                            0.03,
                                            Math.min(
                                              0.97,
                                              (e.clientX - r.left) / r.width - point.x,
                                            ),
                                          ),
                                          y: Math.max(
                                            0.1,
                                            Math.min(
                                              0.97,
                                              (e.clientY - r.top) / r.height - point.y,
                                            ),
                                          ),
                                        }
                                      : o,
                                  ),
                                }
                              : d,
                          );
                        }}
                        onLostPointerCapture={() => {
                          grab.current = null;
                        }}
                        onPointerCancel={() => {
                          grab.current = null;
                        }}
                        onPointerUp={(e) => {
                          grab.current = null;
                          if (e.currentTarget.hasPointerCapture(e.pointerId))
                            e.currentTarget.releasePointerCapture(e.pointerId);
                        }}
                        onKeyDown={(e) => {
                          if (
                            !editable ||
                            !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
                          )
                            return;
                          e.preventDefault();
                          setSelected(p.id);
                          setDoc((d) =>
                            d
                              ? {
                                  ...d,
                                  placements: d.placements.map((o) =>
                                    o.id === p.id
                                      ? {
                                          ...o,
                                          x: Math.max(
                                            0.03,
                                            Math.min(
                                              0.97,
                                              o.x +
                                                (e.key === 'ArrowRight'
                                                  ? 0.01
                                                  : e.key === 'ArrowLeft'
                                                    ? -0.01
                                                    : 0),
                                            ),
                                          ),
                                          y: Math.max(
                                            0.1,
                                            Math.min(
                                              0.97,
                                              o.y +
                                                (e.key === 'ArrowDown'
                                                  ? 0.01
                                                  : e.key === 'ArrowUp'
                                                    ? -0.01
                                                    : 0),
                                            ),
                                          ),
                                        }
                                      : o,
                                  ),
                                }
                              : d,
                          );
                        }}
                      >
                        <GuildFurnitureArt
                          source={houseItemImage(p.catalog, p.facing)}
                          perspective={p.perspective}
                          onReady={() => refreshTurnControls.current?.()}
                        />
                        {(g.upgrades.find((u) => u.object_id === p.id)?.level || 1) > 1 && (
                          <small>Nv. {g.upgrades.find((u) => u.object_id === p.id)!.level}</small>
                        )}
                      </button>
                    ))}
                  {editable && obj?.room === room && turnControls && perspectiveEditing !== obj.id && (
                    <div className="guild-turn-controls" aria-label="Vistas do item selecionado">
                      {([-1, 1] as const).map((direction) => (
                        <button
                          key={direction}
                          type="button"
                          disabled={busy}
                          aria-label={
                            direction < 0 ? 'Virar item à esquerda' : 'Virar item à direita'
                          }
                          style={{
                            left: (direction < 0 ? turnControls.left : turnControls.right) + '%',
                            top: turnControls.top + '%',
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() =>
                            updateObject({
                              facing: houseTurnFacing(obj.catalog, obj.facing, direction),
                            })
                          }
                        >
                          {direction < 0 ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {editable && (
                  <aside className="guild-paper guild-house-editor" aria-label="Decoração da sala">
                    <h2>Decorar {roomInfo.name}</h2>
                    <p>
                      Arraste as peças ou use as setas do teclado. Salve para compartilhar a sede
                      com sua guilda.
                    </p>
                    <div className="guild-field-grid">
                      <label>
                        Objeto
                        <select
                          aria-label="Objeto"
                          value={decor}
                          onChange={(e) => setDecor(e.target.value)}
                        >
                          {guildDecor.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        disabled={current!.placements.length >= 24}
                        onClick={() => {
                          const id = crypto.randomUUID();
                          setDoc((d) =>
                            d
                              ? {
                                  ...d,
                                  placements: [
                                    ...d.placements,
                                    {
                                      id,
                                      catalog: decor,
                                      room: room as GuildDocument['placements'][number]['room'],
                                      x: 0.5,
                                      y: 0.72,
                                      scale: Math.max(
                                        0.04,
                                        Math.min(0.6, houseDefaultScale(decor)),
                                      ),
                                      facing: houseDefaultFacing(decor),
                                    },
                                  ],
                                }
                              : d,
                          );
                          setSelected(id);
                        }}
                      >
                        <Plus size={16} />
                        Adicionar peça
                      </button>
                      <label>
                        Atmosfera
                        <select
                          aria-label="Atmosfera"
                          value={current!.ambience}
                          onChange={(e) =>
                            setDoc((d) =>
                              d
                                ? { ...d, ambience: e.target.value as GuildDocument['ambience'] }
                                : d,
                            )
                          }
                        >
                          <option value="natural">Luz natural</option>
                          <option value="warm">À luz de velas</option>
                          <option value="moonlit">Noite serena</option>
                        </select>
                      </label>
                      {obj?.room === room && (
                        <>
                          <GuildPerspectiveControls
                            key={obj.id}
                            stage={scene}
                            geometry={pieceGeometry}
                            perspective={obj.perspective}
                            guides={
                              current!.perspectives?.[room] ?? guildRoomPerspective(room)
                            }
                            changeGuides={(guides) =>
                              setDoc((d) =>
                                d
                                  ? {
                                      ...d,
                                      perspectives: { ...d.perspectives, [room]: guides },
                                    }
                                  : d,
                              )
                            }
                            change={(perspective) => updateObject({ perspective })}
                            active={perspectiveEditing === obj.id}
                            toggle={() =>
                              setPerspectiveEditing(
                                perspectiveEditing === obj.id ? '' : obj.id,
                              )
                            }
                          />
                          <label>
                            Tamanho
                            <input
                              type="range"
                              min=".04"
                              max=".6"
                              step=".01"
                              aria-label="Tamanho do objeto"
                              value={obj.scale}
                              onChange={(e) => updateObject({ scale: Number(e.target.value) })}
                            />
                          </label>
                          <label>
                            Vista
                            <select
                              aria-label="Vista do objeto"
                              value={obj.facing}
                              onChange={(e) => updateObject({ facing: Number(e.target.value) })}
                            >
                              {houseFacingOptions(obj.catalog).map((f) => (
                                <option key={f.value} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            onClick={() =>
                              setDoc((d) =>
                                d
                                  ? {
                                      ...d,
                                      placements: d.placements.filter((p) => p.id !== selected),
                                    }
                                  : d,
                              )
                            }
                          >
                            Remover peça
                          </button>
                        </>
                      )}
                    </div>
                    <div className="guild-actions">
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await api('/guilds/' + g.id, {
                              method: 'PUT',
                              body: JSON.stringify({ document: doc, revision: g.revision }),
                            });
                            setDoc(null);
                            await load();
                            setNotice('Sede salva.');
                          })
                        }
                      >
                        <Save size={16} />
                        Salvar sede
                      </button>
                      <button disabled={busy} onClick={() => setDoc(null)}>
                        Descartar edição
                      </button>
                    </div>
                  </aside>
                )}
              </div>
              {obj && g.is_member && !editable && (
                <section className="guild-paper">
                  <h3>
                    {guildDecor.find((i) => i.id === obj.catalog)?.name} · nível {level}
                  </h3>
                  {upgrade ? (
                    <p>
                      Melhoria: {upgrade.gold_po} PO do tesouro · {upgrade.prestige} de prestígio ·{' '}
                      {upgrade.missions} missões semanais concluídas.
                    </p>
                  ) : (
                    <p>Requisitos de melhoria aguardam a definição do administrador.</p>
                  )}
                  {g.is_owner && (
                    <button
                      disabled={busy || !upgrade || level >= upgrade.max_level}
                      onClick={() =>
                        void run(async () => {
                          await post('/guilds/' + g.id + '/upgrade/' + obj.id, {
                            level: level + 1,
                          });
                          await load();
                        })
                      }
                    >
                      Melhorar objeto
                    </button>
                  )}
                </section>
              )}
            </>
          )}
          {tab === 'missions' &&
            (g.is_member ? (
              <>
                <section className="guild-paper">
                  <span className="social-eyebrow">Semana de {g.weekly?.week}</span>
                  <h2>Crônicas da companhia</h2>
                  <p>
                    Missões de aventura concluídas pelos membros após a entrada na guilda contam
                    automaticamente. A semana começa na segunda-feira, às 00h UTC. Ouro vai ao
                    tesouro; prestígio melhora a patente e libera salas.
                  </p>
                </section>
                <div className="guild-missions">
                  {g.weekly?.items.map((m) => (
                    <article className="guild-paper" key={m.mission_id}>
                      <Trophy size={24} />
                      <h3>{m.template.name}</h3>
                      <p>
                        {m.progress}/{m.template.goal}{' '}
                        {
                          {
                            participations: 'participações',
                            missions: 'aventuras distintas',
                            members: 'membros em aventuras',
                          }[m.template.metric]
                        }
                      </p>
                      <progress max={m.template.goal} value={m.progress} />
                      <strong>
                        {m.template.gold_po} PO + {m.template.prestige} prestígio
                      </strong>
                      <button
                        disabled={
                          busy ||
                          !g.is_owner ||
                          Boolean(m.claimed_at) ||
                          m.progress < m.template.goal
                        }
                        onClick={() =>
                          void run(async () => {
                            await post(
                              '/guilds/' + g.id + '/weekly/' + m.mission_id + '/claim',
                              {},
                            );
                            await load();
                          })
                        }
                      >
                        {m.claimed_at
                          ? 'Recompensa recebida'
                          : g.is_owner
                            ? 'Receber recompensa'
                            : 'O fundador recebe a recompensa'}
                      </button>
                    </article>
                  ))}
                </div>
                <section className="guild-paper">
                  <h3>Livro do tesouro</h3>
                  {g.ledger.map((l, i) => (
                    <p key={i}>
                      {{
                        foundation: 'Fundação',
                        weekly: 'Missão semanal',
                        upgrade: 'Melhoria de objeto',
                      }[l.kind] || l.kind}{' '}
                      · {Number(l.amount_cp) / 100} PO ·{' '}
                      {new Date(l.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  ))}
                </section>
              </>
            ) : (
              <p className="guild-paper">As missões e o tesouro são reservados aos membros.</p>
            ))}
          {tab === 'members' && (
            <section className="guild-paper">
              <h2>Companhia · {g.members.length}/8</h2>
              {g.members.map((m) => (
                <div className="guild-member" key={m.user_id}>
                  <button onClick={() => visitProfile(m.user_id)}>
                    <Users size={18} />
                    <strong>{m.name}</strong>
                    <small>
                      {m.character_name} · {m.user_id === g.owner_id ? 'Fundador' : 'Membro'}
                    </small>
                  </button>
                  {m.user_id !== g.owner_id && (g.is_owner || m.user_id === user.id) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await api(
                            '/guilds/' + g.id + '/members/' + encodeURIComponent(m.user_id),
                            { method: 'DELETE' },
                          );
                          await load();
                        })
                      }
                    >
                      {m.user_id === user.id ? 'Sair da guilda' : 'Remover'}
                    </button>
                  )}
                </div>
              ))}
              {g.is_owner && (
                <>
                  <h3>Convidar jogador</h3>
                  <label>
                    Buscar usuário
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Nome do jogador"
                    />
                  </label>
                  <div className="guild-invite-search">
                    {people.slice(0, 8).map((p) => (
                      <button
                        key={p.id}
                        disabled={busy || g.members.length >= 8}
                        onClick={() =>
                          void run(async () => {
                            await post('/guilds/' + g.id + '/invites', { user_id: p.id });
                            setNotice('Convite enviado a ' + p.name + '.');
                          })
                        }
                      >
                        {p.name} <Plus size={14} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
      {founding && doc && (
        <Modal
          title="Fundar uma guilda"
          close={() => {
            setFounding(false);
            setDoc(null);
          }}
        >
          <form
            className="guild-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await post<{ id: string }>('/guilds', {
                  document: doc,
                  character_id: character,
                  request_id: request.current,
                });
                setFounding(false);
                setDoc(null);
                await onPurchased();
                location.hash = 'guild?id=' + r.id;
              });
            }}
          >
            <label>
              Nome da guilda
              <input
                required
                minLength={3}
                maxLength={60}
                value={doc.name}
                onChange={(e) => setDoc({ ...doc, name: e.target.value })}
              />
            </label>
            <label>
              Personagem fundador
              <select required value={character} onChange={(e) => setCharacter(e.target.value)}>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.gold_cp / 100} PO
                  </option>
                ))}
              </select>
            </label>
            <label>
              História
              <textarea
                maxLength={1500}
                value={doc.description}
                onChange={(e) => setDoc({ ...doc, description: e.target.value })}
              />
            </label>
            <CrestEditor
              value={doc.crest}
              name={doc.name}
              onChange={(crest) => setDoc({ ...doc, crest })}
            />
            <p>
              {settings?.document.founding_po} PO · sede inicial com quatro salas · oito jogadores.
            </p>
            {error && <p role="alert">{error}</p>}
            <button disabled={busy} type="submit">
              Fundar guilda
            </button>
          </form>
        </Modal>
      )}
      {config && settings && (
        <Modal title="Administração · Guildas e perfis" close={() => setConfig(null)}>
          <form
            className="guild-form community-settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api('/community/settings', {
                  method: 'PUT',
                  body: JSON.stringify({ document: config, revision: settings.revision }),
                });
                setConfig(null);
                await load();
                setNotice('Configuração salva.');
              });
            }}
          >
            <label>
              Custo de fundação (PO)
              <input
                type="number"
                min={0}
                max={1000000}
                required
                value={config.founding_po ?? ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    founding_po: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Níveis que liberam vitrines do perfil (separados por vírgula)
              <input
                value={config.profile_unlocks.join(',')}
                onChange={(e) =>
                  setConfig({ ...config, profile_unlocks: e.target.value.split(',').map(Number) })
                }
              />
            </label>
            <h3>Expansões da sede</h3>
            <div className="guild-field-grid">
              {Object.entries(config.room_unlocks).map(([id, value]) => (
                <label key={id}>
                  {guildRooms.find((r) => r.id === id)?.name} · nível
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={value}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        room_unlocks: { ...config.room_unlocks, [id]: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <h3>Missões semanais</h3>
            <p>
              Alterações valem para as próximas missões geradas; recompensas da semana em andamento
              ficam preservadas.
            </p>
            {config.missions.map((m, i) => (
              <fieldset key={m.id}>
                <legend>{m.name}</legend>
                <label>
                  Nome
                  <input
                    value={m.name}
                    maxLength={100}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        missions: config.missions.map((s, n) =>
                          n === i ? { ...s, name: e.target.value } : s,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Objetivo
                  <select
                    value={m.metric}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        missions: config.missions.map((s, n) =>
                          n === i ? { ...s, metric: e.target.value as typeof m.metric } : s,
                        ),
                      })
                    }
                  >
                    <option value="members">Membros com aventuras concluídas</option>
                    <option value="missions">Aventuras distintas</option>
                    <option value="participations">Participações em aventuras</option>
                  </select>
                </label>
                <div className="guild-field-grid">
                  {(['goal', 'gold_po', 'prestige'] as const).map((key) => (
                    <label key={key}>
                      {{ goal: 'Meta', gold_po: 'Recompensa (PO)', prestige: 'Prestígio' }[key]}
                      <input
                        type="number"
                        min={key === 'goal' ? 1 : 0}
                        value={m[key]}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            missions: config.missions.map((s, n) =>
                              n === i ? { ...s, [key]: Number(e.target.value) } : s,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({ ...config, missions: config.missions.filter((_, n) => n !== i) })
                  }
                >
                  Remover missão
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={config.missions.length >= 8}
              onClick={() =>
                setConfig({
                  ...config,
                  missions: [
                    ...config.missions,
                    {
                      id: 'quest-' + crypto.randomUUID().slice(0, 8),
                      name: 'Nova missão',
                      metric: 'missions',
                      goal: 1,
                      gold_po: 0,
                      prestige: 10,
                    },
                  ],
                })
              }
            >
              Adicionar missão semanal
            </button>
            <h3>Melhorias de objetos</h3>
            <p>
              Sem regra, a peça permanece no nível 1. Defina os requisitos quando desejar liberar a
              melhoria.
            </p>
            {config.upgrades.map((u, i) => (
              <fieldset key={u.catalog}>
                <legend>{guildDecor.find((d) => d.id === u.catalog)?.name}</legend>
                <div className="guild-field-grid">
                  {(['gold_po', 'prestige', 'missions', 'max_level'] as const).map((key) => (
                    <label key={key}>
                      {
                        {
                          gold_po: 'Custo do tesouro (PO)',
                          prestige: 'Prestígio necessário',
                          missions: 'Semanais concluídas',
                          max_level: 'Nível máximo',
                        }[key]
                      }
                      <input
                        type="number"
                        min={key === 'max_level' ? 2 : 0}
                        max={key === 'max_level' ? 10 : 1000000}
                        value={u[key]}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            upgrades: config.upgrades.map((s, n) =>
                              n === i ? { ...s, [key]: Number(e.target.value) } : s,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({ ...config, upgrades: config.upgrades.filter((_, n) => n !== i) })
                  }
                >
                  Retirar regra
                </button>
              </fieldset>
            ))}
            <label>
              Definir melhoria para
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value)
                    setConfig({
                      ...config,
                      upgrades: [
                        ...config.upgrades,
                        {
                          catalog: e.target.value,
                          gold_po: 0,
                          prestige: 0,
                          missions: 0,
                          max_level: 2,
                        },
                      ],
                    });
                }}
              >
                <option value="">Selecione um objeto</option>
                {guildDecor
                  .filter((d) => !config.upgrades.some((u) => u.catalog === d.id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
            {error && <p role="alert">{error}</p>}
            <button type="submit" disabled={busy}>
              Salvar configurações
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
