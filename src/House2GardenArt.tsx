import { useEffect, useState } from 'react';
import { gardenCrops, gardenGrowthStage, gardenStageImage } from '../shared/house-garden';
import type { House2Item } from '../shared/house-v2';

export function House2GardenArt({
  item,
  width,
  height,
}: {
  item: House2Item;
  width: number;
  height: number;
}) {
  const [clock, setClock] = useState(() => ({ received: Date.now(), tick: Date.now() }));
  useEffect(() => {
    setClock({ received: Date.now(), tick: Date.now() });
    const timer = window.setInterval(
      () => setClock((current) => ({ ...current, tick: Date.now() })),
      15_000,
    );
    return () => window.clearInterval(timer);
  }, [item.garden]);
  const garden = item.garden;
  const now = garden
    ? Date.parse(garden.server_time) + Math.max(0, clock.tick - clock.received)
    : clock.tick;
  const stage = gardenGrowthStage(garden, now);
  const compost = item.garden_role === 'compost';
  const label = compost
    ? !garden?.compost
      ? 'Fermentador vazio'
      : Date.parse(garden.compost_ready_at!) <= now
        ? 'Adubo pronto'
        : 'Adubo em fermentação'
    : !garden?.crop
      ? 'Canteiro vazio'
      : gardenCrops[garden.crop].name +
        ' · ' +
        ['Aguardando rega', 'Brotando', 'Em crescimento', 'Pronta para colher'][stage];
  return (
    <>
      <title>{label}</title>
      <image
        data-garden-stage={compost ? undefined : stage}
        href={compost ? '/house2/garden-20261111/fermentador.webp' : gardenStageImage(garden, now)}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
      />
    </>
  );
}
