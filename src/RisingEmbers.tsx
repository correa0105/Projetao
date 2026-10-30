import { useEffect, useState, type CSSProperties } from 'react';
import './rising-embers.css';

export function RisingEmbers() {
  const [paused, setPaused] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const visibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  return (
    <div className="scene-embers" data-paused={paused} aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <i
          key={i}
          style={
            {
              left: ((i * 43) % 100) + '%',
              animationDelay: -i * 0.8 + 's',
              animationDuration: 12 + (i % 6) + 's',
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
