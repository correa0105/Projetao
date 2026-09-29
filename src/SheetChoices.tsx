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
  feats,
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
  const boostDistributions = [
    ...b.abilities.flatMap((primary) =>
      b.abilities
        .filter((secondary) => secondary !== primary)
        .map((secondary) => ({
          values: statNames.map((_, index) =>
            index === primary ? 2 : index === secondary ? 1 : 0,
          ),
          label: `+2 ${statNames[primary]} e +1 ${statNames[secondary]}`,
        })),
    ),
    {
      values: statNames.map((_, index) => (b.abilities.includes(index) ? 1 : 0)),
      label: `+1 em ${b.abilities.map((index) => statNames[index]).join(', ')}`,
    },
  ];
  const spellFeatHelp = (key: string) => {
    const match = /^feat(?:Ability|Cantrips|Spell)(\d+)$/.exec(key);
    if (!match) return undefined;
    const index = Number(match[1]);
    return `${feats(c)[index]} — origem: ${index === 0 ? `antecedente ${c.backgroundType}` : 'talento adicional de Humano'}. Concede 2 truques e 1 magia de nível 1 sempre preparada, sem mudar sua classe. Escolha Inteligência, Sabedoria ou Carisma para essas magias. A magia de nível 1 pode ser usada uma vez sem espaço por descanso longo; também pode usar espaços, se você os tiver.${cls === 'Bárbaro' ? ' Durante a Fúria, você não pode conjurar magias nem manter concentração.' : ''}`;
  };
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
      <div className="sheet-field-group">
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
        <div className="sheet-field-description">
          <p className="muted small">
            {b.skills.join(' · ')} · {b.tool} · {b.feat}
          </p>
          {b.feat.startsWith('Iniciado em Magia') && (
            <p className="muted small">
              O antecedente {c.backgroundType} concede {b.feat}: 2 truques e 1 magia de nível 1,
              mesmo para {cls}. Essas escolhas vêm do antecedente e são adicionais às da classe.
              {cls === 'Bárbaro' &&
                ' Durante a Fúria, não é possível conjurar nem manter concentração.'}
            </p>
          )}
        </div>
      </div>
      <fieldset className="sheet-choice">
        <legend>
          Bônus do antecedente
          <SheetHelp label="Bônus do antecedente">
            Escolha +2 em um atributo e +1 em outro, ou +1 nos três. Nenhum atributo pode
            ultrapassar 20.
          </SheetHelp>
        </legend>
        <select
          aria-label="Distribuição dos bônus do antecedente"
          value={c.abilityBoosts.join(',')}
          onChange={(event) => {
            const selected = boostDistributions.find(
              (option) => option.values.join(',') === event.target.value,
            );
            if (selected) update({ abilityBoosts: selected.values });
          }}
        >
          {!boostDistributions.some(
            (option) => option.values.join(',') === c.abilityBoosts.join(','),
          ) && (
            <option value={c.abilityBoosts.join(',')} disabled>
              Escolha uma distribuição válida
            </option>
          )}
          {boostDistributions.map((option) => (
            <option key={option.values.join(',')} value={option.values.join(',')}>
              {option.label}
            </option>
          ))}
        </select>
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
            {spellFeatHelp(f.key) && <SheetHelp label={f.label}>{spellFeatHelp(f.key)}</SheetHelp>}
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
            help={spellFeatHelp(f.key)}
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
          help={
            cls === 'Mago'
              ? 'No nível 1, registre 6 magias de nível 1 no grimório. Depois, na aba Magias da ficha, prepare 4 delas. Seus 3 truques são escolhidos separadamente. Os 2 espaços de magia de nível 1 determinam quantas conjurações com espaços você pode fazer entre descansos longos; não são o tamanho do grimório.'
              : undefined
          }
          count={k.known}
          value={c.spells}
          options={spellOptions(cls, 1).map((s) => s.id)}
          onChange={(v) => onChange({ ...c, spells: v })}
        />
      )}
      {k.prepared && (
        <p className="muted small">
          {cls === 'Mago'
            ? 'O grimório começa com 6 magias de nível 1. Depois de concluir a criação, prepare 4 delas na aba Magias. Truques e magias concedidas por talentos são separados dessa conta.'
            : `Selecione até ${k.prepareCount} magias preparadas na ficha. A quantidade não depende do atributo de conjuração.`}
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
