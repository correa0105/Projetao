import { useMemo, useRef, useState } from 'react';
import { ArrowUp, BookOpen, Check, Search, Shield } from 'lucide-react';
import { classes, statNames, modifier } from '../shared/rules';
import { spells, type SheetResponse } from '../shared/character-sheet';
import {
  defaultAdvanceChoice,
  levelPlan,
  multiclassReason,
  subclassRules,
  validateAdvance,
  advancementStats,
  type AdvanceChoice,
} from '../shared/character-advancement';
import { featureNames } from '../shared/class-advancement-text';
import type { Character } from './types';
import { Modal } from './components';
import { ChoiceList } from './SheetChoices';
import { post } from './api';
import './character-advancement.css';

export function AdvancementSpells({
  label,
  count,
  options,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  count: number;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  optional?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [circle, setCircle] = useState('all');
  const normalize = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const available = spells.filter((s) => options.includes(s.id));
  const filtered = available.filter(
    (s) =>
      (circle === 'all' || s.level === Number(circle)) &&
      normalize(s.label).includes(normalize(search)),
  );
  return (
    <div className="advancement-spells">
      <div className="advancement-search">
        <label>
          <Search size={15} aria-hidden="true" />
          <input
            aria-label={`Buscar ${label.toLowerCase()}`}
            placeholder="Buscar magia…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label={`Círculo de ${label.toLowerCase()}`}
          value={circle}
          onChange={(e) => setCircle(e.target.value)}
        >
          <option value="all">Todos os círculos</option>
          {[...new Set(available.map((s) => s.level))]
            .sort((a, b) => a - b)
            .map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Truques' : `Círculo ${n}`}
              </option>
            ))}
        </select>
      </div>
      {value.length > 0 && (
        <p className="advancement-selected">
          {value.map((id) => (
            <button
              type="button"
              key={id}
              onClick={() => onChange(value.filter((v) => v !== id))}
              title="Remover seleção"
            >
              <Check size={12} />
              {spells.find((s) => s.id === id)?.label || id} ×
            </button>
          ))}
        </p>
      )}
      <div className="advancement-spell-list">
        <ChoiceList
          label={label}
          count={count}
          options={filtered.map((s) => s.id)}
          value={value}
          onChange={onChange}
          help={
            optional
              ? 'Pode escolher até este limite. As escolhas ficam registradas na ficha.'
              : undefined
          }
        />
        {!filtered.length && <p>Nenhuma magia encontrada.</p>}
      </div>
    </div>
  );
}

