import { lazy, Suspense, useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Backpack,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheck,
  Coins,
  Compass,
  ExternalLink,
  Feather,
  Gem,
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
import { Navigation } from './Navigation';
import { CharacterSelector } from './CharacterSelector';
import { MissionCompletion } from './MissionCompletion';
import { money, modifier, statNames } from '../shared/rules';
import type { AtlasLocation, Character, Details, Entry, Item, Page, Post, User } from './types';
const WorldAtlas = lazy(() =>
  import('./WorldAtlas').then((module) => ({ default: module.WorldAtlas })),
);

type Icon = ComponentType<{ size?: number; className?: string }>;
const titles: Record<Page, string> = {
  overview: 'Início',
  characters: 'Meus personagens',
  profile: 'Perfil do personagem',
  inventory: 'Inventário',
  achievements: 'Conquistas',
  mercenaries: 'Mercenários',
  missions: 'Missões',
  board: 'Mural da Alvorada',
  hooks: 'Ganchos de aventura',
  shop: 'Empório do viajante',
  house: 'House',
  world: 'Mundo',
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
const achievementInfo: Record<string, [string, string, Icon]> = {
  first_character: ['O primeiro capítulo', 'Dê vida a um personagem.', Feather],
  first_purchase: ['Pronto para a estrada', 'Faça sua primeira compra no empório.', Backpack],
  first_mission: ['Atenda ao chamado', 'Inscreva-se em uma missão da guilda.', Compass],
};
const initialPage = (): Page => {
  const key = location.hash.slice(1);
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
  const [role, setRole] = useState<User['role']>('player');
  const [canEditKingdom, setCanEditKingdom] = useState(false);
  const [completingMission, setCompletingMission] = useState<Post | null>(null);
  const [now, setNow] = useState(Date.now());
  const [page, setPage] = useState<Page>(initialPage);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState<'character' | 'post' | null>(null);
  const [postLocation, setPostLocation] = useState<AtlasLocation | undefined>();
  const [postFromAtlas, setPostFromAtlas] = useState(false);
  const [purchaseItem, setPurchaseItem] = useState<Item | null>(null);
  const [purchaseKey, setPurchaseKey] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buyError, setBuyError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [boardTab, setBoardTab] = useState('Todos');
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
    setRole(me.role);
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
      setPage(initialPage());
      setQuery('');
      setCategory('Todos');
      setBoardTab('Todos');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let alive = true;
    setDetails(null);
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
    location.hash = next;
    setPage(next);
    setQuery('');
    setCategory('Todos');
    setBoardTab('Todos');
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
  async function buy() {
    if (!character || !purchaseItem) return;
    setBusy(true);
    setBuyError('');
    try {
      await post('/purchases', {
        character_id: character.id,
        item_id: purchaseItem.id,
        quantity,
        idempotency_key: purchaseKey,
      });
      setPurchaseItem(null);
      await refresh();
      setToast(`${quantity} × ${purchaseItem.name} adicionado ao inventário de ${character.name}.`);
    } catch (error) {
      setBuyError((error as Error).message);
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
        <span className={`badge ${item.kind}`}>{kindLabel[item.kind]}</span>
        <span className="small muted">
          {item.status === 'open' ? item.difficulty : statusLabel[item.status]}
        </span>
      </div>
      <h3>{item.title}</h3>
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
              {reward.name}: +{reward.experience.toLocaleString('pt-BR')} XP
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
      {!compact && (
        <div className="post-meta">
          <span>
            {item.author_name || 'Alvorada Cinzenta'}
            {item.kind === 'mission' ? ` · ${item.participants} inscrito(s)` : ''}
          </span>
          {item.author_id === user.id &&
            item.kind !== 'hook' &&
            (item.kind !== 'event' || role === 'staff' || role === 'admin') &&
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
    if (page === 'overview')
      return (
        <>
          <div className="page-title">
            <div>
              <h1>
                Boas-vindas, {user.name.split(' ')[0]}
                <span className="title-dot">.</span>
              </h1>
            </div>
          </div>
          <section className="welcome-banner">
            <div className="banner-copy">
              <h2>
                Além das montanhas,
                <br />
                <em>a sua próxima lenda.</em>
              </h2>
              <p>
                {character
                  ? 'Reúna seus aliados. Há caminhos que só os bravos conhecem.'
                  : 'Escolha seu nome. Prepare a mochila. Sua jornada começa ao amanhecer.'}
              </p>
              <button
                className="button cream"
                onClick={() => (character ? go('missions') : setModal('character'))}
              >
                {character ? 'Encontrar uma aventura' : 'Criar meu primeiro personagem'}
                <ArrowRight size={17} />
              </button>
            </div>
          </section>
          <div className="summary-grid">
            {[
              [
                Users,
                'Seus personagens',
                String(characters.length),
                'Novas histórias para viver',
                'characters',
              ],
              [
                Compass,
                'Missões abertas',
                String(missions.filter((p) => p.status === 'open').length),
                'Um chamado para a aventura',
                'missions',
              ],
              [
                Backpack,
                'Na sua mochila',
                String(inventoryCount),
                character ? `Itens de ${character.name}` : 'Prepare-se para a jornada',
                'inventory',
              ],
            ].map(([IconValue, label, value, description, target]) => {
              const Icon = IconValue as Icon;
              return (
                <button
                  className="summary-card"
                  key={String(label)}
                  onClick={() => go(target as Page)}
                >
                  <span className="summary-icon">
                    <Icon size={22} />
                  </span>
                  <span>
                    <span className="summary-label">{String(label)}</span>
                    <strong>
                      {String(value)} <small>{String(description)}</small>
                    </strong>
                  </span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>
          {upcoming.length > 0 && (
            <section className="upcoming-missions" aria-label="Mesas nas próximas 24 horas">
              <div className="section-heading">
                <h2>Mesas chegando</h2>
                <span className="small muted">Próximas 24 horas · horário local</span>
              </div>
              {upcoming.map((item) => (
                <div className="upcoming-mission" key={item.id}>
                  <div>
                    <span className="badge neutral">
                      {item.author_id === user.id
                        ? 'Você tem uma mesa para mestrar'
                        : item.my_characters.length
                          ? 'Você está inscrito'
                          : 'Mesa aberta'}
                    </span>
                    <h3>{item.title}</h3>
                    <time dateTime={item.starts_at!}>{formatSchedule(item.starts_at!)}</time>
                  </div>
                  <button className="button outline" onClick={() => go('missions')}>
                    Ver missão
                  </button>
                </div>
              ))}
            </section>
          )}
          <div className="dashboard-columns">
            <section>
              <div className="section-heading">
                <h2>
                  Chamados da Alvorada <span className="count">{activePosts.length}</span>
                </h2>
                <button className="text-button" onClick={() => go('board')}>
                  Ver mural
                  <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="quest-grid overview-quests">
                {activePosts.slice(0, 2).map((item) => postCard(item, true))}
              </div>
              <div className="guild-note">
                <span className="note-icon">
                  <Feather size={20} />
                </span>
                <div>
                  <b>O próximo rumor pode virar uma grande história.</b>
                  <p>Descubra pistas e ideias nos ganchos de aventura.</p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Explorar ganchos"
                  onClick={() => go('hooks')}
                >
                  <ArrowRight size={19} />
                </button>
              </div>
            </section>
            <section>
              <div className="section-heading">
                <h2>Seu aventureiro</h2>
                <button
                  className="text-button"
                  onClick={() => go('characters')}
                  aria-label="Ver personagens"
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>
              {character ? (
                <div className="character-mini">
                  <div className="character-crest">
                    <Shield size={34} />
                    <span>{character.level}</span>
                  </div>
                  <h3>{character.name}</h3>
                  <p>
                    {character.race} · {character.class}
                  </p>
                  <span className="badge neutral">
                    NÍVEL {character.level} · {character.experience.toLocaleString('pt-BR')} XP
                  </span>
                  <div className="mini-stats">
                    <span>
                      <Heart size={16} />
                      <b>{character.hp}</b> PV
                    </span>
                    <span>
                      <Shield size={16} />
                      <b>{character.armor_class}</b> CA
                    </span>
                    <span>
                      <Coins size={16} />
                      <b>{money(character.gold_cp)}</b> PO
                    </span>
                  </div>
                  <button className="button outline full" onClick={() => go('profile')}>
                    Abrir ficha
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="character-mini empty-mini">
                  <Shield size={38} />
                  <h3>Uma lenda em branco</h3>
                  <p>Todo herói começa com um nome e uma boa história.</p>
                  <button className="button outline" onClick={() => setModal('character')}>
                    <Plus size={16} />
                    Criar personagem
                  </button>
                </div>
              )}
            </section>
          </div>
        </>
      );
    return (
      <>
        <div className="page-title">
          <div>
            <h1>
              {titles[page]}
              <span className="title-dot">.</span>
            </h1>
            <p>
              {page === 'shop'
                ? 'Bons equipamentos. Novos caminhos. Preços do compêndio SRD 5.1.'
                : page === 'characters'
                  ? 'Diferentes rostos, infinitas histórias. Escolha quem você será hoje.'
                  : page === 'missions'
                    ? 'Atenda a um chamado ou reencontre as aventuras que ficaram na memória.'
                    : page === 'board'
                      ? 'Missões, encontros e notícias da Bastião da Alvorada.'
                      : page === 'inventory'
                        ? `Tudo o que ${character?.name || 'seu personagem'} leva para a próxima aventura.`
                        : page === 'profile'
                          ? 'Uma história em construção, um atributo de cada vez.'
                          : page === 'hooks'
                            ? 'Uma pista, um rumor, uma razão para seguir em frente.'
                            : 'Pessoas, lugares e crônicas da Alvorada Cinzenta.'}
            </p>
          </div>
          {page === 'characters' && (
            <button className="button primary" onClick={() => setModal('character')}>
              <Plus size={17} />
              Novo personagem
            </button>
          )}
          {['missions', 'board'].includes(page) && (
            <button
              className="button primary"
              onClick={() => {
                setPostLocation(undefined);
                setPostFromAtlas(false);
                setModal('post');
              }}
            >
              <Plus size={17} />
              Publicar no mural
            </button>
          )}
        </div>
        {page === 'characters' &&
          (characters.length ? (
            <div className="characters-grid">
              {characters.map((item) => (
                <article
                  className={`character-card ${item.id === character?.id ? 'selected' : ''}`}
                  key={item.id}
                >
                  <div className="character-card-top">
                    <span className="badge neutral">NÍVEL {item.level}</span>
                    {item.id === character?.id && (
                      <span className="selected-label">
                        <CircleCheck size={14} />
                        Selecionado
                      </span>
                    )}
                  </div>
                  <div className="character-crest">
                    <Shield size={35} />
                  </div>
                  <h2>{item.name}</h2>
                  <p>
                    {item.race} · {item.class}
                  </p>
                  <span className="muted small">{item.background}</span>
                  <div className="character-card-bottom">
                    <span>
                      <Coins size={16} />
                      {money(item.gold_cp)} PO
                    </span>
                    <button
                      className="button small-button"
                      onClick={() => {
                        setSelectedId(item.id);
                        go('profile');
                      }}
                    >
                      Abrir ficha
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </article>
              ))}
              <button className="new-character" onClick={() => setModal('character')}>
                <Plus size={30} />
                <h3>Mais uma história</h3>
                <p>Crie um novo personagem</p>
              </button>
            </div>
          ) : (
            noCharacter
          ))}
        {page === 'profile' &&
          (character ? (
            <div className="profile-layout">
              <section className="paper profile-card">
                <div className="profile-top">
                  <div className="character-crest">
                    <Shield size={38} />
                  </div>
                  <div>
                    <span className="eyebrow">
                      NÍVEL {character.level} · {character.experience.toLocaleString('pt-BR')} XP ·{' '}
                      {character.background}
                    </span>
                    <h2>{character.name}</h2>
                    <p>
                      {character.race} · {character.class}
                    </p>
                  </div>
                </div>
                <div className="vitals">
                  <div>
                    <Heart size={19} />
                    <strong>{character.hp}</strong>
                    <span>Pontos de vida</span>
                  </div>
                  <div>
                    <Shield size={19} />
                    <strong>{character.armor_class}</strong>
                    <span>CA sem armadura</span>
                  </div>
                  <div>
                    <Sparkles size={19} />
                    <strong>+2</strong>
                    <span>Proficiência</span>
                  </div>
                  <div>
                    <Coins size={19} />
                    <strong>{money(character.gold_cp)}</strong>
                    <span>Peças de ouro</span>
                  </div>
                </div>
                <h3>Atributos</h3>
                <div className="attribute-grid">
                  {character.stats.map((score, index) => (
                    <div key={index}>
                      <span>{statNames[index]}</span>
                      <strong>{score}</strong>
                      <small>
                        {modifier(score) >= 0 ? '+' : ''}
                        {modifier(score)}
                      </small>
                    </div>
                  ))}
                </div>
                <h3>Sua história</h3>
                <p className="biography">
                  {character.biography ||
                    'Ainda há páginas em branco. Que suas aventuras preencham cada uma delas.'}
                </p>
                <div className="info-note">
                  Ficha inicial simplificada. Bônus raciais, magias, efeitos de equipamentos e
                  evolução serão adicionados nas próximas etapas.
                </div>
              </section>
              <aside className="profile-side">
                <div className="paper">
                  <Backpack size={26} />
                  <h3>A mochila está com você.</h3>
                  <p>{inventoryCount} itens prontos para a próxima jornada.</p>
                  <button className="button outline full" onClick={() => go('inventory')}>
                    Ver inventário
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="paper">
                  <Trophy size={26} />
                  <h3>Pequenos feitos, grandes histórias.</h3>
                  <p>{details?.achievements.length || 0} de 3 conquistas desbloqueadas.</p>
                  <button className="text-button" onClick={() => go('achievements')}>
                    Ver conquistas
                    <ArrowRight size={16} />
                  </button>
                </div>
              </aside>
            </div>
          ) : (
            noCharacter
          ))}
        {page === 'shop' && (
          <>
            <div className="shop-bar">
              <div className="search-field">
                <Search size={17} />
                <input
                  aria-label="Buscar itens"
                  placeholder="Buscar no empório…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="tabs">
                {['Todos', 'Armas', 'Armaduras', 'Equipamento'].map((item) => (
                  <button
                    key={item}
                    className={category === item ? 'active' : ''}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <span className="wallet">
                <Coins size={18} />
                {character ? (
                  <>
                    <b>{money(character.gold_cp)}</b> PO
                  </>
                ) : (
                  'Sem personagem'
                )}
              </span>
            </div>
            {!character && (
              <div className="info-note">
                Você pode consultar o catálogo. Crie um personagem para comprar e receber os itens.
              </div>
            )}
            <div className="shop-grid">
              {catalog
                .filter(
                  (item) =>
                    (category === 'Todos' || item.category === category) &&
                    `${item.name} ${item.original_name}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((item) => {
                  const ItemIcon =
                    item.category === 'Armas'
                      ? Sword
                      : item.category === 'Armaduras'
                        ? Shield
                        : Backpack;
                  return (
                    <article className="item-card" key={item.id}>
                      <div
                        className={`item-illustration ${item.category === 'Armas' ? 'weapon' : item.category === 'Armaduras' ? 'armor' : 'gear'}`}
                      >
                        <span className="item-category">{item.category}</span>
                        <ItemIcon size={62} />
                        <span className="item-srd">SRD 5.1</span>
                      </div>
                      <div className="item-body">
                        <h3>{item.name}</h3>
                        <span className="original-name">
                          {item.original_name} · {item.weight_lb} lb
                        </span>
                        <p>{item.description}</p>
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="source-link"
                        >
                          Consultar no 5etools
                          <ExternalLink size={12} />
                        </a>
                        <div className="item-footer">
                          <span>
                            <b>{money(item.price_cp)}</b> PO
                          </span>
                          <button
                            className="button small-button"
                            disabled={!character}
                            onClick={() => {
                              setPurchaseItem(item);
                              setQuantity(1);
                              setPurchaseKey(crypto.randomUUID());
                              setBuyError('');
                            }}
                          >
                            Comprar
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
            {!catalog.some(
              (item) =>
                (category === 'Todos' || item.category === category) &&
                `${item.name} ${item.original_name}`.toLowerCase().includes(query.toLowerCase()),
            ) && <Empty title="Nenhum item por aqui.">Tente outro nome ou outra categoria.</Empty>}
            <p className="source-note">
              Dados importados do 5etools · Somente equipamentos SRD 5.1 · Pesos em libras ·{' '}
              <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noreferrer">
                Referência e licença SRD
              </a>
            </p>
          </>
        )}
        {page === 'inventory' &&
          (!character ? (
            noCharacter
          ) : !details ? (
            <p>Consultando a mochila…</p>
          ) : (
            <>
              <div className="inventory-summary">
                <div>
                  <Backpack size={24} />
                  <span>
                    <b>{inventoryCount}</b> itens na mochila
                  </span>
                </div>
                <div>
                  <Gem size={22} />
                  <span>
                    <b>
                      {new Intl.NumberFormat('pt-BR').format(
                        details.inventory.reduce(
                          (sum, item) => sum + Number(item.weight_lb) * (item.quantity || 0),
                          0,
                        ),
                      )}
                    </b>{' '}
                    lb de equipamento
                  </span>
                </div>
                <div>
                  <Coins size={23} />
                  <span>
                    <b>{money(character.gold_cp)}</b> PO disponíveis
                  </span>
                </div>
              </div>
              {details.inventory.length ? (
                <div className="paper table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Categoria</th>
                        <th>Quantidade</th>
                        <th>Peso total</th>
                        <th>Valor unitário</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.inventory.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <b>{item.name}</b>
                            <small>{item.original_name}</small>
                          </td>
                          <td>{item.category}</td>
                          <td>
                            <span className="quantity-badge">{item.quantity}</span>
                          </td>
                          <td>{Number(item.weight_lb) * (item.quantity || 0)} lb</td>
                          <td>{money(item.price_cp)} PO</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Sua mochila ainda está leve."
                  action={
                    <button className="button primary" onClick={() => go('shop')}>
                      Visitar o empório
                      <ArrowRight size={16} />
                    </button>
                  }
                >
                  Encontre seu primeiro equipamento na loja da guilda.
                </Empty>
              )}
              {details.history.length > 0 && (
                <section className="purchase-history">
                  <div className="section-heading">
                    <h2>Últimas compras</h2>
                    <button className="text-button" onClick={() => go('shop')}>
                      Voltar à loja
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="paper">
                    {details.history.map((order) => (
                      <div className="history-row" key={order.id}>
                        <span className="history-icon">
                          <Check size={15} />
                        </span>
                        <div>
                          <b>
                            {order.quantity} × {order.name}
                          </b>
                          <small>{new Date(order.created_at).toLocaleString('pt-BR')}</small>
                        </div>
                        <span>−{money(order.total_cp)} PO</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ))}
        {page === 'achievements' &&
          (character ? (
            <div className="achievements-grid">
              {Object.entries(achievementInfo).map(([code, [title, description, Icon]]) => {
                const unlocked = details?.achievements.find((item) => item.code === code);
                return (
                  <article className={`paper achievement ${unlocked ? 'unlocked' : ''}`} key={code}>
                    <div className="achievement-emblem">
                      <Icon size={32} />
                    </div>
                    <span className="eyebrow">
                      {unlocked ? 'CONQUISTA DESBLOQUEADA' : 'UM NOVO OBJETIVO'}
                    </span>
                    <h2>{title}</h2>
                    <p>{description}</p>
                    <span className="badge neutral">
                      {unlocked
                        ? new Date(unlocked.unlocked_at).toLocaleDateString('pt-BR')
                        : 'A conquistar'}
                    </span>
                  </article>
                );
              })}
            </div>
          ) : (
            noCharacter
          ))}
        {['missions', 'board', 'hooks'].includes(page) && (
          <>
            <div className="board-toolbar">
              <div className="tabs">
                {(page === 'missions'
                  ? ['Todos', 'Abertas', 'Em andamento', 'Histórico']
                  : page === 'board'
                    ? ['Todos', 'Missões', 'Eventos', 'Ganchos']
                    : ['Todos']
                ).map((tab) => (
                  <button
                    key={tab}
                    className={boardTab === tab ? 'active' : ''}
                    aria-pressed={boardTab === tab}
                    onClick={() => setBoardTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <span className="small muted">
                {character ? `Jogando com ${character.name}` : 'Crie um personagem para participar'}
              </span>
            </div>
            <div className="quest-grid">
              {posts
                .filter((item) => {
                  if (page === 'missions')
                    return (
                      item.kind === 'mission' &&
                      (boardTab === 'Todos' ||
                        (boardTab === 'Abertas' && item.status === 'open') ||
                        (boardTab === 'Em andamento' && item.status === 'active') ||
                        (boardTab === 'Histórico' && ['completed', 'closed'].includes(item.status)))
                    );
                  if (!['open', 'active'].includes(item.status)) return false;
                  return page === 'hooks'
                    ? item.kind === 'hook'
                    : boardTab === 'Todos' ||
                        item.kind ===
                          (
                            { Missões: 'mission', Eventos: 'event', Ganchos: 'hook' } as Record<
                              string,
                              string
                            >
                          )[boardTab];
                })
                .map((item) => postCard(item))}
            </div>
            <p className="source-note">
              {page === 'hooks'
                ? 'Ganchos nascem da conclusão de uma missão.'
                : 'O criador registra o resumo e concede experiência ao concluir a missão. Eventos são publicados pela staff.'}
            </p>
          </>
        )}
        {['house', 'lore', 'rules', 'mercenaries'].includes(page) && (
          <>
            <div className={`entries-grid ${page === 'house' ? 'house-grid' : ''}`}>
              {entries
                .filter((entry) => entry.section === page)
                .map((entry) => {
                  const EntryIcon =
                    page === 'house' ? House : page === 'mercenaries' ? Swords : BookOpen;
                  return (
                    <article className="entry-card paper" key={entry.id}>
                      <div className="entry-icon">
                        <EntryIcon size={31} />
                      </div>
                      <span className="eyebrow">{entry.tag}</span>
                      <h2>{entry.title}</h2>
                      <p className="entry-subtitle">{entry.subtitle}</p>
                      <p>{entry.body}</p>
                      {['house', 'mercenaries'].includes(page) && (
                        <span className="badge neutral">
                          Conteúdo de cenário · Funcionalidades em desenvolvimento
                        </span>
                      )}
                    </article>
                  );
                })}
            </div>
            {page === 'rules' && (
              <div className="license-note">
                <b>Referências e atribuição</b>
                <p>
                  Este protótipo inclui dados do System Reference Document 5.1, © 2016 Wizards of
                  the Coast LLC, disponibilizados sob CC BY 4.0. Nomes foram traduzidos e descrições
                  resumidas. Cenário e lore são originais.
                </p>
                <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noreferrer">
                  System Reference Document
                  <ExternalLink size={13} />
                </a>
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Licença CC BY 4.0
                  <ExternalLink size={13} />
                </a>
              </div>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <div className="app-shell">
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button className="header-wordmark" onClick={() => go('overview')}>
              Alvorada Cinzenta
            </button>
            <b>{titles[page]}</b>
          </div>
          <div className="topbar-right">
            {characters.length > 0 && (
              <CharacterSelector
                characters={characters}
                selectedId={character?.id || ''}
                onSelect={setSelectedId}
              />
            )}
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
              <span>Sair</span>
            </button>
          </div>
        </header>
        <main className="main-content" id="main-content">
          {renderContent()}
        </main>
      </div>
      <Navigation page={page} go={go} postCount={activePosts.length} />
      {toast && (
        <div className="toast" role="status">
          <Sparkles size={19} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dispensar aviso">
            <X size={16} />
          </button>
        </div>
      )}
      {modal === 'character' && (
        <Modal title="Uma nova história" close={() => setModal(null)}>
          <CharacterForm
            done={async (item) => {
              await refresh();
              setSelectedId(item.id);
              setModal(null);
              go('profile');
              setToast(`${item.name} chegou à guilda!`);
            }}
          />
        </Modal>
      )}
      {modal === 'post' && (
        <Modal title="Um chamado à guilda" close={() => setModal(null)}>
          <PostForm
            canCreateEvent={!postFromAtlas && (role === 'staff' || role === 'admin')}
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
      {purchaseItem && character && (
        <Modal
          title="Preparar a mochila"
          close={() => {
            if (!busy) setPurchaseItem(null);
          }}
        >
          <div className="purchase-preview">
            <span className="item-preview-icon">
              <Backpack size={35} />
            </span>
            <div>
              <h3>{purchaseItem.name}</h3>
              <p>{money(purchaseItem.price_cp)} PO por unidade</p>
            </div>
          </div>
          <p className="muted">
            O item será entregue a <b>{character.name}</b>.
          </p>
          <label className="quantity-input">
            Quantidade
            <input
              type="number"
              value={quantity}
              min={1}
              max={99}
              disabled={busy}
              onChange={(event) => {
                setQuantity(Number(event.target.value));
                setPurchaseKey(crypto.randomUUID());
                setBuyError('');
              }}
            />
          </label>
          <div className="checkout-lines">
            <div>
              <span>Saldo atual</span>
              <b>{money(character.gold_cp)} PO</b>
            </div>
            <div>
              <span>Total da compra</span>
              <b>{money(purchaseItem.price_cp * quantity)} PO</b>
            </div>
            <div>
              <span>Saldo após a compra</span>
              <b>{money(character.gold_cp - purchaseItem.price_cp * quantity)} PO</b>
            </div>
          </div>
          {purchaseItem.price_cp * quantity > character.gold_cp && (
            <p className="form-error">Ouro insuficiente. Escolha uma quantidade menor.</p>
          )}
          {buyError && (
            <p className="form-error" role="alert">
              {buyError}
            </p>
          )}
          <button
            className="button primary full"
            disabled={
              busy ||
              !Number.isInteger(quantity) ||
              quantity < 1 ||
              quantity > 99 ||
              purchaseItem.price_cp * quantity > character.gold_cp
            }
            onClick={() => void buy()}
          >
            {busy ? 'Confirmando compra…' : 'Confirmar compra'}
            <Coins size={18} />
          </button>
        </Modal>
      )}
    </div>
  );
}
