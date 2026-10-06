import { HomeJournal } from './HomeJournal';
import { LoreLibrary } from './LoreLibrary';
import { FlashMessage } from './FlashMessage';
import { PageHeader } from './PageHeader';
import { ProfileMenu } from './ProfileMenu';
import { NoticeBoard } from './NoticeBoard';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Backpack,
  Check,
  ChevronRight,
  CircleCheck,
  Coins,
  Compass,
  Feather,
  Heart,
  House,
  LogOut,
  Map,
  MapPin,
  Plus,
  ScrollText,
  Search,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { authClient, api, post } from './api';
import { CharacterForm, Empty, Login, Modal, PostForm } from './components';
import { rankName, progressionLabel, testEligible } from '../shared/progression';
import { Navigation } from './Navigation';
import { CharacterSelector } from './CharacterSelector';
import { MissionCompletion } from './MissionCompletion';
import { CharacterSheet } from './CharacterSheet';
import { Notifications } from './Notifications';
import { Stable } from './Stable';
import { PetShop } from './PetShop';
import { Events } from './Events';
import { Achievements } from './Achievements';
import { Cards } from './Cards';
import { CharacterCards } from './CharacterCards';
import { Shop } from './Shop';
import { Inventory } from './Inventory';
import { CharacterCamp } from './CharacterCamp';
import { money, modifier, statNames } from '../shared/rules';
import type { AtlasLocation, Character, Details, Entry, Item, Page, Post, User } from './types';
const WorldAtlas = lazy(() =>
  import('./WorldAtlas').then((module) => ({ default: module.WorldAtlas })),
);
const Rulebook = lazy(() => import('./Rulebook').then((module) => ({ default: module.Rulebook })));
const Vtt = lazy(() => import('./Vtt').then((module) => ({ default: module.Vtt })));
const Tower = lazy(() => import('./Tower').then((module) => ({ default: module.Tower })));
const HallOfFame = lazy(() =>
  import('./HallOfFame').then((module) => ({ default: module.HallOfFame })),
);
const Profiles = lazy(() => import('./Profiles').then((module) => ({ default: module.Profiles })));

type Icon = ComponentType<{ size?: number; className?: string }>;
const titles: Record<Page, string> = {
  overview: 'Início',
  characters: 'Meus personagens',
  profile: 'Ficha de Personagem',
  inventory: 'Inventário',
  achievements: 'Conquistas',
  missions: 'Mural Alvorada',
  board: 'Mural Alvorada',
  hooks: 'Mural Alvorada',
  shop: 'Empório do viajante',
  stable: 'Estábulo da Alvorada',
  pets: 'Casa dos mascotes',
  events: 'Eventos da Alvorada',
  tower: 'Torre do Véu',
  titles: 'Títulos & honrarias',
  cards: 'Salão das cartas',
  'character-cards': 'Cartas',
  vtt: 'Mesa virtual',
  hall: 'Hall da Fama',
  profiles: 'Perfis da Alvorada',
  house: 'House',
  world: 'Mapa Alvorada',
  lore: 'Crônicas & lore',
  rules: 'Regras da mesa',
};
const kindLabel = { mission: 'Missão', event: 'Evento', hook: 'Gancho' };
const statusLabel = {
  open: 'Aberta',
  active: 'Em andamento',
  completed: 'Concluída',
  closed: 'Encerrada',
};
const initialPage = (): Page => {
  const key = location.hash.slice(1).split('?')[0];
  if (key === 'titles') return 'achievements';
  return key in titles ? (key as Page) : 'overview';
};

