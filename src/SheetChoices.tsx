import {
  alignments,
  choiceFields,
  equipmentFields,
  classRules,
  raceRules,
  skills,
  languages,
  tools,
  spells,
  spellOptions,
  racialSkills,
  proficientSkills,
  type SheetChoices as Choices,
} from '../shared/character-sheet';
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
    update = (v: Partial<Choices>) => onChange({ ...c, ...v });
  const used = racialSkills(race, c);
  return (
    <div className="sheet-creation stack">
      <div className="form-grid">
        <label>
          Sub-raça (SRD 5.1)
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
          Acólito recebe Intuição, Religião, dois idiomas e abrigo em templos de sua fé. O
          antecedente personalizado permite escolher duas perícias e duas ferramentas ou idiomas,
          mantendo o abrigo e o equipamento do acólito como base SRD.
        </SheetHelp>
        <select
          aria-label="Antecedente"
          value={c.backgroundType}
          onChange={(e) =>
            update({
              backgroundType: e.target.value as Choices['backgroundType'],
              backgroundSkills: ['Intuição', 'Religião'],
              backgroundExtras: [],
            })
          }
        >
          <option>Acólito</option>
          <option>Personalizado</option>
        </select>
      </label>
      <ChoiceList
        label="Perícias do antecedente"
        count={2}
        value={c.backgroundSkills}
        options={
          c.backgroundType === 'Acólito' && !used.some((v) => ['Intuição', 'Religião'].includes(v))
            ? ['Intuição', 'Religião']
            : skills.filter((v) => !used.includes(v))
        }
        onChange={(v) => update({ backgroundSkills: v, classSkills: [], expertise: [] })}
      />
      <ChoiceList
        label="Idiomas e ferramentas do antecedente"
        count={2}
        value={c.backgroundExtras}
        options={(c.backgroundType === 'Acólito' ? languages : [...languages, ...tools]).filter(
          (v) =>
            !raceRules[race].languages.includes(v) &&
            !c.options.racialLanguage?.includes(v) &&
            !(cls === 'Feiticeiro' && v === 'Dracônico'),
        )}
        onChange={(v) => update({ backgroundExtras: v })}
      />
      {choiceFields(race, cls).map((f) =>
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
            options={f.options}
            value={c.options[f.key] || []}
            onChange={(v) => update({ options: { ...c.options, [f.key]: v } })}
          />
        ),
      )}
      <ChoiceList
        label={`Perícias de ${cls}`}
        count={k.count}
        value={c.classSkills}
        options={k.skills.filter((v) => !c.backgroundSkills.includes(v) && !used.includes(v))}
        onChange={(v) => update({ classSkills: v, expertise: [] })}
      />
      {cls === 'Ladino' && (
        <ChoiceList
          label="Especialização"
          count={2}
          value={c.expertise}
          options={[...proficientSkills(race, c), 'Ferramentas de ladrão']}
          onChange={(v) => update({ expertise: v })}
        />
      )}
      <details open>
        <summary>
          Equipamento inicial
          <SheetHelp label="Equipamento inicial">
            Itens iniciais ficam registrados na ficha. A guilda mantém a regra de teste de 150 PO;
            não há sorteio adicional de riqueza.
          </SheetHelp>
        </summary>
        <div className="form-grid">
          {equipmentFields(cls).map((f) => (
            <label key={f.key}>
              {f.label}
              <select
                value={c.equipment[f.key]?.[0] || ''}
                onChange={(e) =>
                  update({ equipment: { ...c.equipment, [f.key]: [e.target.value] } })
                }
              >
                {f.options
                  .filter(
                    (v) => !(cls === 'Clérigo' && v === 'Martelo de guerra' && race !== 'Anão'),
                  )
                  .map((v) => (
                    <option key={v}>{v}</option>
                  ))}
              </select>
            </label>
          ))}
        </div>
      </details>
      {!!k.cantrips && (
        <ChoiceList
          label="Truques da classe"
          count={k.cantrips}
          value={c.cantrips}
          options={spellOptions(cls, 0).map((s) => s.id)}
          onChange={(v) => update({ cantrips: v })}
        />
      )}
      {!!k.known && (
        <ChoiceList
          label={cls === 'Mago' ? 'Magias do grimório' : 'Magias conhecidas'}
          help={
            k.prepared
              ? 'As magias preparadas serão escolhidas na ficha, após calcular seus atributos.'
              : undefined
          }
          count={k.known}
          value={c.spells}
          options={spellOptions(cls, 1).map((s) => s.id)}
          onChange={(v) => update({ spells: v })}
        />
      )}
      {k.prepared && !k.known && (
        <div>
          Magias preparadas
          <SheetHelp label="Magias preparadas">
            As magias preparadas serão escolhidas na ficha, após calcular seus atributos.
          </SheetHelp>
        </div>
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
