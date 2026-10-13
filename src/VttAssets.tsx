import { useState, type ReactNode, type DragEvent } from 'react';
import { Trees, Bird, Plus, X } from 'lucide-react';
import { treeAssets, treeAssetMime } from '../shared/vtt-tree-assets';
import './vtt-tree-assets.css';

export function VttAssets({
  enabled,
  query,
  gm,
  add,
  children,
}: {
  enabled: boolean;
  query: string;
  gm: boolean;
  add: (id: string, scale: number) => void;
  children: ReactNode;
}) {
  const [collection, setCollection] = useState('trees'),
    [group, setGroup] = useState('Todos'),
    [selected, setSelected] = useState(''),
    [scale, setScale] = useState(1);
  if (!enabled) return children;
  const item = treeAssets.find((a) => a.id === selected),
    normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean),
    shown = treeAssets.filter(
      (a) =>
        (group === 'Todos' || a.group === group) &&
        terms.every((t) => normalize(a.name + ' ' + a.group + ' árvore floresta').includes(t)),
    );
  const drag = (e: DragEvent, id: string) => {
    if (!gm) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(treeAssetMime, JSON.stringify({ id, scale }));
    e.dataTransfer.effectAllowed = 'copy';
  };
  return (
    <section className="vtt-world-assets" aria-label="Acervo de assets">
      <nav className="vtt-asset-collections" aria-label="Coleções de assets">
        <button aria-pressed={collection === 'trees'} onClick={() => setCollection('trees')}>
          <Trees size={14} /> Árvores <small>{treeAssets.length}</small>
        </button>
        <button
          aria-pressed={collection === 'creatures'}
          onClick={() => setCollection('creatures')}
        >
          <Bird size={14} /> Criaturas
        </button>
      </nav>
      {collection === 'creatures' ? (
        children
      ) : (
        <>
          <header>
            <small>FLORESTA · VISTA SUPERIOR</small>
            <h3>Árvores para seus mapas</h3>
            <p>
              Copas, galhos e folhas com transparência. Arraste uma árvore para o mapa ou escolha
              sua escala.
            </p>
          </header>
          <nav className="vtt-tree-groups" aria-label="Tipos de árvores">
            {['Todos', ...new Set(treeAssets.map((a) => a.group))].map((g) => (
              <button
                key={g}
                aria-pressed={group === g}
                onClick={() => {
                  setGroup(g);
                  setSelected('');
                }}
              >
                {g}
              </button>
            ))}
          </nav>
          <div className="vtt-tree-count">
            {shown.length} árvores{!gm && ' · Somente visualização'}
          </div>
          {item && (
            <article className="vtt-tree-preview">
              <button
                className="vtt-tree-close"
                aria-label="Fechar prévia da árvore"
                onClick={() => setSelected('')}
              >
                <X size={15} />
              </button>
              <img src={item.image} alt={item.name} />
              <h4>{item.name}</h4>
              <p>
                {item.group} · {item.squares * scale} × {item.squares * scale} quadrados
              </p>
              <label>
                Escala
                <select
                  aria-label="Escala da árvore"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                >
                  {[0.5, 1, 1.5, 2].map((s) => (
                    <option key={s} value={s}>
                      {s}×
                    </option>
                  ))}
                </select>
              </label>
              {gm && (
                <button className="vtt-tree-place" onClick={() => add(item.id, scale)}>
                  <Plus size={14} /> Colocar no mapa
                </button>
              )}
            </article>
          )}
          <div className="vtt-tree-grid">
            {shown.map((a) => (
              <button
                className="vtt-tree-card"
                key={a.id}
                draggable={gm}
                onDragStart={(e) => drag(e, a.id)}
                onClick={() => setSelected(a.id)}
                aria-label={'Asset: ' + a.name}
                aria-pressed={selected === a.id}
                title={gm ? 'Arraste para o mapa ou veja a prévia' : a.name}
              >
                <span>
                  <img src={a.image} alt="" loading="lazy" draggable={false} />
                </span>
                <strong>{a.name}</strong>
                <small>{a.group}</small>
              </button>
            ))}
          </div>
          {!shown.length && <p>Nenhuma árvore encontrada. Experimente outro nome ou tipo.</p>}
        </>
      )}
    </section>
  );
}
