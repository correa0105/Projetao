import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { api, post } from './api';
import { Modal } from './components';
import { Send } from 'lucide-react';
import { ItemPicker } from './ItemPicker';
import { RpPersonalScene } from './RpPersonalScene';
import { RpSpeechBubbles } from './RpSpeechBubbles';
import { rpFloorScale, rpDragPosition } from '../shared/rp-perspective';
import type { Character, User } from './types';
import {
  rpScenes,
  rpDecor,
  rpDocumentSchema,
  type RpDocument,
  type RpEntry,
  type RpIndex,
  type RpPlacement,
  type RpPresence,
  type RpState,
} from '../shared/rp-lobby';
import {
  houseItemImage,
  houseDefaultFacing,
  houseDefaultScale,
  houseFacingOptions,
} from '../shared/house';
import './rp-lobby.css';
type Draft = { name: string; document: RpDocument; revision: number };
const defaultPosition = { x: 0.5, y: 0.84, scale: 0.16, flip_x: false, depth_layer: 4 };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const targetFromHash = () =>
  new URLSearchParams(location.hash.split('?')[1] || '').get('room') || '';
export function RPLobby({
  character,
  user,
}: {
  character: Character | null;
  user: User;
  onPurchased?: () => Promise<void>;
}) {
  const [index, setIndex] = useState<RpIndex | null>(null),
    [target, setTarget] = useState(targetFromHash),
    [room, setRoom] = useState<RpState | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null),
    [dirty, setDirty] = useState(false),
    [editing, setEditing] = useState(false);
  const [panel, setPanel] = useState<'decor' | 'guests' | 'character' | null>(null),
    [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [creating, setCreating] = useState(false),
    [closing, setClosing] = useState(false);
  const [newName, setNewName] = useState(''),
    [newScene, setNewScene] = useState('tavern'),
    [hours, setHours] = useState(12);
  const [friends, setFriends] = useState<{ id: string; name: string; status: string }[]>([]),
    [friend, setFriend] = useState(''),
    [allowEdit, setAllowEdit] = useState(false);
  const [self, setSelf] = useState(defaultPosition),
    [joined, setJoined] = useState(false),
    [chat, setChat] = useState(() => innerWidth > 700),
    [message, setMessage] = useState('');
  const [chatActive, setChatActive] = useState(false);
  const [companionPanel, setCompanionPanel] = useState<HTMLDivElement | null>(null);
  const selfRef = useRef(self),
    dirtyRef = useRef(dirty),
    draftRef = useRef(draft),
    targetRef = useRef(target);
  selfRef.current = self;
  dirtyRef.current = dirty;
  draftRef.current = draft;
  targetRef.current = target;
  const stage = useRef<HTMLDivElement>(null),
    messages = useRef<HTMLDivElement>(null),
    chatForm = useRef<HTMLFormElement>(null),
    chatInput = useRef<HTMLInputElement>(null),
    followChat = useRef(true),
    messageKey = useRef(crypto.randomUUID());
  const drag = useRef<{
    kind: 'actor' | 'object';
    id: string;
    pointer: number;
    grab: { x: number; y: number };
    x: number;
    y: number;
  } | null>(null);
  const draftKey = (id: string) => 'rp-lobby-draft:' + user.id + ':' + id;
  const messageDraftKey = (id: string) => 'rp-lobby-message:' + user.id + ':' + id;
  const activeDoc = draft?.document || room?.document;
  const scene = rpScenes.find((s) => s.id === activeDoc?.scene);
  const depth = (y: number) => rpFloorScale(y, activeDoc?.scene);
  useEffect(() => {
    const center = () =>
      requestAnimationFrame(() => {
        const scroller = stage.current?.parentElement;
        if (scroller)
          scroller.scrollLeft = selfRef.current.x * scroller.scrollWidth - scroller.clientWidth / 2;
      });
    center();
    addEventListener('resize', center);
    return () => removeEventListener('resize', center);
  }, [room?.id]);
  const piece = activeDoc?.placements.find((p) => p.id === selected);
  async function refreshIndex() {
    setIndex(await api<RpIndex>('/rp-lobby'));
  }
  async function refreshRoom(id = target) {
    const next = await api<RpState>('/rp-lobby/' + id);
    if (targetRef.current !== id) return;
    setRoom(next);
    if (!dirtyRef.current && (!draftRef.current || next.revision >= draftRef.current.revision))
      setDraft({ name: next.name, document: next.document, revision: next.revision });
  }
  useEffect(() => {
    void refreshIndex().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (!document.hidden) void refreshIndex().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [user.id]);
  useEffect(() => {
    const hash = () => setTarget(targetFromHash());
    addEventListener('hashchange', hash);
    return () => removeEventListener('hashchange', hash);
  }, []);
  useEffect(() => {
    document.body.classList.add('rp-lobby-mounted');
    return () => document.body.classList.remove('rp-lobby-mounted');
  }, []);
  useEffect(() => {
    let live = true;
    setRoom(null);
    setDraft(null);
    setDirty(false);
    dirtyRef.current = false;
    setSelected('');
    setPanel(null);
    setEditing(false);
    setError('');
    setNotice('');
    setJoined(false);
    setMessage('');
    if (!target) return;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey(target)) || 'null');
      if (saved && typeof saved.name === 'string' && Number.isInteger(saved.revision)) {
        rpDocumentSchema.parse(saved.document);
        setDraft(saved);
        setDirty(true);
        dirtyRef.current = true;
        setNotice('Rascunho de decoração recuperado.');
      }
      setMessage(localStorage.getItem(messageDraftKey(target)) || '');
    } catch {}
    async function start() {
      try {
        const current = await api<RpState>('/rp-lobby/' + target);
        if (!live) return;
        setRoom(current);
        if (!dirtyRef.current)
          setDraft({ name: current.name, document: current.document, revision: current.revision });
        if (character) {
          const presence = current.presence.find((p) => p.user_id === user.id);
          const position = presence
            ? {
                x: presence.x,
                y: presence.y,
                scale: presence.scale,
                flip_x: presence.flip_x,
                depth_layer: presence.depth_layer ?? 4,
              }
            : {
                ...defaultPosition,
                x: [0.5, 0.65, 0.35, 0.8, 0.2, 0.58, 0.42, 0.72, 0.28][current.presence.length % 9],
              };
          setSelf(position);
          selfRef.current = position;
          await api('/rp-lobby/' + target + '/presence', {
            method: 'PUT',
            body: JSON.stringify({ ...position, character_id: character.id }),
          });
          if (live) {
            setJoined(true);
            await refreshRoom(target);
          }
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    }
    void start();
    const poll = setInterval(() => {
      if (live && !document.hidden)
        void refreshRoom(target).catch((e) => {
          if (live) setError(e.message);
        });
    }, 3000);
    const heartbeat = setInterval(() => {
      if (live && character && !document.hidden)
        void api('/rp-lobby/' + target + '/presence', {
          method: 'PUT',
          body: JSON.stringify({ ...selfRef.current, character_id: character.id }),
        }).catch((e) => {
          if (live) setError(e.message);
        });
    }, 20000);
    return () => {
      live = false;
      clearInterval(poll);
      clearInterval(heartbeat);
      void fetch('/api/rp-lobby/' + target + '/presence', {
        method: 'DELETE',
        credentials: 'include',
        keepalive: true,
      }).catch(() => {});
    };
  }, [target, character?.id, user.id]);
  useEffect(() => {
    if (target && dirty && draft)
      try {
        localStorage.setItem(draftKey(target), JSON.stringify(draft));
      } catch {
        setError('Não foi possível guardar o rascunho neste navegador. Salve as mudanças na sala.');
      }
  }, [target, dirty, draft]);
  useEffect(() => {
    if (target)
      try {
        localStorage.setItem(messageDraftKey(target), message);
      } catch {}
  }, [message, target]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => {
    const list = messages.current;
    if (list && followChat.current) list.scrollTop = list.scrollHeight;
  }, [room?.messages.at(-1)?.id, chat]);
  useEffect(() => {
    const leaveChat = (event: Event) => {
      const target = event.target as Node;
      if (!chatForm.current?.contains(target) && !messages.current?.contains(target)) {
        setChatActive(false);
        followChat.current = true;
        if (messages.current) messages.current.scrollTop = messages.current.scrollHeight;
      }
    };
    document.addEventListener('pointerdown', leaveChat, true);
    document.addEventListener('focusin', leaveChat, true);
    return () => {
      document.removeEventListener('pointerdown', leaveChat, true);
      document.removeEventListener('focusin', leaveChat, true);
    };
  }, []);
  useEffect(() => {
    if (panel === 'guests')
      void api<{ items: { id: string; name: string; status: string }[] }>('/social/friends')
        .then((r) => setFriends(r.items.filter((f) => f.status === 'accepted')))
        .catch((e) => setError(e.message));
  }, [panel]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(id: string) {
    location.hash = 'house?room=' + encodeURIComponent(id);
    setTarget(id);
  }
  function change(values: Partial<Draft>) {
    if (!room?.can_edit) return;
    setDraft((d) => (d ? { ...d, ...values } : d));
    setDirty(true);
    dirtyRef.current = true;
    setNotice('');
  }
  function changePiece(values: Partial<RpPlacement>) {
    if (!draftRef.current) return;
    change({
      document: {
        ...draftRef.current.document,
        placements: draftRef.current.document.placements.map((p) =>
          p.id === selected ? { ...p, ...values } : p,
        ),
      },
    });
  }
  async function save() {
    const data = draftRef.current;
    if (!data || !dirtyRef.current) return;
    const result = await api<{ revision: number }>('/rp-lobby/' + target, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const newer = draftRef.current !== data;
    const saved = { ...(newer ? draftRef.current! : data), revision: result.revision };
    setDraft(saved);
    draftRef.current = saved;
    setDirty(newer);
    dirtyRef.current = newer;
    if (!newer)
      try {
        localStorage.removeItem(draftKey(target));
      } catch {}
    setNotice(newer ? 'Sala salva. Há mudanças adicionais por salvar.' : 'Sala salva.');
    await refreshRoom();
  }
  async function leave() {
    try {
      await save();
    } catch {
      if (draftRef.current)
        localStorage.setItem(draftKey(target), JSON.stringify(draftRef.current));
    }
    await api('/rp-lobby/' + target + '/presence', { method: 'DELETE' });
    location.hash = 'house';
    setTarget('');
    await refreshIndex();
  }
  async function sendPosition(position = selfRef.current) {
    if (!character || !target) return;
    await api('/rp-lobby/' + target + '/presence', {
      method: 'PUT',
      body: JSON.stringify({ ...position, character_id: character.id }),
    });
  }
  function startDrag(
    event: PointerEvent<HTMLButtonElement>,
    kind: 'actor' | 'object',
    id: string,
    x: number,
    y: number,
  ) {
    if (
      event.button !== 0 ||
      busy ||
      (kind === 'actor' && !joined) ||
      (kind === 'object' && (!editing || !room?.can_edit))
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = stage.current!.getBoundingClientRect(),
      factor = depth(y);
    drag.current = {
      kind,
      id,
      pointer: event.pointerId,
      grab: {
        x: (event.clientX - bounds.left - x * bounds.width) / factor,
        y: (event.clientY - bounds.top - y * bounds.height) / factor,
      },
      x,
      y,
    };
    if (kind === 'object') setSelected(id);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const g = drag.current;
    if (!g || g.pointer !== event.pointerId || !stage.current) return;
    const bounds = stage.current.getBoundingClientRect(),
      { x, y } = rpDragPosition(
        { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
        g.grab,
        bounds,
        g.y,
        activeDoc?.scene,
      );
    g.x = x;
    g.y = y;
    if (g.kind === 'actor') {
      const next = { ...selfRef.current, x, y };
      selfRef.current = next;
      setSelf(next);
    } else if (draftRef.current)
      change({
        document: {
          ...draftRef.current.document,
          placements: draftRef.current.document.placements.map((p) =>
            p.id === g.id ? { ...p, x, y } : p,
          ),
        },
      });
  }
  function stop(event: PointerEvent<HTMLButtonElement>) {
    const g = drag.current;
    if (!g || g.pointer !== event.pointerId) return;
    drag.current = null;
    if (g.kind === 'actor') void sendPosition().catch((e) => setError(e.message));
  }
  async function send() {
    if (!character || !message.trim() || !joined) return;
    const body = message;
    const roomId = target,
      requestId = messageKey.current;
    try {
      await post('/rp-lobby/' + roomId + '/messages', {
        character_id: character.id,
        body,
        request_id: requestId,
      });
      if (targetRef.current !== roomId) return;
      if (messageKey.current === requestId) {
        messageKey.current = crypto.randomUUID();
        setMessage((current) => (current === body ? '' : current));
      }
      followChat.current = true;
      await refreshRoom(roomId);
    } finally {
      if (targetRef.current === roomId) chatInput.current?.focus({ preventScroll: true });
    }
  }
  const errorBox = error && (
    <p role="alert" className="rp-feedback rp-error">
      {error}
    </p>
  );
  if (!target)
    return (
      <main className="rp-directory">
        <header>
          <span className="eyebrow">ENCONTROS NA ALVORADA</span>
          <h1>Lobby de RP</h1>
          <p>
            Escolha um lugar para interpretar seu personagem ou reúna os amigos numa sala
            temporária.
          </p>
          <button
            className="button primary"
            disabled={!character}
            onClick={() => setCreating(true)}
          >
            Criar sala temporária
          </button>
          {!character && <p>Selecione um personagem para criar uma sala e participar do RP.</p>}
        </header>
        {errorBox}
        {!!index?.invites.length && (
          <section className="rp-invitations">
            <h2>Seus convites</h2>
            {index.invites.map((i) => (
              <article key={i.room_id}>
                <div>
                  <strong>{i.name}</strong>
                  <p>Convite de {i.owner_name}</p>
                </div>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api('/rp-lobby/' + i.room_id + '/invite', {
                        method: 'PUT',
                        body: JSON.stringify({ accept: true }),
                      });
                      await refreshIndex();
                      open(i.room_id);
                    })
                  }
                >
                  Aceitar e entrar
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api('/rp-lobby/' + i.room_id + '/invite', {
                        method: 'PUT',
                        body: JSON.stringify({ accept: false }),
                      });
                      await refreshIndex();
                    })
                  }
                >
                  Recusar
                </button>
              </article>
            ))}
          </section>
        )}
        {(['fixed', 'temporary'] as const).map((kind) => (
          <section key={kind}>
            <h2>{kind === 'fixed' ? 'Lugares da cidade' : 'Salas com amigos'}</h2>
            <div className="rp-room-grid">
              {index?.rooms
                .filter((r) => r.kind === kind)
                .map((r) => (
                  <button key={r.id} className="rp-room-card" onClick={() => open(r.id)}>
                    <img src={rpScenes.find((s) => s.id === r.document.scene)?.image} alt="" />
                    <div>
                      <h3>{r.name}</h3>
                      <p>
                        {kind === 'fixed'
                          ? 'Local fixo · aberto para RP'
                          : r.owner_id === user.id
                            ? 'Sua sala · por convite'
                            : 'Anfitrião: ' + r.owner_name}
                      </p>
                      <small>
                        {r.participants} em cena
                        {r.expires_at
                          ? ' · até ' +
                            new Date(r.expires_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </small>
                      <span>Entrar →</span>
                    </div>
                  </button>
                ))}
            </div>
            {kind === 'temporary' && !index?.rooms.some((r) => r.kind === 'temporary') && (
              <p>Suas salas e os convites aceitos aparecem aqui.</p>
            )}
          </section>
        ))}
        {creating && (
          <Modal title="Criar sala temporária" close={() => !busy && setCreating(false)}>
            <form
              className="rp-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!character) return;
                void run(async () => {
                  const r = await post<{ id: string }>('/rp-lobby', {
                    name: newName,
                    scene: newScene,
                    hours,
                    character_id: character.id,
                  });
                  setCreating(false);
                  await refreshIndex();
                  open(r.id);
                });
              }}
            >
              <label>
                Nome da sala
                <input
                  minLength={2}
                  maxLength={80}
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </label>
              <label>
                Cenário
                <select value={newScene} onChange={(e) => setNewScene(e.target.value)}>
                  {rpScenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Duração
                <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                  {[1, 2, 6, 12, 24].map((n) => (
                    <option key={n} value={n}>
                      {n} hora{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                A sala é privada. Depois de criar, convide seus amigos e escolha quem pode editar.
                Você pode encerrar antes do prazo.
              </p>
              {errorBox}
              <button className="button primary" disabled={busy || !newName.trim()}>
                Criar sala
              </button>
            </form>
          </Modal>
        )}
      </main>
    );
  return (
    <main className="rp-session" data-rp-room={target}>
      <div className="rp-scene-scroll">
        <div
          ref={stage}
          className="rp-stage"
          style={{ backgroundImage: scene ? 'url("' + scene.image + '")' : undefined }}
          aria-label={scene?.name || 'Cenário de RP'}
        >
          {activeDoc?.placements.map((p) => (
            <button
              key={p.id}
              className={'rp-prop' + (selected === p.id ? ' selected' : '')}
              data-rp-piece={p.id}
              data-depth-scale={depth(p.y)}
              aria-label={rpDecor.find((x) => x.id === p.catalog)?.name || p.catalog}
              style={
                {
                  left: p.x * 100 + '%',
                  top: p.y * 100 + '%',
                  width: p.scale * depth(p.y) * 100 + '%',
                  zIndex: (7 - p.layer) * 100 + Math.round(p.y * 90),
                } as CSSProperties
              }
              onClick={() => editing && room?.can_edit && setSelected(p.id)}
              onPointerDown={(e) => startDrag(e, 'object', p.id, p.x, p.y)}
              onPointerMove={move}
              onPointerUp={stop}
              onPointerCancel={stop}
            >
              <img
                src={houseItemImage(p.catalog, p.facing)}
                alt=""
                draggable={false}
                style={{ transform: 'rotate(' + p.rotation + 'deg)' }}
              />
            </button>
          ))}
          {room?.presence.map((p) => {
            const own = p.user_id === user.id,
              position = own ? self : p;
            return (
              <button
                key={p.user_id}
                className={'rp-actor' + (own ? ' is-self' : '')}
                data-rp-actor={p.user_id}
                data-base-scale={position.scale}
                data-depth-scale={depth(position.y)}
                aria-label={p.name + (own ? ' · mover personagem' : '')}
                style={
                  {
                    left: position.x * 100 + '%',
                    top: position.y * 100 + '%',
                    width: position.scale * depth(position.y) * 100 + '%',
                    zIndex: (7 - (position.depth_layer ?? 4)) * 100 + Math.round(position.y * 90),
                  } as CSSProperties
                }
                onPointerDown={(e) =>
                  own && startDrag(e, 'actor', p.user_id, position.x, position.y)
                }
                onPointerMove={move}
                onPointerUp={stop}
                onPointerCancel={stop}
              >
                <img
                  src={'/api/rp-lobby/' + target + '/portraits/' + p.character_id}
                  alt=""
                  draggable={false}
                  style={{ transform: position.flip_x ? 'scaleX(-1)' : undefined }}
                />
                <span>{p.name}</span>
              </button>
            );
          })}
          <RpSpeechBubbles room={room} stage={stage} movement={self} />
        </div>
      </div>
      <header className="rp-session-header">
        <button disabled={busy} onClick={() => void run(leave)}>
          ← Lobby de RP
        </button>
        <div>
          <h1>{draft?.name || room?.name || 'Abrindo sala…'}</h1>
          <small>
            {room?.kind === 'fixed'
              ? 'Local fixo · aberto para RP'
              : room?.expires_at
                ? 'Sala temporária · encerra ' + new Date(room.expires_at).toLocaleString('pt-BR')
                : ''}
          </small>
        </div>
        <div className="rp-tools">
          {room?.can_edit && (
            <>
              <button
                aria-pressed={editing}
                onClick={() => {
                  setEditing(!editing);
                  setPanel(!editing ? 'decor' : null);
                }}
              >
                Decorar
              </button>
              {dirty && (
                <button disabled={busy} onClick={() => void run(save)}>
                  Salvar mudanças
                </button>
              )}
            </>
          )}
          {room?.is_owner && (
            <button onClick={() => setPanel(panel === 'guests' ? null : 'guests')}>
              Convidados
            </button>
          )}
          {joined && (
            <button onClick={() => setPanel(panel === 'character' ? null : 'character')}>
              Personagem
            </button>
          )}
          <button aria-pressed={chat} onClick={() => setChat(!chat)}>
            RP · {room?.presence.length || 0}
          </button>
          {room?.is_owner && <button onClick={() => setClosing(true)}>Encerrar sala</button>}
        </div>
      </header>
      <div className="rp-feedbacks">
        {errorBox}
        {notice && (
          <p className="rp-feedback" role="status">
            {notice}
          </p>
        )}
        {dirty && (
          <p className="rp-feedback">Decoração por salvar · rascunho guardado neste navegador.</p>
        )}
      </div>
      {panel && room && (
        <aside
          className="rp-panel"
          aria-label={
            panel === 'decor'
              ? 'Decorar sala'
              : panel === 'guests'
                ? 'Convidados da sala'
                : 'Seu personagem'
          }
        >
          <button
            className="rp-panel-close"
            onClick={() => setPanel(null)}
            aria-label="Fechar painel"
          >
            ×
          </button>
          {panel === 'decor' && room.can_edit && draft && (
            <>
              <h2>Decorar sala</h2>
              <label>
                Nome da sala
                <input
                  value={draft.name}
                  maxLength={80}
                  onChange={(e) => change({ name: e.target.value })}
                />
              </label>
              <label>
                Cenário
                <select
                  value={draft.document.scene}
                  onChange={(e) =>
                    change({ document: { ...draft.document, scene: e.target.value } })
                  }
                >
                  {rpScenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>Arraste as peças pela cena. A mobília de RP é decorativa.</p>
              <label>
                Adicionar mobília
                <ItemPicker
                  items={rpDecor.map((x) => ({
                    id: x.id,
                    name: x.name,
                    image: houseItemImage(x.id, houseDefaultFacing(x.id)),
                  }))}
                  onPick={(id) => {
                    const spec = rpDecor.find((x) => x.id === id);
                    if (!spec) return;
                    const next: RpPlacement = {
                      id: crypto.randomUUID(),
                      catalog: spec.id,
                      x: 0.5,
                      y: 0.84,
                      scale: Math.min(0.5, houseDefaultScale(spec.id)),
                      facing: houseDefaultFacing(spec.id),
                      rotation: 0,
                      layer: 3,
                    };
                    change({
                      document: {
                        ...draft.document,
                        placements: [...draft.document.placements, next],
                      },
                    });
                    setSelected(next.id);
                  }}
                />
              </label>
              {piece && (
                <fieldset>
                  <legend>{rpDecor.find((x) => x.id === piece.catalog)?.name}</legend>
                  <label>
                    Tamanho
                    <input
                      type="range"
                      min="0.04"
                      max="0.5"
                      step="0.01"
                      value={piece.scale}
                      onChange={(e) => changePiece({ scale: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Vista
                    <select
                      value={piece.facing}
                      onChange={(e) => changePiece({ facing: Number(e.target.value) })}
                    >
                      {houseFacingOptions(piece.catalog).map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Giro
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={piece.rotation}
                      onChange={(e) => changePiece({ rotation: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Camada
                    <select
                      value={piece.layer}
                      onChange={(e) => changePiece({ layer: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n}
                          {n === 1 ? ' · frente' : n === 6 ? ' · fundo' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => {
                      change({
                        document: {
                          ...draft.document,
                          placements: draft.document.placements.filter((x) => x.id !== piece.id),
                        },
                      });
                      setSelected('');
                    }}
                  >
                    Retirar da cena
                  </button>
                </fieldset>
              )}
              <button
                className="button primary"
                disabled={busy || !dirty || draft.name.trim().length < 2}
                onClick={() => void run(save)}
              >
                Salvar decoração
              </button>
              {dirty && (
                <button
                  onClick={() => {
                    setDraft({ name: room.name, document: room.document, revision: room.revision });
                    setDirty(false);
                    dirtyRef.current = false;
                    localStorage.removeItem(draftKey(target));
                    setNotice('Decoração recarregada da sala.');
                  }}
                >
                  Recarregar decoração da sala
                </button>
              )}
            </>
          )}
          {panel === 'guests' && room.is_owner && (
            <>
              <h2>Convidar amigos</h2>
              <label>
                Amigo
                <select value={friend} onChange={(e) => setFriend(e.target.value)}>
                  <option value="">Escolha um amigo</option>
                  {friends.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rp-checkbox">
                <input
                  type="checkbox"
                  checked={allowEdit}
                  onChange={(e) => setAllowEdit(e.target.checked)}
                />
                Permitir editar a sala
              </label>
              <button
                disabled={busy || !friend}
                onClick={() =>
                  void run(async () => {
                    await post('/rp-lobby/' + target + '/invites', {
                      user_id: friend,
                      can_edit: allowEdit,
                    });
                    setFriend('');
                    await refreshRoom();
                    setNotice('Convite enviado.');
                  })
                }
              >
                Convidar
              </button>
              {!friends.length && <p>Adicione amigos e aceite a amizade para convidá-los.</p>}
              {room.invites.map((i) => (
                <div className="rp-guest" key={i.user_id}>
                  <strong>{i.name}</strong>
                  <small>
                    {i.status === 'pending'
                      ? 'Convite pendente'
                      : i.status === 'accepted'
                        ? 'Aceito'
                        : 'Recusado'}
                    {i.can_edit ? ' · pode editar' : ''}
                  </small>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api(
                          '/rp-lobby/' + target + '/invites/' + encodeURIComponent(i.user_id),
                          { method: 'DELETE' },
                        );
                        await refreshRoom();
                      })
                    }
                  >
                    Remover convite
                  </button>
                </div>
              ))}
            </>
          )}
          {panel === 'character' && (
            <>
              <h2>{character?.name}</h2>
              <p>Arraste seu personagem para mudar de posição.</p>
              <label>
                Camada do personagem
                <select
                  aria-label="Camada do personagem"
                  value={self.depth_layer}
                  onChange={(e) => {
                    const value = { ...self, depth_layer: Number(e.target.value) };
                    setSelf(value);
                    selfRef.current = value;
                    void sendPosition(value).catch((e) => setError(e.message));
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      Camada {n}
                      {n === 1 ? ' · frente' : n === 6 ? ' · fundo' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tamanho
                <input
                  type="range"
                  min="0.06"
                  max="0.35"
                  step="0.01"
                  value={self.scale}
                  onChange={(e) => {
                    const value = { ...self, scale: Number(e.target.value) };
                    setSelf(value);
                    selfRef.current = value;
                  }}
                  onPointerUp={() => void sendPosition().catch((e) => setError(e.message))}
                  onKeyUp={() => void sendPosition().catch((e) => setError(e.message))}
                />
              </label>
              <button
                onClick={() =>
                  void run(async () => {
                    const value = { ...self, flip_x: !self.flip_x };
                    setSelf(value);
                    selfRef.current = value;
                    await sendPosition(value);
                  })
                }
              >
                Virar personagem
              </button>
              <div ref={setCompanionPanel} />
            </>
          )}
        </aside>
      )}
      <RpPersonalScene
        room={room}
        characterId={character?.id || ''}
        userId={user.id}
        stage={stage}
        refresh={() => refreshRoom()}
        notice={setNotice}
        panelTarget={companionPanel}
        showPanel={() => setPanel('character')}
      />
      {chat && (
        <section
          className={'rp-chat' + (chatActive ? ' chat-active' : '')}
          aria-label="Conversa de RP"
        >
          <button className="rp-chat-close" onClick={() => setChat(false)} aria-label="Recolher RP">
            −
          </button>
          <div
            ref={messages}
            className="rp-messages"
            role="log"
            aria-label="Histórico de RP"
            aria-live="polite"
            onPointerEnter={() => setChatActive(true)}
            onFocus={() => setChatActive(true)}
            tabIndex={0}
            onScroll={(event) => {
              const el = event.currentTarget;
              followChat.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
          >
            {room?.messages.map((m) => (
              <p key={m.id}>
                <strong>{m.name}:</strong> {m.body}
              </p>
            ))}
            {!room?.messages.length && <p>O cenário está pronto. Comece a interpretação.</p>}
          </div>
          <form
            ref={chatForm}
            onSubmit={(e) => {
              e.preventDefault();
              void run(send);
            }}
          >
            <input
              ref={chatInput}
              aria-label="Sua mensagem de RP"
              maxLength={2000}
              value={message}
              onFocus={() => setChatActive(true)}
              onChange={(e) => {
                setMessage(e.target.value);
                messageKey.current = crypto.randomUUID();
              }}
              placeholder={
                joined ? 'Escreva sua fala ou ação…' : 'Selecione um personagem para participar.'
              }
              disabled={!joined}
            />
            <button
              aria-label="Enviar"
              title="Enviar mensagem de RP"
              disabled={busy || !joined || !message.trim()}
            >
              <Send size={22} />
            </button>
          </form>
        </section>
      )}
      {closing && (
        <Modal title="Encerrar sala temporária" close={() => !busy && setClosing(false)}>
          <p>Os convidados sairão desta sala e ela deixará de aparecer no lobby.</p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await post('/rp-lobby/' + target + '/close', {});
                setDirty(false);
                dirtyRef.current = false;
                localStorage.removeItem(draftKey(target));
                setClosing(false);
                location.hash = 'house';
                setTarget('');
                await refreshIndex();
              })
            }
          >
            Encerrar esta sala
          </button>
        </Modal>
      )}
    </main>
  );
}
