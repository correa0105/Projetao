import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Coins,
  Crown,
  Diamond,
  Dices,
  Flag,
  Plus,
  Lock,
  Pencil,
  ChevronLeft,
  Shield,
  Swords,
  Users,
  Wind,
  X,
} from 'lucide-react';
import { api, post } from './api';
import { money } from '../shared/rules';
import { monsterArt } from '../shared/vtt-monster-art';
import {
  towerName,
  towerFloorCount,
  towerFloors,
  towerZones,
  towerLootTable,
  towerBaseReward,
  type TowerRun,
  type TowerState,
  type TowerFloorContent,
  type TowerRewardTable,
  type TowerItemInfo,
} from '../shared/tower';
import type { Character, Item } from './types';
import { TowerDialog, TowerFloorEditor, TowerRewardEditor, TowerItemPreview } from './TowerEditors';
import './tower.css';
const statusNames = {
  preparing: 'Reunindo a expedição',
  active: 'Em ascensão',
  completed: 'De volta à Alvorada',
  cancelled: 'Expedição encerrada',
};
const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(
    new Date(value),
  );
export function Tower({
  characters,
  catalog,
  character,
  refreshCharacters,
}: {
  characters: Character[];
  catalog: Item[];
  character?: Character;
  refreshCharacters: () => Promise<void>;
}) {
  const [state, setState] = useState<TowerState | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [floor, setFloor] = useState(1),
    [tab, setTab] = useState<'atlas' | 'expeditions' | 'treasures'>('atlas'),
    [name, setName] = useState(''),
    [createOpen, setCreateOpen] = useState(false),
    [runId, setRunId] = useState(''),
    [summary, setSummary] = useState(''),
    [confirm, setConfirm] = useState<{
      run: TowerRun;
      action: 'clear' | 'finish' | 'cancel';
    } | null>(null),
    [lastRoll, setLastRoll] = useState<string | null>(null),
    [draft, setDraft] = useState<TowerFloorContent | null>(null),
    [rewardDraft, setRewardDraft] = useState<TowerRewardTable | null>(null),
    [itemPreview, setItemPreview] = useState<TowerItemInfo | null>(null);
  const refresh = useCallback(async () => setState(await api<TowerState>('/tower')), []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  async function act(fn: () => Promise<unknown>, updateCharacter = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
      if (updateCharacter) await refreshCharacters();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const level: TowerFloorContent = state?.floors[floor - 1] || {
    number: floor,
    name: 'Andar ' + floor,
    description: '',
    challenge: null,
    hazard: null,
    traps: null,
    creatures: null,
    boss: false,
    boss_name: null,
    revision: 0,
    discovery: 'hidden',
    base_gold_cp: null,
    base_crystals: null,
  };
  const zoneIndex = towerFloors[floor - 1].zone,
    zone = towerZones[zoneIndex],
    bosses = (state?.floors || []).filter((f) => f.boss && f.number <= floor).map((f) => f.number),
    defaultBase = towerBaseReward(floor, bosses),
    base = {
      ...defaultBase,
      gold_cp: level.base_gold_cp ?? defaultBase.gold_cp,
      crystals: level.base_crystals ?? defaultBase.crystals,
    },
    rewardTable = state?.reward_tables.find((t) => t.tier === base.tier),
    loot = rewardTable?.rows || towerLootTable(base.tier);
  const currentRun =
    state?.expeditions.find((r) => r.id === runId) ||
    state?.expeditions.find(
      (r) =>
        r.members.some((m) => m.character_id === character?.id) &&
        ['preparing', 'active'].includes(r.status),
    ) ||
    state?.expeditions[0];
  const myClaims = state?.claims.filter((c) => c.character_id === character?.id) || [],
    crystals = state?.wallets.find((w) => w.character_id === character?.id)?.crystals || 0;
  const pending = myClaims.filter((c) => c.roll === null).length;
  async function progress(run: TowerRun, action: 'start' | 'clear' | 'finish' | 'cancel') {
    await post(`/tower/expeditions/${run.id}/progress`, {
      revision: run.revision,
      action,
      defeat_boss: action === 'clear' && !!state?.floors[run.cleared_floor]?.boss,
      summary: action === 'finish' || action === 'cancel' ? summary : undefined,
    });
    setConfirm(null);
    setSummary('');
  }
  const runReward = (run: TowerRun) => {
    const reward = towerBaseReward(run.cleared_floor, run.bosses),
      content = state?.floors[run.cleared_floor - 1];
    return {
      ...reward,
      gold_cp: content?.base_gold_cp ?? reward.gold_cp,
      crystals: content?.base_crystals ?? reward.crystals,
    };
  };
  return (
    <section className="tower-page" aria-label={towerName}>
      <header className="tower-hero">
        <img
          className="tower-hero-art"
          src="/tower/tower-veil-v2.webp"
          alt="Uma torre de pedra fechada e monumental, com estátuas de guardiões junto a um lago sob nuvens."
          fetchPriority="high"
        />
        <div className="tower-hero-shade" />
        <div className="tower-hero-copy">
          <div className="tower-eyebrow">
            <span>EXPEDIÇÕES DA ALVORADA</span>
            <span className="tower-experimental">Experimental</span>
          </div>
          <h1>
            Torre <i>do Véu</i>
          </h1>
        </div>
        {character && (
          <div className="tower-wallet">
            <Diamond size={19} />
            <div>
              <b>{crystals.toLocaleString('pt-BR')}</b>
              <span>Cristais · {character.name}</span>
            </div>
          </div>
        )}
      </header>
      <div className="tower-body" id="tower-content">
        <nav className="tower-tabs" aria-label="Seções da torre">
          {(
            [
              ['atlas', 'A ascensão'],
              ['expeditions', 'Expedições'],
              ['treasures', 'Tesouros'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
              {label}
              {id === 'treasures' && pending > 0 && <em>{pending}</em>}
            </button>
          ))}
          <span>Uma saída. Muitos caminhos de volta.</span>
        </nav>
        {error && (
          <div className="tower-error" role="alert">
            {error}
            <button aria-label="Fechar aviso da torre" onClick={() => setError('')}>
              <X size={15} />
            </button>
          </div>
        )}
        {!state && !error && <p role="status">Abrindo o registro das expedições…</p>}
        {tab === 'atlas' && (
          <>
            <div className="tower-atlas tower-atlas-compact">
              <nav className="tower-floor-picker" aria-label="Escolher andar da torre">
                <label>
                  Andar
                  <select
                    aria-label="Escolher andar"
                    value={floor}
                    onChange={(e) => {
                      setFloor(Number(e.target.value));
                      setDraft(null);
                    }}
                  >
                    {(state?.floors || towerFloors).map((f) => (
                      <option key={f.number} value={f.number}>
                        {String(f.number).padStart(2, '0')} · {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  aria-label="Andar anterior"
                  disabled={floor === 1}
                  onClick={() => setFloor(floor - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  aria-label="Próximo andar"
                  disabled={floor === towerFloorCount}
                  onClick={() => setFloor(floor + 1)}
                >
                  <ChevronRight size={16} />
                </button>
                <span>
                  {towerFloorCount} andares · {zone.name}
                </span>
                {state?.can_create && (
                  <button
                    className="tower-edit-floor"
                    onClick={() => {
                      setError('');
                      setDraft({
                        ...level,
                        creatures: level.creatures?.map((c) => ({ ...c })) || [],
                      });
                    }}
                  >
                    <Pencil size={15} />
                    Editar andar
                  </button>
                )}
              </nav>
              <article className={'tower-floor ' + zone.theme}>
                <header className="tower-floor-heading">
                  <div>
                    <span className="tower-kicker">
                      {zone.name} ·{' '}
                      {zone.level === 'Definido pelo mestre'
                        ? 'Exploração a preparar'
                        : 'níveis sugeridos ' + zone.level}
                    </span>
                    <h2>{level.name}</h2>
                  </div>
                  <div className="tower-floor-number">
                    <small>ANDAR</small>
                    <b>{String(floor).padStart(2, '0')}</b>
                  </div>
                </header>
                <nav className="tower-floor-steps" aria-label="Andares desta região">
                  {(state?.floors || [])
                    .filter((f) => Math.floor((f.number - 1) / 5) === zoneIndex)
                    .map((f) => (
                      <button
                        key={f.number}
                        aria-pressed={floor === f.number}
                        onClick={() => setFloor(f.number)}
                        aria-label={'Andar ' + f.number + ' · ' + f.name}
                      >
                        {f.boss ? (
                          <Crown size={16} />
                        ) : (
                          <span>{String(f.number).padStart(2, '0')}</span>
                        )}
                        <small>{f.boss ? 'Guardião' : 'Andar'}</small>
                      </button>
                    ))}
                </nav>
                {level.description && (
                  <p className="tower-floor-description">{level.description}</p>
                )}
                {level.discovery === 'hidden' ? (
                  <div className="tower-hidden">
                    <Lock size={28} />
                    <div>
                      <h3>Andar ainda não descoberto</h3>
                      <p>
                        Criaturas, armadilhas e desafios serão revelados depois que seu personagem
                        ou uma expedição da guilda concluir este andar.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="tower-discovery">
                      {level.discovery === 'master'
                        ? 'Visão do administrador · conteúdo preparado para a sessão'
                        : level.discovery === 'personal'
                          ? 'Descoberto pelo seu personagem'
                          : 'Descoberto pela guilda'}
                    </div>
                    {level.boss && (
                      <div className="tower-boss">
                        <Crown size={36} />
                        <div>
                          <span className="tower-kicker">GUARDIÃO DO ANDAR {floor}</span>
                          <h3>{level.boss_name || 'Guardião a definir pelo mestre'}</h3>
                          <p>Vencer este guardião eleva a tabela de tesouros.</p>
                        </div>
                      </div>
                    )}
                    <div className="tower-creatures">
                      <span className="tower-kicker">CRIATURAS DESTE ANDAR</span>
                      <div>
                        {level.creatures?.map((creature, i) => (
                          <figure key={i}>
                            {creature.art && monsterArt('', creature.art) ? (
                              <img src={monsterArt('', creature.art)} alt="" loading="lazy" />
                            ) : (
                              <Shield size={35} />
                            )}
                            <figcaption>{creature.name}</figcaption>
                          </figure>
                        ))}
                      </div>
                      {!level.creatures?.length && (
                        <p>
                          {state?.can_create
                            ? 'Adicione as criaturas em Editar andar.'
                            : 'Nenhuma criatura registrada neste andar.'}
                        </p>
                      )}
                    </div>
                    <div className="tower-challenges">
                      <div>
                        <Swords size={18} />
                        <h3>O desafio</h3>
                        <p>{level.challenge || 'A definir pelo mestre.'}</p>
                      </div>
                      <div>
                        <Wind size={18} />
                        <h3>O ambiente</h3>
                        <p>{level.hazard || 'A definir pelo mestre.'}</p>
                      </div>
                      {level.traps && (
                        <div className="tower-traps">
                          <Flag size={18} />
                          <h3>Armadilhas</h3>
                          <p>{level.traps}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <footer className="tower-floor-reward">
                  <span>Ao concluir até este andar</span>
                  <b>
                    <Coins size={17} />
                    {money(base.gold_cp)} PO
                  </b>
                  <b>
                    <Diamond size={17} />
                    {base.crystals} cristais
                  </b>
                  <small>+ um tesouro no d100</small>
                </footer>
              </article>
            </div>
            <section className="tower-loot-preview">
              <header>
                <div>
                  <span className="tower-kicker">O QUE ESPERA NA VOLTA</span>
                  <h2>O destino favorece quem sobe.</h2>
                  <p>
                    Prévia do tesouro ao concluir o andar {floor}
                    {base.tier
                      ? ` e vencer ${base.tier} ${base.tier > 1 ? 'guardiões' : 'guardião'}`
                      : ''}
                    . Ouro e cristais abaixo são adicionais à recompensa da expedição.
                  </p>
                </div>
                <div className="tower-treasure-tier">
                  <Dices size={26} />
                  <span>
                    GRAU <b>{base.tier}</b>
                  </span>
                </div>
                {state?.can_create && rewardTable && (
                  <button
                    onClick={() => {
                      setError('');
                      setRewardDraft(rewardTable);
                    }}
                  >
                    <Pencil size={15} />
                    Editar prêmios
                  </button>
                )}
              </header>
              <div className="tower-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>d100</th>
                      <th>Tesouro</th>
                      <th>Ouro extra</th>
                      <th>Cristais extras</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loot.map((r, i) => (
                      <tr key={r.min} data-rarity={i}>
                        <td>
                          {r.min}–{r.max}
                        </td>
                        <td>
                          <small>{r.rarity}</small>
                          <b>{r.relic}</b>
                          {r.item_id && catalog.find((item) => item.id === r.item_id) && (
                            <button
                              className="tower-item-link"
                              onClick={() =>
                                setItemPreview(catalog.find((item) => item.id === r.item_id)!)
                              }
                            >
                              {catalog.find((item) => item.id === r.item_id)!.name} × {r.quantity}
                            </button>
                          )}
                        </td>
                        <td>{money(r.gold_cp)} PO</td>
                        <td>
                          <Diamond size={13} />
                          {r.crystals}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
        {tab === 'expeditions' && (
          <section className="tower-expeditions">
            <header className="tower-section-heading">
              <div>
                <span className="tower-kicker">NINGUÉM PRECISA SUBIR SOZINHO</span>
                <h2>Reúna a expedição.</h2>
                <p>
                  Entre com seu personagem. O mestre inicia a subida e confirma cada andar vencido.
                </p>
              </div>
              {state?.can_create && (
                <button className="tower-primary" onClick={() => setCreateOpen(!createOpen)}>
                  <Plus size={16} />
                  Nova expedição
                </button>
              )}
            </header>
            {createOpen && (
              <form
                className="tower-create"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    const r = await post<{ id: string }>('/tower/expeditions', { name });
                    setRunId(r.id);
                    setName('');
                    setCreateOpen(false);
                  });
                }}
              >
                <label>
                  Nome da expedição
                  <input
                    aria-label="Nome da expedição"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={3}
                    maxLength={80}
                    placeholder="Os que voltam com a aurora"
                    autoFocus
                  />
                </label>
                <button className="tower-primary" disabled={busy}>
                  Abrir expedição
                </button>
                <button type="button" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </button>
              </form>
            )}
            {!state?.expeditions.length ? (
              <div className="tower-empty">
                <Flag size={35} />
                <h3>A primeira subida ainda será escrita.</h3>
                <p>
                  Um mestre pode abrir uma expedição. Depois, cada jogador reúne seu personagem
                  aqui.
                </p>
              </div>
            ) : (
              <div className="tower-runs-layout">
                <aside className="tower-runs" aria-label="Lista de expedições">
                  {state.expeditions.map((r) => (
                    <button
                      key={r.id}
                      aria-pressed={currentRun?.id === r.id}
                      onClick={() => setRunId(r.id)}
                    >
                      <small>{statusNames[r.status]}</small>
                      <b>{r.name}</b>
                      <span>
                        <Users size={13} />
                        {r.members.length}/8{' '}
                        <span>
                          {r.cleared_floor ? 'Andar ' + r.cleared_floor : date(r.created_at)}
                        </span>
                      </span>
                    </button>
                  ))}
                </aside>
                {currentRun && (
                  <article className="tower-run-detail">
                    <header>
                      <div>
                        <span className="tower-kicker">{statusNames[currentRun.status]}</span>
                        <h2>{currentRun.name}</h2>
                      </div>
                      <Shield size={27} />
                    </header>
                    <div className="tower-run-progress">
                      <b>{String(currentRun.cleared_floor).padStart(2, '0')}</b>
                      <span>
                        andares vencidos
                        <small>
                          {currentRun.bosses.length}{' '}
                          {currentRun.bosses.length === 1 ? 'guardião' : 'guardiões'} · tesouro grau{' '}
                          {currentRun.bosses.length}
                        </small>
                      </span>
                      <div className="tower-progress-track">
                        <i
                          style={{
                            width: (currentRun.cleared_floor / towerFloorCount) * 100 + '%',
                          }}
                        />
                      </div>
                    </div>
                    <div className="tower-party">
                      <h3>A companhia</h3>
                      {!currentRun.members.length && (
                        <p>As portas aguardam o primeiro aventureiro.</p>
                      )}
                      {currentRun.members.map((m) => (
                        <div key={m.character_id}>
                          {m.image ? <img src={m.image} alt="" /> : <Shield size={26} />}
                          <span>
                            <b>{m.name}</b>
                            <small>
                              Nível {m.level}
                              {m.mine ? ' · seu personagem' : ''}
                            </small>
                          </span>
                          {m.mine && currentRun.status === 'preparing' && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void act(() =>
                                  post(`/tower/expeditions/${currentRun.id}/leave`, {
                                    character_id: m.character_id,
                                  }),
                                )
                              }
                            >
                              Sair
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {currentRun.status === 'preparing' && (
                      <div className="tower-join">
                        <span>Escolha quem vai subir</span>
                        <div>
                          {characters
                            .filter((c) => !currentRun.members.some((m) => m.character_id === c.id))
                            .map((c) => (
                              <button
                                disabled={busy || currentRun.members.length >= 8}
                                key={c.id}
                                onClick={() =>
                                  void act(() =>
                                    post(`/tower/expeditions/${currentRun.id}/join`, {
                                      character_id: c.id,
                                    }),
                                  )
                                }
                              >
                                <Plus size={13} />
                                {c.name}
                              </button>
                            ))}
                        </div>
                        {!characters.length && <p>Crie seu personagem para participar.</p>}
                      </div>
                    )}
                    {currentRun.status === 'active' &&
                      currentRun.cleared_floor < towerFloorCount && (
                        <div className="tower-next">
                          <span className="tower-kicker">O PRÓXIMO DESAFIO</span>
                          <h3>
                            {state?.floors[currentRun.cleared_floor]?.name ||
                              'Andar ' + (currentRun.cleared_floor + 1)}
                          </h3>
                          <p>
                            Andar {currentRun.cleared_floor + 1} ·{' '}
                            {towerZones[towerFloors[currentRun.cleared_floor].zone].name}
                          </p>
                        </div>
                      )}
                    {currentRun.summary && (
                      <p className="tower-run-summary">{currentRun.summary}</p>
                    )}
                    {currentRun.status === 'completed' && (
                      <div className="tower-return">
                        <Check size={18} />
                        <p>
                          A recompensa da expedição já foi entregue. Abra Tesouros para rolar o d100
                          e revelar sua relíquia.
                        </p>
                        <button onClick={() => setTab('treasures')}>
                          Abrir tesouros <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                    {currentRun.can_manage &&
                      ['active', 'preparing'].includes(currentRun.status) && (
                        <div className="tower-master-controls">
                          <span className="tower-kicker">CONTROLES DO MESTRE</span>
                          <div>
                            {currentRun.status === 'preparing' ? (
                              <button
                                className="tower-primary"
                                disabled={busy || !currentRun.members.length}
                                onClick={() => void act(() => progress(currentRun, 'start'))}
                              >
                                Iniciar ascensão <ArrowUpRight size={15} />
                              </button>
                            ) : (
                              <>
                                <button
                                  className="tower-primary"
                                  disabled={busy || currentRun.cleared_floor >= towerFloorCount}
                                  onClick={() => setConfirm({ run: currentRun, action: 'clear' })}
                                >
                                  {state?.floors[currentRun.cleared_floor]?.boss ? (
                                    <Crown size={15} />
                                  ) : (
                                    <Check size={15} />
                                  )}{' '}
                                  {state?.floors[currentRun.cleared_floor]?.boss
                                    ? 'Confirmar derrota do guardião'
                                    : 'Concluir andar ' + (currentRun.cleared_floor + 1)}
                                </button>
                                <button
                                  disabled={busy || currentRun.cleared_floor === 0}
                                  onClick={() => setConfirm({ run: currentRun, action: 'finish' })}
                                >
                                  Retornar e recompensar
                                </button>
                              </>
                            )}
                            <button
                              disabled={busy}
                              onClick={() => setConfirm({ run: currentRun, action: 'cancel' })}
                            >
                              Encerrar sem recompensa
                            </button>
                          </div>
                        </div>
                      )}
                  </article>
                )}
              </div>
            )}
          </section>
        )}
        {tab === 'treasures' && (
          <section className="tower-treasures">
            <header className="tower-section-heading">
              <div>
                <span className="tower-kicker">O QUE A TORRE DEIXOU COM VOCÊ</span>
                <h2>Tesouros de {character?.name || 'sua jornada'}.</h2>
                <p>
                  Cada expedição concluída dá uma rolagem. Guardiões vencidos elevam o grau do
                  tesouro.
                </p>
              </div>
              <span className="tower-crystal-total">
                <Diamond size={22} />
                <b>{crystals}</b> cristais
              </span>
            </header>
            {!myClaims.length ? (
              <div className="tower-empty">
                <Dices size={35} />
                <h3>Sua história ainda não tem um tesouro.</h3>
                <p>Conclua uma expedição para receber ouro, cristais e uma chance no d100.</p>
                <button onClick={() => setTab('expeditions')}>
                  Ver expedições <ArrowUpRight size={15} />
                </button>
              </div>
            ) : (
              <div className="tower-claim-grid">
                {myClaims.map((c) => (
                  <article
                    className={
                      'tower-claim ' +
                      (c.roll !== null ? 'revealed' : 'sealed') +
                      (lastRoll === c.run_id ? ' just-revealed' : '')
                    }
                    key={c.run_id}
                    data-rarity={c.rarity}
                  >
                    <div className="tower-claim-top">
                      <span>
                        GRAU {c.tier} · ANDAR {c.floor}
                      </span>
                      <small>{c.expedition}</small>
                    </div>
                    <div
                      className="tower-d100"
                      aria-label={
                        c.roll === null ? 'Tesouro fechado' : 'Resultado do d100: ' + c.roll
                      }
                    >
                      {c.roll === null ? <Dices size={42} /> : <b>{c.roll}</b>}
                    </div>
                    {c.roll === null ? (
                      <>
                        <h3>O véu ainda guarda seu prêmio.</h3>
                        <p>Uma relíquia, ouro e cristais adicionais esperam pela sua rolagem.</p>
                        <button
                          className="tower-primary"
                          disabled={busy}
                          onClick={() =>
                            void act(async () => {
                              await post(`/tower/expeditions/${c.run_id}/treasure`, {
                                character_id: c.character_id,
                              });
                              setLastRoll(c.run_id);
                            }, true)
                          }
                        >
                          <Dices size={16} />
                          {busy ? 'Abrindo o tesouro…' : 'Rolar d100 e revelar'}
                        </button>
                      </>
                    ) : (
                      <div className="tower-roll-result" role="status">
                        <span>{c.rarity}</span>
                        <h3>{c.relic}</h3>
                        {c.item && (
                          <button
                            className="tower-item-link"
                            onClick={() => setItemPreview(c.item!)}
                          >
                            {c.item.name} × {c.item_quantity}
                          </button>
                        )}
                        <p>Relíquia de coleção da Torre do Véu.</p>
                        <div>
                          <b>
                            <Coins size={15} />+{money(c.bonus_gold_cp)} PO
                          </b>
                          <b>
                            <Diamond size={15} />+{c.bonus_crystals} cristais
                          </b>
                        </div>
                      </div>
                    )}
                    <footer>
                      <span>
                        Expedição: {money(c.base_gold_cp)} PO + {c.base_crystals} cristais
                      </span>
                      <small>
                        {c.roll !== null
                          ? 'Tesouro entregue em ' + date(c.rolled_at!)
                          : 'Recompensa da expedição já recebida'}
                      </small>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        <details className="tower-guide">
          <summary>Como funciona a Torre do Véu?</summary>
          <div>
            <p>
              O mestre abre a expedição; os jogadores entram com seus próprios personagens, até oito
              por grupo. Cada personagem participa de uma subida de cada vez. O mestre inicia a
              ascensão e confirma os andares em sequência. Os andares com guardião são definidos
              pelo administrador e exigem confirmação de derrota.
            </p>
            <p>
              Ao retornar após ao menos um andar concluído, cada participante recebe ouro e cristais
              pelo progresso confirmado. O jogador revela um tesouro com um d100. O grau depende dos
              guardiões vencidos; o administrador configura as faixas, nomes e valores em Editar
              prêmios. Ouro e cristais do tesouro são adicionais. Itens vinculados são entregues ao
              inventário; clique no nome para ver imagem e informações. A tabela fica registrada no
              retorno da expedição, preservando o prêmio conquistado.
            </p>
            <p>
              Cristais são a moeda da torre; o saldo e as relíquias ficam nesta página. As relíquias
              são de coleção. A expedição não soma missões para patente. Criaturas, encontros e
              desafios são conduzidos pelo mestre durante a sessão. Esta é a primeira versão
              experimental, com 100 andares. Administradores preparam informações, criaturas e
              armadilhas em Editar andar. Nome e descrição são públicos; os encontros, desafios e
              armadilhas são revelados somente após a conclusão pelo personagem ou pela guilda.
            </p>
          </div>
        </details>
      </div>
      {confirm && (
        <TowerDialog
          label="Confirmar progresso da torre"
          close={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <button
            aria-label="Fechar confirmação"
            className="tower-confirm-close"
            disabled={busy}
            onClick={() => setConfirm(null)}
          >
            <X size={17} />
          </button>
          <span className="tower-kicker">DECISÃO DO MESTRE</span>
          <h2>
            {confirm.action === 'clear'
              ? state?.floors[confirm.run.cleared_floor]?.boss
                ? 'O guardião foi derrotado?'
                : 'O andar foi vencido?'
              : confirm.action === 'finish'
                ? 'Hora de voltar à Alvorada.'
                : 'Encerrar esta subida?'}
          </h2>
          <p>
            {confirm.action === 'clear'
              ? `Confirme o resultado do grupo no andar ${confirm.run.cleared_floor + 1}. ${state?.floors[confirm.run.cleared_floor]?.boss ? 'A tabela de tesouros evoluirá.' : ''}`
              : confirm.action === 'finish'
                ? `${confirm.run.members.length} participantes receberão ${money(runReward(confirm.run).gold_cp)} PO e ${runReward(confirm.run).crystals} cristais cada, além da rolagem de tesouro.`
                : 'A expedição será encerrada sem entregar ouro, cristais ou tesouros.'}
          </p>
          {confirm.action !== 'clear' && (
            <label>
              Registro da expedição
              <textarea
                aria-label="Registro da expedição"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={1500}
                rows={3}
                placeholder="O que o grupo encontrou no caminho?"
              />
            </label>
          )}
          {error && <p role="alert">{error}</p>}
          <div>
            <button
              disabled={busy}
              className="tower-primary"
              onClick={() =>
                void act(() => progress(confirm.run, confirm.action), confirm.action === 'finish')
              }
            >
              {busy
                ? 'Registrando…'
                : confirm.action === 'finish'
                  ? 'Confirmar retorno e entregar'
                  : 'Confirmar'}
            </button>
            <button disabled={busy} onClick={() => setConfirm(null)}>
              Voltar
            </button>
          </div>
        </TowerDialog>
      )}
      {draft && (
        <TowerFloorEditor
          initial={draft}
          busy={busy}
          error={error}
          close={() => {
            if (!busy) setDraft(null);
          }}
          save={(value) =>
            void act(async () => {
              await post('/tower/floors/' + value.number, {
                revision: value.revision,
                name: value.name,
                description: value.description,
                challenge: value.challenge || '',
                hazard: value.hazard || '',
                traps: value.traps || '',
                creatures: value.creatures || [],
                boss: value.boss,
                boss_name: value.boss_name || '',
                base_gold_cp: value.base_gold_cp,
                base_crystals: value.base_crystals,
              });
              setDraft(null);
            })
          }
        />
      )}
      {rewardDraft && (
        <TowerRewardEditor
          initial={rewardDraft}
          catalog={catalog}
          busy={busy}
          error={error}
          close={() => {
            if (!busy) setRewardDraft(null);
          }}
          save={(value) =>
            void act(async () => {
              await post('/tower/rewards/' + value.tier, {
                revision: value.revision,
                rows: value.rows,
              });
              setRewardDraft(null);
            })
          }
        />
      )}
      {itemPreview && <TowerItemPreview item={itemPreview} close={() => setItemPreview(null)} />}
    </section>
  );
}
