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
        <svg viewBox="0 0 72 118" aria-hidden="true">
          <defs>
            <linearGradient id={paint + '-metal'} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#ede0bb" />
              <stop offset=".26" stopColor="#a7844d" />
              <stop offset=".55" stopColor="#65513a" />
              <stop offset=".78" stopColor="#d0b17a" />
              <stop offset="1" stopColor="#806443" />
            </linearGradient>
          </defs>
          <path
            d="M17 9 63 58 17 109 9 101 49 58 9 17Z"
            fill={'url(#' + paint + '-metal)'}
            stroke="#3a2b1a"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="m17 13 42 45-42 47M13 18l38 40-38 42"
            fill="none"
            stroke="#efe0b4"
            strokeOpacity=".62"
            strokeWidth="1.1"
          />
          <path d="m19 24 29 31m-29 39 29-31" fill="none" stroke="#342a20" strokeWidth="1.2" />
          <path d="m53 53 5 5-5 5-5-5Z" fill="#d9c392" stroke="#5a442a" />
          <path d="m17 17 4 4-4 4-4-4Zm0 75 4 4-4 4-4-4Z" fill="#dfcc9f" stroke="#665034" />
        </svg>
        <span className="profile-arrow-caption">{next.name}</span>
      </button>
      <span className="profile-panel-announcement" aria-live="polite" aria-atomic="true">
        Aba do perfil: {panels[index]?.name}
      </span>
    </nav>
  );
}
