import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  towerFloors,
  towerZones,
  towerLootTable,
  towerBaseReward,
  type TowerRun,
  type TowerState,
} from '../shared/tower';
import type { Character } from './types';
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
  character,
  refreshCharacters,
}: {
  characters: Character[];
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
    [lastRoll, setLastRoll] = useState<string | null>(null);
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
  const level = towerFloors[floor - 1],
    zone = towerZones[level.zone],
    bosses = towerFloors.filter((f) => f.boss && f.number <= floor).map((f) => f.number),
    base = towerBaseReward(floor, bosses),
    loot = towerLootTable(base.tier);
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
      defeat_boss: action === 'clear' && (run.cleared_floor + 1) % 5 === 0,
      summary: action === 'finish' || action === 'cancel' ? summary : undefined,
    });
    setConfirm(null);
    setSummary('');
  }
  return (
    <section className="tower-page" aria-label={towerName}>
      <header className="tower-hero">
        <img
          className="tower-hero-art"
          src="/tower/tower-veil-v1.webp"
          alt="Uma torre colossal com cavernas de cristal, jardins, forjas e terraços gelados acima das ruínas."
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
          <p>
            Trinta andares entre você
            <br />e a última luz.
          </p>
          <button
            className="tower-primary"
            onClick={() => {
              setTab('expeditions');
              document.getElementById('tower-content')?.scrollIntoView({
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                  ? 'auto'
                  : 'smooth',
              });
            }}
          >
            Preparar a ascensão <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="tower-hero-metrics">
          <span>
            <b>30</b>andares
          </span>
          <span>
            <b>06</b>guardiões
          </span>
          <span>
            <b>d100</b>tesouros
          </span>
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
            <div className="tower-atlas">
              <aside className="tower-route" aria-label="Regiões da torre">
                <span className="tower-kicker">ESCOLHA SEU DESTINO</span>
                {towerZones.map((z, i) => (
                  <button
                    key={z.theme}
                    className={'tower-zone ' + z.theme}
                    aria-pressed={level.zone === i}
                    onClick={() => setFloor(i * 5 + 1)}
                  >
                    <span className="tower-zone-index">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <small>
                        Andares {i * 5 + 1}–{i * 5 + 5}
                      </small>
                      <b>{z.name}</b>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                ))}
                <p>
                  O perigo cresce a cada região.
                  <br />
                  Escolha até onde ousa ir.
                </p>
              </aside>
              <article className={'tower-floor ' + zone.theme}>
                <header className="tower-floor-heading">
                  <div>
                    <span className="tower-kicker">
                      {zone.name} · níveis sugeridos {zone.level}
                    </span>
                    <h2>{level.name}</h2>
                  </div>
                  <div className="tower-floor-number">
                    <small>ANDAR</small>
                    <b>{String(floor).padStart(2, '0')}</b>
                  </div>
                </header>
                <nav className="tower-floor-steps" aria-label="Andares desta região">
                  {towerFloors
                    .filter((f) => f.zone === level.zone)
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
                <p className="tower-floor-description">{zone.description}</p>
                {level.boss ? (
                  <div className="tower-boss">
                    <img src={monsterArt('', zone.bossArt)} alt="" />
                    <div>
                      <span className="tower-kicker">GUARDIÃO DO ANDAR {floor}</span>
                      <h3>{zone.boss}</h3>
                      <p>
                        Vencer este guardião abre a região seguinte e eleva a tabela de tesouros.
                      </p>
                      <span className="tower-boss-tier">
                        <Crown size={14} /> Tesouro de grau {base.tier}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="tower-creatures">
                    <span className="tower-kicker">CRIATURAS NESTA REGIÃO</span>
                    <div>
                      {zone.creatures.map((creature) => (
                        <figure key={creature}>
                          <img src={monsterArt('', creature)} alt="" loading="lazy" />
                          <figcaption>{creature}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
                <div className="tower-challenges">
                  <div>
                    <Swords size={18} />
                    <h3>O desafio</h3>
                    <p>{zone.challenge}</p>
                  </div>
                  <div>
                    <Wind size={18} />
                    <h3>O ambiente</h3>
                    <p>{zone.hazard}</p>
                  </div>
                </div>
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
                        <i style={{ width: (currentRun.cleared_floor / 30) * 100 + '%' }} />
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
                    {currentRun.status === 'active' && currentRun.cleared_floor < 30 && (
                      <div className="tower-next">
                        <span className="tower-kicker">O PRÓXIMO DESAFIO</span>
                        <h3>{towerFloors[currentRun.cleared_floor].name}</h3>
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
                                  disabled={busy || currentRun.cleared_floor >= 30}
                                  onClick={() => setConfirm({ run: currentRun, action: 'clear' })}
                                >
                                  {(currentRun.cleared_floor + 1) % 5 === 0 ? (
                                    <Crown size={15} />
                                  ) : (
                                    <Check size={15} />
                                  )}{' '}
                                  {(currentRun.cleared_floor + 1) % 5 === 0
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
              ascensão e confirma os andares em sequência; a cada cinco, um guardião precisa ser
              derrotado.
            </p>
            <p>
              Ao retornar após ao menos um andar concluído, cada participante recebe ouro e cristais
              pelo progresso confirmado. O jogador revela um tesouro com um d100. O grau depende dos
              guardiões vencidos; as faixas de raridade são 1–50, 51–75, 76–90, 91–98 e 99–100. Ouro
              e cristais do tesouro são adicionais.
            </p>
            <p>
              Cristais são a moeda da torre; o saldo e as relíquias ficam nesta página. As relíquias
              são de coleção. A expedição não soma missões para patente. Criaturas, encontros e
              desafios são conduzidos pelo mestre durante a sessão. Esta é a primeira versão
              experimental, com 30 andares.
            </p>
          </div>
        </details>
      </div>
      {confirm && (
        <TowerConfirmation
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
              ? (confirm.run.cleared_floor + 1) % 5 === 0
                ? 'O guardião foi derrotado?'
                : 'O andar foi vencido?'
              : confirm.action === 'finish'
                ? 'Hora de voltar à Alvorada.'
                : 'Encerrar esta subida?'}
          </h2>
          <p>
            {confirm.action === 'clear'
              ? `Confirme o resultado do grupo no andar ${confirm.run.cleared_floor + 1}. ${(confirm.run.cleared_floor + 1) % 5 === 0 ? 'A tabela de tesouros evoluirá.' : ''}`
              : confirm.action === 'finish'
                ? `${confirm.run.members.length} participantes receberão ${money(towerBaseReward(confirm.run.cleared_floor, confirm.run.bosses).gold_cp)} PO e ${towerBaseReward(confirm.run.cleared_floor, confirm.run.bosses).crystals} cristais cada, além da rolagem de tesouro.`
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
        </TowerConfirmation>
      )}
    </section>
  );
}
function TowerConfirmation({ children, close }: { children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="tower-confirm"
      aria-label="Confirmar progresso da torre"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {children}
    </dialog>
  );
}
