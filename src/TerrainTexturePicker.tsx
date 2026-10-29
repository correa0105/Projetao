import { VttAssetImage } from './VttAssetImage';
import { useState } from 'react';
import { terrainTextures, type TerrainTextureId } from '../shared/vtt-terrain';
import { referenceGrassTextures } from '../shared/reference-grass';
import './terrain-texture-picker.css';

// Prioritize the supplied grasses in the UI without changing saved material IDs or catalog order.
const terrainBrushTextures = [
  referenceGrassTextures[2],
  referenceGrassTextures[3],
  referenceGrassTextures[0],
  referenceGrassTextures[1],
  ...terrainTextures.filter((t) => !referenceGrassTextures.some((g) => g.id === t.id)),
];

const searchable = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

export function TerrainTexturePicker({
  value,
  change,
  className,
  disabled = false,
  labelPrefix = '',
}: {
  value: TerrainTextureId;
  change: (id: TerrainTextureId) => void;
  className: string;
  disabled?: boolean;
  labelPrefix?: string;
}) {
  const [query, setQuery] = useState('');
  const selected = terrainBrushTextures.find((t) => t.id === value);
  const shown = terrainBrushTextures.filter((t) =>
    searchable(t.name).includes(searchable(query.trim())),
  );
  return (
    <div className="terrain-texture-picker">
      <label className="terrain-texture-search">
        Buscar textura
        <input
          type="search"
          aria-label="Buscar textura de terreno"
          placeholder="Grama, terra, pedra…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {selected && (
        <div className="terrain-texture-selected" aria-label="Textura selecionada">
          <VttAssetImage thumbnail src={'thumbnail' in selected ? selected.thumbnail : selected.image} alt="" />
          <span>
            Textura selecionada<strong>{selected.name}</strong>
          </span>
        </div>
      )}
      <div className={className} aria-label="Texturas do brush">
        {shown.map((t) => (
          <button
            type="button"
            key={t.id}
            disabled={disabled}
            aria-label={labelPrefix + t.name}
            aria-pressed={value === t.id}
            onClick={() => change(t.id)}
          >
            <VttAssetImage thumbnail src={'thumbnail' in t ? t.thumbnail : t.image} alt="" loading="lazy" />
            <span>{t.name}</span>
          </button>
        ))}
      </div>
      {!shown.length && <p role="status">Nenhuma textura encontrada.</p>}
    </div>
  );
}
