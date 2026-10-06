import { useState } from 'react';
import { monsterActions } from '../shared/vtt-monster-actions';
import { monsterSections } from '../shared/vtt-compendium';
import {
  monsterCustomizationSchema,
  monsterCustomDetails,
  type MonsterCustomization,
} from '../shared/vtt-monster-presets';
import type { VttToken } from '../shared/vtt';
import type { MonsterProfile } from './VttMonsterSheet';
import { api, post } from './api';

export function customMonster(profile: MonsterProfile, sourceId = ''): MonsterCustomization {
  const actions = profile.actions ?? monsterActions(profile.actionDetails ?? profile.details);
  const sections = monsterSections(profile.details);
  const traits = sections
    .filter((s) => !/^(?:Ações|Reações|Outras ações)/.test(s.title))
    .map(
      (s) =>
        '### ' +
        s.title +
        '\n' +
        s.blocks.map((b) => [b.name, ...b.paragraphs].filter(Boolean).join('\n')).join('\n'),
    )
    .join('\n\n');
  // Actions without dice remain editable and visible, including multiattack.
  const allActions = sections
    .filter((s) => /^(?:Ações|Reações|Outras ações)/.test(s.title))
    .flatMap((s, i) =>
      s.blocks.map((b, j) => {
        const parsed = actions.find((a) => a.name === b.name);
        return parsed
          ? { ...parsed, description: b.paragraphs.join('\n') }
          : {
              id: `description-${i}-${j}`,
              name: b.name || s.title,
              description: b.paragraphs.join('\n'),
              attack: null,
              damage: [],
            };
      }),
    );
  return monsterCustomizationSchema.parse({
    sourceId,
    size: profile.size || 'M',
    cr: profile.cr || '',
    speed: profile.speed || '30 ft',
    information: profile.information || [],
    traits,
    actions: allActions.length ? allActions : actions,
  });
}
export function VttMonsterEditor({
  roomId,
  token,
  profile,
  upload,
  save,
  done,
}: {
  roomId: string;
  token: VttToken;
  profile: MonsterProfile;
  upload: (file: File) => Promise<string>;
  save: (token: VttToken) => Promise<void>;
  done: () => void;
}) {
  const [draft, setDraft] = useState(() => ({
    ...structuredClone(token),
    monster: token.monster || customMonster(profile),
    sheet: token.sheet || {
      source: profile.source || 'Monstro personalizado',
      race: profile.type || '',
      class: '',
      level: 0,
      stats: profile.stats,
      speed: 30,
      biography: '',
      details: profile.details,
    },
  }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const m = draft.monster;
  const patch = (value: Partial<MonsterCustomization>) =>
    setDraft((d) => ({ ...d, monster: { ...d.monster, ...value } }));
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function translate() {
    const lines = [
      draft.name,
      draft.sheet.race,
      m.speed,
      m.traits,
      ...m.information.flatMap((i) => [i.label, i.value]),
      ...m.actions.flatMap((a) => [a.name, a.description]),
    ];
    const indexes = lines.map((s, i) => (s.trim() ? i : -1)).filter((i) => i >= 0);
    const result = await post<{ lines: string[] }>(`/vtt/rooms/${roomId}/translate-monster`, {
      lines: indexes.map((i) => lines[i]),
    });
    indexes.forEach((i, j) => {
      lines[i] = result.lines[j];
    });
    let cursor = 4;
    const information = m.information.map(() => ({
      label: lines[cursor++],
      value: lines[cursor++],
    }));
    const actions = m.actions.map((a) => ({
      ...a,
      name: lines[cursor++],
      description: lines[cursor++],
    }));
    setDraft((d) => ({
      ...d,
      name: lines[0],
      sheet: { ...d.sheet, race: lines[1] },
      monster: { ...d.monster, speed: lines[2], traits: lines[3], information, actions },
    }));
  }
  return (
    <form
      className="vtt-monster-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const monster = monsterCustomizationSchema.parse(m),
            details = monsterCustomDetails(monster);
          if (details.length > 40000) throw Error('A ficha precisa ter até 40 mil caracteres.');
          // Validate formulas using the same parser as the server before persisting.
          const { rollFormula } = await import('../shared/vtt-roll');
          for (const a of monster.actions)
            for (const f of [a.attack, ...a.damage]) if (f) rollFormula(f, (_min, max) => max - 1);
          await save({
            ...draft,
            monster,
            hp: Math.min(draft.hp, draft.maxHp),
            sheet: { ...draft.sheet, details },
          });
          done();
        });
      }}
    >
      <p>Esta cópia e o preset são seus. A biblioteca original é preservada.</p>
      <button type="button" disabled={busy} onClick={() => void run(translate)}>
        {busy ? 'Processando…' : 'Traduzir para português'}
      </button>
      <div className="vtt-monster-editor-grid">
        <label>
          Nome
          <input
            value={draft.name}
            maxLength={100}
            required
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </label>
        <label>
          Tipo
          <input
            value={draft.sheet.race}
            maxLength={100}
            onChange={(e) =>
              setDraft((d) => ({ ...d, sheet: { ...d.sheet, race: e.target.value } }))
            }
          />
        </label>
        <label>
          Tamanho
          <select value={m.size} onChange={(e) => patch({ size: e.target.value })}>
            {['T', 'S', 'M', 'L', 'H', 'G'].map((v, i) => (
              <option key={v} value={v}>
                {['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Imenso'][i]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nível de desafio
          <input value={m.cr} maxLength={40} onChange={(e) => patch({ cr: e.target.value })} />
        </label>
        <label>
          PV atuais
          <input
            type="number"
            min={0}
            max={100000}
            value={draft.hp}
            onChange={(e) => setDraft((d) => ({ ...d, hp: Number(e.target.value) }))}
          />
        </label>
        <label>
          PV máximos
          <input
            type="number"
            min={1}
            max={100000}
            value={draft.maxHp}
            onChange={(e) => setDraft((d) => ({ ...d, maxHp: Number(e.target.value) }))}
          />
        </label>
        <label>
          Classe de armadura
          <input
            type="number"
            min={0}
            max={100}
            value={draft.ac}
            onChange={(e) => setDraft((d) => ({ ...d, ac: Number(e.target.value) }))}
          />
        </label>
        <label>
          Deslocamento
          <input
            value={m.speed}
            maxLength={300}
            onChange={(e) => patch({ speed: e.target.value })}
          />
        </label>
      </div>
      <fieldset>
        <legend>Imagem do monstro</legend>
        {draft.image && <img className="vtt-editor-portrait" src={draft.image} alt={draft.name} />}
        <label>
          Enviar imagem
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void run(async () => {
                  const image = await upload(file);
                  setDraft((d) => ({ ...d, image }));
                });
            }}
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>Atributos</legend>
        <div className="vtt-monster-editor-grid">
          {['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'].map((label, i) => (
            <label key={label}>
              {label}
              <input
                type="number"
                min={0}
                max={100}
                value={draft.sheet.stats[i]}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    sheet: {
                      ...d.sheet,
                      stats: d.sheet.stats.map((v, j) => (j === i ? Number(e.target.value) : v)),
                    },
                  }))
                }
              />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Características e informações</legend>
        <label>
          Características
          <textarea
            rows={8}
            value={m.traits}
            maxLength={24000}
            onChange={(e) => patch({ traits: e.target.value })}
          />
        </label>
        {m.information.map((info, i) => (
          <div className="vtt-monster-editor-grid" key={i}>
            <label>
              Título
              <input
                value={info.label}
                onChange={(e) =>
                  patch({
                    information: m.information.map((v, j) =>
                      j === i ? { ...v, label: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              Informação
              <input
                value={info.value}
                onChange={(e) =>
                  patch({
                    information: m.information.map((v, j) =>
                      j === i ? { ...v, value: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={() => patch({ information: [...m.information, { label: '', value: '' }] })}
        >
          Adicionar informação
        </button>
      </fieldset>
      <fieldset>
        <legend>Ataques e ações</legend>
        {m.actions.map((a, i) => (
          <article key={a.id} className="vtt-monster-edit-action">
            <label>
              Nome da ação
              <input
                value={a.name}
                maxLength={150}
                onChange={(e) =>
                  patch({
                    actions: m.actions.map((v, j) =>
                      j === i ? { ...v, name: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              Descrição
              <textarea
                value={a.description}
                rows={3}
                maxLength={6000}
                onChange={(e) =>
                  patch({
                    actions: m.actions.map((v, j) =>
                      j === i ? { ...v, description: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <div className="vtt-monster-editor-grid">
              <label>
                Rolagem de ataque
                <input
                  placeholder="1d20+7"
                  value={a.attack || ''}
                  maxLength={100}
                  onChange={(e) =>
                    patch({
                      actions: m.actions.map((v, j) =>
                        j === i ? { ...v, attack: e.target.value || null } : v,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Dano (uma fórmula por linha)
                <textarea
                  value={a.damage.join('\n')}
                  rows={2}
                  onChange={(e) =>
                    patch({
                      actions: m.actions.map((v, j) =>
                        j === i ? { ...v, damage: e.target.value.split('\n').filter(Boolean) } : v,
                      ),
                    })
                  }
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => patch({ actions: m.actions.filter((_, j) => j !== i) })}
            >
              Remover ação
            </button>
          </article>
        ))}
        <button
          type="button"
          onClick={() =>
            patch({
              actions: [
                ...m.actions,
                {
                  id: crypto.randomUUID(),
                  name: 'Nova ação',
                  description: '',
                  attack: null,
                  damage: [],
                },
              ],
            })
          }
        >
          Adicionar ação
        </button>
      </fieldset>
      <label>
        Anotações
        <textarea
          value={draft.sheet.biography}
          rows={4}
          maxLength={16000}
          onChange={(e) =>
            setDraft((d) => ({ ...d, sheet: { ...d.sheet, biography: e.target.value } }))
          }
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <footer>
        <button disabled={busy} type="submit">
          Salvar ficha e preset
        </button>
        <button type="button" disabled={busy} onClick={done}>
          Cancelar
        </button>
      </footer>
    </form>
  );
}
