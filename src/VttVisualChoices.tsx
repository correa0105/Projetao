import { CloudRain, Sparkles, Sun } from 'lucide-react';
import type { useVttMediaPreferences } from './vtt-media-preferences';

export function VttVisualChoices({ media }: { media: ReturnType<typeof useVttMediaPreferences> }) {
  return (
    <div className="vtt-visual-choices">
      <label className="vtt-visual-option">
        <CloudRain size={22} strokeWidth={1.5} aria-hidden="true" />
        <span>
          <b>Efeitos do mapa</b>
          <small>Clima, partículas e elementos animados do cenário.</small>
        </span>
        <input
          aria-label="Efeitos do mapa"
          type="checkbox"
          checked={media.mapEffects}
          onChange={(event) => media.update({ mapEffects: event.target.checked })}
        />
      </label>
      <label className="vtt-visual-option">
        <Sparkles size={22} strokeWidth={1.5} aria-hidden="true" />
        <span>
          <b>Efeitos do mestre</b>
          <small>Magias, ataques, dados e efeitos visuais dos personagens.</small>
        </span>
        <input
          aria-label="Efeitos do mestre"
          type="checkbox"
          checked={media.masterEffects}
          onChange={(event) => media.update({ masterEffects: event.target.checked })}
        />
      </label>
      <p className="vtt-required-visuals">
        <Sun size={18} aria-hidden="true" />
        <span>
          Sempre ativos: iluminação dinâmica e horário da cena — amanhecer, sol da tarde, entardecer
          e noite.
        </span>
      </p>
    </div>
  );
}
export function VttRememberChoices({
  media,
}: {
  media: ReturnType<typeof useVttMediaPreferences>;
}) {
  return (
    <label className="vtt-remember-choices">
      <input
        type="checkbox"
        aria-label="Não perguntar novamente"
        checked={media.skipVisualPrompt}
        onChange={(event) => media.update({ skipVisualPrompt: event.target.checked })}
      />
      <span>
        <b>Não perguntar novamente</b>
        <small>Usar estas preferências nas próximas entradas neste navegador.</small>
      </span>
    </label>
  );
}
