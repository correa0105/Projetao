import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  UserRound,
  Search,
  Users,
  UserPlus,
  MessageSquare,
  Star,
  Trophy,
  Crown,
  Shield,
  Layers,
  Settings2,
  Check,
  X,
  Flag,
  Send,
} from 'lucide-react';
import { api, post } from './api';
import type { User } from './types';
import type { DirectoryEntry, ProfileSettings, DirectMessage } from '../shared/social';
import { profileSettingsSchema } from '../shared/social';
import { rankName, progressionLabel } from '../shared/progression';
import { AchievementShelf } from './Achievements';
import { PortraitCabinet } from './PortraitFrames';
import { CardCollection } from './CharacterCards';
import { PetArt } from './PetShop';
import { pets } from '../shared/pets';
import { mounts, ownedMountImage, type OwnedMount } from '../shared/mounts';
import { petArtwork } from './pet-art';
import { HallOfFame, visitProfile } from './HallOfFame';
import type { deriveSheet } from '../shared/character-sheet';
import type { ShelfConfig, AchievementDefinition } from '../shared/achievements';
import type { Card } from '../shared/cards';
import './hall-profiles.css';
type PublicCharacter = {
  id: string;
  user_id: string;
  name: string;
  race: string;
  class: string;
  background: string;
  biography: string;
  level: number;
  hp: number;
  armor_class: number;
  stats: number[];
  portrait_revision: number;
  portrait: string;
  progression_missions: number;
  displayed_title: string | null;
  title_position: 'below' | 'beside';
};
type Profile = {
  id: string;
  name: string;
  document: ProfileSettings;
  revision: number;
  avatar: string;
  is_owner: boolean;
  characters: PublicCharacter[];
  reviews: {
    author_id: string;
    author: string;
    score: number;
    comment: string;
    created_at: string;
  }[];
  rating: { count: number; average: number };
  friend: { id: string; status: 'pending' | 'accepted'; incoming: boolean } | null;
  blocked: boolean;
  blocked_by_me: boolean;
};
type PublicDetails = {
  character: PublicCharacter;
  shelf: ShelfConfig;
  achievements: { code: string }[];
  definitions: AchievementDefinition[];
  mounts: OwnedMount[];
  pets: { id: string; pet_id: string; appearance: string; name: string; displayed: boolean }[];
  cards: (Card & { level: number; slot: number | null })[];
  titles: { id: string; document: { name: string; description: string } }[];
  derived: ReturnType<typeof deriveSheet> | null;
};
type Friend = {
  id: string;
  name: string;
  avatar: string;
  status: 'pending' | 'accepted';
  incoming: boolean;
  friendship_id: string;
};
type Panel = 'characters' | 'achievements' | 'hall' | 'sheet' | 'cards';
const panels: { id: Panel; name: string; icon: typeof Users }[] = [
  { id: 'characters', name: 'Personagens', icon: Users },
  { id: 'achievements', name: 'Conquistas', icon: Trophy },
  { id: 'hall', name: 'Hall da Fama', icon: Crown },
  { id: 'sheet', name: 'Ficha', icon: Shield },
  { id: 'cards', name: 'Cartas', icon: Layers },
];
export function Profiles({ user }: { user: User }) {
  const olderLoaded = useRef(false);
  const params = () => new URLSearchParams(location.hash.split('?')[1] || ''),
    [target, setTarget] = useState(params().get('user') || ''),
    [selected, setSelected] = useState(params().get('character') || ''),
    [profile, setProfile] = useState<Profile | null>(null),
    [details, setDetails] = useState<PublicDetails | null>(null),
    [panel, setPanel] = useState<Panel>('characters'),
    [error, setError] = useState('');
  const [items, setItems] = useState<DirectoryEntry[]>([]),
    [query, setQuery] = useState(''),
    [more, setMore] = useState(false),
    [friends, setFriends] = useState<Friend[]>([]),
    [blocks, setBlocks] = useState<{ id: string; name: string }[]>([]),
    [inbox, setInbox] = useState<{ id: string; name: string; body: string; unread: number }[]>([]),
    [socialOpen, setSocialOpen] = useState(false),
    [chatPeer, setChatPeer] = useState<{ id: string; name: string } | null>(null),
    [messages, setMessages] = useState<DirectMessage[]>([]),
    [message, setMessage] = useState(''),
    [canSend, setCanSend] = useState(false),
    [hasOlder, setHasOlder] = useState(false),
    [editing, setEditing] = useState<ProfileSettings | null>(null),
    [rating, setRating] = useState(5),
    [comment, setComment] = useState(''),
    [companion, setCompanion] = useState<OwnedMount | null>(null);
  const loadProfile = async (uid = target) => {
    const next = await api<Profile>('/profiles/' + encodeURIComponent(uid));
    setProfile(next);
    setSelected((previous) =>
      next.characters.some((c) => c.id === previous)
        ? previous
        : next.document.featured.find((id) => next.characters.some((c) => c.id === id)) ||
          next.characters[0]?.id ||
          '',
    );
    const review = next.reviews.find((r) => r.author_id === user.id);
    setRating(review?.score || 5);
    setComment(review?.comment || '');
  };
  async function loadSocial() {
    const [f, i] = await Promise.all([
      api<{ items: Friend[]; blocks: typeof blocks }>('/social/friends'),
      api<typeof inbox>('/social/inbox'),
    ]);
    setFriends(f.items);
    setBlocks(f.blocks);
    setInbox(i);
  }
  async function run(fn: () => Promise<void>) {
    try {
      setError('');
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    function navigate() {
      setTarget(params().get('user') || '');
      setSelected(params().get('character') || '');
      setPanel('characters');
      setProfile(null);
      setDetails(null);
    }
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void api<{ items: DirectoryEntry[]; has_more: boolean }>(
        '/profiles?q=' + encodeURIComponent(query),
      )
        .then((r) => {
          if (active) {
            setItems(r.items);
            setMore(r.has_more);
          }
        })
        .catch((e) => active && setError(e.message));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  useEffect(() => {
    if (!target) return;
    let active = true;
    api<Profile>('/profiles/' + encodeURIComponent(target))
      .then((next) => {
        if (active) {
          setProfile(next);
          setSelected((prev) =>
            next.characters.some((c) => c.id === prev)
              ? prev
              : next.document.featured.find((id) => next.characters.some((c) => c.id === id)) ||
                next.characters[0]?.id ||
                '',
          );
          const review = next.reviews.find((r) => r.author_id === user.id);
          setRating(review?.score || 5);
          setComment(review?.comment || '');
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [target]);
  useEffect(() => {
    setDetails(null);
    setCompanion(null);
    if (!target || !selected) return;
    let active = true;
    api<PublicDetails>(`/profiles/${encodeURIComponent(target)}/characters/${selected}`)
      .then((d) => {
        if (active) {
          setDetails(d);
          setCompanion(d.mounts.find((m) => m.displayed) || null);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [target, selected]);
  useEffect(() => {
    void run(loadSocial);
    const timer = setInterval(() => {
      if (!document.hidden) void loadSocial().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!chatPeer) return;
    let active = true;
    const poll = () =>
      api<{ items: DirectMessage[]; has_more: boolean; can_send: boolean }>(
        '/social/chat/' + encodeURIComponent(chatPeer.id),
      ).then((r) => {
        if (active) {
          setMessages((prev) => {
            const old = prev.filter((m) => !r.items.some((n) => n.id === m.id));
            return [...old, ...r.items].sort((a, b) => Number(a.id) - Number(b.id));
          });
          setCanSend(r.can_send);
          if (!olderLoaded.current) setHasOlder(r.has_more);
          if (r.items.some((m) => m.recipient_id === user.id && !m.read_at))
            void post('/social/chat/' + encodeURIComponent(chatPeer.id) + '/read', {})
              .then(loadSocial)
              .catch(() => {});
        }
      });
    setMessages([]);
    olderLoaded.current = false;
    void poll().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (!document.hidden) void poll().catch(() => {});
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [chatPeer?.id]);
  function avatar(path: string, name: string) {
    return (
      <span className="social-avatar">
        <UserRound size={38} />
        {path && (
          <img src={path} alt={name} onError={(e) => (e.currentTarget.style.display = 'none')} />
        )}
      </span>
    );
  }
  function openChat(peer: { id: string; name: string }) {
    setChatPeer(peer);
    setSocialOpen(true);
  }
  async function changeFriend(action: 'request' | 'accept' | 'remove') {
    await api('/social/friends/' + encodeURIComponent(target), {
      method: action === 'request' ? 'POST' : action === 'accept' ? 'PATCH' : 'DELETE',
      body: JSON.stringify({}),
    });
    await loadProfile();
    await loadSocial();
  }
  const current = details?.character || profile?.characters.find((c) => c.id === selected),
    displayPet = details?.pets.find((p) => p.displayed),
    species = pets.find((p) => p.id === displayPet?.pet_id);
  async function upload(file: File) {
    const r = await fetch('/api/social/assets', {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    return data.path as string;
  }
  return (
    <section
      className={`profiles-page ${profile ? 'visiting' : ''}`}
      style={
        profile
          ? ({
              '--profile-accent': profile.document.accent,
              '--profile-background': `url('${profile.document.background}')`,
            } as CSSProperties)
          : undefined
      }
    >
      <div className="profiles-top">
        <button className="social-back" onClick={() => (location.hash = 'profiles')}>
          <ArrowLeft size={16} />
          {target ? 'Todos os perfis' : 'Perfis da Alvorada'}
        </button>
        <div>
          <button onClick={() => visitProfile(user.id)}>
            <UserRound size={15} />
            Meu perfil
          </button>
          <button onClick={() => setSocialOpen((v) => !v)} aria-expanded={socialOpen}>
            <MessageSquare size={16} />
            Amigos e chat
            {inbox.some((i) => i.unread > 0) && (
              <b className="social-unread">{inbox.reduce((n, i) => n + i.unread, 0)}</b>
            )}
          </button>
          {profile?.is_owner && (
            <button onClick={() => setEditing(structuredClone(profile.document))}>
              <Settings2 size={15} />
              Personalizar perfil
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="social-error" role="alert">
          {error}
          <button aria-label="Fechar aviso" onClick={() => setError('')}>
            <X size={14} />
          </button>
        </div>
      )}
      {!target ? (
        <>
          <header className="profiles-directory-heading">
            <span className="social-eyebrow">Cada viajante, um universo</span>
            <h1>Perfis da Alvorada</h1>
            <p>Encontre amigos e descubra as histórias por trás dos personagens.</p>
            <label className="profiles-finder">
              <Search size={19} />
              <input
                aria-label="Localizador de perfil"
                placeholder="Nome do jogador ou ID do perfil"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={100}
              />
            </label>
          </header>
          <div className="profile-directory">
            {items.map((p) => (
              <article key={p.id}>
                {avatar(p.avatar, p.name)}
                <h2>{p.name}</h2>
                <p>{p.tagline || 'Uma história ainda sendo escrita.'}</p>
                <span>
                  {p.characters} personagens
                  {p.rating_count > 0 ? ` · ★ ${p.rating.toFixed(1)} (${p.rating_count})` : ''}
                </span>
                <button onClick={() => visitProfile(p.id)}>
                  Visitar perfil <ArrowRight size={14} />
                </button>
              </article>
            ))}
          </div>
          {items.length === 0 && (
            <p className="social-empty">Nenhum perfil encontrado para esta busca.</p>
          )}
          {more && (
            <button
              className="button outline"
              onClick={() =>
                void run(async () => {
                  const next = await api<{ items: DirectoryEntry[]; has_more: boolean }>(
                    '/profiles?q=' + encodeURIComponent(query) + '&offset=' + items.length,
                  );
                  setItems((list) => [...list, ...next.items]);
                  setMore(next.has_more);
                })
              }
            >
              Carregar mais perfis
            </button>
          )}
        </>
      ) : !profile ? (
        <p className="social-empty">Abrindo o perfil…</p>
      ) : (
        <>
          <header className="visited-profile-heading">
            {avatar(profile.avatar, profile.name)}
            <div>
              <span className="social-eyebrow">Perfil do viajante</span>
              <h1>{profile.name}</h1>
              <p>{profile.document.tagline || 'Nas estradas da Alvorada.'}</p>
              <small>ID: {profile.id}</small>
            </div>
            <div className="visited-profile-actions">
              {profile.is_owner ? null : profile.blocked_by_me ? (
                <button
                  onClick={() =>
                    void run(async () => {
                      await api('/social/blocks/' + encodeURIComponent(target), {
                        method: 'DELETE',
                      });
                      await loadProfile();
                      await loadSocial();
                    })
                  }
                >
                  Desbloquear
                </button>
              ) : profile.blocked ? (
                <span>Interações indisponíveis.</span>
              ) : (
                <>
                  {profile.friend?.status === 'accepted' ? (
                    <>
                      <button onClick={() => openChat({ id: profile.id, name: profile.name })}>
                        <MessageSquare size={15} />
                        Conversar
                      </button>
                      <button onClick={() => void run(() => changeFriend('remove'))}>
                        Remover amizade
                      </button>
                    </>
                  ) : profile.friend ? (
                    <button
                      onClick={() =>
                        void run(() => changeFriend(profile.friend!.incoming ? 'accept' : 'remove'))
                      }
                    >
                      {profile.friend.incoming ? 'Aceitar amizade' : 'Cancelar pedido'}
                    </button>
                  ) : (
                    <button onClick={() => void run(() => changeFriend('request'))}>
                      <UserPlus size={15} />
                      Adicionar amigo
                    </button>
                  )}
                  <button
                    title="Bloquear jogador"
                    onClick={() =>
                      void run(async () => {
                        await post('/social/blocks/' + encodeURIComponent(target), {});
                        await loadProfile();
                        await loadSocial();
                      })
                    }
                  >
                    <Flag size={14} />
                  </button>
                </>
              )}
            </div>
          </header>
          <div className="visited-profile-layout">
            <div className="profile-panels-viewport">
              <div
                className="profile-panels-strip"
                style={{
                  transform: `translateX(-${panels.findIndex((p) => p.id === panel) * 20}%)`,
                }}
              >
                <section
                  className="public-profile-panel public-camp"
                  aria-hidden={panel !== 'characters'}
                  inert={panel !== 'characters'}
                >
                  <div className="public-camp-heading">
                    <div className="public-camp-name" data-title-position={current?.title_position}>
                      <h2>{current?.name || 'O acampamento do viajante'}</h2>
                      {current?.displayed_title && (
                        <div className="public-character-title">
                          <Crown size={14} />
                          {current.displayed_title}
                        </div>
                      )}
                    </div>
                    {current && (
                      <p>
                        {rankName(current.level)} · {current.race} · {current.class}
                      </p>
                    )}
                  </div>
                  <div className="public-camp-stage">
                    {companion && (
                      <button
                        className="public-camp-mount"
                        style={
                          {
                            '--mount-scale':
                              mounts.find((m) => m.id === companion.mount_id)?.scale || 1,
                          } as CSSProperties
                        }
                        onClick={() => setCompanion(null)}
                        title="Ocultar montaria nesta visita"
                      >
                        <img src={ownedMountImage(companion)} alt={companion.name} />
                        <span>{companion.name}</span>
                      </button>
                    )}
                    <div className="public-character-figures">
                      {profile.characters.map((c) => (
                        <button
                          key={c.id}
                          className={`public-character-figure ${selected === c.id ? 'selected' : ''}`}
                          aria-label={`Selecionar ${c.name} no perfil`}
                          aria-pressed={selected === c.id}
                          onClick={() => setSelected(c.id)}
                        >
                          {c.portrait_revision > 0 ? (
                            <img src={c.portrait} alt={c.name} />
                          ) : (
                            <div className="public-character-silhouette">
                              <UserRound size={90} />
                            </div>
                          )}
                          <span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                    {displayPet && species && (
                      <div
                        className="public-camp-pet"
                        style={
                          {
                            '--companion-width': `${petArtwork(species.id, displayPet.appearance).width}px`,
                            '--companion-proportion':
                              petArtwork(species.id, displayPet.appearance).width / 218,
                          } as CSSProperties
                        }
                      >
                        <PetArt pet={species} appearance={displayPet.appearance} />
                        <span title={displayPet.name}>{displayPet.name}</span>
                      </div>
                    )}
                  </div>
                </section>
                <section
                  className="public-profile-panel public-achievements"
                  aria-hidden={panel !== 'achievements'}
                  inert={panel !== 'achievements'}
                >
                  <span className="social-eyebrow">Memórias de uma jornada</span>
                  <h2>Conquistas de {current?.name || profile.name}</h2>
                  {details && (
                    <>
                      <div className="cabinet-room-stage public-cabinet-stage">
                        <PortraitCabinet
                          characters={profile.characters}
                          active={selected}
                          onSelect={setSelected}
                        >
                          <AchievementShelf
                            config={details.shelf}
                            definitions={details.definitions}
                          />
                        </PortraitCabinet>
                      </div>
                      <div className="public-earned-achievements">
                        {details.achievements.map((a) => {
                          const def = details.definitions.find((d) => d.code === a.code);
                          return (
                            <article key={a.code}>
                              <img src={'/trophies/' + a.code + '.png'} alt="" />
                              <div>
                                <h3>{def?.title}</h3>
                                <p>{def?.description}</p>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      {details.achievements.length === 0 && (
                        <p className="social-empty">
                          Esta jornada ainda não tem conquistas registradas.
                        </p>
                      )}
                    </>
                  )}
                </section>
                <section
                  className="public-profile-panel"
                  aria-hidden={panel !== 'hall'}
                  inert={panel !== 'hall'}
                >
                  {panel === 'hall' && (
                    <HallOfFame key={selected} embedded focusCharacterId={selected} />
                  )}
                </section>
                <section
                  className="public-profile-panel public-sheet"
                  aria-hidden={panel !== 'sheet'}
                  inert={panel !== 'sheet'}
                >
                  <span className="social-eyebrow">O registro do aventureiro</span>
                  <h2>Ficha de {current?.name || profile.name}</h2>
                  {current && (
                    <>
                      <p>
                        {current.race} · {current.class} · Nível {current.level} ·{' '}
                        {rankName(current.level)}
                      </p>
                      <div className="public-stat-cards">
                        <span>
                          PV<b>{current.hp}</b>
                        </span>
                        <span>
                          CA<b>{current.armor_class}</b>
                        </span>
                        <span>
                          Missões<b>{current.progression_missions}</b>
                        </span>
                      </div>
                      <div className="public-abilities">
                        {current.stats.map((stat, i) => (
                          <span key={i}>
                            {['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'][i]}
                            <b>{stat}</b>
                            <small>
                              {Math.floor((stat - 10) / 2) >= 0 ? '+' : ''}
                              {Math.floor((stat - 10) / 2)}
                            </small>
                          </span>
                        ))}
                      </div>
                      <h3>História</h3>
                      <p className="public-biography">
                        {current.biography || 'História ainda não registrada.'}
                      </p>
                      {details?.derived && (
                        <>
                          <h3>Perícias</h3>
                          <div className="public-skill-list">
                            {details.derived.skills.map((s) => (
                              <span key={s.name}>
                                {s.name}
                                <b>
                                  {s.value >= 0 ? '+' : ''}
                                  {s.value}
                                </b>
                              </span>
                            ))}
                          </div>
                          <h3>Características</h3>
                          {details.derived.features.map((f, i) => (
                            <p key={i}>{f}</p>
                          ))}
                          <h3>Equipamento da ficha</h3>
                          <p>{details.derived.equipment.join(' · ')}</p>
                        </>
                      )}
                    </>
                  )}
                </section>
                <section
                  className="public-profile-panel public-cards"
                  aria-hidden={panel !== 'cards'}
                  inert={panel !== 'cards'}
                >
                  <span className="social-eyebrow">As histórias que o acompanham</span>
                  <h2>Cartas de {current?.name || profile.name}</h2>
                  <CardCollection
                    key={current?.id || profile.id}
                    items={(details?.cards || []).map((card) => ({
                      ownedId: card.id,
                      card,
                      level: card.level,
                      slot: card.slot,
                    }))}
                  />
                </section>
              </div>
            </div>
            <aside className="profile-visit-nav">
              <span>Você está visitando</span>
              <strong>{profile.name}</strong>
              {current && (
                <label>
                  Personagem
                  <select
                    aria-label="Personagem do perfil visitado"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {profile.characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {panels.map(({ id, name, icon: Icon }) => (
                <button key={id} aria-pressed={panel === id} onClick={() => setPanel(id)}>
                  <Icon size={17} />
                  {name}
                  <ArrowRight size={14} />
                </button>
              ))}
              <p>Visita de consulta. Apenas o dono gerencia seus personagens e bens.</p>
            </aside>
          </div>
          <section className="profile-reviews">
            <div>
              <span className="social-eyebrow">Pelas vozes da comunidade</span>
              <h2>Avaliações do perfil</h2>
              <p>
                {profile.rating.count
                  ? `★ ${profile.rating.average.toFixed(1)} · ${profile.rating.count} avaliações`
                  : 'Este perfil ainda não foi avaliado.'}
              </p>
            </div>
            {!profile.is_owner && !profile.blocked && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await post('/profiles/' + encodeURIComponent(target) + '/review', {
                      score: rating,
                      comment,
                    });
                    await loadProfile();
                  });
                }}
              >
                <fieldset>
                  <legend>Sua avaliação</legend>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`Avaliar com ${n} estrelas`}
                      aria-pressed={rating === n}
                      className={n <= rating ? 'filled' : ''}
                      onClick={() => setRating(n)}
                    >
                      <Star size={21} />
                    </button>
                  ))}
                </fieldset>
                <label>
                  Comentário
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={500}
                    placeholder="Conte como foi jogar com este viajante…"
                  />
                </label>
                <div>
                  <button className="button primary">Salvar avaliação</button>
                  {profile.reviews.some((r) => r.author_id === user.id) && (
                    <button
                      type="button"
                      onClick={() =>
                        void run(async () => {
                          await api('/profiles/' + encodeURIComponent(target) + '/review', {
                            method: 'DELETE',
                          });
                          await loadProfile();
                        })
                      }
                    >
                      Remover minha avaliação
                    </button>
                  )}
                </div>
              </form>
            )}
            <div className="profile-review-list">
              {profile.reviews.map((r) => (
                <article key={r.author_id}>
                  <button onClick={() => visitProfile(r.author_id)}>{r.author}</button>
                  <span>
                    {'★'.repeat(r.score)}
                    {'☆'.repeat(6 - r.score - 1)}
                  </span>
                  <p>{r.comment}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {socialOpen && (
        <aside className="social-drawer" role="dialog" aria-label="Amigos e chat">
          <header>
            <h2>{chatPeer ? 'Conversa com ' + chatPeer.name : 'Amigos e mensagens'}</h2>
            <button
              aria-label="Fechar amigos e chat"
              onClick={() => {
                setSocialOpen(false);
                setChatPeer(null);
              }}
            >
              <X size={18} />
            </button>
          </header>
          {chatPeer ? (
            <>
              <button className="social-back" onClick={() => setChatPeer(null)}>
                <ArrowLeft size={13} />
                Lista de amigos
              </button>
              {hasOlder && messages[0] && (
                <button
                  onClick={() =>
                    void run(async () => {
                      const r = await api<{ items: DirectMessage[]; has_more: boolean }>(
                        `/social/chat/${encodeURIComponent(chatPeer.id)}?before=${messages[0].id}`,
                      );
                      olderLoaded.current = true;
                      setMessages((prev) => [
                        ...r.items.filter((m) => !prev.some((p) => p.id === m.id)),
                        ...prev,
                      ]);
                      setHasOlder(r.has_more);
                    })
                  }
                >
                  Mensagens anteriores
                </button>
              )}
              <div className="direct-chat-history" aria-live="polite">
                {messages.map((m) => (
                  <article key={m.id} className={m.sender_id === user.id ? 'sent' : 'received'}>
                    <p>{m.body}</p>
                    <small>
                      {new Date(m.created_at).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                      {m.sender_id === user.id && m.read_at ? ' · Lida' : ''}
                    </small>
                  </article>
                ))}
              </div>
              {canSend ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const next = await post<DirectMessage>(
                        '/social/chat/' + encodeURIComponent(chatPeer.id),
                        { body: message },
                      );
                      setMessages((prev) =>
                        prev.some((m) => m.id === next.id) ? prev : [...prev, next],
                      );
                      setMessage('');
                      await loadSocial();
                    });
                  }}
                >
                  <label>
                    Mensagem privada
                    <textarea
                      aria-label="Mensagem privada"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={2000}
                      rows={2}
                    />
                  </label>
                  <button className="button primary" disabled={!message.trim()}>
                    <Send size={15} />
                    Enviar
                  </button>
                </form>
              ) : (
                <p>Adicione este jogador e aguarde a amizade ser aceita para enviar mensagens.</p>
              )}
            </>
          ) : (
            <>
              <h3>Pedidos recebidos</h3>
              {friends
                .filter((f) => f.status === 'pending' && f.incoming)
                .map((f) => (
                  <div className="social-friend-row" key={f.id}>
                    {avatar(f.avatar, f.name)}
                    <button onClick={() => visitProfile(f.id)}>{f.name}</button>
                    <button
                      aria-label={'Aceitar amizade de ' + f.name}
                      onClick={() =>
                        void run(async () => {
                          await api('/social/friends/' + encodeURIComponent(f.id), {
                            method: 'PATCH',
                            body: '{}',
                          });
                          await loadSocial();
                        })
                      }
                    >
                      <Check size={15} />
                    </button>
                    <button
                      aria-label={'Recusar amizade de ' + f.name}
                      onClick={() =>
                        void run(async () => {
                          await api('/social/friends/' + encodeURIComponent(f.id), {
                            method: 'DELETE',
                          });
                          await loadSocial();
                        })
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              <h3>Seus amigos</h3>
              {friends
                .filter((f) => f.status === 'accepted')
                .map((f) => (
                  <div className="social-friend-row" key={f.id}>
                    {avatar(f.avatar, f.name)}
                    <button onClick={() => visitProfile(f.id)}>{f.name}</button>
                    <button aria-label={'Conversar com ' + f.name} onClick={() => openChat(f)}>
                      <MessageSquare size={16} />
                    </button>
                  </div>
                ))}
              {friends.every((f) => f.status !== 'accepted') && (
                <p>Visite um perfil e envie seu primeiro pedido de amizade.</p>
              )}
              <h3>Pedidos enviados</h3>
              {friends
                .filter((f) => f.status === 'pending' && !f.incoming)
                .map((f) => (
                  <div className="social-friend-row" key={f.id}>
                    <span>{f.name}</span>
                    <button
                      onClick={() =>
                        void run(async () => {
                          await api('/social/friends/' + encodeURIComponent(f.id), {
                            method: 'DELETE',
                          });
                          await loadSocial();
                        })
                      }
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
              <h3>Conversas recentes</h3>
              {inbox.map((i) => (
                <button className="social-inbox-row" key={i.id} onClick={() => openChat(i)}>
                  <strong>
                    {i.name}
                    {i.unread > 0 && <b>{i.unread}</b>}
                  </strong>
                  <span>{i.body}</span>
                </button>
              ))}
              {blocks.length > 0 && (
                <>
                  <h3>Contas bloqueadas</h3>
                  {blocks.map((b) => (
                    <div className="social-friend-row" key={b.id}>
                      <span>{b.name}</span>
                      <button
                        onClick={() =>
                          void run(async () => {
                            await api('/social/blocks/' + encodeURIComponent(b.id), {
                              method: 'DELETE',
                            });
                            await loadSocial();
                          })
                        }
                      >
                        Desbloquear
                      </button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </aside>
      )}
      {editing && profile && (
        <div className="social-modal-backdrop">
          <form
            className="social-modal"
            role="dialog"
            aria-label="Personalizar perfil"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api('/profiles/' + encodeURIComponent(user.id), {
                  method: 'PUT',
                  body: JSON.stringify({
                    document: profileSettingsSchema.parse(editing),
                    revision: profile.revision,
                  }),
                });
                setEditing(null);
                await loadProfile(user.id);
              });
            }}
          >
            <button
              type="button"
              className="social-modal-close"
              aria-label="Fechar personalização"
              onClick={() => setEditing(null)}
            >
              <X size={18} />
            </button>
            <h2>Seu lugar na Alvorada</h2>
            <label>
              Frase de apresentação
              <input
                value={editing.tagline}
                maxLength={120}
                onChange={(e) => setEditing((v) => (v ? { ...v, tagline: e.target.value } : v))}
              />
            </label>
            <label>
              Sobre você
              <textarea
                value={editing.bio}
                maxLength={2000}
                rows={5}
                onChange={(e) => setEditing((v) => (v ? { ...v, bio: e.target.value } : v))}
              />
            </label>
            <label>
              Cor dos detalhes
              <input
                type="color"
                value={editing.accent}
                onChange={(e) => setEditing((v) => (v ? { ...v, accent: e.target.value } : v))}
              />
            </label>
            <label>
              Cenário
              <select
                value={editing.background}
                onChange={(e) => setEditing((v) => (v ? { ...v, background: e.target.value } : v))}
              >
                <option value="/character-camp-v2.png">Acampamento</option>
                <option value="/notice-village-empty-v4.png">Vila</option>
                {editing.background.startsWith('/api/social/assets/') && (
                  <option value={editing.background}>Imagem personalizada</option>
                )}
              </select>
            </label>
            <label className="social-upload">
              <UserRound size={15} />
              Enviar imagem do perfil
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    void run(async () => {
                      const path = await upload(f);
                      setEditing((v) => (v ? { ...v, avatar: path } : v));
                    });
                  e.target.value = '';
                }}
              />
            </label>
            <button type="button" onClick={() => setEditing((v) => (v ? { ...v, avatar: '' } : v))}>
              Usar retrato do personagem como avatar
            </button>
            <label>
              Personagem de destaque
              <select
                value={editing.featured[0] || ''}
                onChange={(e) =>
                  setEditing((v) =>
                    v ? { ...v, featured: e.target.value ? [e.target.value] : [] } : v,
                  )
                }
              >
                <option value="">Primeiro personagem</option>
                {profile.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" type="submit">
              Salvar meu perfil
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
