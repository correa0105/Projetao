import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Clock3, Dices, LockKeyhole } from 'lucide-react';
import { api, post } from './api';
import { professions, professionMaterials, materialItemId } from '../shared/professions';
import { professionItemArtwork } from '../shared/profession-art';
import {
  defaultProfessionLootTables,
  professionLootMaterials,
  professionMaterialLevel,
  professionLootTiers,
  professionLootTable,
  materialProbabilities,
  materialChanceLimit,
  type MaterialRewardState,
  type MaterialReward,
  type ProfessionLootTable,
} from '../shared/profession-loot';
import './vtt-profession-rewards.css';
const materialName = (id: string) =>
  professionMaterials.find((r) => materialItemId(r[0]) === id)?.[1] ?? id;
export function VttMaterialPresence({ roomId, active }: { roomId: string; active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const ping = () =>
      void post('/vtt/rooms/' + roomId + '/material-rewards/presence', {}).catch(() => {});
    ping();
    const timer = setInterval(ping, 30000);
    return () => clearInterval(timer);
  }, [roomId, active]);
  return null;
}
function RollResults({ run }: { run: MaterialReward }) {
  return (
    <div className="vtt-material-results">
      {run.roster.map((player) => {
        const roll = run.rolls.find((r) => r.player_id === player.id);
        return (
          <div className="vtt-material-result" key={player.id}>
            <div className={'vtt-material-die ' + (roll ? 'has-result' : '')}>
              {roll ? String(roll.value).padStart(2, '0') : <Clock3 size={18} />}
            </div>
            <div>
              <strong>{player.name}</strong>
              <span>
                {roll
                  ? roll.item_id
                    ? `${roll.quantity} × ${materialName(roll.item_id)}`
                    : 'Nenhum material encontrado'
                  : 'D100 ainda não utilizado'}
              </span>
              <small>
                {roll
                  ? roll.granted_at
                    ? 'Entregue na conclusão'
                    : 'Aguardando o registro de conclusão'
                  : 'Uma tentativa disponível'}
              </small>
            </div>
            {roll?.item_id && <img src={professionItemArtwork(roll.item_id)} alt="" />}
          </div>
        );
      })}
    </div>
  );
}
export function VttProfessionRewards({
  roomId,
  readOnly = false,
}: {
  roomId: string;
  readOnly?: boolean;
}) {
  const [state, setState] = useState<MaterialRewardState | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [mission, setMission] = useState(''),
    [title, setTitle] = useState(''),
    [characters, setCharacters] = useState<string[]>([]),
    [tables, setTables] = useState<ProfessionLootTable[]>(defaultProfessionLootTables),
    [editProfession, setEditProfession] = useState('smithing'),
    [editLevel, setEditLevel] = useState(1);
  const [player, setPlayer] = useState(''),
    [character, setCharacter] = useState(''),
    [profession, setProfession] = useState('smithing'),
    [summary, setSummary] = useState('');
  const alive = useRef(true),
    locked = useRef(false),
    keys = useRef(new Map<string, string>()),
    generation = useRef(0);
  const base = '/vtt/rooms/' + roomId + '/material-rewards';
  async function refresh() {
    const gen = ++generation.current;
    const data = await api<MaterialRewardState>(base);
    if (alive.current && gen === generation.current) setState(data);
    return data;
  }
  useEffect(() => {
    alive.current = true;
    void refresh().catch((e) => {
      if (alive.current) setError(e.message);
    });
    const timer = setInterval(() => {
      if (!locked.current) void refresh().catch(() => {});
    }, 5000);
    return () => {
      alive.current = false;
      ++generation.current;
      clearInterval(timer);
    };
  }, [roomId]);
  function key(operation: string) {
    let id = keys.current.get(operation);
    if (!id) {
      id = crypto.randomUUID();
      keys.current.set(operation, id);
    }
    return id;
  }
  async function action(
    operation: string,
    path: string,
    payload: Record<string, unknown>,
    message: string,
  ) {
    if (locked.current || readOnly) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await post(path, payload);
      keys.current.delete(operation);
      await refresh();
      if (alive.current) setNotice(message);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
      await refresh().catch(() => {});
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (!state) return <p role="status">{error || 'Abrindo as recompensas da aventura…'}</p>;
  const run = state.current,
    isGM = state.is_gm && !readOnly;
  const selectedMission = state.missions.find((m) => m.id === mission);
  const selectedRoster =
    selectedMission?.roster ??
    state.registered
      .map((p) => ({ ...p, characters: p.characters.filter((c) => characters.includes(c.id)) }))
      .filter((p) => p.characters.length);
  const editTable = tables.find(
    (t) => t.profession_id === editProfession && t.min_level === editLevel,
  );
  const validTables =
    tables.length > 0 &&
    tables.every(
      (t) => t.entries.length > 0 && t.entries.reduce((sum, e) => sum + e.chance, 0) <= 90,
    );
  const total = editTable?.entries.reduce((sum, e) => sum + e.chance, 0) ?? 0;
  const target = run
    ? isGM
      ? (run.roster.find((p) => p.id === player) ??
        run.roster.find((p) => !run.rolls.some((r) => r.player_id === p.id)) ??
        run.roster[0])
      : run.roster.find((p) => p.id === state.user_id)
    : undefined;
  const chosenCharacter =
    target?.characters.find((c) => c.id === character) ?? target?.characters[0];
  const availableTables = (chosenCharacter?.professions ?? []).flatMap((p) => {
    const table = run && professionLootTable(run.tables, p.id, p.level);
    return table ? [{ ...table, character_level: p.level }] : [];
  });
  const chosenTable =
    availableTables.find((t) => t.profession_id === profession) ?? availableTables[0];
  const already = target && run?.rolls.find((r) => r.player_id === target.id);
  function updateChance(item_id: string, field: 'chance' | 'quantity', value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 100) return;
    setTables((rows) =>
      rows.map((t) => {
        if (t.profession_id !== editProfession || t.min_level !== editLevel) return t;
        const entries = t.entries.filter((e) => e.item_id !== item_id);
        const current = t.entries.find((e) => e.item_id === item_id) ?? {
          item_id,
          chance: 0,
          quantity: 1,
        };
        const next = { ...current, [field]: value };
        if (next.chance > 0 && next.quantity > 0) entries.push(next);
        return { ...t, entries };
      }),
    );
    keys.current.clear();
  }
  return (
    <section className="vtt-material-rewards" aria-label="Materiais da aventura">
      <div className="vtt-material-intro">
        <img src="/shop/expanded/gaming-dice.webp" alt="" />
        <div>
          <span className="pf-kicker">RECOMPENSAS DE OFÍCIO</span>
          <h3>O que a aventura trouxe?</h3>
        </div>
      </div>
      <p className="vtt-muted">
        Um d100 por jogador inscrito. Os materiais são reservados até o mestre registrar a conclusão
        da mesa.
      </p>
      {error && (
        <p className="vtt-material-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="vtt-material-notice" role="status">
          {notice}
        </p>
      )}
      {run ? (
        <>
          <div className="vtt-material-run">
            <span className="pf-kicker">
              {run.mission_id ? 'MISSÃO VINCULADA' : 'MESA TEMÁTICA'}
            </span>
            <h3>{run.title}</h3>
            <strong>
              {run.rolls.length} de {run.roster.length} d100 utilizados
            </strong>
            <progress
              max={run.roster.length}
              value={run.rolls.length}
              aria-label="Rolagens dos inscritos"
            />
          </div>
          {target ? (
            <div className="vtt-material-roll-form">
              {isGM && (
                <label>
                  Jogador inscrito
                  <select
                    aria-label="Jogador inscrito"
                    value={target.id}
                    disabled={busy}
                    onChange={(e) => {
                      setPlayer(e.target.value);
                      setCharacter('');
                    }}
                  >
                    {run.roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {run.rolls.some((r) => r.player_id === p.id) ? ' · já rolou' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {already ? (
                <div className="vtt-material-used">
                  <LockKeyhole size={15} />
                  Este jogador já usou seu único d100, independentemente do resultado.
                </div>
              ) : chosenTable ? (
                <>
                  <label>
                    Personagem que receberá
                    <select
                      disabled={busy || readOnly}
                      value={chosenCharacter?.id ?? ''}
                      onChange={(e) => setCharacter(e.target.value)}
                    >
                      {target.characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Materiais de qual profissão?
                    <select
                      disabled={busy || readOnly}
                      value={chosenTable.profession_id}
                      onChange={(e) => setProfession(e.target.value)}
                    >
                      {availableTables.map((t) => (
                        <option key={t.profession_id} value={t.profession_id}>
                          {professions.find((p) => p.id === t.profession_id)?.name} · Nível{' '}
                          {t.character_level}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="vtt-material-chances">
                    <strong>Chances deste d100</strong>
                    {materialProbabilities(chosenTable.entries).map((e, i) => (
                      <div key={i} className={e.item_id ? '' : 'vtt-material-empty-chance'}>
                        {e.item_id && <img src={professionItemArtwork(e.item_id)} alt="" />}
                        <span>
                          {e.item_id
                            ? `${e.quantity} × ${materialName(e.item_id)}${e.multiplier === 2 ? ' · bônus ×2' : ''}`
                            : 'Nenhum material'}
                          <small>
                            D100 {e.from}–{e.to}
                          </small>
                        </span>
                        <b>{e.chance}%</b>
                      </div>
                    ))}
                    <small>
                      Somente materiais liberados até o nível {chosenTable.character_level}.
                      Resultados 91–100 dão o dobro do material sorteado.
                    </small>
                  </div>
                  <button
                    className="vtt-material-roll-button"
                    disabled={busy || readOnly || !chosenCharacter}
                    onClick={() => {
                      const op =
                        'roll:' +
                        run.id +
                        ':' +
                        target.id +
                        ':' +
                        chosenCharacter?.id +
                        ':' +
                        chosenTable.profession_id;
                      void action(
                        op,
                        base + '/' + run.id + '/roll',
                        {
                          request_id: key(op),
                          player_id: target.id,
                          character_id: chosenCharacter?.id,
                          profession_id: chosenTable.profession_id,
                        },
                        'D100 registrado. A entrega aguarda a conclusão da mesa.',
                      );
                    }}
                  >
                    <Dices size={18} />
                    {busy
                      ? 'Registrando…'
                      : target.id === state.user_id
                        ? 'Rolar meu único d100'
                        : 'Rolar pelo jogador ausente'}
                  </button>
                  {isGM && target.id !== state.user_id && (
                    <small>
                      O mestre usa a tentativa do jogador ausente; não cria uma rolagem adicional.
                    </small>
                  )}
                </>
              ) : (
                <div className="vtt-material-no-profession">
                  <p>
                    Este personagem não tem uma profissão habilitada para as tabelas desta aventura.
                    A tentativa pode ser registrada sem receber materiais.
                  </p>
                  {target.characters.length > 1 && (
                    <label>
                      Personagem
                      <select
                        value={chosenCharacter?.id ?? ''}
                        onChange={(e) => setCharacter(e.target.value)}
                      >
                        {target.characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    disabled={busy || readOnly || !chosenCharacter}
                    onClick={() => {
                      const op = 'no-profession:' + run.id + ':' + target.id;
                      void action(
                        op,
                        base + '/' + run.id + '/roll',
                        {
                          request_id: key(op),
                          player_id: target.id,
                          character_id: chosenCharacter?.id,
                          profession_id: 'no-profession',
                        },
                        'Tentativa registrada sem materiais elegíveis.',
                      );
                    }}
                  >
                    <Dices size={16} />
                    {target.id === state.user_id
                      ? 'Registrar meu d100 sem materiais'
                      : 'Rolar pelo inscrito ausente, sem materiais'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="vtt-muted">
              Você pode acompanhar os resultados. Somente os inscritos têm um d100 disponível.
            </p>
          )}
          <RollResults run={run} />
          {isGM && (
            <form
              className="vtt-material-conclusion"
              onSubmit={(e) => {
                e.preventDefault();
                void action(
                  'complete:' + run.id,
                  base + '/' + run.id + '/complete',
                  { summary },
                  'Conclusão registrada. Os materiais sorteados foram entregues às mochilas.',
                );
              }}
            >
              <h3>Registro de conclusão da mesa</h3>
              <p>
                Depois que todos os inscritos usarem o d100, confirme o relato para entregar as
                recompensas.
              </p>
              <label>
                Resumo da aventura
                <textarea
                  value={summary}
                  minLength={10}
                  maxLength={5000}
                  rows={4}
                  required
                  onChange={(e) => setSummary(e.target.value)}
                />
              </label>
              <button
                disabled={
                  busy || run.rolls.length !== run.roster.length || summary.trim().length < 10
                }
              >
                <Check size={16} />
                Registrar conclusão e entregar
              </button>
              {run.mission_id && (
                <small>
                  Se a missão ainda estiver em andamento, a conclusão também registra as recompensas
                  normais dos inscritos.
                </small>
              )}
            </form>
          )}
        </>
      ) : isGM ? (
        <form
          className="vtt-material-setup"
          onSubmit={(e) => {
            e.preventDefault();
            const op = 'open:' + mission + ':' + title;
            void action(
              op,
              base,
              {
                request_id: key(op),
                title: title.trim(),
                mission_id: mission || null,
                character_ids: mission ? [] : characters,
                tables,
              },
              'D100 liberados para os jogadores inscritos.',
            );
          }}
        >
          <h3>Preparar recompensas</h3>
          <label>
            Origem da aventura
            <select
              value={mission}
              onChange={(e) => {
                setMission(e.target.value);
                const m = state.missions.find((m) => m.id === e.target.value);
                if (m) setTitle(m.title);
                keys.current.clear();
              }}
            >
              <option value="">Mesa temática</option>
              {state.missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                  {m.status === 'completed' ? ' · concluída' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nome desta aventura
            <input
              required
              minLength={3}
              maxLength={150}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                keys.current.clear();
              }}
            />
          </label>
          {selectedMission ? (
            <div className="vtt-material-enrollment">
              <strong>Inscritos na missão</strong>
              {selectedRoster.map((p) => (
                <p key={p.id}>
                  <Check size={13} />
                  {p.name} · 1d100
                </p>
              ))}
            </div>
          ) : (
            <fieldset className="vtt-material-enrollment">
              <legend>Jogadores inscritos nesta aventura</legend>
              {state.registered.map((p) => (
                <div key={p.id}>
                  <strong>{p.name}</strong>
                  {p.characters.map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={characters.includes(c.id)}
                        onChange={(e) => {
                          setCharacters((ids) =>
                            e.target.checked ? [...ids, c.id] : ids.filter((id) => id !== c.id),
                          );
                          keys.current.clear();
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              ))}
              {!state.registered.length && (
                <p>Os jogadores precisam entrar na sala com uma conta e ter um personagem.</p>
              )}
            </fieldset>
          )}
          <p className="vtt-material-count">
            <Dices size={17} />
            {selectedRoster.length} jogadores inscritos = {selectedRoster.length} d100
          </p>
          <details className="vtt-material-table-editor">
            <summary>
              Ajustar materiais e porcentagens <ChevronDown size={14} />
            </summary>
            <p>
              Cada ofício tem tabelas por nível. Resultados 91–100 são reservados ao bônus ×2; a
              parte que faltar até 90 significa nenhum material.
            </p>
            <label>
              Profissão
              <select value={editProfession} onChange={(e) => setEditProfession(e.target.value)}>
                {professions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Faixa de nível
              <select value={editLevel} onChange={(e) => setEditLevel(Number(e.target.value))}>
                {professionLootTiers.map((level) => (
                  <option key={level} value={level}>
                    Nível {level}
                    {level === 10 ? '' : level === 1 ? '–2' : level === 3 ? '–5' : '–9'}
                  </option>
                ))}
              </select>
            </label>
            <label className="vtt-material-enabled">
              <input
                type="checkbox"
                checked={!!editTable}
                onChange={(e) => {
                  setTables((rows) =>
                    e.target.checked
                      ? [
                          ...rows,
                          defaultProfessionLootTables().find(
                            (t) => t.profession_id === editProfession && t.min_level === editLevel,
                          )!,
                        ]
                      : rows.filter(
                          (t) => t.profession_id !== editProfession || t.min_level !== editLevel,
                        ),
                  );
                  keys.current.clear();
                }}
              />
              Disponível nesta aventura
            </label>
            {editTable && (
              <>
                {professionLootMaterials(editProfession)
                  .filter((id) => professionMaterialLevel(editProfession, id) <= editLevel)
                  .map((id) => {
                    const entry = editTable.entries.find((e) => e.item_id === id);
                    return (
                      <div className="vtt-material-odds-row" key={id}>
                        <img src={professionItemArtwork(id)} alt="" />
                        <span>{materialName(id)}</span>
                        <label>
                          <span>Chance (%)</span>
                          <input
                            aria-label={'Chance de ' + materialName(id)}
                            type="number"
                            min="0"
                            max={materialChanceLimit(editProfession, id, editLevel)}
                            value={entry?.chance ?? 0}
                            onChange={(e) => updateChance(id, 'chance', e.target.valueAsNumber)}
                          />
                        </label>
                        <label>
                          <span>Qtd.</span>
                          <input
                            aria-label={'Quantidade de ' + materialName(id)}
                            type="number"
                            min="1"
                            max="99"
                            value={entry?.quantity ?? 1}
                            onChange={(e) => updateChance(id, 'quantity', e.target.valueAsNumber)}
                          />
                        </label>
                      </div>
                    );
                  })}
                <p className={total > 90 ? 'vtt-material-error' : ''}>
                  {total}% em materiais · 10% em dobro · {Math.max(0, 90 - total)}% sem material
                </p>
              </>
            )}
          </details>
          <p className="vtt-muted">
            Ao liberar, os inscritos e as chances ficam definidos para esta aventura. Cada jogador
            poderá usar somente um d100.
          </p>
          <button
            disabled={busy || !selectedRoster.length || title.trim().length < 3 || !validTables}
          >
            <Dices size={17} />
            {busy ? 'Liberando…' : `Liberar ${selectedRoster.length} d100`}
          </button>
        </form>
      ) : (
        <p className="vtt-material-awaiting">
          <Clock3 size={18} />
          Aguarde o mestre vincular a missão ou preparar a mesa temática e liberar os d100.
        </p>
      )}
      {!!state.history.length && (
        <details className="vtt-material-history">
          <summary>Mesas concluídas</summary>
          {state.history.slice(0, 5).map((run) => (
            <article key={run.id}>
              <h3>{run.title}</h3>
              <small>{new Date(run.completed_at!).toLocaleDateString('pt-BR')}</small>
              <RollResults run={run} />
            </article>
          ))}
        </details>
      )}
    </section>
  );
}