export default function App() {
  const { data: session, isPending, error, refetch } = authClient.useSession();
  if (isPending)
    return (
      <div className="boot">
        <span className="loading-wordmark">Alvorada Cinzenta</span>
        <p>À espera da alvorada…</p>
      </div>
    );
  if (error)
    return (
      <div className="boot">
        <p>Não foi possível conectar à guilda.</p>
        <button className="button primary" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  if (!session) return <Login />;
  return <Portal key={session.user.id} user={session.user} />;
}

function Portal({ user }: { user: User }) {
  const [administrator, setAdministrator] = useState(false);
  const [canEditKingdom, setCanEditKingdom] = useState(false);
  const [completingMission, setCompletingMission] = useState<Post | null>(null);
  const [now, setNow] = useState(Date.now());
  const [page, setPage] = useState<Page>(initialPage);
  const [rulesVisited, setRulesVisited] = useState(() => initialPage() === 'rules');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [characterMenuOpen, setCharacterMenuOpen] = useState(false);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState<'character' | 'post' | null>(null);
  const [postLocation, setPostLocation] = useState<AtlasLocation | undefined>();
  const [postFromAtlas, setPostFromAtlas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [postKind, setPostKind] = useState<'mission' | 'event'>('mission');
  const rulesActive = page === 'rules' && !loading && !loadError;
  const character = characters.find((item) => item.id === selectedId) || characters[0];
  const refresh = useCallback(async () => {
    const [nextCharacters, nextCatalog, nextPosts, nextEntries, me] = await Promise.all([
      api<Character[]>('/characters'),
      api<Item[]>('/catalog'),
      api<Post[]>('/board'),
      api<Entry[]>('/world'),
      api<User>('/me'),
    ]);
    setCharacters(nextCharacters);
    setCatalog(nextCatalog);
    setPosts(nextPosts);
    setEntries(nextEntries);
    setAdministrator(me.administrador === 1);
    setCanEditKingdom(me.canEditKingdom === true);
  }, []);
  useEffect(() => {
    refresh()
      .catch((error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === 'visible') refresh().catch(() => {});
    }, 60000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    const onHash = () => {
      const next = initialPage();
      if (next === 'rules') setRulesVisited(true);
      setPage(next);
      setQuery('');
      setCategory('Todos');
      setPostKind('mission');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const detailsCharacter = useRef<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (detailsCharacter.current !== character?.id) {
      detailsCharacter.current = character?.id;
      setDetails(null);
    }
    if (character)
      api<Details>(`/characters/${character.id}/details`)
        .then((data) => {
          if (alive) setDetails(data);
        })
        .catch((error) => {
          if (alive) setToast(error.message);
        });
    return () => {
      alive = false;
    };
  }, [character]);
  function go(next: Page) {
    if (next === 'rules') setRulesVisited(true);
    location.hash = next;
    // Start page audio while the navigation gesture is still active.
    window.dispatchEvent(new Event('alvorada:navigate'));
    setPage(next);
    setQuery('');
    setCategory('Todos');
    setPostKind('mission');
  }
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      await refresh();
      setToast(message);
    } catch (error) {
      setToast((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const activePosts = posts.filter((post) => ['open', 'active'].includes(post.status));
  const missions = posts.filter((post) => post.kind === 'mission');
  const upcoming = missions
    .filter(
      (item) =>
        item.status === 'open' &&
        item.starts_at &&
        new Date(item.starts_at).getTime() >= now &&
        new Date(item.starts_at).getTime() <= now + 24 * 60 * 60 * 1000,
    )
    .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!));
  const formatSchedule = (value: string) =>
    new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const inventoryCount =
    details?.inventory.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  const noCharacter = (
    <Empty
      title="Toda lenda tem um começo."
      action={
        <button className="button primary" onClick={() => setModal('character')}>
          <Plus size={17} />
          Criar personagem
        </button>
      }
    >
      Crie seu primeiro personagem para preparar a mochila e partir em uma aventura.
    </Empty>
  );
  const postCard = (item: Post, compact = false) => (
    <article className={`quest-card ${item.kind} ${compact ? 'compact' : ''}`} key={item.id}>
      <div className="quest-top">
        <span className={`badge ${item.kind}`}>
          {item.rank_test_level
            ? `Teste de patente · ${rankName(item.rank_test_level + 1)}`
            : kindLabel[item.kind]}
        </span>
        <span className="small muted">
          {item.status === 'open' ? item.difficulty : statusLabel[item.status]}
        </span>
      </div>
      <h3>{item.title}</h3>
      {item.kind === 'mission' && (
        <p className="mission-rank-label">
          <Shield size={15} aria-hidden="true" /> Patente {item.mission_rank}
        </p>
      )}
      <p>{item.description}</p>
      {item.starts_at && (
        <p className="mission-schedule">
          <time dateTime={item.starts_at}>{formatSchedule(item.starts_at)}</time>
        </p>
      )}
      {item.kind === 'mission' && !item.starts_at && (
        <p className="small muted">Sem horário definido</p>
      )}
      {item.source_mission_title && (
        <p className="small muted">Originado em: {item.source_mission_title}</p>
      )}
      {!compact && item.completion_summary && (
        <div className="mission-result">
          <strong>Resumo da missão</strong>
          <p>{item.completion_summary}</p>
          {item.rewards.map((reward, index) => (
            <span key={index}>
              {reward.name}:{' '}
              {reward.progression_credit === null
                ? `${reward.experience.toLocaleString('pt-BR')} XP (histórico)`
                : `${money(reward.gold_cp)} PO · ${reward.rank_promoted ? `promovido ao nível ${reward.level_after}` : reward.progression_credit ? '+1 missão válida' : 'sem avanço na progressão'}`}
            </span>
          ))}
        </div>
      )}
      <div className="quest-location">
        <MapPin size={14} />
        {item.location}
      </div>
      <div className="quest-bottom">
        <span>
          {item.reward_cp > 0 ? (
            <>
              <Coins size={16} />
              <b>{money(item.reward_cp)} PO</b>
            </>
          ) : (
            <>
              <Sparkles size={15} />
              <span>Uma história espera</span>
            </>
          )}
        </span>
        {compact ? (
          <button
            className="text-button"
            onClick={() => go(item.kind === 'mission' ? 'missions' : 'board')}
            aria-label={`Ver ${item.title}`}
          >
            <ArrowUpRight size={20} />
          </button>
        ) : item.kind === 'mission' ? (
          <button
            className="button small-button"
            disabled={
              busy ||
              !character ||
              rankName(character.level) !== item.mission_rank ||
              (!!item.rank_test_level &&
                !testEligible(
                  character.level,
                  character.progression_missions,
                  item.rank_test_level,
                )) ||
              item.status !== 'open' ||
              item.my_characters.includes(character.id)
            }
            onClick={() =>
              void action(
                () => post(`/board/${item.id}/join`, { character_id: character?.id }),
                'Inscrição confirmada. Sua aventura está mais perto!',
              )
            }
          >
            {character && item.my_characters.includes(character.id) ? (
              <>
                <Check size={15} />
                Inscrito
              </>
            ) : item.status !== 'open' ? (
              statusLabel[item.status]
            ) : !character ? (
              'Crie um personagem'
            ) : rankName(character.level) !== item.mission_rank ? (
              `Exclusiva para ${item.mission_rank}`
            ) : item.rank_test_level &&
              !testEligible(
                character.level,
                character.progression_missions,
                item.rank_test_level,
              ) ? (
              'Teste ainda indisponível'
            ) : (
              'Participar'
            )}
            {item.status === 'open' && character && !item.my_characters.includes(character.id) && (
              <ArrowRight size={15} />
            )}
          </button>
        ) : (
          <span className="small muted">{statusLabel[item.status]}</span>
        )}
      </div>
      {item.kind === 'mission' &&
        character &&
        item.status === 'open' &&
        rankName(character.level) !== item.mission_rank && (
          <p className="small muted">
            Esta missão não é da sua patente. Seu personagem é {rankName(character.level)}; a missão
            exige {item.mission_rank}.
          </p>
        )}
      {!compact && (
        <div className="post-meta">
          <span>
            {item.author_name || 'Alvorada Cinzenta'}
            {item.kind === 'mission' ? ` · ${item.participants} inscrito(s)` : ''}
          </span>
          {item.author_id === user.id &&
            item.kind !== 'hook' &&
            (item.kind !== 'event' || administrator) &&
            ['open', 'active'].includes(item.status) && (
              <div>
                {item.status === 'open' && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(
                        () =>
                          api(`/board/${item.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'active' }),
                          }),
                        'Registro iniciado.',
                      )
                    }
                  >
                    Iniciar
                  </button>
                )}
                {item.status === 'active' && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      item.kind === 'mission'
                        ? setCompletingMission(item)
                        : void action(
                            () =>
                              api(`/board/${item.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'completed' }),
                              }),
                            'Registro concluído.',
                          )
                    }
                  >
                    Concluir
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(
                      () =>
                        api(`/board/${item.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: 'closed' }),
                        }),
                      'Registro encerrado.',
                    )
                  }
                >
                  Encerrar
                </button>
              </div>
            )}
        </div>
      )}
    </article>
  );

  function renderContent() {
    if (loading)
      return (
        <div className="loading-content">
          <span className="loading-wordmark">Alvorada Cinzenta</span>
          <p>Preparando sua mesa…</p>
        </div>
      );
    if (loadError)
      return (
        <Empty
          title="A conexão com a guilda se perdeu."
          action={
            <button
              className="button primary"
              onClick={() => {
                setLoading(true);
                refresh()
                  .then(() => setLoadError(''))
                  .catch((error) => setLoadError(error.message))
                  .finally(() => setLoading(false));
              }}
            >
              Tentar novamente
            </button>
          }
        >
          {loadError}
        </Empty>
      );
    if (page === 'rules') return null;
    if (page === 'world')
      return (
        <Suspense fallback={<div className="loading-content">Desdobrando o atlas…</div>}>
          <WorldAtlas
            canEditKingdom={canEditKingdom}
            posts={posts}
            renderMission={(item) => postCard(item)}
            onPublish={(place) => {
              setPostLocation(place);
              setPostFromAtlas(true);
              setModal('post');
            }}
          />
        </Suspense>
      );
    if (page === 'overview') return <HomeJournal upcoming={upcoming} canEdit={administrator} />;
    if (page === 'events') return <Events />;
    if (page === 'tower')
      return (
        <Suspense fallback={<div className="loading-content">Abrindo as portas da torre…</div>}>
          <Tower
            characters={characters}
            catalog={catalog}
            character={character}
            refreshCharacters={refresh}
          />
        </Suspense>
      );
    if (page === 'hall' || page === 'profiles')
      return (
        <Suspense
          fallback={<div className="loading-content">Abrindo as histórias da Alvorada…</div>}
        >
          {page === 'hall' ? <HallOfFame /> : <Profiles user={user} />}
        </Suspense>
      );
    if (page === 'vtt')
      return (
        <Suspense fallback={<div className="loading-content">Preparando a mesa…</div>}>
          <Vtt characters={characters} user={user} />
        </Suspense>
      );
    if (page === 'cards')
      return <Cards key={character?.id || 'visitor'} character={character} onPurchased={refresh} />;
    if (page === 'character-cards')
      return <CharacterCards key={character?.id || 'visitor'} character={character} />;
    return (
      <>
        {page !== 'characters' && page !== 'lore' && page !== 'pets' && (
          <div className="page-header-spacer" aria-hidden="true" />
        )}
        {page === 'characters' && (
          <CharacterCamp
            characters={characters}
            selectedId={character?.id || ''}
            onSelect={setSelectedId}
            onCreate={() => setModal('character')}
            onRefresh={refresh}
          />
        )}
        {page === 'profile' &&
          (character ? (
            <CharacterSheet
              key={character.id}
              character={character}
              details={details}
              onRefresh={refresh}
            />
          ) : (
            noCharacter
          ))}
        {page === 'stable' && (
          <Stable key={character?.id || 'guest'} character={character} onPurchased={refresh} />
        )}
        {page === 'pets' && (
          <PetShop key={character?.id || 'visitor'} character={character} onPurchased={refresh} />
        )}
        {page === 'shop' && <Shop catalog={catalog} character={character} onPurchased={refresh} />}
        {page === 'inventory' &&
          (!character ? (
            noCharacter
          ) : !details ? (
            <p>Consultando a mochila…</p>
          ) : (
            <Inventory
              onRefresh={refresh}
              key={character.id}
              character={character}
              details={details}
              onShop={() => go('shop')}
              onInventoryChange={(inventory) =>
                setDetails((current) => (current ? { ...current, inventory } : current))
              }
            />
          ))}
        {page === 'achievements' &&
          (character ? (
            <Achievements
              key={character.id}
              characterId={character.id}
              characters={characters.map((c) => ({
                ...c,
                portrait: `/api/profiles/${encodeURIComponent(user.id)}/characters/${c.id}/portrait?v=${c.portrait_revision}`,
              }))}
              onSelect={setSelectedId}
            />
          ) : (
            noCharacter
          ))}
        {['missions', 'board', 'hooks', 'stable'].includes(page) && (
          <NoticeBoard
            key={page}
            posts={posts}
            userId={user.id}
            onPaperChange={refresh}
            feedback={toast}
            renderPost={(item) => postCard(item, false)}
            canCreateEvent={administrator}
            onPublish={(kind) => {
              setPostKind(kind);
              setPostLocation(undefined);
              setPostFromAtlas(false);
              setModal('post');
            }}
          />
        )}
        {page === 'lore' && <LoreLibrary />}
        {page === 'house' && (
          <>
            <div className="entries-grid house-grid">
              {entries
                .filter((entry) => entry.section === page)
                .map((entry) => {
                  return (
                    <article className="entry-card paper" key={entry.id}>
                      <div className="entry-icon">
                        <House size={31} />
                      </div>
                      <span className="eyebrow">{entry.tag}</span>
                      <h2>{entry.title}</h2>
                      <p className="entry-subtitle">{entry.subtitle}</p>
                      <p>{entry.body}</p>
                      <span className="badge neutral">
                        Conteúdo de cenário · Funcionalidades em desenvolvimento
                      </span>
                    </article>
                  );
                })}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="app-shell" data-page={page}>
      <div className="main-shell">
        {page !== 'vtt' && (
          <PageHeader
            showTitle={
              !['lore', 'events', 'tower', 'cards', 'vtt', 'hall', 'profiles'].includes(page)
            }
            title={
              page === 'characters'
                ? 'Seu acampamento'
                : page === 'overview'
                  ? 'Início'
                  : titles[page]
            }
          >
            <ProfileMenu
              character={character}
              open={characterMenuOpen}
              onOpenChange={setCharacterMenuOpen}
            >
              <div className="topbar-right">
                {character && (
                  <span
                    className="profile-character-summary"
                    title={`${rankName(character.level)} · ${character.class}`}
                  >
                    <span>{rankName(character.level)}</span>
                    <small>{character.class}</small>
                  </span>
                )}
                <div className="player-hud-selection">
                  {characters.length > 0 && (
                    <CharacterSelector
                      characters={characters}
                      selectedId={character?.id || ''}
                      onSelect={setSelectedId}
                      open={characterMenuOpen}
                      onOpenChange={setCharacterMenuOpen}
                      hideTrigger
                    />
                  )}
                </div>
                <Notifications
                  characters={characters}
                  page={page}
                  onNavigate={(id, target) => {
                    setSelectedId(id);
                    go(target);
                  }}
                />
                <button
                  className="logout-button"
                  aria-label="Sair da conta"
                  title="Sair da conta"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const result = await authClient.signOut();
                      if (result.error) throw new Error('Não foi possível sair. Tente novamente.');
                      location.hash = '';
                    } catch (error) {
                      setToast((error as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <LogOut size={16} aria-hidden="true" />
                </button>
              </div>
            </ProfileMenu>
          </PageHeader>
        )}
        <main className="main-content" id="main-content">
          {renderContent()}
          {rulesVisited && (
            <div hidden={!rulesActive} style={{ display: rulesActive ? undefined : 'none' }}>
              <div className="page-header-spacer" aria-hidden="true" />
              <Suspense fallback={<div className="loading-content">Abrindo o códice…</div>}>
                <Rulebook active={Boolean(rulesActive)} />
              </Suspense>
            </div>
          )}
        </main>
      </div>
      <Navigation page={page} go={go} />
      {toast && <FlashMessage kind="info">{toast}</FlashMessage>}
      {modal === 'character' && (
        <Modal title="Uma nova história" parchment close={() => setModal(null)}>
          <CharacterForm
            done={async () => {
              await refresh();
              setModal(null);
              go('characters');
              setToast('Referência enviada. Seu personagem chegará quando a arte estiver pronta.');
            }}
          />
        </Modal>
      )}
      {modal === 'post' && (
        <Modal title="Um chamado à guilda" close={() => setModal(null)}>
          <PostForm
            initialKind={postFromAtlas ? 'mission' : postKind}
            canCreateEvent={!postFromAtlas && administrator}
            initialLocation={postLocation}
            requireMappedLocation={postFromAtlas}
            done={async () => {
              await refresh();
              setModal(null);
              if (!postFromAtlas) go('board');
              setToast(
                postFromAtlas
                  ? 'Missão registrada no mapa e no mural.'
                  : 'Seu chamado está no mural.',
              );
            }}
          />
        </Modal>
      )}
      {completingMission && (
        <MissionCompletion
          mission={completingMission}
          close={() => setCompletingMission(null)}
          done={async () => {
            setCompletingMission(null);
            await refresh();
            setToast('Missão concluída. Resumo e experiência registrados no histórico.');
          }}
        />
      )}
    </div>
  );
}
