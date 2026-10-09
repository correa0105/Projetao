import { X, Sparkles, RotateCcw, Trash2, Move, Wind } from 'lucide-react';
import { shapeNames } from '../shared/vtt-spells';
import { vttUpdateMessage } from '../shared/vtt-protocol';
import type { VttSpellsController } from './useVttSpells';
import type { VttScene } from '../shared/vtt';
import './vtt-spells.css';
export function VttSpellControls({
  spells,
  scene,
  gm,
  userId,
}: {
  spells: VttSpellsController;
  scene: VttScene;
  gm: boolean;
  userId: string;
}) {
  const { pending: p, profile, actor } = spells;
  const active = spells.effects.filter(
    (e) => e.persistent && (!e.expires || e.expires > Date.now()),
  );
  return (
    <>
      {spells.error && (
        <div className="vtt-spell-error" role="alert">
          {spells.error}
          {spells.error === vttUpdateMessage && (
            <button onClick={() => window.location.reload()}>Recarregar VTT</button>
          )}
          <button aria-label="Fechar aviso de magia" onClick={spells.clearError}>
            <X size={14} />
          </button>
        </div>
      )}
      {p && profile && (
        <section className="vtt-spell-preparation" aria-label="Preparação da magia">
          <header>
            <Sparkles size={18} />
            <div>
              <strong>{profile.name}</strong>
              <small>
                {actor?.name} · {p.moveEffectId ? 'mover efeito' : 'preparar conjuração'}
              </small>
            </div>
            <button disabled={spells.busy} aria-label="Cancelar conjuração" onClick={spells.cancel}>
              <X size={16} />
            </button>
          </header>
          {!!profile.level && !p.moveEffectId && (
            <label>
              Espaço de magia
              <select
                aria-label="Nível do espaço de magia"
                disabled={spells.busy}
                value={p.slot}
                onChange={(e) => spells.update({ slot: Number(e.target.value) })}
              >
                {Array.from({ length: 10 - profile.level }, (_, i) => profile.level + i).map(
                  (n) => (
                    <option key={n} value={n}>
                      Nível {n}
                      {p.free
                        ? ''
                        : ' · ' +
                          Math.max(
                            0,
                            (p.data?.resources.slots_total[n - 1] || 0) -
                              (p.data?.resources.slots_used[n - 1] || 0),
                          ) +
                          ' restantes'}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}
          {!!profile.alternatives?.length && !p.moveEffectId && (
            <label>
              Forma
              <select
                aria-label="Forma da magia"
                disabled={spells.busy}
                value={p.variant}
                onChange={(e) => spells.update({ variant: Number(e.target.value) })}
              >
                {profile.alternatives.map((o, i) => (
                  <option key={i} value={i} disabled={(o.minSlot || 0) > p.slot}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {gm && profile.level > 0 && !p.moveEffectId && (
            <label className="vtt-spell-check">
              <input
                type="checkbox"
                checked={p.free}
                disabled={spells.busy}
                onChange={(e) => spells.update({ free: e.target.checked })}
              />
              Conjuração livre do mestre
            </label>
          )}
          <p className="vtt-spell-instruction">
            {profile.mode === 'self'
              ? profile.follow
                ? 'A magia acompanha o conjurador.'
                : 'A magia parte da posição do conjurador.'
              : profile.mode === 'targets'
                ? (profile.repeat ? 'Disparos' : 'Alvos') +
                  ': ' +
                  p.targets.length +
                  '/' +
                  profile.count +
                  ' · faltam até ' +
                  Math.max(0, profile.count - p.targets.length) +
                  '. Clique nos tokens' +
                  (profile.repeat ? ' (pode repetir o alvo)' : '') +
                  '.'
                : profile.origin.startsWith('caster')
                  ? 'Aponte e clique na direção do efeito.'
                  : profile.shape === 'wall'
                    ? 'Clique na origem e depois na direção da parede.'
                    : 'Clique no chão para marcar a área.'}
          </p>
          {profile.destinationRange && (
            <small>
              Clique também no chão para indicar o destino, até {profile.destinationRange} pés. O
              deslocamento do token continua sob controle da mesa.
            </small>
          )}
          {profile.shape && (
            <p className="vtt-spell-footprint">
              {shapeNames[profile.shape]} {profile.size} pés
              {['line', 'wall'].includes(profile.shape)
                ? ' × ' + profile.width + ' pés'
                : ''} ·{' '}
              {(profile.size / (scene.grid.scale * (scene.grid.unit === 'm' ? 1 / 0.3048 : 1)))
                .toFixed(1)
                .replace('.0', '')}{' '}
              quadrados{profile.shape === 'sphere' ? ' de raio' : ''}
              {profile.areas > 1 ? ' · ' + p.points.length + '/' + profile.areas + ' áreas' : ''}
            </p>
          )}
          {profile.shape &&
            profile.mode === 'targets' &&
            !profile.areaFromTargets &&
            !p.points.length && (
              <p>Marque primeiro a área no chão, depois escolha os tokens dentro dela.</p>
            )}
          {profile.conditional && (
            <small>Selecione apenas os saltos permitidos pelo resultado dos dados.</small>
          )}
          {profile.objectBudget && (
            <small>Limite pelo modificador de conjuração: Grande custa 2; Enorme custa 3.</small>
          )}
          {profile.chain && (
            <small>
              Alvos secundários até {profile.chain} pés do{' '}
              {profile.chainFromLast ? 'alvo anterior' : 'primeiro alvo'}.
            </small>
          )}
          {profile.contiguous && <small>Os painéis devem se conectar.</small>}
          {profile.higher && p.slot > profile.level && (
            <details>
              <summary>O que muda neste espaço</summary>
              <p>{profile.higher}</p>
            </details>
          )}
          {profile.concentration && (
            <small>
              Concentração · o efeito permanece na cena; conjurar outra concentração encerra a
              anterior.
            </small>
          )}
          {!!p.targets.length && (
            <div className="vtt-spell-target-list">
              {p.targets.map((id, i) => (
                <button
                  key={i}
                  disabled={spells.busy || !!(profile.includeSelf && id === actor?.id)}
                  onClick={() => spells.update({ targets: p.targets.filter((_, n) => n !== i) })}
                >
                  {scene.tokens.find((t) => t.id === id)?.name || 'Alvo'}
                  <X size={11} />
                </button>
              ))}
            </div>
          )}
          <footer>
            <button
              disabled={spells.busy || (!p.targets.length && !p.points.length && !p.anchor)}
              onClick={spells.undo}
            >
              <RotateCcw size={13} />
              Desfazer
            </button>
            <button
              className="vtt-gold"
              disabled={spells.busy || !spells.ready || !spells.available}
              onClick={() => void spells.cast()}
            >
              {spells.busy
                ? 'Aplicando…'
                : p.moveEffectId
                  ? 'Confirmar posição'
                  : 'Confirmar conjuração'}
            </button>
          </footer>
          {!spells.available && <small>Escolha um nível com espaço disponível.</small>}
        </section>
      )}
      {!!active.length && (
        <details className="vtt-scene-spells">
          <summary>
            <Sparkles size={14} /> Magias na cena · {active.length}
          </summary>
          <div>
            {active.map((e) => (
              <article key={e.id}>
                <div>
                  <strong>{e.name}</strong>
                  <small>
                    {scene.tokens.find((t) => t.id === e.actorId)?.name}
                    {e.concentration ? ' · concentração' : ''}
                  </small>
                </div>
                {e.profile.breath &&
                  e.targets.map((id) => {
                    const target = scene.tokens.find((t) => t.id === id);
                    return target && (gm || target.controller === userId) ? (
                      <button
                        key={id}
                        title={'Baforada de ' + target.name}
                        aria-label={'Exalar ' + e.name + ' · ' + target.name}
                        onClick={() => spells.exhale(e, id)}
                      >
                        <Wind size={14} />
                      </button>
                    ) : null;
                  })}
                {e.profile.movable &&
                  !e.profile.follow &&
                  (gm || scene.tokens.find((t) => t.id === e.actorId)?.controller === userId) && (
                    <button
                      title="Mover área sem gastar outro espaço"
                      aria-label={'Mover ' + e.name}
                      onClick={() => spells.move(e)}
                    >
                      <Move size={14} />
                    </button>
                  )}
                {(gm || scene.tokens.find((t) => t.id === e.actorId)?.controller === userId) && (
                  <button
                    title="Encerrar efeito"
                    aria-label={'Remover ' + e.name}
                    onClick={() => void spells.remove(e.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </article>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
