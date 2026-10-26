import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import {
  vehicleDefinitions,
  vehicleImage,
  vehicleMime,
  type OwnedVttVehicle,
  type VehicleId,
  type VehicleArt,
} from '../shared/vtt-vehicles';
import art from '../shared/vtt-vehicle-art.json';
export type VehiclePick = { characterId: string; itemId: VehicleId; copy: number };
export function VehiclePreview({ id }: { id: VehicleId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => {
      const c = canvas.current?.getContext('2d');
      if (!c || !live) return;
      const d = vehicleDefinitions[id],
        a: VehicleArt = art[id];
      c.clearRect(0, 0, 180, 180);
      const scale = Math.min(164 / d.widthFt, 164 / d.lengthFt),
        w = d.widthFt * scale,
        h = d.lengthFt * scale;
      for (const part of ['base', 'cover'] as const) {
        const r = a[part];
        if (!r) continue;
        const width = w * (part === 'base' ? d.baseWidth : 1),
          q = part === 'cover' ? a.coverTarget : undefined;
        c.drawImage(
          img,
          r[0] * img.width,
          r[1] * img.height,
          r[2] * img.width,
          r[3] * img.height,
          q ? (180 - w) / 2 + q[0] * w : (180 - width) / 2,
          q ? (180 - h) / 2 + q[1] * h : (180 - h) / 2,
          q ? q[2] * w : width,
          q ? q[3] * h : h,
        );
      }
      canvas.current!.dataset.ready = 'true';
    };
    img.src = vehicleImage(id);
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <canvas
      ref={canvas}
      width={180}
      height={180}
      style={{ width: 84, height: 100, objectFit: 'contain', flexShrink: 0 }}
      aria-label="Veículo visto de cima"
      role="img"
    />
  );
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
  const [copy, setCopy] = useState(0),
    d = vehicleDefinitions[v.itemId],
    pick = { characterId: v.characterId, itemId: v.itemId, copy };
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
      {v.quantity > 1 && (
        <label>
          Exemplar
          <input
            aria-label={`Exemplar de ${d.name}`}
            type="number"
            min={1}
            max={Math.min(v.quantity, 10000)}
            value={copy + 1}
            disabled={disabled}
            onChange={(e) =>
              setCopy(Math.max(0, Math.min(v.quantity - 1, 9999, Number(e.target.value) - 1)))
            }
          />
        </label>
      )}
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
