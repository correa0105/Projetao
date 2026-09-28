import {
  alignments,
  choiceFields,
  equipmentFields,
  classRules,
  raceRules,
  skills,
  languages,
  spells,
  spellOptions,
  racialSkills,
  proficientSkills,
  backgroundRules,
  defaultChoices,
  normalizeOptions,
  startingEquipment,
  startingGold,
  type SheetChoices as Choices,
} from '../shared/character-sheet';
import { statNames, money } from '../shared/rules';
import { SheetHelp } from './SheetHelp';
export function ChoiceList({
  label,
  options,
  value,
  count,
  onChange,
  help,
}: {
  label: string;
  help?: string;
  options: string[];
  value: string[];
  count: number;
  onChange: (v: string[]) => void;
}) {
  const name = (v: string) => spells.find((s) => s.id === v)?.label || v;
  return (
    <fieldset className="sheet-choice">
      <legend>
        {label}{' '}
        <small>
          Escolha {count} · {value.length}/{count}
        </small>
        {help && <SheetHelp label={label}>{help}</SheetHelp>}
      </legend>
      <div className="sheet-checks">
        {options.map((v) => (
          <label key={v}>
            <input
              type="checkbox"
              checked={value.includes(v)}
              disabled={!value.includes(v) && value.length >= count}
              onChange={() =>
                onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
              }
            />
            <span>{name(v)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function SheetChoices({
  race,
  cls,
  value: c,
  onChange,
}: {
  race: string;
  cls: string;
  value: Choices;
  onChange: (v: Choices) => void;
}) {
  const k = classRules[cls],
    b = backgroundRules[c.backgroundType],
    used = racialSkills(race, c);
  const update = (v: Partial<Choices>) => onChange(normalizeOptions(race, cls, { ...c, ...v }));
  return (
    <div className="sheet-creation stack">
      <div className="form-grid">
        <label>
          Linhagem (SRD 5.2.1)
          <select value={c.subrace} onChange={(e) => update({ subrace: e.target.value })}>
            {raceRules[race].variants.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Alinhamento
          <select value={c.alignment} onChange={(e) => update({ alignment: e.target.value })}>
            {alignments.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Antecedente
        <SheetHelp label="Antecedente">
          O antecedente concede bônus de atributos, duas perícias, uma ferramenta e um talento de
          origem. Opções do SRD 5.2.1.
        </SheetHelp>
        <select
          aria-label="Antecedente"
          value={c.backgroundType}
          onChange={(e) => {
            const next = defaultChoices(race, cls, e.target.value);
            onChange({
              ...c,
              ...next,
              alignment: c.alignment,
              personality: c.personality,
              ideals: c.ideals,
              bonds: c.bonds,
              flaws: c.flaws,
              appearance: c.appearance,
              age: c.age,
              height: c.height,
              weight: c.weight,
            });
          }}
        >
          {Object.keys(backgroundRules).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <p className="muted small">
        {b.skills.join(' · ')} · {b.tool} · {b.feat}
      </p>
      <fieldset className="sheet-choice">
        <legend>
          Bônus do antecedente
          <SheetHelp label="Bônus do antecedente">
            Escolha +2 em um atributo e +1 em outro, ou +1 nos três. Nenhum atributo pode
            ultrapassar 20.
          </SheetHelp>
        </legend>
        <div className="form-grid">
          {b.abilities.map((i) => (
            <label key={i}>
              {statNames[i]}
              <select
                aria-label={'Bônus em ' + statNames[i]}
                value={c.abilityBoosts[i]}
                onChange={(e) =>
                  update({
                    abilityBoosts: c.abilityBoosts.map((v, j) =>
                      j === i ? Number(e.target.value) : v,
                    ),
                  })
                }
              >
                {[0, 1, 2].map((v) => (
                  <option key={v} value={v}>
                    +{v}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>
      <ChoiceList
        label="Idiomas iniciais (além de Comum)"
        count={2}
        value={c.backgroundExtras}
        options={languages.filter((v) => v !== 'Comum')}
        onChange={(v) => update({ backgroundExtras: v })}
      />
      {choiceFields(race, cls, c).map((f) =>
        f.count === 1 ? (
          <label key={f.key}>
            {f.label}
            <select
              value={c.options[f.key]?.[0] || ''}
              onChange={(e) => update({ options: { ...c.options, [f.key]: [e.target.value] } })}
            >
              {f.options.map((v) => (
                <option key={v} value={v}>
                  {spells.find((s) => s.id === v)?.label || v}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <ChoiceList
            key={f.key}
            label={f.label}
            count={f.count}
            value={c.options[f.key] || []}
            options={f.options}
            onChange={(v) => onChange({ ...c, options: { ...c.options, [f.key]: v } })}
          />
        ),
      )}
      <ChoiceList
        label={'Perícias de ' + cls}
        count={k.count}
        value={c.classSkills}
        options={k.skills.filter(
          (v) =>
            !c.backgroundSkills.includes(v) &&
            !used.includes(v) &&
            !Object.entries(c.options)
              .filter(([key]) => key.startsWith('skilled'))
              .flatMap(([, v]) => v)
              .includes(v),
        )}
        onChange={(v) => onChange({ ...c, classSkills: v, expertise: [] })}
      />
      {cls === 'Ladino' && (
        <ChoiceList
          label="Especialização"
          count={2}
          value={c.expertise}
          options={proficientSkills(race, c)}
          onChange={(v) => onChange({ ...c, expertise: v })}
        />
      )}
      <details open>
        <summary>Equipamento inicial</summary>
        <div className="form-grid">
          {equipmentFields(cls).map((f) => (
            <label key={f.key}>
              {f.label}
              <select
                value={c.equipment[f.key]?.[0]}
                onChange={(e) =>
                  update({ equipment: { ...c.equipment, [f.key]: [e.target.value] } })
                }
              >
                {f.options.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="muted small">
          {startingEquipment(cls, c).join(' · ') || 'Sem conjunto inicial de itens.'}
        </p>
        <p className="muted small">
          Ouro inicial: {money(startingGold(cls, c))} PO. Creditado uma única vez ao concluir uma
          ficha nova. Conversões preservam o saldo existente.
        </p>
      </details>
      {!!k.cantrips && (
        <ChoiceList
          label="Truques da classe"
          count={k.cantrips}
          value={c.cantrips}
          options={spellOptions(cls, 0).map((s) => s.id)}
          onChange={(v) => onChange({ ...c, cantrips: v })}
        />
      )}
      {!!k.known && (
        <ChoiceList
          label={cls === 'Mago' ? 'Magias do grimório' : 'Magias preparadas da classe'}
          count={k.known}
          value={c.spells}
          options={spellOptions(cls, 1).map((s) => s.id)}
          onChange={(v) => onChange({ ...c, spells: v })}
        />
      )}
      {k.prepared && (
        <p className="muted small">
          Selecione até {k.prepareCount} magias preparadas na ficha. A quantidade não depende do
          atributo de conjuração.
        </p>
      )}
      <details>
        <summary>Aparência e personalidade</summary>
        <div className="form-grid">
          {(['age', 'height', 'weight'] as const).map((key, i) => (
            <label key={key}>
              {['Idade', 'Altura', 'Peso'][i]}
              <input
                maxLength={40}
                value={c[key]}
                onChange={(e) => update({ [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        {(['appearance', 'personality', 'ideals', 'bonds', 'flaws'] as const).map((key, i) => (
          <label key={key}>
            {['Aparência', 'Traços de personalidade', 'Ideais', 'Vínculos', 'Defeitos'][i]}
            <textarea
              rows={2}
              maxLength={800}
              value={c[key]}
              onChange={(e) => update({ [key]: e.target.value })}
            />
          </label>
        ))}
      </details>
    </div>
  );
}
