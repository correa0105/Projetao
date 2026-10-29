import { VttAssetImage } from './VttAssetImage';
import { useEffect, useState } from 'react';
import posters from '../shared/vtt-vehicle-thumbnails.json';
import { api } from './api';
import {
  vehicleDefinitions,
  vehicleMime,
  type OwnedVttVehicle,
  type VehicleId,
} from '../shared/vtt-vehicles';
export type VehiclePick = { characterId: string; itemId: VehicleId; copy: number };
export function VehiclePreview({ id }: { id: VehicleId }) {
  return <VttAssetImage thumbnail src={posters[id]} width={180} height={180}
    style={{width:84,height:100,objectFit:'contain',flexShrink:0}} alt="Veículo visto de cima"
    onLoad={event=>{event.currentTarget.dataset.ready='true';}}/>;
}
function VehicleRow({
  vehicle: v,
  disabled,
  bring,
}: {
  vehicle: OwnedVttVehicle;
  disabled: boolean;
  bring: (pick: VehiclePick) => void;
}) {
  const d = vehicleDefinitions[v.itemId],
    pick = { characterId: v.characterId, itemId: v.itemId, copy: 0 };
  return (
    <div className="vtt-vehicle-row">
      <button
        className="vtt-list-row vtt-character-row"
        disabled={disabled}
        draggable={!disabled}
        onDragStart={(e) => {
          e.dataTransfer.setData(vehicleMime, JSON.stringify(pick));
          e.dataTransfer.effectAllowed = 'copy';
        }}
        onClick={() => bring(pick)}
        title="Puxar para a mesa ou arrastar para o mapa"
      >
        <VehiclePreview id={v.itemId} />
        <span>
          <strong>{d.name}</strong>
          <small>
            {v.characterName} · {v.ownerName}
          </small>
          <small>
            {(d.lengthFt * 0.3048).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m de
            comprimento · {v.quantity} no inventário
          </small>
          {d.covered && <small>Cobertura transparente com personagem embaixo</small>}
        </span>
      </button>
    </div>
  );
}
export function VttVehicles({
  roomId,
  gm,
  disabled,
  bring,
}: {
  roomId: string;
  gm: boolean;
  disabled: boolean;
  bring: (pick: VehiclePick) => void;
}) {
  const [vehicles, setVehicles] = useState<OwnedVttVehicle[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(gm),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!gm) return;
    let live = true;
    setLoading(true);
    api<{ vehicles: OwnedVttVehicle[] }>(`/vtt/rooms/${roomId}/vehicles`)
      .then((r) => {
        if (live) {
          setVehicles(r.vehicles);
          setError('');
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [roomId, gm, revision]);
  return (
    <section aria-label="Veículos dos personagens">
      <h3>Veículos dos personagens</h3>
      <p className="vtt-muted">
        {gm
          ? 'Clique ou arraste para puxar o veículo comprado para a mesa. A escala acompanha o tamanho do veículo e a grade do mapa.'
          : 'Veículos comprados na loja ficam disponíveis aqui para o mestre puxar para a mesa.'}
      </p>
      {gm && (
        <>
          <button disabled={loading || disabled} onClick={() => setRevision((r) => r + 1)}>
            Atualizar compras
          </button>
          {loading && <p role="status">Consultando inventários…</p>}
          {error && <p role="alert">{error}</p>}
          {!loading && !vehicles.length && !error && (
            <p className="vtt-muted">
              Os personagens desta mesa ainda não têm veículos. Eles podem ser comprados na loja.
            </p>
          )}
          {vehicles.map((v) => (
            <VehicleRow
              key={`${v.characterId}-${v.itemId}`}
              vehicle={v}
              disabled={disabled}
              bring={bring}
            />
          ))}
        </>
      )}
    </section>
  );
}
