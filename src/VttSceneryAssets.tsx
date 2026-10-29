import { VttAssetImage } from './VttAssetImage';
import { useEffect, useRef, useState } from 'react';
import { sceneryAssets, sceneryAssetMime, type SceneryAsset } from '../shared/vtt-scenery-assets';
import './vtt-scenery-assets.css';

export function VttSceneryAssets({
  query,
  gm,
  add,
}: {
  query: string;
  gm: boolean;
  add: (id: string, scale: number) => void;
}) {
  const [category, setCategory] = useState('Todos');
  const [selected, setSelected] = useState<SceneryAsset | null>(null);
  const [scale, setScale] = useState(1);
  const [limit, setLimit] = useState(40);
  const detail = useRef<HTMLDivElement>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('vtt-scenery-favorites') || '[]');
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('vtt-scenery-favorites', JSON.stringify(favorites));
    } catch {
      /* Browser storage is optional. */
    }
  }, [favorites]);
  useEffect(() => setLimit(40), [category, query]);
  useEffect(() => setSelected(null), [category]);
  useEffect(() => {
    if (selected)
      detail.current?.scrollIntoView({
        block: 'nearest',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
  }, [selected]);
  const categories = [
    'Todos',
    'Favoritos',
    ...[
      'Casa',
      'Acampamento',
      'Floresta',
      'Masmorra',
      'Construções',
      'Taverna',
      'Cidade',
      'Natureza',
      'Objetos',
      'Templo',
    ].filter((c) => sceneryAssets.some((a) => a.category === c)),
  ];
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const assets = sceneryAssets.filter(
    (a) =>
      (category === 'Todos' ||
        (category === 'Favoritos' ? favorites.includes(a.id) : a.category === category)) &&
      terms.every((term) => normalize(a.name + ' ' + a.category).includes(term)),
  );
  return (
    <section className="vtt-scenery">
      <header>
        <small>ACERVO DE CENÁRIOS · {sceneryAssets.length} PEÇAS</small>
        <h3>Peças para criar mundos</h3>
        <p>Madeira, pedra e natureza. Artes originais vistas de cima.</p>
      </header>
      <nav aria-label="Categorias de assets">
        {categories.map((c) => (
          <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </nav>
      <p className="vtt-scenery-count">
        {assets.length} peças ·{' '}
        {gm ? 'Arraste para o mapa ou abra uma prévia' : 'Escolha uma peça para ver os detalhes'}
      </p>
      {selected && (
        <div ref={detail} className="vtt-scenery-detail">
          <button
            className="vtt-scenery-close"
            aria-label="Fechar prévia do asset"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
          <div className="vtt-scenery-stage">
            <VttAssetImage src={selected.image} alt={selected.name} />
          </div>
          <h4>{selected.name}</h4>
          <p>
            {selected.category} · {Number((selected.width * scale).toFixed(2))} ×{' '}
            {Number((selected.height * scale).toFixed(2))} quadrados
          </p>
          <label>
            Escala
            <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
              {[0.5, 1, 1.5, 2, 3].map((v) => (
                <option key={v} value={v}>
                  {v}×
                </option>
              ))}
            </select>
          </label>
          {gm && (
            <button className="vtt-scenery-place" onClick={() => add(selected.id, scale)}>
              Colocar no mapa
            </button>
          )}
          <button
            aria-pressed={favorites.includes(selected.id)}
            onClick={() =>
              setFavorites((f) =>
                f.includes(selected.id)
                  ? f.filter((id) => id !== selected.id)
                  : [...f, selected.id],
              )
            }
          >
            {favorites.includes(selected.id) ? '★ Favorito' : '☆ Favoritar'}
          </button>
        </div>
      )}
      <div className="vtt-scenery-grid">
        {assets.slice(0, limit).map((a) => (
          <button
            key={a.id}
            className="vtt-scenery-card"
            aria-pressed={selected?.id === a.id}
            draggable={gm}
            onDragStart={(e) => {
              e.dataTransfer.setData(sceneryAssetMime, JSON.stringify({ id: a.id, scale: 1 }));
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => {
              setSelected(a);
              setScale(1);
            }}
          >
            <div className="vtt-scenery-stage">
              <VttAssetImage thumbnail loading="lazy" src={a.image} alt="" draggable={false} />
              <span>
                {Number(a.width.toFixed(2))} × {Number(a.height.toFixed(2))}
              </span>
            </div>
            <strong>{a.name}</strong>
            <small>{a.category}</small>
          </button>
        ))}
      </div>
      {assets.length > limit && (
        <button className="vtt-scenery-more" onClick={() => setLimit((v) => v + 40)}>
          Mostrar mais peças ({Math.min(limit, assets.length)} de {assets.length})
        </button>
      )}
      {!assets.length && <p role="status">Nenhuma peça encontrada nesta seleção.</p>}
    </section>
  );
}
