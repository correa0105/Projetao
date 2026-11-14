import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, LockKeyhole, Search, Users, X } from 'lucide-react';
import { api, post } from './api';
import {
  professions,
  professionMaterialIds,
  professionUnlocked,
  type Profession,
  type CraftRecipe,
  type ProfessionState,
} from '../shared/professions';
import type { Character, Page } from './types';
import './professions.css';
import { ProfessionProduction } from './ProfessionProduction';
import { ProfessionRecipeDetails } from './ProfessionRecipeDetails';
import { professionItemArtwork } from '../shared/profession-art';
import { professionProgress } from '../shared/profession-progression';

function timeLeft(date: string, now: number) {
  const minutes = Math.max(0, Math.ceil((Date.parse(date) - now) / 60000));
  return minutes ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : 'Pronto para recolher';
}
function MaterialDelivery({
  rooms,
}: {
  rooms: ProfessionState['rooms'];
  onChanged: () => Promise<void>;
}) {
  const [room, setRoom] = useState(rooms[0]?.id ?? '');
  return (
    <section className="pf-delivery">
      <span className="pf-kicker">MATERIAIS DA AVENTURA</span>
      <h2>Uma descoberta para cada ofício</h2>
      <p>
        No VTT, o mestre vincula a missão ou prepara a mesa temática. Cada jogador inscrito tem um
        d100, com materiais do seu ofício e nível. Resultados 91–100 podem render o dobro.
      </p>
      <p>
        O resultado fica reservado. A mochila só recebe os materiais quando o mestre registra a
        conclusão da mesa.
      </p>
      <label>
        Mesa
        <select value={room} onChange={(e) => setRoom(e.target.value)}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="button pf-primary"
        disabled={!room}
        onClick={() => {
          window.location.hash = 'vtt?room=' + room;
        }}
      >
        Abrir o VTT
      </button>
    </section>
  );
}
export function Professions({
  character,
  onChanged,
  go,
}: {
  character?: Character;
  onChanged: () => Promise<void>;
  go: (page: Page) => void;
}) {
  const [state, setState] = useState<ProfessionState>(),
    [selected, setSelected] = useState<string | null>(null),
    [recipeId, setRecipeId] = useState(''),
    [recipeSearch, setRecipeSearch] = useState(''),
    [query, setQuery] = useState(''),
    [mine, setMine] = useState(false),
    [deliveries, setDeliveries] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [tick, setTick] = useState(Date.now()),
    [received, setReceived] = useState(Date.now());
  const locked = useRef(false),
    requestKeys = useRef(new Map<string, string>()),
    generation = useRef(0);
  async function reload() {
    const gen = ++generation.current;
    const data = await api<ProfessionState>(
      '/professions' + (character ? '?character_id=' + character.id : ''),
    );
    if (gen === generation.current) {
      setState(data);
      setReceived(Date.now());
    }
    return data;
  }
  useEffect(() => {
    let active = true;
    void reload().catch((e) => {
      if (active) setError(e.message);
    });
    const timer = window.setInterval(() => {
      setTick(Date.now());
      if (document.visibilityState === 'visible' && !locked.current) void reload().catch(() => {});
    }, 15000);
    return () => {
      active = false;
      ++generation.current;
      window.clearInterval(timer);
    };
  }, [character?.id]);
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const profession = professions.find((p) => p.id === selected);
  const administrator = state?.capabilities?.all_professions === true;
  const unlimitedMaterials = state?.capabilities?.unlimited_materials === true;
  const hasProfession = (p: Profession) =>
    administrator || professionUnlocked(p, state?.proficiencies ?? []);
  const unlocked = !!profession && hasProfession(profession);
  const craftingProgress =
    state?.progress?.find((p) => p.profession_id === selected) ?? professionProgress();
  const active = state?.projects.find((p) => !p.claimed_at);
  const current = active?.profession_id === selected ? active : undefined;
  const recipe =
    (current?.recipe.id === recipeId ? current.recipe : undefined) ??
    profession?.recipes.find((r) => r.id === recipeId) ??
    current?.recipe ??
    profession?.recipes[0];
  const recipeUnlocked =
    unlocked && (administrator || craftingProgress.level >= (recipe?.required_level ?? 1));
  const now = state ? Date.parse(state.server_time) + Math.max(0, tick - received) : tick;
  function open(p: Profession) {
    setSelected(p.id);
    setRecipeId(active?.profession_id === p.id ? active.recipe_id : p.recipes[0].id);
    setRecipeSearch('');
    setDeliveries(false);
    setError('');
    setNotice('');
  }
  function key(id: string) {
    let value = requestKeys.current.get(id);
    if (!value) {
      value = crypto.randomUUID();
      requestKeys.current.set(id, value);
    }
    return value;
  }
  async function act(kind: 'start' | 'assist' | 'collect') {
    if (locked.current || !character || !profession || !recipe) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const operation =
      kind === 'start' ? 'start:' + recipe.id : kind + ':' + current?.id + ':' + current?.revision;
    try {
      if (kind === 'start')
        await post('/professions/projects', {
          character_id: character.id,
          recipe_id: recipe.id,
          request_id: key(operation),
        });
      else if (kind === 'assist' && current)
        await post('/professions/projects/' + current.id + '/assist', {
          request_id: key(operation),
        });
      else if (kind === 'collect' && current)
        await post('/professions/projects/' + current.id + '/collect', {});
      requestKeys.current.delete(operation);
      await reload();
      if (kind === 'collect')
        setNotice(`Criação na mochila. +${recipe.experience ?? 20} EXP em ${profession.name}.`);
      if (kind !== 'assist') void onChanged().catch(() => {});
      return true;
    } catch (e) {
      setError((e as Error).message);
      await reload().catch(() => {});
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function availability(r: CraftRecipe) {
    return (
      unlimitedMaterials ||
      r.ingredients.every(
        (i) => (state?.inventory.find((v) => v.id === i.item_id)?.available ?? 0) >= i.quantity,
      )
    );
  }
  const filtered = professions.filter(
    (p) =>
      (!mine || hasProfession(p)) &&
      (p.name + ' ' + p.tools.join(' '))
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLocaleLowerCase('pt-BR')
        .includes(
          query
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLocaleLowerCase('pt-BR'),
        ),
  );
  const banner = profession ?? professions[0];
  return (
    <section
      className={'professions ' + (profession ? 'pf-inside' : '')}
      style={{ '--pf-accent': banner.accent } as CSSProperties}
    >
      <img className="pf-scenery" src={banner.background} alt="" aria-hidden="true" />
      <div className="pf-content">
        <header className="pf-header">
          <div>
            <span className="pf-kicker">ALVORADA CINZENTA · OFÍCIOS</span>
            <h1>
              {deliveries
                ? 'Entregas de mesa'
                : (profession?.name ?? 'Toda aventura deixa matéria-prima.')}
            </h1>
            <p>
              {deliveries
                ? 'Os materiais da jornada seguem para as mãos de quem cria.'
                : (profession?.title ??
                  'Escolha seu ofício. Traga suas descobertas. Crie algo que faça parte da sua história.')}
            </p>
          </div>
          <div className="pf-header-actions">
            {character ? (
              <span className="pf-character">
                <span className="pf-small-dot" />
                {character.name}
              </span>
            ) : (
              <button className="button" onClick={() => go('characters')}>
                Selecionar personagem
              </button>
            )}
            {(selected || deliveries) && (
              <button
                className="button outline"
                onClick={() => {
                  setSelected(null);
                  setDeliveries(false);
                  setError('');
                  setNotice('');
                }}
              >
                <ArrowLeft size={16} /> Todas as profissões
              </button>
            )}
            {!!state?.rooms.length && !deliveries && (
              <button className="button outline" onClick={() => setDeliveries(true)}>
                <Users size={16} /> Entregas de mesa
              </button>
            )}
          </div>
        </header>
        {error && (
          <p className="pf-feedback pf-error" role="alert">
            {error}
            <button aria-label="Fechar erro" onClick={() => setError('')}>
              <X size={15} />
            </button>
          </p>
        )}
        {notice && (
          <p className="pf-feedback" role="status">
            <Check size={18} />
            {notice}
          </p>
        )}
        {!state && (
          <p role="status" className="pf-loading">
            Abrindo as oficinas…
          </p>
        )}
        {deliveries && state ? (
          <MaterialDelivery
            rooms={state.rooms}
            onChanged={async () => {
              await reload();
              await onChanged();
            }}
          />
        ) : profession ? (
          <>
            <div className={'pf-access ' + (unlocked ? 'is-unlocked' : '')}>
              <img src={'/sheet/training-badges-20261019/' + profession.badge + '.webp'} alt="" />
              {unlocked ? (
                <>
                  <Check size={17} />
                  <span>
                    <strong>Bancada liberada</strong> ·{' '}
                    {administrator ? 'acesso de administrador' : 'proficiência confirmada na ficha'}
                  </span>
                </>
              ) : (
                <>
                  <LockKeyhole size={17} />
                  <span>
                    <strong>Oficina para visita</strong> · exige{' '}
                    {profession.tools.length > 2
                      ? 'uma das proficiências deste ofício'
                      : profession.tools[0]}{' '}
                    na ficha concluída.
                  </span>
                </>
              )}
            </div>
            <div
              className="pf-level-progress"
              aria-label={'Nível de crafting em ' + profession.name}
            >
              <div>
                <strong>
                  Nível {craftingProgress.level} · {craftingProgress.title}
                </strong>
                <span>
                  {administrator
                    ? 'Todos os níveis liberados'
                    : craftingProgress.next_level === null
                      ? 'Nível máximo'
                      : craftingProgress.experience + ' / ' + craftingProgress.next_level + ' EXP'}
                </span>
              </div>
              <progress
                max={
                  craftingProgress.next_level === null
                    ? 1
                    : craftingProgress.next_level - craftingProgress.level_start
                }
                value={
                  craftingProgress.next_level === null
                    ? 1
                    : craftingProgress.experience - craftingProgress.level_start
                }
              />
              <small>Conclua criações para ganhar experiência neste ofício.</small>
            </div>
            <div className="pf-studio-grid">
              <aside className="pf-recipe-shelf" aria-label="Receitas da profissão">
                <span className="pf-kicker">LIVRO DA OFICINA</span>
                <h2>O que vamos criar?</h2>
                <p>{profession.description}</p>
                <label className="pf-recipe-search">
                  Encontrar uma receita
                  <input
                    aria-label="Buscar receitas"
                    placeholder="Nome do item…"
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                  />
                </label>
                <div className="pf-recipe-list" aria-label="Lista de receitas">
                  {profession.recipes
                    .filter((r) =>
                      r.name
                        .normalize('NFD')
                        .replace(/\p{Diacritic}/gu, '')
                        .toLocaleLowerCase('pt-BR')
                        .includes(
                          recipeSearch
                            .normalize('NFD')
                            .replace(/\p{Diacritic}/gu, '')
                            .toLocaleLowerCase('pt-BR'),
                        ),
                    )
                    .map((r) => {
                      const item = state?.inventory.find((i) => i.id === r.output.item_id);
                      return (
                        <button
                          key={r.id}
                          className={'pf-recipe ' + (recipe?.id === r.id ? 'is-selected' : '')}
                          onClick={() => {
                            setRecipeId(r.id);
                            if (innerWidth < 760)
                              document
                                .querySelector('.pf-bench')
                                ?.scrollIntoView({
                                  behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                                    ? 'auto'
                                    : 'smooth',
                                  block: 'start',
                                });
                          }}
                          disabled={busy}
                          aria-pressed={recipe?.id === r.id}
                        >
                          <img
                            className="pf-object-icon"
                            src={professionItemArtwork(
                              r.output.item_id,
                              item?.image_path,
                              profession.badge,
                            )}
                            alt=""
                          />
                          <span>
                            <strong>{r.name}</strong>
                            <small>
                              {r.output.quantity > 1 ? r.output.quantity + ' unidades · ' : ''}
                              {r.hours} h de produção
                            </small>
                            <small
                              className={
                                'pf-recipe-level ' +
                                (!administrator && craftingProgress.level < (r.required_level ?? 1)
                                  ? 'is-locked'
                                  : '')
                              }
                            >
                              Nível {r.required_level ?? 1} · {r.experience ?? 20} EXP
                            </small>
                          </span>
                          <ArrowRight size={16} />
                        </button>
                      );
                    })}
                </div>
                <small className="pf-recipe-count">
                  {profession.recipes.length} receitas neste ofício
                </small>
                {recipe && (
                  <div className="pf-ingredients">
                    <h3>Materiais da receita</h3>
                    <p>
                      {unlimitedMaterials
                        ? 'Materiais ilimitados na sua bancada.'
                        : 'Estas quantidades serão consumidas ao iniciar.'}
                    </p>
                    {recipe.ingredients.map((i) => {
                      const item = state?.inventory.find((v) => v.id === i.item_id),
                        table = professionMaterialIds.has(i.item_id),
                        amount = item?.available ?? 0;
                      return (
                        <div
                          className={
                            'pf-ingredient ' +
                            (unlimitedMaterials || amount >= i.quantity ? 'is-available' : '')
                          }
                          key={i.item_id}
                        >
                          <img
                            className="pf-object-icon"
                            src={professionItemArtwork(
                              i.item_id,
                              item?.image_path,
                              profession.badge,
                            )}
                            alt=""
                          />
                          <div>
                            <strong>{item?.name ?? i.item_id}</strong>
                            <small>{table ? 'Obtido em mesa' : 'Insumo do Empório'}</small>
                          </div>
                          <span
                            aria-label={
                              (item?.name ?? i.item_id) +
                              ': ' +
                              (unlimitedMaterials
                                ? 'materiais ilimitados; '
                                : amount + ' disponíveis de ') +
                              i.quantity +
                              ' necessários'
                            }
                          >
                            {unlimitedMaterials ? '∞' : amount}/{i.quantity}
                          </span>
                        </div>
                      );
                    })}
                    <button className="pf-shop-link" onClick={() => go('shop')}>
                      Visitar o Empório <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </aside>
              <main className="pf-bench" aria-label="Bancada de criação">
                {active && !current && !recipe ? (
                  <div className="pf-other-job">
                    <Clock3 size={32} />
                    <h2>Seu trabalho continua em outra oficina.</h2>
                    <p>
                      {active.recipe.name} · {timeLeft(active.ready_at, now)}
                    </p>
                    <button
                      className="button pf-primary"
                      onClick={() => open(professions.find((p) => p.id === active.profession_id)!)}
                    >
                      Voltar ao trabalho
                    </button>
                  </div>
                ) : current && recipe?.id === current.recipe_id ? (
                  <ProfessionProduction
                    key={current.id}
                    project={current}
                    profession={profession}
                    now={now}
                    busy={busy}
                    unlocked={unlocked}
                    itemImage={
                      state?.inventory.find((i) => i.id === current.recipe.output.item_id)
                        ?.image_path
                    }
                    assist={() => act('assist')}
                    collect={() => void act('collect')}
                  />
                ) : recipe ? (
                  <div className="pf-project-intro">
                    <div className="pf-bench-symbol">
                      <img
                        src={professionItemArtwork(
                          recipe.output.item_id,
                          state?.inventory.find((i) => i.id === recipe.output.item_id)?.image_path,
                          profession.badge,
                        )}
                        alt=""
                      />
                    </div>
                    <span className="pf-kicker">UMA NOVA CRIAÇÃO</span>
                    <h2>{recipe.name}</h2>
                    <ProfessionRecipeDetails
                      recipe={recipe}
                      item={state?.inventory.find((i) => i.id === recipe.output.item_id)}
                    />
                    <div className="pf-preview-stages">
                      {[
                        'Reunir os materiais',
                        'Deixar a oficina produzir',
                        'Recolher sua criação',
                      ].map((name, i) => (
                        <div key={name}>
                          <span>{i + 1}</span>
                          <strong>{name}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="pf-production-time">
                      <Clock3 size={18} />
                      {recipe.hours} horas reais · resultado na mochila
                    </div>
                    {!unlocked ? (
                      <p className="pf-locked-note">
                        <LockKeyhole size={17} /> Esta bancada aguarda a proficiência na ficha.
                      </p>
                    ) : !recipeUnlocked ? (
                      <p className="pf-locked-note">
                        <LockKeyhole size={17} /> Alcance o nível {recipe.required_level} neste
                        ofício para liberar esta receita.
                      </p>
                    ) : !availability(recipe) ? (
                      <p className="pf-locked-note">
                        <img
                          className="pf-button-art"
                          src="/navigation/illustrated-20261020/inventory.webp"
                          alt=""
                        />{' '}
                        Reúna os materiais indicados no livro da oficina.
                      </p>
                    ) : (
                      <p className="pf-start-note">
                        {unlimitedMaterials
                          ? 'Seu acesso de administrador fornece os materiais.'
                          : 'Ao iniciar, os materiais listados serão usados.'}{' '}
                        A produção continua automaticamente, mesmo com o site fechado.
                      </p>
                    )}
                    <button
                      className="button pf-primary"
                      disabled={
                        !recipeUnlocked ||
                        !availability(recipe) ||
                        busy ||
                        !state ||
                        !character ||
                        !!active
                      }
                      onClick={() => void act('start')}
                    >
                      <img
                        className="pf-button-art"
                        src={'/sheet/training-badges-20261019/' + profession.badge + '.webp'}
                        alt=""
                      />
                      {busy ? 'Preparando…' : 'Usar materiais e iniciar'}
                    </button>
                    {active && (
                      <button
                        className="button outline"
                        onClick={() => {
                          open(professions.find((p) => p.id === active.profession_id)!);
                        }}
                      >
                        Voltar à criação em andamento
                      </button>
                    )}
                  </div>
                ) : null}
              </main>
            </div>
            {!!state?.projects.some((p) => p.claimed_at && p.profession_id === selected) && (
              <section className="pf-history">
                <span className="pf-kicker">FEITO POR SUAS MÃOS</span>
                <h2>Criações recolhidas</h2>
                {state.projects
                  .filter((p) => p.claimed_at && p.profession_id === selected)
                  .slice(0, 6)
                  .map((p) => (
                    <div key={p.id}>
                      <Check size={16} />
                      <strong>{p.recipe.name}</strong>
                      <span>{new Date(p.claimed_at!).toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))}
              </section>
            )}
          </>
        ) : (
          <>
            {active && (
              <button
                className="pf-active-banner"
                onClick={() => open(professions.find((p) => p.id === active.profession_id)!)}
              >
                <Clock3 size={23} />
                <span>
                  <strong>Continuar: {active.recipe.name}</strong>
                  <small>{timeLeft(active.ready_at, now)}</small>
                </span>
                <ArrowRight size={20} />
              </button>
            )}
            <div className="pf-catalog-toolbar">
              <label className="pf-search">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Encontrar um ofício…"
                  aria-label="Pesquisar profissões"
                />
              </label>
              <button
                className={'button outline ' + (mine ? 'is-active' : '')}
                aria-pressed={mine}
                onClick={() => setMine(!mine)}
              >
                Minhas profissões <span>{professions.filter((p) => hasProfession(p)).length}</span>
              </button>
              <span>{filtered.length} oficinas</span>
            </div>
            <div className="pf-profession-grid">
              {filtered.map((p) => {
                const allowed = hasProfession(p);
                return (
                  <button
                    key={p.id}
                    className={'pf-profession-card ' + (allowed ? 'is-unlocked' : '')}
                    onClick={() => open(p)}
                  >
                    <img
                      className="pf-card-scenery"
                      src={p.background.replace('.webp', '-thumb.webp')}
                      alt=""
                      loading="lazy"
                    />
                    <span className="pf-card-status">
                      {allowed ? (
                        <>
                          <Check size={13} /> Sua profissão
                        </>
                      ) : (
                        <>
                          <LockKeyhole size={12} /> Conhecer oficina
                        </>
                      )}
                    </span>
                    <div className="pf-card-copy">
                      <img
                        src={'/sheet/training-badges-20261019/' + p.badge + '.webp'}
                        alt=""
                        loading="lazy"
                      />
                      <div>
                        <h2>{p.name}</h2>
                        <p>{p.title}</p>
                      </div>
                      <ArrowRight size={19} />
                    </div>
                  </button>
                );
              })}
            </div>
            {!filtered.length && (
              <p className="pf-empty">
                {mine
                  ? 'Nenhuma proficiência deste ofício foi encontrada na ficha concluída. Você pode visitar todas as oficinas.'
                  : 'Nenhuma profissão encontrada. Tente outro nome.'}
              </p>
            )}
            <div className="pf-how">
              <div>
                <img
                  className="pf-how-art"
                  src={professionItemArtwork('craft-material-herb')}
                  alt=""
                />
                <strong>Encontre na aventura</strong>
                <p>Couro, plantas, minérios e descobertas são entregues pelo mestre.</p>
              </div>
              <div>
                <img
                  className="pf-how-art"
                  src="/navigation/illustrated-20261020/shop.webp"
                  alt=""
                />
                <strong>Complete no Empório</strong>
                <p>Compre os frascos, a tinta e os outros insumos que a receita pede.</p>
              </div>
              <div>
                <img
                  className="pf-how-art"
                  src="/sheet/training-badges-20261019/smithing.webp"
                  alt=""
                />
                <strong>Crie na sua bancada</strong>
                <p>Use sua proficiência, conclua o trabalho e guarde o resultado na mochila.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
