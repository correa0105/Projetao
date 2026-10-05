import { useLayoutEffect, useRef, useState } from 'react';
import type { BossBar } from '../shared/vtt';
import './vtt-boss.css';
function Bar({ boss }: { boss: BossBar }) {
  const percent = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
  const previous = useRef(percent),
    [heal, setHeal] = useState<{ from: number; to: number } | null>(null);
  const [healed, setHealed] = useState(false);
  useLayoutEffect(() => {
    setHealed(false);
    const from = previous.current;
    previous.current = percent;
    if (percent <= from) {
      setHeal(null);
      return;
    }
    setHeal({ from, to: percent });
    const timer = setTimeout(() => {
      setHealed(true);
      setHeal(null);
    }, 1400);
    return () => clearTimeout(timer);
  }, [percent]);
  return (
    <div className={'vtt-boss-bar style-' + boss.style} aria-label={'Boss · ' + boss.name}>
      <div className="vtt-boss-title">
        <strong>{boss.name}</strong>
        <small>
          {Math.max(0, boss.hp)} / {boss.maxHp}
        </small>
      </div>
      <div
        className="vtt-boss-track"
        role="progressbar"
        aria-label={'PV de ' + boss.name}
        aria-valuenow={Math.max(0, Math.min(boss.maxHp, boss.hp))}
        aria-valuemin={0}
        aria-valuemax={boss.maxHp}
      >
        <div
          className="vtt-boss-red"
          style={{
            width: (heal ? heal.from : percent) + '%',
            transition: heal || healed ? 'none' : undefined,
          }}
        />
        {heal && (
          <div
            className="vtt-boss-heal"
            style={{ left: heal.from + '%', width: heal.to - heal.from + '%' }}
          />
        )}
      </div>
    </div>
  );
}
export function VttBossBars({ bars }: { bars: BossBar[] }) {
  return (
    <div className="vtt-boss-bars" aria-label="Barras dos bosses">
      {bars.map((boss) => (
        <Bar key={boss.tokenId} boss={boss} />
      ))}
    </div>
  );
}
