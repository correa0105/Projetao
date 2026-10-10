import { conditionIcons, toggledCondition } from '../shared/vtt-condition-icons';
import type { CSSProperties } from 'react';
import './vtt-conditions.css';
export function VttConditionMenu({
  conditions,
  gm,
  enabled,
  busy,
  onChange,
}: {
  conditions: string[];
  gm: boolean;
  enabled: boolean;
  busy: boolean;
  onChange: (next: string[]) => void;
}) {
  return (
    <details className="vtt-condition-menu" onToggle={e=>{const section=e.currentTarget;if(!section.open)return;requestAnimationFrame(()=>{const popup=section.closest<HTMLElement>('.vtt-context-menu');if(popup)popup.scrollTop+=section.getBoundingClientRect().top-popup.getBoundingClientRect().top-42;});}}>
      <summary>
        Condições <span>{conditions.length || ''}</span>
      </summary>
      <div className="vtt-condition-grid" role="group" aria-label="Ícones de condições">
        {conditionIcons.map((icon) => {
          const selected = conditions.includes(icon.name),
            blocked = selected && !gm,
            full = !selected && conditions.length >= 30;
          return (
            <button
              key={icon.name}
              type="button"
              aria-label={icon.name}
              aria-pressed={selected}
              disabled={!enabled || busy || blocked || full}
              style={{ '--condition-color': icon.color } as CSSProperties}
              title={
                blocked
                  ? `${icon.name} · Somente o mestre pode remover condições.`
                  : full
                    ? 'Limite de 30 condições.'
                    : `${icon.name} · ${icon.hint}`
              }
              onClick={() => onChange(toggledCondition(conditions, icon.name, gm))}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {icon.paths.map((path, index) => (
                  <path
                    key={index}
                    d={path.d}
                    fillRule="evenodd"
                    fill={path.fill ? 'currentColor' : 'none'}
                    stroke={path.fill ? 'none' : 'currentColor'}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
              <span>{icon.name}</span>
            </button>
          );
        })}
      </div>
      {conditions
        .filter((name) => !conditionIcons.some((icon) => icon.name === name))
        .map((name) => (
          <button
            className="vtt-condition-custom"
            type="button"
            key={name}
            disabled={!gm || !enabled || busy}
            onClick={() => onChange(conditions.filter((item) => item !== name))}
          >
            ◇ {name} {gm ? '×' : ''}
          </button>
        ))}
    </details>
  );
}