export function CharacterAdvancement({
  character,
  data,
  onSaved,
}: {
  character: Character;
  data: SheetResponse;
  onSaved: (r: SheetResponse) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<AdvanceChoice>(() => defaultAdvanceChoice(character.class));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const s = data.sheet!,
    d = data.derived!;
  const grant = d.pendingLevels === 0;
  const plan = useMemo(
    () => levelPlan(character, s.choices!, choice),
    [character, s.choices, choice],
  );
  const update = (patch: Partial<AdvanceChoice>) => {
    setChoice((v) => {
      const next = { ...v, ...patch };
      const nextPlan = levelPlan(character, s.choices!, next);
      next.choices = Object.fromEntries(
        Object.entries(next.choices)
          .filter(([key]) => nextPlan.fields.some((f) => f.key === key))
          .map(([key, values]) => [
            key,
            values.filter((value) =>
              nextPlan.fields.find((f) => f.key === key)!.options.includes(value),
            ),
          ]),
      );
      return next;
    });
    requestId.current = crypto.randomUUID();
    setError('');
  };
  const show = () => {
    setChoice(defaultAdvanceChoice(character.class));
    requestId.current = crypto.randomUUID();
    setError('');
    setOpen(true);
  };
  async function confirm() {
    if (busy) return;
    try {
      validateAdvance(character, s.choices!, choice);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await post<SheetResponse>(`/characters/${character.id}/sheet/advance`, {
        expectedLevel: character.level,
        requestId: requestId.current,
        grant,
        choice,
      });
      await onSaved(r);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const target = grant ? character.level + 1 : character.level - d.pendingLevels + 1;
  const changedCon =
    modifier(advancementStats(character, choice, plan.level)[2]) - modifier(character.stats[2]);
  const draconic = d.classLevels.find((s) => s.class === 'Feiticeiro' && s.subclass === 'draconic');
  const hpGain =
    plan.hpGain +
    changedCon * (grant ? character.level + 1 : character.level) +
    (choice.class === 'Feiticeiro'
      ? draconic
        ? 1
        : choice.subclass === 'draconic'
          ? plan.level
          : 0
      : 0);
  return (
    <>
      <section className="sheet-advancement" aria-label="Evolução do personagem">
        <div>
          <span className="advancement-eyebrow">Caminho do personagem</span>
          <h3>{d.classLevels.map((v) => `${v.class} ${v.level}`).join(' · ')}</h3>
          <p>
            {d.classLevels
              .map((v) => subclassRules[v.class]?.find((s) => s.id === v.subclass)?.name)
              .filter(Boolean)
              .join(' · ') || 'A subclasse é escolhida no nível 3 da classe.'}
          </p>
          {d.pendingLevels > 0 && (
            <p className="advancement-pending">
              {d.pendingLevels}{' '}
              {d.pendingLevels === 1 ? 'nível aguardando escolhas' : 'níveis aguardando escolhas'}.
            </p>
          )}
        </div>
        {(d.pendingLevels > 0 || data.capabilities?.can_grant_level) && (
          <button
            className="button outline"
            onClick={show}
            disabled={grant && character.level >= 20}
          >
            <ArrowUp size={17} />
            {d.pendingLevels
              ? 'Concluir evolução'
              : character.level >= 20
                ? 'Nível máximo'
                : 'Conceder nível (ADM)'}
          </button>
        )}
      </section>
      {open && (
        <Modal
          title={`Evoluir para o nível ${target}`}
          close={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div className="advancement-dialog">
            <p className="advancement-intro">
              {grant ? (
                <>
                  <Shield size={16} />
                  Concessão de administrador para o seu personagem.
                </>
              ) : (
                'Complete as escolhas do nível conquistado.'
              )}{' '}
              Escolha a classe que receberá este nível.
            </p>
            <label className="advancement-class-label">
              Classe deste nível
              <select
                value={choice.class}
                disabled={busy}
                onChange={(e) => {
                  setChoice(defaultAdvanceChoice(e.target.value));
                  requestId.current = crypto.randomUUID();
                  setError('');
                }}
              >
                {classes.map((cls) => {
                  const reason = multiclassReason(character, s.choices!, cls),
                    previous = d.classLevels.find((v) => v.class === cls);
                  return (
                    <option key={cls} value={cls} disabled={!!reason}>
                      {cls} —{' '}
                      {previous ? `nível ${previous.level + 1}` : reason || 'iniciar multiclasse'}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="advancement-preview">
              <span>
                <b>
                  {choice.class} {plan.level}
                </b>
                <small>{plan.previous ? 'Continuar na classe' : 'Nova classe'}</small>
              </span>
              <span>
                <b>+{hpGain} PV</b>
                <small>Média do dado + Constituição</small>
              </span>
              <span>
                <b>
                  {plan.profile.maxSpell ? `Círculo ${plan.profile.maxSpell}` : 'Sem conjuração'}
                </b>
                <small>Magias desta classe</small>
              </span>
            </div>
            <p className="advancement-features">
              <BookOpen size={16} />
              {plan.profile.features
                .split(',')
                .map(
                  (v) =>
                    featureNames[v.trim()] ||
                    (v.includes('Subclass') ? 'Característica de subclasse' : v.trim()),
                )
                .join(' · ')}
            </p>
            <fieldset disabled={busy} className="advancement-fields">
              {plan.subclassRequired && (
                <label>
                  Subclasse
                  <select
                    aria-label="Subclasse"
                    value={choice.subclass}
                    onChange={(e) =>
                      update({ subclass: e.target.value, bonusSpells: [], choices: {} })
                    }
                  >
                    <option value="">Selecione a subclasse</option>
                    {plan.subclasses.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <small>Subclasses disponíveis no SRD 5.2.1.</small>
                  {choice.subclass && (
                    <p>
                      {plan.subclasses.find((s) => s.id === choice.subclass)?.features[3].join(' ')}
                    </p>
                  )}
                </label>
              )}
              {plan.asi && (
                <fieldset className="advancement-attributes">
                  <legend>Melhoria de atributos · distribuir 2 pontos</legend>
                  <p>
                    O limite desta melhoria é 20. A Constituição recalcula os PV dos níveis
                    anteriores.
                  </p>
                  <div>
                    {statNames.map((name, i) => (
                      <label key={name}>
                        {name}
                        <select
                          aria-label={`Melhoria de ${name}`}
                          value={choice.boosts[i]}
                          onChange={(e) =>
                            update({
                              boosts: choice.boosts.map((n, j) =>
                                j === i ? Number(e.target.value) : n,
                              ),
                            })
                          }
                        >
                          {[0, 1, 2]
                            .filter((n) => n === 0 || character.stats[i] + n <= 20)
                            .map((n) => (
                              <option key={n} value={n}>
                                {character.stats[i]} → {character.stats[i] + n} (+{n})
                              </option>
                            ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {plan.fields.map((f) => (
                <div key={f.key}>
                  {f.options.some((id) => spells.some((s) => s.id === id)) ? (
                    <AdvancementSpells
                      label={f.label}
                      count={f.count}
                      options={f.options}
                      value={choice.choices[f.key] || []}
                      onChange={(v) => update({ choices: { ...choice.choices, [f.key]: v } })}
                    />
                  ) : (
                    <ChoiceList
                      label={f.label}
                      count={f.count}
                      options={f.options}
                      value={choice.choices[f.key] || []}
                      onChange={(v) => update({ choices: { ...choice.choices, [f.key]: v } })}
                    />
                  )}
                </div>
              ))}
              {plan.newCantrips > 0 && (
                <AdvancementSpells
                  label="Novos truques"
                  count={plan.newCantrips}
                  options={plan.cantripOptions}
                  value={choice.newCantrips}
                  onChange={(v) => update({ newCantrips: v })}
                />
              )}
              {plan.newSpells > 0 && (
                <AdvancementSpells
                  label="Novas magias"
                  count={plan.newSpells}
                  options={plan.spellOptions.filter((v) => !choice.bonusSpells.includes(v))}
                  value={choice.newSpells}
                  onChange={(v) => update({ newSpells: v })}
                />
              )}
              {plan.bonusCount > 0 && (
                <AdvancementSpells
                  label="Magias adicionais da subclasse"
                  count={plan.bonusCount}
                  optional={choice.class === 'Mago' && plan.level !== 3}
                  options={plan.bonusOptions.filter((v) => !choice.newSpells.includes(v))}
                  value={choice.bonusSpells}
                  onChange={(v) => update({ bonusSpells: v })}
                />
              )}
              {plan.automatic.length > 0 && (
                <p className="advancement-automatic">
                  Sempre disponíveis pela classe ou subclasse:{' '}
                  {plan.automatic
                    .map((id) => spells.find((s) => s.id === id)?.label || id)
                    .join(' · ')}
                  .
                </p>
              )}
            </fieldset>
            {error && (
              <p role="alert" className="advancement-error">
                {error}
              </p>
            )}
            <div className="advancement-confirm">
              <button className="button outline" disabled={busy} onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="button primary" disabled={busy} onClick={() => void confirm()}>
                {busy ? 'Registrando…' : 'Confirmar evolução'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
