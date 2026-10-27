import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, Search, Save } from 'lucide-react';
import { Modal } from './components';
import { api, post } from './api';
import { races, classes, statNames } from '../shared/rules';
import {
  adminCharacterEditSchema,
  type AdminCharacterEdit,
  type SheetOverrides,
} from '../shared/character-admin';
import { SheetChoices } from './SheetChoices';
import {
  defaultChoices,
  reconcileChoices,
  validateChoices,
  deriveSheet,
  spells,
  type SheetChoices as Choices,
  type SheetRecord,
} from '../shared/character-sheet';
import type { Character } from './types';
import './character-administration.css';
type Data = {
  character: Character;
  sheet: SheetRecord | null;
  choices: Choices;
  revision: string;
  owner_name: string;
  art_pending: boolean;
  derived: ReturnType<typeof deriveSheet>;
};
type Draft = Omit<AdminCharacterEdit, 'choices'> & { choices: Choices };
type Entry = {
  id: string;
  name: string;
  class: string;
  race: string;
  level: number;
  owner_name: string;
};
const adjustments = [
  ['hp', 'PV máximos'],
  ['armorClass', 'Classe de armadura'],
  ['initiative', 'Iniciativa'],
  ['speed', 'Deslocamento (m)'],
  ['passivePerception', 'Percepção passiva'],
  ['spellDC', 'CD de magia'],
  ['spellAttack', 'Ataque de magia'],
] as const;
function makeDraft(d: Data): Draft {
  const s = d.sheet,
    c = d.character;
  return {
    revision: d.revision,
    reason: 'Edição administrativa da ficha',
    name: c.name,
    race: c.race as Draft['race'],
    class: c.class as Draft['class'],
    level: c.level,
    biography: c.biography,
    stats: [...c.stats],
    progression_missions: c.progression_missions,
    gold_cp: c.gold_cp,
    choices: d.choices ?? defaultChoices(c.race, c.class),
    overrides: {
      ...(c.hp !== d.derived.hp ? { hp: c.hp } : {}),
      ...(c.armor_class !== d.derived.armorClass ? { armorClass: c.armor_class } : {}),
      ...c.sheet_overrides,
    },
    resources: {
      current_hp: s?.current_hp ?? c.hp,
      temp_hp: s?.temp_hp ?? 0,
      inspiration: s?.inspiration ?? false,
      death_success: s?.death_success ?? 0,
      death_failure: s?.death_failure ?? 0,
      slots_used: s?.slots_used ?? 0,
      hit_dice_used: s?.hit_dice_used ?? 0,
      prepared: s?.prepared ?? [],
      notes: s?.notes ?? '',
    },
  };
}
export function CharacterAdministration({
  characterId,
  onSaved,
  label = 'Editar ficha · Admin',
}: {
  characterId: string;
  onSaved?: () => void | Promise<void>;
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(characterId),
    [query, setQuery] = useState(''),
    [entries, setEntries] = useState<Entry[]>([]),
    [data, setData] = useState<Data | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [raw, setRaw] = useState('');
  useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = setTimeout(() => {
      void api<Entry[]>('/admin/characters?q=' + encodeURIComponent(query))
        .then((r) => {
          if (live) setEntries(r);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, query]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setData(null);
    setDraft(null);
    setError('');
    setNotice('');
    void api<Data>('/admin/characters/' + selected)
      .then((r) => {
        if (live) {
          setData(r);
          setDraft(makeDraft(r));
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [open, selected]);
  const automatic = useMemo(() => {
    if (!draft) return null;
    try {
      return deriveSheet({ ...draft, sheet_overrides: {} }, draft.choices);
    } catch {
      return data?.derived ?? null;
    }
  }, [draft?.race, draft?.class, draft?.level, draft?.stats, draft?.choices, data]);
  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  function updateOverride(key: keyof SheetOverrides, value: string) {
    if (!draft) return;
    const next = { ...draft.overrides };
    if (value === '') delete next[key];
    else Object.assign(next, { [key]: Number(value) });
    update({ overrides: next });
  }
  async function save() {
    if (!draft) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = adminCharacterEditSchema.parse(draft);
      const result = await post<Data>('/admin/characters/' + selected, body);
      setData(result);
      setDraft(makeDraft(result));
      setNotice('Alterações salvas na ficha.');
      await onSaved?.();
      window.dispatchEvent(
        new CustomEvent('character-admin-updated', { detail: { characterId: selected } }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="button outline small-button character-admin-launcher"
        onClick={() => {
          setSelected(characterId);
          setOpen(true);
        }}
      >
        <SlidersHorizontal size={15} />
        {label}
      </button>
      {open && (
        <Modal
          title="Administrar fichas"
          close={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div className="character-admin-editor">
            <label>
              <Search size={15} />
              Buscar personagem ou jogador
              <input
                aria-label="Buscar ficha administrativa"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              Personagem
              <select
                aria-label="Ficha para administrar"
                value={selected}
                disabled={busy}
                onChange={(e) => setSelected(e.target.value)}
              >
                {!entries.some((e) => e.id === selected) && (
                  <option value={selected}>{data?.character.name ?? 'Carregando…'}</option>
                )}
                {entries.map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.name} · {e.owner_name} · {e.class} {e.level}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p role="alert" className="character-admin-error">
                {error}
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
            {!draft || !data ? (
              <p role="status">Consultando ficha…</p>
            ) : (
              <form
                inert={busy}
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <p className="character-admin-owner">
                  Editando <strong>{draft.name}</strong> · jogador:{' '}
                  <strong>{data.owner_name}</strong>
                </p>
                <fieldset disabled={busy}>
                  <legend>Personagem e atributos</legend>
                  <div className="character-admin-grid">
                    <label>
                      Nome
                      <input
                        aria-label="Nome administrativo"
                        value={draft.name}
                        disabled={data.art_pending}
                        maxLength={60}
                        onChange={(e) => update({ name: e.target.value })}
                      />
                    </label>
                    <label>
                      Espécie
                      <select
                        aria-label="Espécie administrativa"
                        value={draft.race}
                        disabled={data.art_pending}
                        onChange={(e) => {
                          const race = e.target.value as Draft['race'];
                          update({
                            race,
                            choices: reconcileChoices(race, draft.class, draft.choices),
                          });
                        }}
                      >
                        {races.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Classe inicial
                      <select
                        aria-label="Classe administrativa"
                        value={draft.class}
                        disabled={data.art_pending}
                        onChange={(e) => {
                          const cls = e.target.value as Draft['class'];
                          update({
                            class: cls,
                            choices: reconcileChoices(draft.race, cls, draft.choices),
                          });
                        }}
                      >
                        {classes.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nível
                      <input
                        aria-label="Nível administrativo"
                        type="number"
                        min={1}
                        max={20}
                        value={draft.level}
                        onChange={(e) => update({ level: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Missões concluídas
                      <input
                        type="number"
                        min={0}
                        max={1000000}
                        value={draft.progression_missions}
                        onChange={(e) => update({ progression_missions: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Ouro (PO)
                      <input
                        aria-label="Ouro administrativo em PO"
                        type="number"
                        min={0}
                        max={21474836.47}
                        step="0.01"
                        value={draft.gold_cp / 100}
                        onChange={(e) =>
                          update({ gold_cp: Math.round(Number(e.target.value) * 100) })
                        }
                      />
                    </label>
                  </div>
                  <div className="character-admin-stats">
                    {statNames.map((name, i) => (
                      <label key={name}>
                        {name}
                        <input
                          aria-label={`Atributo administrativo: ${name}`}
                          type="number"
                          min={1}
                          max={30}
                          value={draft.stats[i]}
                          onChange={(e) => {
                            const stats = [...draft.stats];
                            stats[i] = Number(e.target.value);
                            update({ stats });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <label>
                    Biografia
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={draft.biography}
                      onChange={(e) => update({ biography: e.target.value })}
                    />
                  </label>
                  <p className="muted small">
                    Os atributos são valores finais. Reduzir o nível retira os avanços posteriores
                    da ficha; o registro administrativo conserva o estado anterior. Os dados
                    originais do slot permanecem salvos.
                  </p>
                </fieldset>
                <details>
                  <summary>Origem, características e aparência</summary>
                  <p className="muted small">
                    A aparência fica salva para a próxima arte. O retrato e o token atuais são
                    preservados.
                  </p>
                  {data.art_pending && (
                    <p role="status">
                      Há uma arte em preparação ou aguardando escolha. Conclua esse pedido para
                      editar a aparência.
                    </p>
                  )}
                  <fieldset disabled={busy || data.art_pending}>
                    <SheetChoices
                      race={draft.race}
                      cls={draft.class}
                      value={draft.choices}
                      onChange={(choices) => update({ choices })}
                    />
                  </fieldset>
                </details>
                <details>
                  <summary>Valores calculados e perícias</summary>
                  <p className="muted small">
                    Deixe vazio para usar o cálculo automático da ficha.
                  </p>
                  <div className="character-admin-grid">
                    {adjustments.map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          aria-label={`Ajuste: ${label}`}
                          type="number"
                          step={key === 'speed' ? '0.5' : '1'}
                          value={draft.overrides[key] ?? ''}
                          placeholder={`Automático: ${automatic?.[key] ?? '—'}`}
                          onChange={(e) => updateOverride(key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                  <details>
                    <summary>Salvaguardas</summary>
                    <div className="character-admin-stats">
                      {statNames.map((name, index) => (
                        <label key={name}>
                          {name}
                          <input
                            aria-label={`Salvaguarda administrativa: ${name}`}
                            type="number"
                            min={-100}
                            max={100}
                            value={draft.overrides.saves?.[index] ?? ''}
                            placeholder={String(automatic?.saves[index] ?? 0)}
                            onChange={(e) => {
                              const values = [
                                ...(draft.overrides.saves ?? automatic?.saves ?? Array(6).fill(0)),
                              ];
                              values[index] =
                                e.target.value === ''
                                  ? (automatic?.saves[index] ?? 0)
                                  : Number(e.target.value);
                              update({ overrides: { ...draft.overrides, saves: values } });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      className="button outline small-button"
                      type="button"
                      onClick={() => {
                        const next = { ...draft.overrides };
                        delete next.saves;
                        update({ overrides: next });
                      }}
                    >
                      Usar salvaguardas automáticas
                    </button>
                  </details>
                  <details>
                    <summary>Perícias</summary>
                    {automatic?.skills.map((skill) => {
                      const value = draft.overrides.skills?.[skill.name];
                      return (
                        <div className="character-admin-skill" key={skill.name}>
                          <label>
                            {skill.name}
                            <input
                              aria-label={`Perícia administrativa: ${skill.name}`}
                              type="number"
                              min={-100}
                              max={100}
                              value={value?.value ?? ''}
                              placeholder={String(skill.value)}
                              onChange={(e) => {
                                const skills = { ...draft.overrides.skills };
                                if (e.target.value === '') delete skills[skill.name];
                                else
                                  skills[skill.name] = { ...skill, value: Number(e.target.value) };
                                update({ overrides: { ...draft.overrides, skills } });
                              }}
                            />
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={value?.trained ?? skill.trained}
                              onChange={(e) =>
                                update({
                                  overrides: {
                                    ...draft.overrides,
                                    skills: {
                                      ...draft.overrides.skills,
                                      [skill.name]: {
                                        ...skill,
                                        ...value,
                                        trained: e.target.checked,
                                        expert: e.target.checked
                                          ? (value?.expert ?? skill.expert)
                                          : false,
                                      },
                                    },
                                  },
                                })
                              }
                            />
                            Treinada
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={value?.expert ?? skill.expert}
                              onChange={(e) =>
                                update({
                                  overrides: {
                                    ...draft.overrides,
                                    skills: {
                                      ...draft.overrides.skills,
                                      [skill.name]: {
                                        ...skill,
                                        ...value,
                                        expert: e.target.checked,
                                        trained: e.target.checked
                                          ? true
                                          : (value?.trained ?? skill.trained),
                                      },
                                    },
                                  },
                                })
                              }
                            />
                            Especialização
                          </label>
                        </div>
                      );
                    })}
                  </details>
                  {(['languages', 'proficiencies'] as const).map((key) => (
                    <label key={key}>
                      {key === 'languages' ? 'Idiomas' : 'Proficiências'} (uma por linha; vazio usa
                      o automático)
                      <textarea
                        rows={3}
                        value={draft.overrides[key]?.join('\n') ?? ''}
                        placeholder={automatic?.[key].join(', ')}
                        onChange={(e) => {
                          const next = { ...draft.overrides };
                          if (!e.target.value.trim()) delete next[key];
                          else
                            next[key] = e.target.value
                              .split('\n')
                              .map((v) => v.trim())
                              .filter(Boolean);
                          update({ overrides: next });
                        }}
                      />
                    </label>
                  ))}
                </details>
                <details>
                  <summary>Recursos e notas</summary>
                  <div className="character-admin-grid">
                    {(
                      [
                        ['current_hp', 'PV atuais'],
                        ['temp_hp', 'PV temporários'],
                        ['hit_dice_used', 'Dados de vida gastos'],
                        ['slots_used', 'Espaços de magia gastos'],
                        ['death_success', 'Sucessos contra morte'],
                        ['death_failure', 'Falhas contra morte'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          aria-label={`Recurso: ${label}`}
                          type="number"
                          min={0}
                          value={draft.resources[key] ?? ''}
                          onChange={(e) =>
                            update({
                              resources: {
                                ...draft.resources,
                                [key]:
                                  key === 'current_hp' && e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label className="character-admin-check">
                    <input
                      type="checkbox"
                      checked={draft.resources.inspiration}
                      onChange={(e) =>
                        update({ resources: { ...draft.resources, inspiration: e.target.checked } })
                      }
                    />
                    Inspiração
                  </label>
                  <label>
                    Magias preparadas
                    <select
                      multiple
                      size={8}
                      aria-label="Magias preparadas administrativas"
                      value={draft.resources.prepared}
                      onChange={(e) =>
                        update({
                          resources: {
                            ...draft.resources,
                            prepared: Array.from(e.target.selectedOptions).map((o) => o.value),
                          },
                        })
                      }
                    >
                      {spells
                        .filter((s) => s.level > 0)
                        .map((spell) => (
                          <option key={spell.id} value={spell.id}>
                            {spell.label} · nível {spell.level}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Notas
                    <textarea
                      rows={5}
                      maxLength={20000}
                      value={draft.resources.notes}
                      onChange={(e) =>
                        update({ resources: { ...draft.resources, notes: e.target.value } })
                      }
                    />
                  </label>
                </details>
                <details
                  onToggle={(e) => {
                    if (e.currentTarget.open) setRaw(JSON.stringify(draft.choices, null, 2));
                  }}
                >
                  <summary>Escolhas avançadas da ficha</summary>
                  <p className="muted small">
                    Inclui escolhas de níveis e subclasses. Ao trocar a classe inicial, os níveis já
                    registrados continuam nas respectivas classes. Aplique o texto antes de salvar.
                  </p>
                  <textarea
                    className="character-admin-json"
                    aria-label="Escolhas avançadas em JSON"
                    rows={14}
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                  />
                  <button
                    className="button outline"
                    type="button"
                    onClick={() => {
                      try {
                        const value = JSON.parse(raw);
                        const choices = validateChoices(draft.race, draft.class, value);
                        update({ choices: { ...choices, advancement: value.advancement } });
                        setError('');
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Aplicar escolhas avançadas
                  </button>
                </details>
                <label>
                  Motivo da alteração
                  <input
                    value={draft.reason}
                    maxLength={500}
                    onChange={(e) => update({ reason: e.target.value })}
                  />
                </label>
                <button
                  className="button primary character-admin-save"
                  type="submit"
                  disabled={busy}
                >
                  <Save size={16} />
                  {busy ? 'Salvando…' : 'Salvar alterações da ficha'}
                </button>
              </form>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
