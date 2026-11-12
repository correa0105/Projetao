import { useState } from 'react';
import {
  emptyBastionProgression,
  bastionSpecialCost,
  type BastionProgression,
  type BastionRequirement,
} from '../shared/guild-bastion';
import type { GuildFacilityDefinition } from '../shared/guild-facilities';

export function GuildBastionEditor({
  value,
  change,
  tags,
}: {
  value: GuildFacilityDefinition;
  change: (value: GuildFacilityDefinition) => void;
  tags: { id: string; name: string; active: boolean }[];
}) {
  const [selected, select] = useState(1);
  const progression = value.progression || emptyBastionProgression();
  const tier = progression.levels[selected - 1];
  function update(patch: Partial<BastionProgression['levels'][number]>) {
    change({
      ...value,
      progression: {
        levels: progression.levels.map((t) => (t.level === selected ? { ...t, ...patch } : t)),
      },
    });
  }
  function requirement(index: number, next: BastionRequirement) {
    update({ requirements: tier.requirements.map((r, i) => (i === index ? next : r)) });
  }
  return (
    <div className="bastion-editor">
      <p>
        Configure o benefício completo de cada nível. Ele substitui o benefício anterior e deve
        melhorar com a evolução. O nível base já oferece o primeiro benefício.
      </p>
      <label>
        Nível a configurar
        <select
          aria-label="Nível a configurar"
          value={selected}
          onChange={(e) => select(Number(e.target.value))}
        >
          {progression.levels.map((t) => (
            <option key={t.level} value={t.level}>
              {t.level === 1 ? '1 · Base' : 'Nível ' + t.level} ·{' '}
              {t.enabled ? 'Liberado' : 'A definir'}
            </option>
          ))}
        </select>
      </label>
      <label>
        Benefício do nível {selected}
        <textarea
          aria-label={'Benefício do nível ' + selected}
          maxLength={1500}
          value={tier.benefit}
          placeholder="Descreva o benefício e seus valores."
          onChange={(e) => update({ benefit: e.target.value })}
        />
      </label>
      <label className="bastion-checkbox">
        <input
          type="checkbox"
          checked={tier.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
        Liberar este nível com as regras preenchidas
      </label>
      {selected > 1 && (
        <>
          <h4>Requisitos para alcançar o nível {selected}</h4>
          <p>
            Todos os requisitos devem ser cumpridos. Missões e tags conquistadas contam
            como metas acumuladas. Os custos são retirados do tesouro ao evoluir.
          </p>
          {tier.requirements.map((r, i) => (
            <fieldset className="bastion-requirement-editor" key={i}>
              <legend>Requisito {i + 1}</legend>
              <label>
                Tipo de requisito
                <select
                  aria-label="Tipo de requisito"
                  value={r.kind}
                  onChange={(e) => {
                    const kind = e.target.value as BastionRequirement['kind'];
                    requirement(
                      i,
                      kind === 'monster_tag'
                        ? { kind, target: r.target, tag_id: tags.find((t) => t.active)?.id || '' }
                        : kind === 'custom'
                          ? { kind, target: r.target, key: '', label: '' }
                          : { kind, target: r.target },
                    );
                  }}
                >
                  <option value="missions">Missões concluídas</option>
                  <option value="monster_tag">Tag de monstro</option>
                  <option value="monster_tags">Total de tags de monstros</option>
                  <option value="treasury">Créditos do Bastião no tesouro</option>
                  {bastionSpecialCost(value.room) === 'gold_cost' && <option value="gold_cost">Ouro da Ferraria</option>}
                  <option value="custom">Outro critério</option>
                </select>
              </label>
              {r.kind === 'monster_tag' && (
                <label>
                  Tag de monstro
                  <select
                    aria-label="Tag de monstro"
                    value={r.tag_id}
                    onChange={(e) => requirement(i, { ...r, tag_id: e.target.value })}
                  >
                    <option value="">Escolha uma tag</option>
                    {tags
                      .filter((t) => t.active || t.id === r.tag_id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.active ? '' : ' (inativa)'}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {r.kind === 'custom' && (
                <>
                  <label>
                    Nome do critério
                    <input
                      maxLength={100}
                      value={r.label}
                      onChange={(e) => requirement(i, { ...r, label: e.target.value })}
                    />
                  </label>
                  <label>
                    Identificador do critério
                    <input
                      maxLength={60}
                      pattern="[a-z][a-z0-9_]{1,59}"
                      placeholder="Ex.: relíquias → reliquias"
                      value={r.key}
                      onChange={(e) => requirement(i, { ...r, key: e.target.value })}
                    />
                  </label>
                  <p>
                    Use o mesmo identificador para acompanhar a mesma meta em outros níveis. O
                    progresso é confirmado pelo administrador.
                  </p>
                </>
              )}
              <label>
                {r.kind === 'treasury' ? 'Quantidade em CB' : r.kind === 'gold_cost' ? 'Quantidade em PO' : 'Quantidade necessária'}
                <input
                  type="number"
                  min={r.kind === 'treasury' || r.kind === 'gold_cost' ? 0.01 : 1}
                  max={r.kind === 'treasury' || r.kind === 'gold_cost' ? 10_000_000 : 1_000_000_000}
                  step={r.kind === 'treasury' || r.kind === 'gold_cost' ? 0.01 : 1}
                  value={r.kind === 'treasury' || r.kind === 'gold_cost' ? r.target / 100 : r.target}
                  onChange={(e) =>
                    requirement(i, {
                      ...r,
                      target:
                        r.kind === 'treasury' || r.kind === 'gold_cost'
                          ? Math.round(Number(e.target.value) * 100)
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
              <button
                className="button outline"
                type="button"
                onClick={() =>
                  update({ requirements: tier.requirements.filter((_, n) => n !== i) })
                }
              >
                Remover requisito
              </button>
            </fieldset>
          ))}
          <button
            className="button outline"
            type="button"
            disabled={tier.requirements.length >= 12}
            onClick={() =>
              update({ requirements: [...tier.requirements, { kind: bastionSpecialCost(value.room) ?? 'missions', target: 1 }] })
            }
          >
            Adicionar requisito
          </button>
          {!tier.requirements.length && (
            <p>Sem requisitos: ao liberar este nível, o fundador poderá evoluir gratuitamente.</p>
          )}
        </>
      )}
      {selected === 1 && (
        <p>
          O benefício base vale assim que esta instalação está disponível. Não há custo para
          ativá-lo.
        </p>
      )}
    </div>
  );
}
