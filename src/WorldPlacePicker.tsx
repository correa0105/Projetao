import { useEffect, useState } from 'react';
import type { AtlasData } from './types';
import { api } from './api';
export function WorldPlacePicker({
  regionId,
  locationId,
  onRegionChange,
  onLocationChange,
  required = false,
}: {
  regionId: string;
  locationId: string;
  onRegionChange: (id: string) => void;
  onLocationChange: (id: string) => void;
  required?: boolean;
}) {
  const [atlas, setAtlas] = useState<AtlasData | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void api<AtlasData>('/atlas')
      .then((a) => {
        if (live) setAtlas(a);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="stack world-place-picker">
      <label>
        Reino
        <select
          aria-label="Reino"
          value={regionId}
          required={required}
          onChange={(e) => {
            onRegionChange(e.target.value);
            onLocationChange('');
          }}
        >
          <option value="">Escolha o reino</option>
          {atlas?.regions
            .filter((r) => r.available)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Área específica da missão
        <select
          aria-label="Área específica da missão"
          value={locationId}
          disabled={!regionId || !atlas}
          required={required || !!regionId}
          onChange={(e) => onLocationChange(e.target.value)}
        >
          <option value="">Escolha o local no reino</option>
          {atlas?.locations
            .filter((l) => l.region_id === regionId)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
