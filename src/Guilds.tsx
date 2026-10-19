import { GuildEstate } from './GuildEstate';
import { useState, useEffect, useRef } from 'react';
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
  Search,
  Palette,
  ChevronDown,
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
import { GuildCrest } from './GuildCrest';
import { CrestEditor } from './GuildCrestEditor';
import { Modal } from './components';
import { visitProfile } from './HallOfFame';
import './guilds.css';
import './community-refinements.css';
import { GuildLobby } from './GuildLobby';
import { ScenePanel } from './ScenePanel';
import './guild-immersive.css';
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
  membership: { guild_id: string; character_id: string; character_name: string } | null;
  linked_character_ids: string[];
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
  members: { user_id: string; character_id: string; name: string; character_name: string }[];
  upgrades: { object_id: string; level: number }[];
  facilities: { room: string; level: number }[];
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
  activeCharacterId,
  onSelectCharacter,
  onPurchased,
}: {
  user: User;
  characters: Character[];
  activeCharacterId: string;
  onSelectCharacter: (id: string) => void;
  onPurchased: () => void | Promise<void>;
}) {
  const [directory, setDirectory] = useState<Directory | null>(null),
    [settings, setSettings] = useState<Settings | null>(null),
    [g, setG] = useState<Guild | null>(null),
    [target, setTarget] = useState(
      new URLSearchParams(location.hash.split('?')[1] || '').get('id') || '',
    ),
    [panel, setPanel] = useState<string | null>(null),
    [room, setRoom] = useState('main'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [founding, setFounding] = useState(false),
    [character, setCharacter] = useState(activeCharacterId || characters[0]?.id || ''),
    [doc, setDoc] = useState<GuildDocument | null>(null),
    [config, setConfig] = useState<CommunitySettings | null>(null),
    [search, setSearch] = useState(''),
    [people, setPeople] = useState<{ id: string; name: string }[]>([]),
    [decor, setDecor] = useState(guildDecor[0]?.id || '');
  const [estateFocusRequest, setEstateFocusRequest] = useState(0);
  const [estateEditRequest, setEstateEditRequest] = useState(0);
  const request = useRef(crypto.randomUUID());
  const [crestDraft, setCrestDraft] = useState<{ crest: Crest; revision: number } | null>(null);
  const loadTurn = useRef(0);
  const memberUrl = (url: string) =>
    activeCharacterId ? url + '?character_id=' + encodeURIComponent(activeCharacterId) : url;
  async function load() {
    const turn = ++loadTurn.current;
    const [d, s] = await Promise.all([
      api<Directory>(memberUrl('/guilds')),
      api<Settings>('/community/settings'),
    ]);
    const guild = target ? await api<Guild>(memberUrl('/guilds/' + target)) : null;
    if (turn !== loadTurn.current) return;
    setDirectory(d);
    setSettings(s);
    setG(guild);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (!document.hidden && !doc) void load().catch((e) => setError(e.message));
    }, 30000);
    return () => clearInterval(timer);
  }, [target, Boolean(doc), activeCharacterId]);
  useEffect(() => {
    setDirectory(null);
    setG(null);
    setDoc(null);
    setFounding(false);
    setEstateFocusRequest(0);
    setEstateEditRequest(0);
    setCrestDraft(null);
    setPanel(null);
    setCharacter(activeCharacterId || characters[0]?.id || '');
  }, [activeCharacterId]);
  useEffect(() => {
    const fn = () => {
      setTarget(new URLSearchParams(location.hash.split('?')[1] || '').get('id') || '');
      setDoc(null);
      setCrestDraft(null);
      setG(null);
      setRoom('main');
      setEstateFocusRequest(0);
      setEstateEditRequest(0);
      setPanel(null);
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
  const current = doc || g?.document;
  const freeCharacters = characters.filter((c) => !directory?.linked_character_ids.includes(c.id));
  const headquarters = g ? (
    <GuildEstate
      key={g.id}
      guildId={g.id}
      characterId={activeCharacterId}
      revision={g.revision}
      estate={g.document.estate}
      owner={g.is_owner}
      member={g.is_member}
      levels={g.facilities || []}
      treasury={g.treasury_cp}
      focusRoom={room}
      focusRequest={estateFocusRequest}
      editRequest={estateEditRequest}
      changed={load}
    />
  ) : null;
  return (
    <section className={`guild-page ${g ? 'guild-is-detail' : 'guild-is-lobby'}`}>
      {headquarters}
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
          <GuildLobby
            entries={directory.items}
            mine={directory.mine}
            activeName={
              characters.find((c) => c.id === activeCharacterId)?.name || 'Seu personagem'
            }
            cost={settings?.document.founding_po}
            canFound={
              !busy &&
              freeCharacters.length > 0 &&
              settings?.document.founding_po !== null &&
              Boolean(settings)
            }
            foundingHint={
              !characters.length
                ? 'Crie um personagem para fundar ou entrar em uma guilda.'
                : !freeCharacters.length
                  ? 'Todos os seus personagens já pertencem a uma guilda.'
                  : 'A fundação será liberada quando o custo estiver configurado.'
            }
            onFound={() => {
              request.current = crypto.randomUUID();
              setCharacter(
                freeCharacters.find((c) => c.id === activeCharacterId)?.id ||
                  freeCharacters[0]?.id ||
                  '',
              );
              setDoc(guildDocumentSchema.parse({ name: 'Nova guilda' }));
              setFounding(true);
            }}
            onAdmin={
              settings?.can_edit ? () => setConfig(structuredClone(settings.document)) : undefined
            }
            invites={
              <>
                {' '}
                {!directory.mine && freeCharacters.length > 0 && directory.invites.length > 0 && (
                  <section className="guild-paper">
                    <h2>Convites recebidos</h2>
                    <label>
                      Representar com
                      <select value={character} onChange={(e) => setCharacter(e.target.value)}>
                        {freeCharacters.map((c) => (
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
                              await post('/guilds/' + i.guild_id + '/join', {
                                character_id: character,
                              });
                              onSelectCharacter(character);
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
              </>
            }
          />
        </>
      ) : !g ? (
        <p role="status">Abrindo a sede…</p>
      ) : (
        <>
          <div className="guild-scene-topbar">
            <button
              className="guild-scene-identity"
              onClick={() => setPanel(panel === 'overview' ? null : 'overview')}
              aria-expanded={panel === 'overview'}
              aria-controls="scene-panel-overview"
              aria-label="Informações da guilda"
            >
              <GuildCrest crest={current!.crest} size={52} />
              <span>
                <h1>{g.document.name}</h1>
                <small>Sede da guilda · {g.is_member ? 'Sua companhia' : 'Visitante'}</small>
              </span>
              <ChevronDown size={15} />
            </button>
            <div className="guild-scene-top-actions">
              <button onClick={() => (location.hash = 'guild')} aria-label="Todas as guildas">
                <ArrowLeft size={16} />
                <span>Todas as guildas</span>
              </button>
              <button
                aria-expanded={panel === 'rooms'}
                aria-controls="scene-panel-rooms"
                onClick={() => setPanel(panel === 'rooms' ? null : 'rooms')}
              >
                <Home size={16} />
                Salas
                <ChevronDown size={13} />
              </button>
            </div>
          </div>
          <nav className="guild-scene-dock" aria-label="Áreas da guilda">
            <button
              aria-expanded={panel === 'members'}
              aria-controls="scene-panel-members"
              onClick={() => setPanel(panel === 'members' ? null : 'members')}
            >
              <Users size={18} />
              <span>Companhia</span>
              <small>{g.members.length}/8</small>
            </button>
            <button
              aria-expanded={panel === 'missions'}
              aria-controls="scene-panel-missions"
              onClick={() => setPanel(panel === 'missions' ? null : 'missions')}
            >
              <Trophy size={18} />
              <span>Missões</span>
            </button>
          </nav>
          <div className="guild-scene-tools">
            {g.is_owner && (
              <button
                aria-expanded={panel === 'edit'}
                onClick={() => {
                  setPanel(null);
                  setEstateEditRequest((n) => n + 1);
                }}
              >
                <Palette size={17} />
                <span>Reposicionar itens</span>
              </button>
            )}
          </div>
          {panel === 'overview' && (
            <ScenePanel
              id="overview"
              title="Sobre a companhia"
              side="left"
              close={() => setPanel(null)}
            >
              <p className="guild-scene-description">
                {g.document.description || 'Uma companhia, muitas histórias para escrever.'}
              </p>
              <div className="guild-summary">
                <div className="guild-rank">
                  <span className="social-eyebrow">Patente {g.rank}</span>
                  <h2>Nível {g.level}</h2>
                </div>
                <div className="guild-stat">
                  <Trophy size={16} />
                  <strong>{g.prestige}</strong>
                  <span>Prestígio</span>
                </div>
                <div className="guild-stat">
                  <Users size={16} />
                  <strong>
                    {g.members.length}
                    <small>/8</small>
                  </strong>
                  <span>Jogadores</span>
                </div>
                {g.is_member && (
                  <strong>
                    <Coins size={18} /> {((g.treasury_cp || 0) / 100).toLocaleString('pt-BR')} PO
                    <small>Tesouro da guilda</small>
                  </strong>
                )}
                {g.is_owner && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      setCrestDraft({
                        crest: structuredClone(current!.crest),
                        revision: g.revision,
                      })
                    }
                  >
                    <Palette size={16} />
                    Editar brasão
                  </button>
                )}
                {g.is_owner && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      setPanel(null);
                      setEstateEditRequest((n) => n + 1);
                    }}
                  >
                    <Settings2 size={16} />
                    Reposicionar itens
                  </button>
                )}
              </div>
              <p className="guild-membership" role="status">
                <Users size={14} />
                {characters.find((c) => c.id === activeCharacterId)?.name || 'Seu personagem'}
                {g.is_member
                  ? ' · Membro desta guilda'
                  : ' · Visitante · Não pertence a esta guilda'}
              </p>

              <div className="guild-actions">
                {settings?.can_edit && (
                  <button onClick={() => setConfig(structuredClone(settings.document))}>
                    <Settings2 size={15} />
                    Painel administrativo
                  </button>
                )}
              </div>
            </ScenePanel>
          )}
          {panel === 'rooms' && (
            <ScenePanel id="rooms" title="Explore a sede" close={() => setPanel(null)}>
              <p className="guild-scene-description">
                Uma casa humilde, quatro cômodos e quatro instalações para evoluir.
              </p>{' '}
              <nav className="guild-room-tabs" aria-label="Salas da sede">
                {guildRooms
                  .filter((r) => r.starter)
                  .map((r) => {
                    const locked =
                      !r.starter && g.level < g.room_unlocks[r.id as keyof typeof g.room_unlocks];
                    return (
                      <button
                        key={r.id}
                        disabled={locked}
                        title={
                          locked
                            ? 'Libera no nível ' +
                              g.room_unlocks[r.id as keyof typeof g.room_unlocks]
                            : r.name
                        }
                        aria-pressed={room === r.id}
                        onClick={() => {
                          setRoom(r.id);
                          setEstateFocusRequest((n) => n + 1);
                          setPanel(null);
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
            </ScenePanel>
          )}
          {panel === 'missions' && (
            <ScenePanel
              id="missions"
              title="Missões e tesouro"
              side="left"
              close={() => setPanel(null)}
            >
              {' '}
              {panel === 'missions' &&
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
                                  memberUrl(
                                    '/guilds/' + g.id + '/weekly/' + m.mission_id + '/claim',
                                  ),
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
                            furniture: 'Compra de mobília',
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
            </ScenePanel>
          )}
          {panel === 'members' && (
            <ScenePanel id="members" title="Companhia" side="left" close={() => setPanel(null)}>
              {' '}
              {panel === 'members' && (
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
                      {m.user_id !== g.owner_id &&
                        (g.is_owner || (g.is_member && m.character_id === activeCharacterId)) && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await api(
                                  memberUrl(
                                    '/guilds/' + g.id + '/members/' + encodeURIComponent(m.user_id),
                                  ),
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
                                await post(memberUrl('/guilds/' + g.id + '/invites'), {
                                  user_id: p.id,
                                });
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
            </ScenePanel>
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
                onSelectCharacter(character);
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
              <select
                aria-label="Personagem fundador"
                required
                value={character}
                onChange={(e) => setCharacter(e.target.value)}
              >
                {freeCharacters.map((c) => (
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
      {crestDraft && g?.is_owner && (
        <Modal title="Editar brasão" close={() => !busy && setCrestDraft(null)}>
          <form
            className="guild-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const saved = await api<{ revision: number }>(
                  memberUrl('/guilds/' + g.id + '/crest'),
                  { method: 'PATCH', body: JSON.stringify(crestDraft) },
                );
                setG((old) =>
                  old
                    ? {
                        ...old,
                        revision: saved.revision,
                        document: { ...old.document, crest: crestDraft.crest },
                      }
                    : old,
                );
                setDoc((old) => (old ? { ...old, crest: crestDraft.crest } : old));
                setCrestDraft(null);
                setNotice('Brasão salvo.');
              });
            }}
          >
            <CrestEditor
              value={crestDraft.crest}
              name={g.document.name}
              onChange={(crest) => setCrestDraft({ ...crestDraft, crest })}
            />
            {error && <p role="alert">{error}</p>}
            <div className="guild-actions">
              <button type="submit" disabled={busy}>
                <Save size={15} />
                Salvar brasão
              </button>
              <button type="button" disabled={busy} onClick={() => setCrestDraft(null)}>
                Cancelar
              </button>
            </div>
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
