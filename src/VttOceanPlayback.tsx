import { useEffect, useState } from 'react';
import { Pause, Play, Waves } from 'lucide-react';
import { oceanAnimationEnabled, type Ocean, type OceanMotionPreference } from '../shared/vtt-naval';
export function VttOceanPlayback({
  ocean,
  mapEffects,
  preference,
  change,
}: {
  ocean: Ocean;
  mapEffects: boolean;
  preference: OceanMotionPreference;
  change: (next: 'on' | 'off') => void;
}) {
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)'),
      update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const playing = oceanAnimationEnabled(ocean, mapEffects, preference, reduced);
  return (
    <div className="vtt-ocean-playback" role="group" aria-label="Reprodução das ondas">
      <Waves size={16} />
      <span>
        {playing
          ? 'Ondas em movimento'
          : ocean.animated
            ? 'Ondas pausadas neste dispositivo'
            : 'Água parada pelo mestre'}
      </span>
      {ocean.animated && (
        <button
          type="button"
          aria-label={playing ? 'Pausar ondas neste dispositivo' : 'Ativar ondas neste dispositivo'}
          aria-pressed={playing}
          onClick={() => change(playing ? 'off' : 'on')}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pausar' : 'Ativar ondas'}
        </button>
      )}
    </div>
  );
}
