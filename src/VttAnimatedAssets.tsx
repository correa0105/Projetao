import { VttAssetImage } from './VttAssetImage';
import posters from '../shared/vtt-animated-thumbnails.json';
import {
  animatedAssets,
  animatedAssetMime,
  type AnimatedAsset,
} from '../shared/vtt-animated-assets';
export function VttAnimatedAssets({
  query,
  gm,
  add,
}: {
  query: string;
  gm: boolean;
  add: (id: AnimatedAsset['id']) => void;
}) {
  const removed = new Set<AnimatedAsset['id']>([
    'candles',
    'windmill',
    'fountain',
    'magic-pool',
    'crystals',
    'chest',
    'spellbook',
  ]);
  const rows = animatedAssets.filter(
    (a) =>
      !removed.has(a.id) &&
      (a.name + ' ' + a.description)
        .toLocaleLowerCase('pt-BR')
        .includes(query.toLocaleLowerCase('pt-BR')),
  );
  return (
    <div className="vtt-animated-library">
      <p>Elementos de ambiente vistos de cima. Arraste para o mapa ou clique em adicionar.</p>
      <div className="vtt-animated-grid">
        {rows.map((a) => (
          <article
            key={a.id}
            draggable={gm}
            onDragStart={(e) => {
              if (!gm) return;
              e.dataTransfer.setData(animatedAssetMime, a.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <VttAssetImage thumbnail src={(posters as Record<string,string>)[a.id] || a.image} fallback={a.image} width={192} height={192} alt="" aria-label="Prévia estática vista de cima" />
            <strong>{a.name}</strong>
            <p>{a.description}</p>
            {gm && (
              <button onClick={() => add(a.id)} aria-label={'Adicionar ' + a.name}>
                Adicionar
              </button>
            )}
          </article>
        ))}
      </div>
      {!rows.length && <p>Nenhum asset encontrado.</p>}
    </div>
  );
}
