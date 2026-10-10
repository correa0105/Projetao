import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';

export function ProfileNextArrow<T extends string>({
  panels,
  selected,
  onSelect,
}: {
  panels: { id: T; name: string; icon: LucideIcon }[];
  selected: T;
  onSelect: (panel: T) => void;
}) {
  const paint = useId(),
    index = panels.findIndex((p) => p.id === selected);
  const next = panels[(index + 1) % panels.length];
  return (
    <nav className="profile-next-nav" aria-label="Navegação do perfil visitado">
      {panels.map(({ id, name }) => (
        <span className="profile-panel-label" id={'profile-tab-' + id} key={id}>
          {name}
        </span>
      ))}
      {index > 0 && (
        <button
          type="button"
          className="profile-next-arrow profile-previous-arrow"
          aria-label={'Aba anterior: ' + panels[index - 1].name}
          aria-controls={'profile-panel-' + panels[index - 1].id}
          title={'Aba anterior: ' + panels[index - 1].name}
          onClick={() => onSelect(panels[index - 1].id)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              onSelect(panels[index - 1].id);
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              onSelect(next.id);
            } else if (event.key === 'Home') {
              event.preventDefault();
              onSelect(panels[0].id);
            } else if (event.key === 'End') {
              event.preventDefault();
              onSelect(panels[panels.length - 1].id);
            }
          }}
        >
          <svg viewBox="0 0 40 56" aria-hidden="true">
            <path
              className="profile-arrow-glow"
              d="m10 9 19 19-19 19"
              fill="none"
              stroke="#dfbc7c"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="m10 9 19 19-19 19"
              fill="none"
              stroke={'url(#' + paint + '-metal)'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="profile-arrow-caption">{panels[index - 1].name}</span>
        </button>
      )}
      <button
        type="button"
        className="profile-next-arrow"
        aria-label={'Próxima aba: ' + next.name}
        aria-controls={'profile-panel-' + next.id}
        title={'Próxima aba: ' + next.name}
        onClick={() => onSelect(next.id)}
        onKeyDown={(event) => {
          let to: number;
          if (event.key === 'ArrowRight') to = (index + 1) % panels.length;
          else if (event.key === 'ArrowLeft') to = (index + panels.length - 1) % panels.length;
          else if (event.key === 'Home') to = 0;
          else if (event.key === 'End') to = panels.length - 1;
          else return;
          event.preventDefault();
          onSelect(panels[to].id);
        }}
      >
        <svg viewBox="0 0 40 56" aria-hidden="true">
          <defs>
            <linearGradient id={paint + '-metal'} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#ad8d59" />
              <stop offset=".5" stopColor="#f2dfb5" />
              <stop offset="1" stopColor="#ad8d59" />
            </linearGradient>
          </defs>
          <path
            className="profile-arrow-glow"
            d="m10 9 19 19-19 19"
            fill="none"
            stroke="#dfbc7c"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m10 9 19 19-19 19"
            fill="none"
            stroke={'url(#' + paint + '-metal)'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="profile-arrow-caption">{next.name}</span>
      </button>
      <span className="profile-panel-announcement" aria-live="polite" aria-atomic="true">
        Aba do perfil: {panels[index]?.name}
      </span>
    </nav>
  );
}
