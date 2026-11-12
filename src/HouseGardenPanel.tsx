import { useEffect, useRef, useState } from 'react';
import { Droplet, FlaskConical, Sprout } from 'lucide-react';
import {
  gardenComposts,
  gardenCrops,
  type GardenAction,
  type HouseGarden,
} from '../shared/house-garden';
import { money } from '../shared/rules';
import { api, ApiError, post } from './api';

function remaining(timestamp: string, now: number) {
  const minutes = Math.max(0, Math.ceil((Date.parse(timestamp) - now) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

export function HouseGardenPanel({
  plotId,
  characterId,
  characterName,
  onChanged,
  onStateChanged,
  onArrange,
}: {
  plotId: string;
  characterId: string;
  characterName: string;
  onChanged?: () => Promise<void>;
  onStateChanged?: (garden: HouseGarden) => void;
  onArrange?: (role: 'bed' | 'compost') => Promise<void>;
}) {
  const path = '/house-v2/plots/' + plotId + '/garden';
  const [snapshot, setSnapshot] = useState<{ garden: HouseGarden; received: number }>();
  const [tick, setTick] = useState(Date.now);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const requests = useRef(new Map<string, string>());

  useEffect(() => {
    let active = true;
    void api<HouseGarden>(path)
      .then((garden) => {
        if (active) {
          setSnapshot({ garden, received: Date.now() });
          onStateChanged?.(garden);
        }
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message);
      });
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [path]);

  async function act(operation: GardenAction) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const key = JSON.stringify(operation);
    const request = requests.current.get(key) ?? crypto.randomUUID();
    requests.current.set(key, request);
    try {
      const result = await post<{
        garden: HouseGarden;
        gold_delta_cp: number;
        item_id: string | null;
      }>(path, {
        character_id: characterId,
        request_id: request,
        operation,
      });
      requests.current.delete(key);
      setSnapshot({ garden: result.garden, received: Date.now() });
      onStateChanged?.(result.garden);
      if (result.item_id) setNotice('Uma Poção de Cura foi guardada na mochila.');
      if (result.gold_delta_cp > 0)
        setNotice(`Colheita vendida por ${money(result.gold_delta_cp)} PO.`);
      if (operation.action === 'harvest' || result.gold_delta_cp) void onChanged?.().catch(() => {});
    } catch (failure) {
      setError((failure as Error).message);
      if (failure instanceof ApiError && failure.status === 409) {
        await api<HouseGarden>(path)
          .then((garden) => {
            setSnapshot({ garden, received: Date.now() });
          })
          .catch(() => {});
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (!snapshot)
    return error ? <p role="alert">{error}</p> : <p role="status">Consultando a horta…</p>;
  const { garden, received } = snapshot;
  const now = Date.parse(garden.server_time) + Math.max(0, tick - received);
  const crop = garden.crop && gardenCrops[garden.crop];
  const compost = garden.compost && gardenComposts[garden.compost];
  const cropReady = !!garden.ready_at && Date.parse(garden.ready_at) <= now;
  const compostReady = !!garden.compost_ready_at && Date.parse(garden.compost_ready_at) <= now;

  return (
    <div className="h2-garden">
      <p>
        <strong>{characterName}</strong> · {money(garden.gold_cp)} PO
      </p>
      <p>Os tempos de cultivo e fermentação contam em horas reais.</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section className="h2-garden-card" aria-label="Canteiro">
        <h3>
          <Sprout size={18} aria-hidden="true" /> Canteiro
        </h3>
        {onArrange && <button className="button outline" disabled={busy} onClick={() => void onArrange('bed')}>Posicionar canteiro no terreno</button>}
        {!crop ? (
          (Object.keys(gardenCrops) as (keyof typeof gardenCrops)[]).map((id) => {
            const seed = gardenCrops[id];
            return (
              <div key={id} className="h2-garden-option">
                <strong>{seed.name}</strong>
                <p>
                  {seed.hours} h após regar · Venda por {money(seed.saleCp)} PO
                  {seed.healing ? ' ou uma Poção de Cura' : ''}
                </p>
                <button
                  type="button"
                  disabled={busy || garden.gold_cp < seed.seedCp}
                  onClick={() => void act({ action: 'plant', crop: id })}
                >
                  Plantar {seed.name} · {money(seed.seedCp)} PO
                </button>
              </div>
            );
          })
        ) : (
          <>
            <strong>{crop.name}</strong>
            <p>
              {cropReady
                ? 'Pronta para colher.'
                : garden.ready_at
                  ? `Em crescimento · faltam ${remaining(garden.ready_at, now)}.`
                  : 'Aguardando rega. Regue para começar o cultivo.'}
              {garden.fertilized && ' Adubo aplicado.'}
            </p>
            {!garden.ready_at && (
              <button type="button" disabled={busy} onClick={() => void act({ action: 'water' })}>
                <Droplet size={15} aria-hidden="true" /> Regar
              </button>
            )}
            {garden.ready_at && !cropReady && compostReady && !garden.fertilized && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void act({ action: 'fertilize' })}
              >
                Aplicar adubo fermentado
              </button>
            )}
            {cropReady && (
              <>
                {crop.healing && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act({ action: 'harvest', destination: 'healing' })}
                  >
                    Colher e preparar Poção de Cura
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act({ action: 'harvest', destination: 'sell' })}
                >
                  Colher e vender · {money(crop.saleCp)} PO
                </button>
              </>
            )}
          </>
        )}
      </section>
      <section className="h2-garden-card" aria-label="Fermentador">
        <h3>
          <FlaskConical size={18} aria-hidden="true" /> Fermentador
        </h3>
        {onArrange && <button className="button outline" disabled={busy} onClick={() => void onArrange('compost')}>Posicionar fermentador no terreno</button>}
        {compost && garden.compost_ready_at ? (
          <>
            <strong>{compost.name}</strong>
            <p>
              {compostReady
                ? 'Adubo pronto para aplicar.'
                : `Fermentando · faltam ${remaining(garden.compost_ready_at, now)}.`}
            </p>
            <p>Reduz o cultivo em {compost.reductionHours} h. Cada planta aceita uma aplicação.</p>
          </>
        ) : (
          (Object.keys(gardenComposts) as (keyof typeof gardenComposts)[]).map((id) => {
            const recipe = gardenComposts[id];
            return (
              <div key={id} className="h2-garden-option">
                <strong>{recipe.name}</strong>
                <p>
                  Fermenta em {recipe.hours} h e reduz o cultivo em {recipe.reductionHours} h.
                </p>
                <button
                  type="button"
                  disabled={busy || garden.gold_cp < recipe.costCp}
                  onClick={() => void act({ action: 'ferment', compost: id })}
                >
                  Fermentar {recipe.name.toLocaleLowerCase('pt-BR')} · {money(recipe.costCp)} PO
                </button>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
