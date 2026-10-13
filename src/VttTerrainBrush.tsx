import { Eye, EyeOff, Plus, ArrowUp, ArrowDown, Trash2, Paintbrush, Eraser } from 'lucide-react';
import { terrainTextures } from '../shared/vtt-terrain';
import type { TerrainLayer, TerrainStroke } from '../shared/vtt';
import './vtt-terrain-brush.css';
export type TerrainBrushSettings = Pick<
  TerrainStroke,
  'texture' | 'radius' | 'softness' | 'opacity' | 'textureScale' | 'shape' | 'layer'
>;
export function VttTerrainBrush({
  value,
  change,
  mode,
  activate,
  clear,
  hasPaint,
  gm,
  busy,
  layers,
  updateLayers,
  removeLayer,
}: {
  value: TerrainBrushSettings;
  change: (value: TerrainBrushSettings) => void;
  mode: string;
  activate: (erase: boolean) => void;
  clear: () => void;
  hasPaint: boolean;
  gm: boolean;
  busy: boolean;
  layers: TerrainLayer[];
  updateLayers: (layers: TerrainLayer[]) => void;
  removeLayer: (id: string) => void;
}) {
  const selected = layers.find((l) => l.id === value.layer) || layers[0],
    blocked = !gm || busy;
  function choose(id: string) {
    change({ ...value, layer: id });
  }
  function update(patch: Partial<TerrainLayer>) {
    updateLayers(layers.map((l) => (l.id === selected.id ? { ...l, ...patch } : l)));
  }
  function reorder(step: number) {
    const index = layers.findIndex((l) => l.id === selected.id),
      target = index + step;
    if (target < 0 || target >= layers.length) return;
    const next = [...layers];
    [next[index], next[target]] = [next[target], next[index]];
    updateLayers(next);
  }
  return (
    <section className="vtt-terrain-brush" aria-label="Brush do mapa">
      <h3>Pintar o mapa</h3>
      <p>Escolha uma textura e arraste no mapa. A borracha limpa somente a camada selecionada.</p>
      <div className="vtt-terrain-modes">
        <button
          disabled={blocked || !selected.visible}
          aria-pressed={mode === 'terrain-paint'}
          onClick={() => activate(false)}
        >
          <Paintbrush size={15} />
          Pincel
        </button>
        <button
          disabled={blocked || !selected.visible}
          aria-pressed={mode === 'terrain-erase'}
          onClick={() => activate(true)}
        >
          <Eraser size={15} />
          Borracha
        </button>
      </div>
      <div className="vtt-terrain-textures" aria-label="Texturas do brush">
        {terrainTextures.map((t) => (
          <button
            key={t.id}
            disabled={blocked}
            aria-label={'Textura: ' + t.name}
            aria-pressed={value.texture === t.id}
            onClick={() => {
              change({ ...value, texture: t.id });
              activate(false);
            }}
          >
            <img src={t.image} alt="" />
            <span>{t.name}</span>
          </button>
        ))}
      </div>
      {value.texture === 'water' && <p>A espuma acompanha a margem ao soltar o pincel. Pinte água sobre terra ou areia para formar a costa.</p>}
      <label>
        Formato do brush
        <select
          aria-label="Formato do brush"
          disabled={blocked}
          value={value.shape}
          onChange={(e) => change({ ...value, shape: e.target.value as TerrainStroke['shape'] })}
        >
          <option value="round">Redondo</option>
          <option value="square">Quadrado</option>
          <option value="rough">Irregular</option>
        </select>
      </label>
      <label>
        Raio · {value.radius} px
        <input
          aria-label="Raio do pincel de chão"
          disabled={blocked}
          type="range"
          min="5"
          max="500"
          step="5"
          value={value.radius}
          onChange={(e) => change({ ...value, radius: +e.target.value })}
        />
      </label>
      <label>
        Suavidade · {Math.round(value.softness * 100)}%
        <input
          aria-label="Suavidade do pincel"
          disabled={blocked}
          type="range"
          min="0"
          max="1"
          step=".05"
          value={value.softness}
          onChange={(e) => change({ ...value, softness: +e.target.value })}
        />
      </label>
      <label>
        Opacidade do pincel · {Math.round(value.opacity * 100)}%
        <input
          aria-label="Opacidade do pincel"
          disabled={blocked}
          type="range"
          min=".05"
          max="1"
          step=".05"
          value={value.opacity}
          onChange={(e) => change({ ...value, opacity: +e.target.value })}
        />
      </label>
      <label>
        Tamanho da textura · {value.textureScale} px
        <input
          aria-label="Tamanho da textura de chão"
          disabled={blocked}
          type="range"
          min="50"
          max="1000"
          step="25"
          value={value.textureScale}
          onChange={(e) => change({ ...value, textureScale: +e.target.value })}
        />
      </label>
      <section className="vtt-terrain-layers" aria-label="Camadas da pintura">
        <header>
          <h4>Camadas</h4>
          <button
            aria-label="Adicionar camada de pintura"
            disabled={blocked || layers.length >= 8}
            onClick={() => {
              const id = crypto.randomUUID();
              updateLayers([
                ...layers,
                { id, name: 'Camada ' + (layers.length + 1), visible: true, opacity: 1 },
              ]);
              choose(id);
            }}
          >
            <Plus size={14} />
            Nova
          </button>
        </header>
        <p>A camada no topo da lista cobre as demais.</p>
        {[...layers].reverse().map((l) => (
          <div className="vtt-terrain-layer" key={l.id}>
            <button
              aria-label={(l.visible ? 'Ocultar' : 'Mostrar') + ' camada ' + l.name}
              aria-pressed={l.visible}
              disabled={blocked}
              onClick={() =>
                updateLayers(
                  layers.map((item) =>
                    item.id === l.id ? { ...item, visible: !item.visible } : item,
                  ),
                )
              }
            >
              {l.visible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
            <button
              className="vtt-terrain-layer-name"
              aria-pressed={selected.id === l.id}
              onClick={() => choose(l.id)}
            >
              {l.name}
            </button>
          </div>
        ))}
        <label>
          Nome da camada
          <input
            aria-label="Nome da camada de pintura"
            disabled={blocked}
            value={selected.name}
            maxLength={60}
            onChange={(e) => update({ name: e.target.value.trim() ? e.target.value : 'Camada' })}
            onBlur={() => {
              if (!selected.name.trim()) update({ name: 'Camada' });
            }}
          />
        </label>
        <label>
          Opacidade da camada · {Math.round(selected.opacity * 100)}%
          <input
            aria-label="Opacidade da camada de pintura"
            disabled={blocked}
            type="range"
            min="0"
            max="1"
            step=".05"
            value={selected.opacity}
            onChange={(e) => update({ opacity: +e.target.value })}
          />
        </label>
        <div className="vtt-terrain-layer-tools">
          <button
            aria-label="Subir camada de pintura"
            disabled={blocked || selected.id === layers.at(-1)?.id}
            onClick={() => reorder(1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            aria-label="Descer camada de pintura"
            disabled={blocked || selected.id === layers[0].id}
            onClick={() => reorder(-1)}
          >
            <ArrowDown size={15} />
          </button>
          <button
            aria-label="Excluir camada de pintura"
            disabled={blocked || selected.id === 'base'}
            onClick={() => {
              removeLayer(selected.id);
              choose('base');
            }}
          >
            <Trash2 size={15} />
          </button>
          <button disabled={blocked || !hasPaint} onClick={clear}>
            Limpar camada
          </button>
        </div>
      </section>
      <p>
        Esc sai do pincel. Desfazer recupera traços, camadas e partes apagadas. A pintura é salva
        com a mesa.
      </p>
    </section>
  );
}
