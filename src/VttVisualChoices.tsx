import type { useVttMediaPreferences } from './vtt-media-preferences';

export function VttVisualChoices({ media }: { media: ReturnType<typeof useVttMediaPreferences> }) {
  return (
    <div className="vtt-visual-choices">
      <label className="vtt-check">
        <input
          type="checkbox"
          checked={media.mapEffects}
          onChange={(event) => media.update({ mapEffects: event.target.checked })}
        />
        Efeitos do mapa
      </label>
      <p>Clima, partículas e elementos animados do cenário.</p>
      <label className="vtt-check">
        <input
          type="checkbox"
          checked={media.masterEffects}
          onChange={(event) => media.update({ masterEffects: event.target.checked })}
        />
        Efeitos do mestre
      </label>
      <p>Magias, ataques, dados e efeitos visuais dos personagens.</p>
      <p className="vtt-required-visuals">
        Sempre ativos: iluminação dinâmica e horário da cena — amanhecer, sol da tarde, entardecer e
        noite.
      </p>
    </div>
  );
}
