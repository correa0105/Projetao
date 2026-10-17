import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Layers, Lock, EyeOff } from 'lucide-react';
import { orderedTokens, type VttScene, type VttToken } from '../shared/vtt';
import { reorderVttItems, type StackAction } from '../shared/vtt-stacking';
import './vtt-map-controls.css';

export function VttStackButtons({
  disabled,
  apply,
}: {
  disabled: boolean;
  apply: (action: StackAction) => void;
}) {
  return (
    <div className="vtt-stack-buttons" role="group" aria-label="Ordem de sobreposição">
      {(
        [
          ['front', 'Trazer para frente', 'Frente', ChevronsUp],
          ['up', 'Subir uma camada', 'Subir', ArrowUp],
          ['down', 'Descer uma camada', 'Descer', ArrowDown],
          ['back', 'Enviar para trás', 'Trás', ChevronsDown],
        ] as const
      ).map(([action, label, name, Icon]) => (
        <button
          key={action}
          type="button"
          disabled={disabled}
          title={label}
          aria-label={label}
          onClick={() => apply(action)}
        >
          <Icon size={15} />
          {name}
        </button>
      ))}
    </div>
  );
}

export function VttItemLayers({
  scene,
  selection,
  disabled,
  edit,
  select,
}: {
  scene: VttScene;
  selection: string[];
  disabled: boolean;
  edit: (fn: (s: VttScene) => void) => void;
  select: (token: VttToken) => void;
}) {
  const selected = scene.tokens.find((t) => selection.includes(t.id));
  const linked = scene.tokens.some(
    (t) =>
      selection.includes(t.id) &&
      (t.attachment || scene.tokens.some((child) => child.attachment?.tokenId === t.id)),
  );
  return (
    <section id="vtt-item-layers" className="vtt-item-layers" aria-label="Camadas dos itens">
      <h3>
        <Layers size={16} />
        Sobreposição de itens
      </h3>
      <VttStackButtons
        disabled={disabled || !scene.tokens.some((t) => selection.includes(t.id))}
        apply={(action) => edit((s) => reorderVttItems(s.tokens, selection, action))}
      />
      <label>
        Camada dos itens selecionados
        <select
          aria-label="Camada dos itens selecionados"
          value={selected?.layer ?? 'map'}
          disabled={disabled || !selected || linked}
          onChange={(e) => {
            const layer = e.target.value as VttToken['layer'];
            edit((s) => {
              s.tokens
                .filter((t) => selection.includes(t.id))
                .forEach((t) => {
                  t.layer = layer;
                });
              reorderVttItems(s.tokens, selection, 'front');
            });
            if (selected) select({ ...selected, layer });
          }}
        >
          <option value="map">Fundo · mapa e mobília</option>
          <option value="tokens">Objetos e personagens</option>
          <option value="gm">Mestre · oculto aos jogadores</option>
        </select>
      </label>
      <p className="vtt-muted">
        Os itens no topo da lista aparecem por cima. Selecione pela lista para alcançar uma peça
        coberta.
      </p>
      <div className="vtt-stack-list">
        {(['gm', 'tokens', 'map'] as const).map((layer) => {
          const tokens = orderedTokens(scene.tokens)
            .filter((t) => t.layer === layer)
            .reverse();
          return (
            tokens.length > 0 && (
              <div
                key={layer}
                role="group"
                aria-label={
                  {
                    gm: 'Camada do mestre',
                    tokens: 'Camada dos personagens',
                    map: 'Camada do mapa',
                  }[layer]
                }
              >
                <strong>
                  {
                    {
                      gm: 'Mestre · oculto',
                      tokens: 'Personagens e tokens',
                      map: 'Mapa e mobília',
                    }[layer]
                  }
                </strong>
                {tokens.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    data-stack-item={t.id}
                    className={selection.includes(t.id) ? 'selected' : ''}
                    disabled={disabled}
                    aria-pressed={selection.includes(t.id)}
                    onClick={() => select(t)}
                  >
                    <span>{t.name}</span>
                    <small>{t.attachment ? 'Vinculado' : `Camada ${t.level}`}</small>
                    {t.locked && <Lock size={12} />} {t.hidden && <EyeOff size={12} />}
                  </button>
                ))}
              </div>
            )
          );
        })}
        {!scene.tokens.length && <p>Coloque um item no mapa para organizar suas camadas.</p>}
      </div>
    </section>
  );
}
