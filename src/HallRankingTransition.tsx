import { useEffect, useRef } from 'react';
import { startHallSmoke } from './hall-smoke';

/** A decorative seam between the full screen exhibition and the ranking. */
export function HallRankingTransition() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) return startHallSmoke(ref.current);
  }, []);
  return <canvas ref={ref} className="hall-ranking-smoke" aria-hidden="true" />;
}
