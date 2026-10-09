import { useEffect, useRef } from 'react';
import {
  animatedAssets,
  animatedAssetMime,
  type AnimatedAsset,
} from '../shared/vtt-animated-assets';
import { newDocument, newToken } from '../shared/vtt';
import { drawAnimatedAsset } from './vtt-animated-assets';
import { effectMaterialsReady } from './vtt-effects-materials';
import { physicalPropsReady } from './vtt-effects-physical';
function Preview({ id, image }: { id: AnimatedAsset['id']; image: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!.getContext('2d')!,
      art = new Image();
    art.src = image;
    const scene = newDocument(crypto.randomUUID()).scenes[0],
      token = newToken(crypto.randomUUID(), scene);
    token.width = token.height = 180;
    token.animatedAsset = { id, speed: 1, intensity: 0.8, playing: true };
    let frame = 0,
      visible = false,
      disposed = false,
      ready = false,
      last = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)'),
      observer = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
      });
    observer.observe(ref.current!);
    const paint = (time: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(paint);
      if (!visible || document.hidden || time - last < 66 || !ready) return;
      last = time;
      c.clearRect(0, 0, 192, 192);
      c.save();
      c.translate(96, 96);
      drawAnimatedAsset(c, token, art, time, reduced.matches, true);
      c.restore();
    };
    void Promise.all([
      effectMaterialsReady,
      physicalPropsReady,
      image ? art.decode().catch(() => {}) : Promise.resolve(),
    ]).then(() => {
      ready = true;
    });
    frame = requestAnimationFrame(paint);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [id, image]);
  return <canvas ref={ref} width={192} height={192} aria-label="Prévia animada vista de cima" />;
}
export function VttAnimatedAssets({
  query,
  gm,
  add,
}: {
  query: string;
  gm: boolean;
  add: (id: AnimatedAsset['id']) => void;
}) {
  const rows = animatedAssets.filter((a) =>
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
            <Preview id={a.id} image={a.image} />
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
