import { navalMotion, rowing, sailMasts, type Ocean } from '../shared/vtt-naval';
import type { VttToken } from '../shared/vtt';
export function VttNavalControls({
  token,
  edit,
  commit,
  disabled = false,
}: {
  token: VttToken;
  edit: (p: Partial<VttToken>) => void;
  commit?: () => void;
  disabled?: boolean;
}) {
  const id = token.vehicle?.itemId;
  if (!id || (!sailMasts[id] && !rowing[id])) return null;
  const m = navalMotion(token),
    patch = (v: Partial<typeof m>, save = true) => {
      edit({ vehicleMotion: { ...m, ...v } });
      if (save) commit?.();
    };
  return (
    <fieldset className="vtt-naval-controls" disabled={disabled}>
      <legend>Velas e remos</legend>
      {sailMasts[id] && (
        <>
          <label className="vtt-check">
            <input
              type="checkbox"
              checked={m.sail === 'inflated'}
              onChange={(e) => patch({ sail: e.target.checked ? 'inflated' : 'furled' })}
            />
            Inflar velas
          </label>
          <label className="vtt-check">
            <input
              type="checkbox"
              checked={m.sailsAnimated}
              onChange={(e) => patch({ sailsAnimated: e.target.checked })}
            />
            Animar velas ao vento
          </label>
          <label>
            Orientação das velas{' '}
            <input
              aria-label="Orientação das velas"
              type="range"
              min={-180}
              max={180}
              step={5}
              value={m.sailAngle}
              onChange={(e) => patch({ sailAngle: Number(e.target.value) }, false)}
              onPointerUp={commit}
              onKeyUp={commit}
            />
            <output>{m.sailAngle}°</output>
          </label>
        </>
      )}
      {rowing[id] && (
        <label className="vtt-check">
          <input
            type="checkbox"
            checked={m.oarsAnimated}
            onChange={(e) => patch({ oarsAnimated: e.target.checked })}
          />
          Remar
        </label>
      )}
      <label>
        Ritmo{' '}
        <input
          aria-label="Ritmo do barco"
          type="range"
          min={0.25}
          max={2}
          step={0.05}
          value={m.speed}
          onChange={(e) => patch({ speed: Number(e.target.value) }, false)}
          onPointerUp={commit}
          onKeyUp={commit}
        />
        <output>{m.speed.toFixed(2)}×</output>
      </label>
    </fieldset>
  );
}
export function VttOceanControls({
  value,
  change,
}: {
  value: Ocean;
  change: (p: Partial<Ocean>) => void;
}) {
  return (
    <fieldset className="vtt-ocean-controls">
      <legend>Oceano</legend>
      <label className="vtt-check">
        <input
          type="checkbox"
          checked={value.animated}
          onChange={(e) => change({ animated: e.target.checked })}
        />
        Animar água
      </label>
      <label>
        Ritmo das ondas
        <input
          aria-label="Ritmo das ondas"
          type="range"
          min={0.25}
          max={2}
          step={0.05}
          value={value.speed}
          onChange={(e) => change({ speed: Number(e.target.value) })}
        />
      </label>
      {(['seaVolume', 'windVolume'] as const).map((key) => (
        <label key={key}>
          {key === 'seaVolume' ? 'Som do mar' : 'Som do vento'}
          <input
            aria-label={key === 'seaVolume' ? 'Som do mar' : 'Som do vento'}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={value[key]}
            onChange={(e) => change({ [key]: Number(e.target.value) })}
          />
          <output>{Math.round(value[key] * 100)}%</output>
        </label>
      ))}
      <p className="vtt-muted">
        0% silencia. Pinte terra ou areia com o brush para formar ilhas e margens.
      </p>
    </fieldset>
  );
}
