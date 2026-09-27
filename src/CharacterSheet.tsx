import { useEffect, useState } from 'react';
import { BookOpen, Dices, Shield, Heart, Sparkles } from 'lucide-react';
import { api, post } from './api';
import type { Character, Details } from './types';
import { statNames, modifier, money } from '../shared/rules';
import {
  defaultChoices,
  validateChoices,
  racialBonuses,
  classRules,
  spells,
  spellOptions,
  sheetAttacks,
  dragons,
  type SheetResponse,
  type SheetRecord,
} from '../shared/character-sheet';
import { SheetChoices, ChoiceList } from './SheetChoices';
import { SheetHelp } from './SheetHelp';
import './character-sheet.css';
import './character-parchment.css';
const signed = (v: number) => `${v >= 0 ? '+' : ''}${v}`;
const spellName = (id: string) => spells.find((s) => s.id === id)?.label || id;
export function CharacterSheet({
  character: c,
  details,
  onRefresh,
}: {
  character: Character;
  details: Details | null;
  onRefresh: () => Promise<void>;
}) {
  const [data, setData] = useState<SheetResponse | null>(null),
    [choices, setChoices] = useState(() => defaultChoices(c.race, c.class));
  const [assignment, setAssignment] = useState([0, 1, 2, 3, 4, 5]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [tab, setTab] = useState('Atributos');
  const [draft, setDraft] = useState<SheetRecord | null>(null);
  function receive(r: SheetResponse) {
    setData(r);
    setDraft(r.sheet);
    if (r.sheet?.choices) setChoices(r.sheet.choices);
    if (r.sheet?.assignment) setAssignment(r.sheet.assignment);
  }
  useEffect(() => {
    let active = true;
    api<SheetResponse>(`/characters/${c.id}/sheet`)
      .then((r) => {
        if (active) receive(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [c.id]);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);
  async function action(path: string, body: unknown, refresh = false) {
    setBusy(true);
    setError('');
    try {
      const r = await post<SheetResponse>(`/characters/${c.id}/sheet/${path}`, body);
      receive(r);
      if (refresh) await onRefresh();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const s = data?.sheet,
    d = data?.derived,
    k = classRules[c.class];
  const bonuses = racialBonuses(c.race, choices);
  const rolls = s?.rolls?.map((v) => v.reduce((a, b) => a + b, 0) - Math.min(...v));
  const change = (v: Partial<SheetRecord>) =>
    setDraft((current) => (current ? { ...current, ...v } : current));
  function saveState() {
    if (draft) void action('state', draft);
  }
  const armorNote = d?.equipment.some((x) => x === 'Escudo' || x === 'Escudo de madeira')
    ? 'CA com escudo; armas de duas mãos exigem guardá-lo.'
    : 'CA com o equipamento inicial.';
  return (
    <div className="character-sheet">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="sheet-saved" role="status">
          Salvo.
        </p>
      )}
      {!data && !error && <p role="status">Abrindo o tomo…</p>}
      {data && !s?.rolls && (
        <section className="sheet-panel">
          <h3>
            <BookOpen size={20} /> {s ? 'Suas escolhas' : 'Complete sua origem'}
            <SheetHelp label="rolagem de atributos">
              4d6 por atributo, descartando o menor. Uma rolagem permanente por personagem; depois
              você distribui os seis resultados.
            </SheetHelp>
          </h3>
          <p>
            Confira as escolhas antes de rolar. Depois da rolagem, origem e treinamento ficam
            registrados.
          </p>
          <fieldset disabled={busy} className="sheet-form-reset">
            <SheetChoices race={c.race} cls={c.class} value={choices} onChange={setChoices} />
          </fieldset>
          <div className="sheet-actions">
            <button
              className="button outline"
              disabled={busy}
              onClick={() => {
                try {
                  void action('choices', validateChoices(c.race, c.class, choices));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Salvar escolhas
            </button>
            {s && (
              <button
                className="button primary"
                disabled={busy || JSON.stringify(s.choices) !== JSON.stringify(choices)}
                onClick={() => void action('roll', {})}
              >
                <Dices size={18} /> {busy ? 'Rolando…' : 'Rolar os seis atributos'}
              </button>
            )}
          </div>
        </section>
      )}
      {rolls && !s?.finalized_at && (
        <section className="sheet-panel">
          <h3>
            <Dices size={22} /> O destino está lançado
            <SheetHelp label="distribuição dos atributos">
              O menor dado de cada resultado é descartado e aparece riscado. Os bônus raciais
              são somados ao resultado escolhido. PV no nível 1 usam o máximo do dado de vida,
              Constituição e bônus aplicáveis.
            </SheetHelp>
          </h3>
          <p>
            Distribua os resultados. Ao confirmar, os bônus raciais e os valores da ficha serão
            calculados.
          </p>
          <div className="sheet-rolls">
            {s!.rolls!.map((dice, i) => (
              <div key={i}>
                <small>Resultado {i + 1}</small>
                <strong>{rolls[i]}</strong>
                <span>
                  {dice.map((v, j) => (
                    <i className={j === dice.indexOf(Math.min(...dice)) ? 'discarded' : ''} key={j}>
                      {v}
                    </i>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div className="sheet-attributes">
            {statNames.map((name, i) => (
              <label key={name}>
                {name}
                <select
                  aria-label={`Resultado para ${name}`}
                  value={assignment[i]}
                  onChange={(e) => {
                    const next = [...assignment],
                      v = Number(e.target.value),
                      old = next.indexOf(v);
                    next[old] = next[i];
                    next[i] = v;
                    setAssignment(next);
                  }}
                >
                  {rolls.map((v, j) => (
                    <option key={j} value={j}>
                      Resultado {j + 1}: {v}
                    </option>
                  ))}
                </select>
                <small>
                  {rolls[assignment[i]]} + {bonuses[i]} racial
                </small>
                <strong>{rolls[assignment[i]] + bonuses[i]}</strong>
              </label>
            ))}
          </div>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void action('finalize', { assignment }, true)}
          >
            Confirmar distribuição e abrir ficha
          </button>
          <p className="muted small">
            A confirmação é definitiva.
          </p>
        </section>
      )}
      {d && s?.finalized_at && draft && (
        <>
          <div className="sheet-vitals">
            {[
              [Heart, c.hp, 'PV máximos'],
              [Shield, d.armorClass, 'Classe de armadura'],
              [Sparkles, signed(d.proficiency), 'Proficiência'],
              [Dices, signed(d.initiative), 'Iniciativa'],
            ].map(([Icon, val, label], i) => {
              const Glyph = Icon as typeof Heart;
              return (
                <div key={i}>
                  <Glyph size={19} />
                  <strong>{String(val)}</strong>
                  <span>{String(label)}</span>
                </div>
              );
            })}
          </div>
          <div className="sheet-tabs" role="tablist" aria-label="Seções da ficha">
            {['Atributos', 'Combate', 'Magias', 'História e equipamento'].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                aria-controls="sheet-tab-panel"
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <section className="sheet-panel" id="sheet-tab-panel" role="tabpanel" aria-label={tab}>
            {tab === 'Atributos' && (
              <>
                <div className="sheet-attributes">
                  {c.stats.map((score, i) => (
                    <div key={i}>
                      <span>{statNames[i]}</span>
                      <strong>{score}</strong>
                      <b>{signed(modifier(score))}</b>
                      <small>
                        {rolls?.[s.assignment![i]]} + {bonuses[i]} racial
                      </small>
                    </div>
                  ))}
                </div>
                <div className="sheet-columns">
                  <div>
                    <h3>
                      Salvaguardas
                      <SheetHelp label="Salvaguardas">
                        ○ Sem proficiência: apenas o modificador do atributo. ● Proficiência: soma
                        também o bônus de proficiência. Os valores exibidos já incluem o bônus.
                      </SheetHelp>
                    </h3>
                    <ul className="sheet-values">
                      {d.saves.map((v, i) => (
                        <li key={i}>
                          <span>
                            {k.saves.includes(i) ? '●' : '○'} {statNames[i]}
                          </span>
                          <b>{signed(v)}</b>
                        </li>
                      ))}
                    </ul>
                    <h3>Sentidos e movimento</h3>
                    <p>
                      Percepção passiva <b>{d.passivePerception}</b>
                      <br />
                      Deslocamento <b>{d.speed} m</b> · Tamanho <b>{d.size}</b>
                    </p>
                    <h3>Idiomas</h3>
                    <p>{d.languages.join(' · ')}</p>
                    <h3>Proficiências</h3>
                    <ul>
                      {d.proficiencies.map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>
                      Perícias
                      <SheetHelp label="Perícias">
                        ○ Sem proficiência: apenas o modificador do atributo. ● Proficiência: soma o
                        bônus de proficiência. ◆ Especialização: soma o dobro desse bônus. Os totais
                        já estão calculados.
                      </SheetHelp>
                    </h3>
                    <ul className="sheet-values">
                      {d.skills.map((v) => (
                        <li key={v.name}>
                          <span>
                            {v.expert ? '◆' : v.trained ? '●' : '○'} {v.name}
                          </span>
                          <b>{signed(v.value)}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
            {tab === 'Combate' && (
              <>
                <h3>Recursos da sessão</h3>
                <div className="sheet-resource-grid">
                  {(
                    [
                      { key: 'current_hp', label: 'PV atuais', max: c.hp },
                      { key: 'temp_hp', label: 'PV temporários', max: 999 },
                      {
                        key: 'hit_dice_used',
                        label: `Dados de vida gastos (${c.level}d${d.hitDie})`,
                        max: c.level,
                      },
                      { key: 'death_success', label: 'Sucessos contra a morte', max: 3 },
                      { key: 'death_failure', label: 'Falhas contra a morte', max: 3 },
                    ] as const
                  ).map((f) => (
                    <label key={f.key}>
                      {f.label}
                      <input
                        type="number"
                        min={0}
                        max={f.max}
                        value={draft[f.key] ?? 0}
                        onChange={(e) => change({ [f.key]: Number(e.target.value) })}
                      />
                    </label>
                  ))}
                </div>
                <label className="sheet-inspiration">
                  <input
                    type="checkbox"
                    checked={draft.inspiration}
                    onChange={(e) => change({ inspiration: e.target.checked })}
                  />{' '}
                  Inspiração
                </label>
                <button className="button primary" disabled={busy} onClick={saveState}>
                  Salvar recursos
                </button>
                <h3>
                  Ataques com equipamento inicial
                  <SheetHelp label="Ataques com equipamento inicial">
                    {armorNote} Bônus situacionais são aplicados na mesa.
                  </SheetHelp>
                </h3>
                <ul className="sheet-attacks">
                  {sheetAttacks(c.race, c.class, c.stats, choices).map((w) => (
                    <li key={w.name}>
                      <strong>{w.name}</strong>
                      <span>Ataque {signed(w.attack)}</span>
                      <span>
                        {w.dice}
                        {w.dice === '—' ? '' : ' ' + signed(w.ability)} · {w.type}
                      </span>
                      {!w.trained && <small>Sem proficiência</small>}
                    </li>
                  ))}
                  <li>
                    <strong>Desarmado</strong>
                    <span>
                      Ataque{' '}
                      {signed(
                        modifier(c.stats[c.class === 'Monge' && c.stats[1] > c.stats[0] ? 1 : 0]) +
                          d.proficiency,
                      )}
                    </span>
                    <span>
                      {c.class === 'Monge'
                        ? `1d4 ${signed(Math.max(modifier(c.stats[0]), modifier(c.stats[1])))}`
                        : Math.max(0, 1 + modifier(c.stats[0]))}{' '}
                      contundente
                    </span>
                  </li>
                </ul>
                {c.race === 'Draconato' && (
                  <p>
                    Sopro {choices.options.dragon[0]}: {dragons[choices.options.dragon[0]].damage},{' '}
                    {dragons[choices.options.dragon[0]].shape}; salvaguarda de{' '}
                    {dragons[choices.options.dragon[0]].save}, CD{' '}
                    {8 + modifier(c.stats[2]) + d.proficiency}.
                  </p>
                )}
                <h3>Traços e recursos</h3>
                <ul className="sheet-features">
                  {d.features.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                  {Object.entries(choices.options)
                    .filter(([key]) => ['style', 'enemy', 'terrain', 'dragon'].includes(key))
                    .map(([key, v]) => (
                      <li key={key}>{v.join(', ')}</li>
                    ))}
                </ul>
              </>
            )}
            {tab === 'Magias' && (
              <>
                <h3>
                  Conjuração
                  <SheetHelp label="Conjuração">
                    Esta ficha registra escolhas e recursos. Rolagens de ataque, efeitos e condições
                    das magias são resolvidos na mesa.
                  </SheetHelp>
                </h3>
                {d.spellDC !== null ? (
                  <p>
                    Habilidade: {statNames[d.spellAbility!]} · CD <b>{d.spellDC}</b> · Ataque{' '}
                    <b>{signed(d.spellAttack!)}</b>
                  </p>
                ) : (
                  <p>A classe ainda não conjura no nível 1.</p>
                )}
                <h3>
                  Truques
                  {c.race === 'Elfo' && (
                    <SheetHelp label="Truques">
                      O truque racial usa Inteligência: CD{' '}
                      {8 + d.proficiency + modifier(c.stats[3])} e ataque{' '}
                      {signed(d.proficiency + modifier(c.stats[3]))}.
                    </SheetHelp>
                  )}
                  {c.race === 'Tiefling' && (
                    <SheetHelp label="Truques">Taumaturgia racial usa Carisma.</SheetHelp>
                  )}
                </h3>
                <p>{d.cantrips.map(spellName).join(' · ') || 'Nenhum.'}</p>

                {d.known.length > 0 && (
                  <>
                    <h3>{c.class === 'Mago' ? 'Grimório' : 'Magias conhecidas'}</h3>
                    <p>{d.known.map(spellName).join(' · ')}</p>
                  </>
                )}
                {!!d.slots && (
                  <>
                    <label>
                      Espaços de nível 1 gastos (total {d.slots})
                      <SheetHelp label="Espaços de magia">
                        Recupera em descanso {c.class === 'Bruxo' ? 'curto ou longo' : 'longo'}.
                      </SheetHelp>
                      <input
                        type="number"
                        min={0}
                        max={d.slots}
                        value={draft.slots_used}
                        onChange={(e) => change({ slots_used: Number(e.target.value) })}
                      />
                    </label>
                  </>
                )}
                {k.prepared && (
                  <>
                    <ChoiceList
                      label="Magias preparadas (até o limite)"
                      help="Pode trocar após um descanso longo."
                      count={d.prepareCount}
                      options={(c.class === 'Mago'
                        ? d.known
                        : spellOptions(c.class, 1).map((v) => v.id)
                      ).filter(
                        (v) => !(c.class === 'Clérigo' && ['bless', 'cure-wounds'].includes(v)),
                      )}
                      value={draft.prepared}
                      onChange={(v) => change({ prepared: v })}
                    />
                  </>
                )}
                {c.class === 'Clérigo' && (
                  <p>
                    Domínio da Vida: Bênção e Curar Ferimentos sempre preparadas, sem ocupar o
                    limite.
                  </p>
                )}
                {(d.slots > 0 || k.prepared) && (
                  <button className="button primary" disabled={busy} onClick={saveState}>
                    Salvar magias e espaços
                  </button>
                )}
              </>
            )}
            {tab === 'História e equipamento' && (
              <>
                <div className="sheet-columns">
                  <div>
                    <h3>Identidade</h3>
                    <p>
                      {c.background} · {choices.alignment}
                    </p>
                    <p>
                      {[
                        choices.age && `Idade: ${choices.age}`,
                        choices.height && `Altura: ${choices.height}`,
                        choices.weight && `Peso: ${choices.weight}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {(['appearance', 'personality', 'ideals', 'bonds', 'flaws'] as const).map(
                      (key, i) => (
                        <div key={key}>
                          <h4>
                            {['Aparência', 'Personalidade', 'Ideais', 'Vínculos', 'Defeitos'][i]}
                          </h4>
                          <p>{choices[key] || 'Não informado.'}</p>
                        </div>
                      ),
                    )}
                    <h3>História</h3>
                    <p className="biography">
                      {c.biography || 'Sua história ainda está sendo escrita.'}
                    </p>
                  </div>
                  <div>
                    <h3>
                      Equipamento inicial
                      <SheetHelp label="Equipamento inicial">
                        Os itens iniciais são registros da ficha; compras permanecem no inventário.
                        Trocas de equipamento e efeitos situacionais são resolvidos na mesa.
                      </SheetHelp>
                    </h3>
                    <ul>
                      {d.equipment.map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                    <h3>Inventário adquirido</h3>
                    <ul>
                      {details?.inventory.map((item) => (
                        <li key={item.id}>
                          {item.quantity} × {item.name}
                        </li>
                      ))}
                    </ul>
                    <p>
                      {money(c.gold_cp)} PO · {c.experience} XP
                    </p>
                  </div>
                </div>
                <label>
                  Anotações
                  <textarea
                    aria-label="Anotações"
                    rows={6}
                    maxLength={8000}
                    value={draft.notes}
                    onChange={(e) => change({ notes: e.target.value })}
                  />
                </label>
                <div className="sheet-actions">
                  <button className="button primary" disabled={busy} onClick={saveState}>
                    Salvar anotações
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
