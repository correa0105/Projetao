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
import { OwnedPetArt } from './OwnedPetArt';
import { pets } from '../shared/pets';
import { mounts, ownedMountImage, type OwnedMount } from '../shared/mounts';
import { petArtwork } from './pet-art';
import { characterHeightScale } from '../shared/character-stature';
import { useCampMountSize, useCampPetPosition } from './useCampMountSize';
import { CampBackdrop } from './CampBackdrop';
import { CharacterSilhouette } from './CharacterCamp';
import { ProfileNextArrow } from './ProfileNextArrow';
import { ProfileRating } from './ProfileRating';
import { Modal } from './components';
import { HallOfFame, visitProfile } from './HallOfFame';
import type { deriveSheet } from '../shared/character-sheet';
import type { ShelfConfig, AchievementDefinition } from '../shared/achievements';
import type { Card } from '../shared/cards';
import './hall-profiles.css';
import './profile-visit.css';
import './realm-pages.css';
import './profile-next.css';
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
  species_size?: string;
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
  own_review: { score: number; comment: string } | null;
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
  pets: {
    id: string;
    pet_id: string;
    appearance: string;
    name: string;
    displayed: boolean;
    image_url?: string | null;
    image_revision?: number;
  }[];
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
type Panel = 'characters' | 'achievements' | 'hall' | 'cards';
const panels: { id: Panel; name: string; icon: typeof Users }[] = [
  { id: 'characters', name: 'Acampamento', icon: Users },
  { id: 'achievements', name: 'Conquistas', icon: Trophy },
  { id: 'hall', name: 'Hall da Fama', icon: Crown },
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
    [sheetCharacterId, setSheetCharacterId] = useState<string | null>(null),
    [campInfoId, setCampInfoId] = useState<string | null>(null),
    [companionName, setCompanionName] = useState<'mount' | 'pet' | null>(null),
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
    [companion, setCompanion] = useState<OwnedMount | null>(null);
  const mountHost = useRef<HTMLButtonElement>(null);
  const mountHidden = useRef(false);
  const petHost = useRef<HTMLDivElement>(null);
  useCampPetPosition(
    petHost,
    details?.pets.find((pet) => pet.displayed)?.id,
    `${profile?.id || ''}:${panel}`,
  );
  useCampMountSize(mountHost, companion?.id, `${profile?.id || ''}:${panel}`);
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
      setSheetCharacterId(null);
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
    let active = true,
      serial = 0;
    const reload = () => {
      if (document.hidden) return;
      const request = ++serial;
      void api<Profile>('/profiles/' + encodeURIComponent(target))
        .then((next) => {
          if (!active || request !== serial) return;
          setProfile(next);
          setSelected((previous) =>
            next.characters.some((c) => c.id === previous)
              ? previous
              : next.document.featured.find((id) => next.characters.some((c) => c.id === id)) ||
                next.characters[0]?.id ||
                '',
          );
        })
        .catch((e) => active && request === serial && setError(e.message));
    };
    reload();
    const timer = setInterval(reload, 30000);
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', reload);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', reload);
    };
  }, [target]);
  useEffect(() => {
    setDetails(null);
    setCompanion(null);
    mountHidden.current = false;
    if (!target || !selected) return;
    let active = true,
      serial = 0;
    const reload = () => {
      if (document.hidden) return;
      const request = ++serial;
      void api<PublicDetails>(`/profiles/${encodeURIComponent(target)}/characters/${selected}`)
        .then((d) => {
          if (active && request === serial) {
            setDetails(d);
            setCompanion(mountHidden.current ? null : d.mounts.find((m) => m.displayed) || null);
          }
        })
        .catch((e) => active && request === serial && setError(e.message));
    };
    const artworkChanged = (event: Event) => {
      if ((event as CustomEvent).detail?.characterId === selected) reload();
    };
    reload();
    const timer = setInterval(reload, 30000);
    window.addEventListener('focus', reload);
    window.addEventListener('companion-art-updated', artworkChanged);
    document.addEventListener('visibilitychange', reload);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', reload);
      window.removeEventListener('companion-art-updated', artworkChanged);
      document.removeEventListener('visibilitychange', reload);
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
          <img
            src={path}
            alt={name}
            onLoad={(e) => e.currentTarget.style.removeProperty('display')}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
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
  const current =
      (details?.character.id === selected ? details.character : null) ||
      profile?.characters.find((c) => c.id === selected),
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
            <span className="social-eyebrow">Conheça os aventureiros de Alvorada</span>
            <h2>Encontre um viajante</h2>
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
          <div className="visited-profile-layout">
            <div className="profile-panels-viewport">
              <div
                className="profile-panels-strip"
                style={{
                  transform: `translateX(-${panels.findIndex((p) => p.id === panel) * (100 / panels.length)}%)`,
                }}
              >
                <section
                  className="public-profile-panel public-camp"
                  role="tabpanel"
                  id="profile-panel-characters"
                  aria-labelledby="profile-tab-characters"
                  aria-hidden={panel !== 'characters'}
                  inert={panel !== 'characters'}
                >
                  <CampBackdrop />
                  <div className="public-camp-heading">
                    <div className="public-camp-name">
                      <h2>Acampamento</h2>
                    </div>
                  </div>
                  <div className="page-header-spacer" aria-hidden="true" />
                  <div className="camp-stage public-camp-stage">
                    {companion && (
                      <button
                        className="camp-mount public-camp-mount"
                        ref={mountHost}
                        style={
                          {
                            '--mount-scale':
                              mounts.find((m) => m.id === companion.mount_id)?.scale || 1,
                          } as CSSProperties
                        }
                        onClick={() => {
                          setCompanionName((value) => (value === 'mount' ? null : 'mount'));
                        }}
                        aria-label={companion.name}
                        data-name-open={companionName === 'mount'}
                      >
                        <img src={ownedMountImage(companion)} alt={companion.name} />
                        <span className="camp-mount-name">{companion.name}</span>
                      </button>
                    )}
                    <div className="public-character-figures">
                      {profile.characters.map((c) => (
                        <article
                          key={c.id}
                          className={`camp-character public-camp-character ${selected === c.id ? 'is-selected' : ''}`}
                          data-info-open={campInfoId === c.id}
                          style={
                            {
                              '--stature-scale': characterHeightScale(c.race, c.species_size),
                            } as CSSProperties
                          }
                        >
                          <button
                            className={`camp-figure public-character-figure ${selected === c.id ? 'selected' : ''}`}
                            aria-label={`Selecionar ${c.name} no perfil`}
                            aria-pressed={selected === c.id}
                            aria-expanded={campInfoId === c.id}
                            onClick={() => {
                              setSelected(c.id);
                              setCampInfoId((value) => (value === c.id ? null : c.id));
                            }}
                          >
                            {c.portrait_revision > 0 ? (
                              <img src={c.portrait} alt={c.name} />
                            ) : (
                              <CharacterSilhouette />
                            )}
                            <span className="profile-figure-name">{c.name}</span>
                          </button>
                          <div
                            className="camp-character-info public-character-info"
                            aria-hidden={campInfoId !== c.id}
                            inert={campInfoId !== c.id}
                          >
                            <span className="eyebrow">
                              Nível {c.level} {selected === c.id ? '· Selecionado' : ''}
                            </span>
                            <div className="camp-name-line">
                              <h2>{c.name}</h2>
                              {c.displayed_title && (
                                <span
                                  className="character-title-label"
                                  data-title-position={c.title_position}
                                >
                                  <Crown size={13} />
                                  {c.displayed_title}
                                </span>
                              )}
                            </div>
                            <p>
                              {c.race} · {c.class}
                            </p>
                            <div className="camp-actions">
                              {(
                                [
                                  ['achievements', 'Ver conquistas'],
                                  ['sheet', 'Ver ficha'],
                                  ['cards', 'Ver cartas'],
                                ] as const
                              ).map(([id, name]) => (
                                <button
                                  type="button"
                                  className="button outline small-button"
                                  key={id}
                                  onClick={() => {
                                    setSelected(c.id);
                                    if (id === 'sheet') setSheetCharacterId(c.id);
                                    else setPanel(id);
                                  }}
                                >
                                  {name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                    {displayPet && species && (
                      <div
                        className="camp-pet public-camp-pet"
                        ref={petHost}
                        data-pet-species={displayPet.pet_id}
                        data-name-open={companionName === 'pet'}
                        tabIndex={0}
                        role="button"
                        aria-label={displayPet.name}
                        aria-pressed={companionName === 'pet'}
                        onClick={() =>
                          setCompanionName((value) => (value === 'pet' ? null : 'pet'))
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setCompanionName((value) => (value === 'pet' ? null : 'pet'));
                          }
                        }}
                        style={
                          {
                            '--companion-width': `${petArtwork(species.id, displayPet.appearance).width}px`,
                            '--companion-proportion':
                              petArtwork(species.id, displayPet.appearance).width / 218,
                          } as CSSProperties
                        }
                      >
                        <OwnedPetArt pet={displayPet} />
                        <span title={displayPet.name}>{displayPet.name}</span>
                      </div>
                    )}
                  </div>
                </section>
                <section
                  className="public-profile-panel public-achievements"
                  role="tabpanel"
                  id="profile-panel-achievements"
                  aria-labelledby="profile-tab-achievements"
                  aria-hidden={panel !== 'achievements'}
                  inert={panel !== 'achievements'}
                >
                  <header className="public-panel-heading">
                    <span className="social-eyebrow">Memórias de uma jornada</span>
                    <h2>Conquistas de {current?.name || profile.name}</h2>
                  </header>
                  {details && (
                    <>
                      <div className="cabinet-room-stage public-cabinet-stage">
                        <PortraitCabinet
                          characters={profile.characters}
                          active={selected}
                          onSelect={setSelected}
                          sceneAligned
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
                  role="tabpanel"
                  id="profile-panel-hall"
                  aria-labelledby="profile-tab-hall"
                  aria-hidden={panel !== 'hall'}
                  inert={panel !== 'hall'}
                >
                  {panel === 'hall' && (
                    <HallOfFame key={selected} embedded focusCharacterId={selected} />
                  )}
                </section>

                <section
                  className="public-profile-panel public-cards"
                  role="tabpanel"
                  id="profile-panel-cards"
                  aria-labelledby="profile-tab-cards"
                  aria-hidden={panel !== 'cards'}
                  inert={panel !== 'cards'}
                >
                  <header className="public-panel-heading">
                    <span className="social-eyebrow">As histórias que o acompanham</span>
                    <h2>Cartas de {current?.name || profile.name}</h2>
                  </header>
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
            <div className="profile-visit-selector">
              <div
                className="profile-character-avatar"
                aria-label={current ? 'Retrato de ' + current.name : 'Retrato do viajante'}
              >
                <UserRound size={30} aria-hidden="true" />
                {current && current.portrait_revision > 0 ? (
                  <img
                    key={current.id}
                    src={
                      current.portrait +
                      (current.portrait.includes('?') ? '&' : '?') +
                      'face=1&crop=2'
                    }
                    alt={current.name}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                    onLoad={(event) => {
                      event.currentTarget.style.removeProperty('display');
                    }}
                  />
                ) : null}
              </div>
              <div className="profile-visit-identity">
                <span className="social-eyebrow">Perfil do viajante</span>
                <strong>{profile.name}</strong>
                {current && (
                  <span
                    className="profile-selected-character"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {current.name}
                  </span>
                )}
              </div>
            </div>
            <ProfileNextArrow panels={panels} selected={panel} onSelect={setPanel} />
          </div>
          {sheetCharacterId && (
            <Modal
              title={
                'Ficha de ' +
                (profile.characters.find((c) => c.id === sheetCharacterId)?.name || 'personagem')
              }
              close={() => setSheetCharacterId(null)}
            >
              <div className="public-sheet profile-sheet-modal">
                {details?.character.id !== sheetCharacterId ? (
                  <p role="status">Carregando ficha…</p>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </Modal>
          )}
          {!profile.is_owner && (
            <ProfileRating
              key={profile.id}
              average={profile.rating.average}
              count={profile.rating.count}
              own={profile.own_review}
              enabled={!profile.is_owner && !profile.blocked}
              save={async (score, comment) => {
                await post('/profiles/' + encodeURIComponent(target) + '/review', {
                  score,
                  comment,
                });
                await loadProfile();
                window.dispatchEvent(new Event('profile-rating-updated'));
              }}
            />
          )}
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
