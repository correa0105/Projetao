import type { CSSProperties } from 'react';
import './character-level-badge.css';
import { LayeredClassBadge } from './LayeredClassBadge';

const identities: Record<string, { id: string; accent: string }> = {
  Artífice: { id: 'artificer', accent: '#b69560' },
  Bárbaro: { id: 'barbarian', accent: '#ba6954' },
  Bardo: { id: 'bard', accent: '#bd9463' },
  Bruxo: { id: 'warlock', accent: '#a28aba' },
  Clérigo: { id: 'cleric', accent: '#d1b474' },
  Druida: { id: 'druid', accent: '#9ca66d' },
  Feiticeiro: { id: 'sorcerer', accent: '#cd775c' },
  Guerreiro: { id: 'fighter', accent: '#c59b72' },
  Ladino: { id: 'rogue', accent: '#b391a4' },
  Mago: { id: 'wizard', accent: '#91a9d1' },
  Monge: { id: 'monk', accent: '#b8a36e' },
  Paladino: { id: 'paladin', accent: '#d5c387' },
  Patrulheiro: { id: 'ranger', accent: '#9ca777' },
};

export function CharacterLevelBadge({ className, level }: { className: string; level: number }) {
  const value = Number.isFinite(level) ? Math.max(1, Math.min(20, Math.trunc(level))) : 1;
  const tier = Math.ceil(value / 4);
  const progress = ((value - 1) % 4) + 1;
  const identity = identities[className] || identities.Guerreiro;
  return (
    <div
      className="sheet-rank-level class-level-badge"
      data-class={identity.id}
      data-level={value}
      data-tier={tier}
      role="img"
      aria-label={`${className}, nível ${value} de 20`}
      title={`${className} · Nível ${value}`}
      style={{ '--badge-accent': identity.accent } as CSSProperties}
    >
      <LayeredClassBadge id={identity.id} tier={tier} />
      <span className="level-badge-plaque" aria-hidden="true">
        <span className="level-badge-label">Nível</span>
        <strong className="level-badge-number">{value}</strong>
      </span>
      <span className="level-badge-milestones" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <i key={index} className={index < progress ? 'is-filled' : ''} />
        ))}
      </span>
    </div>
  );
}
