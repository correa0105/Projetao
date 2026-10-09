import { FlashMessage } from './FlashMessage';
import { CharacterTitleLabel } from './Titles';
import { useEffect, useState } from 'react';
import {
  BookOpen,
  Dices,
  Shield,
  Heart,
  Sparkles,
  Check,
  ChevronsUp,
  Eye,
  Footprints,
  Ruler,
  Languages,
  Package,
  Sword,
  Backpack,
  Hand,
} from 'lucide-react';
import { api, post } from './api';
import {
  rankName,
  progressionLabel,
  MISSION_THRESHOLDS,
  testEligible,
} from '../shared/progression';
import type { Character, Details } from './types';
import { statNames, modifier, money, races } from '../shared/rules';
import {
  defaultChoices,
  restChoiceFields,
  type SheetChoices as Choices,
  validateChoices,
  racialBonuses,
  classRules,
  spells,
  spellOptions,
  dragons,
  type SheetResponse,
  type SheetRecord,
} from '../shared/character-sheet';
import { SheetChoices, ChoiceList } from './SheetChoices';
import { SheetHelp } from './SheetHelp';
import { ItemThumbnail } from './ItemThumbnail';
import { AttributeDice } from './AttributeDice';
import './character-sheet.css';
import './character-parchment.css';
const signed = (v: number) => `${v >= 0 ? '+' : ''}${v}`;
const spellName = (id: string) => spells.find((s) => s.id === id)?.label || id;
function FeatureCard({ text }: { text: string }) {
  const separator = text.indexOf(':');
  return (
    <li>
      <Sparkles size={17} aria-hidden="true" />
      <div>
        <strong>{separator < 0 ? text : text.slice(0, separator)}</strong>
        {separator >= 0 && <p>{text.slice(separator + 1).trim()}</p>}
      </div>
    </li>
  );
}
function TrainingMark({ trained, expert = false }: { trained: boolean; expert?: boolean }) {
  const label = expert ? 'Especialização' : trained ? 'Proficiência' : 'Sem proficiência';
  return (
    <span
      className={'sheet-training ' + (expert ? 'is-expert' : trained ? 'is-trained' : '')}
      role="img"
      aria-label={label}
      title={label}
    >
      {expert ? (
        <ChevronsUp size={13} />
      ) : trained ? (
        <Check size={12} />
      ) : (
        <span aria-hidden="true">—</span>
      )}
    </span>
  );
}
function EquipmentCard({
  name,
  quantity,
  image,
}: {
  name: string;
  quantity?: number;
  image?: string | null;
}) {
  const Icon = /espada|arco|flecha|adaga|machado|lança|martelo|besta/i.test(name)
    ? Sword
    : /armadura|cota|escudo|couro/i.test(name)
      ? Shield
      : /livro|orações/i.test(name)
        ? BookOpen
        : /pacote|mochila/i.test(name)
          ? Backpack
          : Package;
  return (
    <li className="sheet-equipment-card">
      <span className="sheet-equipment-icon">
        <ItemThumbnail image={image} name={name} fallback={<Icon size={23} aria-hidden="true" />} />
      </span>
      <span>{name}</span>
      {quantity !== undefined && <b className="sheet-equipment-quantity">×{quantity}</b>}
    </li>
  );
}
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
  const [restChoices, setRestChoices] = useState<Choices>(() => defaultChoices(c.race, c.class));
  const [draft, setDraft] = useState<SheetRecord | null>(null);
  const [revealedRolls, setRevealedRolls] = useState(6);
  function receive(r: SheetResponse) {
    setData(r);
    setDraft(r.sheet);
    if (r.sheet?.choices) {
      setChoices(r.sheet.choices);
      setRestChoices(r.sheet.choices);
    }
    if (r.sheet?.assignment) setAssignment(r.sheet.assignment);
  }
  useEffect(() => {
    let active = true;
    setRevealedRolls(6);
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
    let live = true;
    const refreshAttacks = () => {
      if (!document.hidden)
        void api<SheetResponse>(`/characters/${c.id}/sheet`)
          .then((r) => {
            if (live)
              setData((previous) => (previous ? { ...previous, attacks: r.attacks } : previous));
          })
          .catch(() => {});
    };
    refreshAttacks();
    const timer = setInterval(refreshAttacks, 5000);
    window.addEventListener('focus', refreshAttacks);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('focus', refreshAttacks);
    };
  }, [c.id, details?.inventory]);
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
      if (path === 'roll') setRevealedRolls(0);
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
  const visibleRestFields = restChoiceFields(c.race, c.class, restChoices).filter((field) =>
    field.key === 'mastery' ? tab === 'Combate' : tab === 'Magias',
  );
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
  const rankReady = testEligible(c.level, c.progression_missions);
  const rankStart = MISSION_THRESHOLDS[c.level - 1];
  const rankTarget = MISSION_THRESHOLDS[Math.min(c.level, 19)];
  const rankProgress =
    c.level === 20
      ? 100
      : Math.min(
          100,
          Math.max(0, ((c.progression_missions - rankStart) / (rankTarget - rankStart)) * 100),
        );
  return (
    <div className="character-sheet">
      <CharacterTitleLabel characterId={c.id} />
      <section
        className={`sheet-rank-banner${rankReady ? ' is-ready' : ''}`}
        aria-label="Patente e progressão"
      >
        <div className="sheet-rank-identity">
          <div className="sheet-rank-level" aria-label={`Nível ${c.level}`}>
            <small>Nível</small>
            <strong>{c.level}</strong>
          </div>
          <div>
            <span className="sheet-rank-eyebrow">Patente da guilda</span>
            <h3>
              {rankName(c.level)}
              <SheetHelp label="progressão de patente">
                Missões concluídas contam até o requisito da próxima patente. Nesse limite, missões
                normais concedem apenas ouro; conclua o teste para ser promovido.
                {c.level > 1 &&
                  ' Os recursos de classe e PV dos níveis superiores ainda precisam ser conferidos na mesa.'}
              </SheetHelp>
            </h3>
          </div>
        </div>
        <div className="sheet-rank-journey">
          <div className="sheet-rank-progress-heading">
            <span>
              {rankReady
                ? 'Teste de patente disponível'
                : c.level === 20
                  ? 'Jornada completa'
                  : 'Próximo marco'}
            </span>
            <span>
              {rankReady ? (
                <Check size={16} aria-hidden="true" />
              ) : c.level === 20 ? (
                '20 / 20'
              ) : (
                `Nível ${c.level + 1}`
              )}
            </span>
          </div>
          <div
            className="sheet-rank-track"
            role="progressbar"
            aria-label="Progresso até o próximo marco"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(rankProgress)}
            aria-valuetext={progressionLabel(c.level, c.progression_missions)}
          >
            <span style={{ width: `${rankProgress}%` }} />
          </div>
          <p>{progressionLabel(c.level, c.progression_missions)}</p>
        </div>
      </section>
      {error && <FlashMessage>{error}</FlashMessage>}
      {saved && <FlashMessage kind="info">Salvo.</FlashMessage>}
      {!data && !error && <p role="status">Abrindo o tomo…</p>}
      {data && (!s?.rolls || !s?.choices) && (
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
            {s?.rules_version === '5.1' && !s.choices && (
              <>
                <p>
                  Revisão para D&D 5.5e: seus dados rolados e bens foram preservados. Revise a
                  origem antes de confirmar a conversão.
                </p>
                <label>
                  Espécie
                  <select
                    value={choices.species}
                    onChange={(e) => setChoices(defaultChoices(e.target.value, c.class))}
                  >
                    {races.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <SheetChoices
              race={choices.species}
              cls={c.class}
              value={choices}
              onChange={setChoices}
            />
          </fieldset>
          <div className="sheet-actions">
            <button
              className="button outline"
              disabled={busy}
              onClick={() => {
                try {
                  void action('choices', validateChoices(choices.species, c.class, choices), true);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Salvar escolhas
            </button>
            {s?.choices && !s.rolls && (
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
      {rolls && s?.choices && !s?.finalized_at && (
        <section className="sheet-panel">
          <h3>
            <Dices size={22} /> O destino está lançado
            <SheetHelp label="distribuição dos atributos">
              O menor dado de cada resultado é descartado e aparece riscado. Os bônus do antecedente
              são somados ao resultado escolhido. PV no nível 1 usam o máximo do dado de vida,
              Constituição e bônus aplicáveis.
            </SheetHelp>
          </h3>
          <p>
            {revealedRolls < 6
              ? 'Lance uma rolagem por vez. Em cada uma, quatro dados caem e o menor é descartado.'
              : 'Distribua os resultados. Ao confirmar, os bônus do antecedente e os valores da ficha serão calculados.'}
          </p>
          <AttributeDice
            key={c.id}
            rolls={s!.rolls!}
            revealed={revealedRolls}
            onReveal={setRevealedRolls}
          />
          {revealedRolls === 6 && (
            <>
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
                      {rolls[assignment[i]]} + {bonuses[i]} do antecedente
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
              <p className="muted small">A confirmação é definitiva.</p>
            </>
          )}
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
            {['Atributos', 'Combate', 'Magias', 'História', 'Equipamento'].map((t) => (
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
                        {rolls?.[s.assignment![i]]} + {bonuses[i]} do antecedente
                      </small>
                    </div>
                  ))}
                </div>
                <div className="sheet-columns">
                  <div>
                    <h3>
                      Salvaguardas
                      <SheetHelp label="Salvaguardas">
                        Traço: sem proficiência, usa apenas o modificador do atributo. Marca de
                        confirmação: proficiência, soma também o bônus de proficiência. Os valores
                        exibidos já incluem o bônus.
                      </SheetHelp>
                    </h3>
                    <ul className="sheet-values sheet-save-cards">
                      {d.saves.map((v, i) => (
                        <li key={i} className={k.saves.includes(i) ? 'is-trained' : ''}>
                          <TrainingMark trained={k.saves.includes(i)} />
                          <span>{statNames[i]}</span>
                          <b>{signed(v)}</b>
                        </li>
                      ))}
                    </ul>
                    <h3>Sentidos e movimento</h3>
                    <div className="sheet-exploration">
                      <div>
                        <Eye size={20} aria-hidden="true" />
                        <b>{d.passivePerception}</b>
                        <span>Percepção passiva</span>
                      </div>
                      <div>
                        <Footprints size={20} aria-hidden="true" />
                        <b>{d.speed} m</b>
                        <span>Deslocamento</span>
                      </div>
                      <div>
                        <Ruler size={20} aria-hidden="true" />
                        <b>{d.size}</b>
                        <span>Tamanho</span>
                      </div>
                    </div>
                    <h3>Idiomas</h3>
                    <div className="sheet-language-tags">
                      {d.languages.map((language) => (
                        <span key={language}>
                          <Languages size={14} aria-hidden="true" />
                          {language}
                        </span>
                      ))}
                    </div>
                    <h3>Proficiências</h3>
                    <ul className="sheet-training-cards">
                      {d.proficiencies.map((v, i) => (
                        <li key={i}>
                          <Shield size={17} aria-hidden="true" />
                          <span>{v}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>
                      Perícias
                      <SheetHelp label="Perícias">
                        Traço: sem proficiência. Marca de confirmação: proficiência, soma o bônus de
                        proficiência. Setas duplas: especialização, soma o dobro desse bônus. Os
                        totais já estão calculados.
                      </SheetHelp>
                    </h3>
                    <ul className="sheet-values sheet-skill-cards">
                      {d.skills.map((v) => (
                        <li
                          key={v.name}
                          className={v.expert ? 'is-expert' : v.trained ? 'is-trained' : ''}
                        >
                          <TrainingMark trained={v.trained} expert={v.expert} />
                          <span>{v.name}</span>
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
                  Inspiração Heroica
                </label>
                <button className="button primary" disabled={busy} onClick={saveState}>
                  Salvar recursos
                </button>
                <h3>
                  Ataques com armas equipadas
                  <SheetHelp label="Ataques com armas equipadas">
                    Apenas armas da mochila equipadas nas mãos aparecem aqui. {armorNote} Bônus
                    situacionais são aplicados na mesa.
                  </SheetHelp>
                </h3>
                <ul className="sheet-attacks sheet-attack-cards">
                  {(data?.attacks || []).map((w) => (
                    <li key={w.itemId}>
                      <header>
                        <ItemThumbnail
                          image={w.image_path}
                          name={w.name}
                          fallback={<Sword size={22} aria-hidden="true" />}
                        />
                        <strong>{w.name}</strong>
                      </header>
                      <div className="sheet-attack-numbers">
                        <div>
                          <span>Acerto</span>
                          <b>{signed(w.attack)}</b>
                        </div>
                        <div>
                          <span>Dano</span>
                          <b>
                            {w.dice}
                            {w.dice === '—' ? '' : ' ' + signed(w.ability)}
                          </b>
                        </div>
                      </div>
                      <footer>
                        <span>
                          {w.type}
                          {w.mastery ? ' · ' + w.mastery : ''}
                        </span>
                        {!w.trained && <small>Sem proficiência</small>}
                      </footer>
                    </li>
                  ))}
                  <li>
                    <header>
                      <Hand size={22} aria-hidden="true" />
                      <strong>Desarmado</strong>
                    </header>
                    <div className="sheet-attack-numbers">
                      <div>
                        <span>Acerto</span>
                        <b>
                          {signed(
                            modifier(
                              c.stats[c.class === 'Monge' && c.stats[1] > c.stats[0] ? 1 : 0],
                            ) + d.proficiency,
                          )}
                        </b>
                      </div>
                      <div>
                        <span>Dano</span>
                        <b>
                          {c.class === 'Monge'
                            ? '1d6 ' + signed(Math.max(modifier(c.stats[0]), modifier(c.stats[1])))
                            : Math.max(0, 1 + modifier(c.stats[0]))}
                        </b>
                      </div>
                    </div>
                    <footer>
                      <span>Contundente</span>
                    </footer>
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
                    <FeatureCard key={i} text={v} />
                  ))}
                  {Object.entries(choices.options)
                    .filter(([key]) => ['style', 'enemy', 'terrain', 'dragon'].includes(key))
                    .map(([key, v]) => (
                      <FeatureCard
                        key={key}
                        text={
                          (
                            {
                              style: 'Estilo de luta',
                              enemy: 'Inimigo favorito',
                              terrain: 'Terreno favorito',
                              dragon: 'Ancestralidade dracônica',
                            } as Record<string, string>
                          )[key] +
                          ': ' +
                          v.join(', ')
                        }
                      />
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
                <h3>Truques</h3>
                <p>{d.cantrips.map(spellName).join(' · ') || 'Nenhum.'}</p>

                {d.known.length > 0 && (
                  <>
                    <h3>{c.class === 'Mago' ? 'Grimório' : 'Magias preparadas da classe'}</h3>
                    <p>{d.known.map(spellName).join(' · ')}</p>
                  </>
                )}
                {(d.slots > 0 || k.prepared) && (
                  <div className="sheet-form-reset sheet-spell-controls">
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
                          help={
                            ['Paladino', 'Patrulheiro'].includes(c.class)
                              ? 'Após descanso longo pode substituir uma magia preparada. Registre aqui a escolha acordada na mesa.'
                              : 'Pode trocar após um descanso longo.'
                          }
                          count={d.prepareCount}
                          options={
                            c.class === 'Mago' ? d.known : spellOptions(c.class, 1).map((v) => v.id)
                          }
                          value={draft.prepared}
                          onChange={(v) => change({ prepared: v })}
                        />
                      </>
                    )}
                  </div>
                )}
                {!!d.alwaysPrepared.length && (
                  <p>Sempre preparadas: {d.alwaysPrepared.map(spellName).join(' · ')}.</p>
                )}
                {d.spellGrants.map((g, i) => (
                  <div className="sheet-training-cards" key={i}>
                    <h3>{g.source}</h3>
                    <p>
                      {statNames[g.ability]} · CD {8 + d.proficiency + modifier(c.stats[g.ability])}{' '}
                      · ataque {signed(d.proficiency + modifier(c.stats[g.ability]))}
                    </p>
                    <p>{[...g.cantrips, ...g.spells].map(spellName).join(' · ')}</p>
                    <p className="muted small">{g.note}</p>
                  </div>
                ))}
              </>
            )}
            {['História', 'Equipamento'].includes(tab) && (
              <>
                <div className="sheet-columns sheet-separated">
                  <div hidden={tab !== 'História'}>
                    <h3>Identidade</h3>
                    <p>
                      {choices.backgroundType} · {choices.alignment}
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
                  <div hidden={tab !== 'Equipamento'}>
                    <h3>
                      Equipamento inicial
                      <SheetHelp label="Equipamento inicial">
                        Os itens iniciais são registros da ficha; compras permanecem no inventário.
                        Trocas de equipamento e efeitos situacionais são resolvidos na mesa.
                      </SheetHelp>
                    </h3>
                    <ul className="sheet-equipment-grid">
                      {d.equipment.map((v, i) => (
                        <EquipmentCard key={i} name={v} />
                      ))}
                    </ul>
                    <h3>Inventário adquirido</h3>
                    <ul className="sheet-equipment-grid">
                      {details?.inventory.map((item) => (
                        <EquipmentCard
                          key={item.id}
                          name={item.name}
                          quantity={item.quantity}
                          image={item.image_path}
                        />
                      ))}
                    </ul>
                    <p>
                      {c.gold_unlimited ? '∞' : money(c.gold_cp)} PO · {rankName(c.level)} · Nível{' '}
                      {c.level}
                      <br />
                      {progressionLabel(c.level, c.progression_missions)}
                    </p>
                  </div>
                </div>
                {tab === 'História' && (
                  <>
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
              </>
            )}
            {(visibleRestFields.length > 0 || (tab === 'Magias' && c.class === 'Mago')) && (
              <details className="sheet-rest-choices">
                <summary>Escolhas após descanso longo</summary>
                <p className="muted small">
                  Registre aqui as trocas permitidas depois de descansar na mesa. Estas escolhas
                  atualizam os recursos do personagem, sem refazer sua origem ou seus atributos.
                </p>
                {visibleRestFields.map((f) => (
                  <ChoiceList
                    key={f.key}
                    label={f.label}
                    count={f.count}
                    options={f.options}
                    value={restChoices.options[f.key] || []}
                    onChange={(v) =>
                      setRestChoices({
                        ...restChoices,
                        options: { ...restChoices.options, [f.key]: v },
                      })
                    }
                  />
                ))}
                {tab === 'Magias' && c.class === 'Mago' && (
                  <ChoiceList
                    label="Truques do mago após descanso"
                    count={k.cantrips}
                    options={spellOptions(c.class, 0).map((s) => s.id)}
                    value={restChoices.cantrips}
                    onChange={(v) => setRestChoices({ ...restChoices, cantrips: v })}
                  />
                )}
                <button
                  className="button outline"
                  disabled={busy}
                  onClick={() => void action('rest-choices', restChoices)}
                >
                  Salvar trocas do descanso
                </button>
              </details>
            )}
            {tab === 'Magias' && (d.slots > 0 || k.prepared) && (
              <div className="sheet-actions">
                <button className="button primary" disabled={busy} onClick={saveState}>
                  Salvar magias e espaços
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
