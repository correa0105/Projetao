import type { LucideIcon } from 'lucide-react';

export function ProfileSignpost<T extends string>({
  panels,
  selected,
  onSelect,
}: {
  panels: { id: T; name: string; icon: LucideIcon }[];
  selected: T;
  onSelect: (panel: T) => void;
}) {
  return (
    <nav className="profile-visit-nav" role="tablist" aria-label="Abas do perfil visitado">
      {panels.map(({ id, name, icon: Icon }, index) => (
        <button
          type="button"
          className="profile-tab"
          key={id}
          aria-label={name}
          id={'profile-tab-' + id}
          data-profile-tab={id}
          role="tab"
          aria-controls={'profile-panel-' + id}
          aria-selected={selected === id}
          aria-pressed={selected === id}
          tabIndex={selected === id ? 0 : -1}
          onClick={() => onSelect(id)}
          onKeyDown={(event) => {
            let next = index;
            if (event.key === 'ArrowRight') next = (index + 1) % panels.length;
            else if (event.key === 'ArrowLeft') next = (index + panels.length - 1) % panels.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = panels.length - 1;
            else return;
            event.preventDefault();
            onSelect(panels[next].id);
            const button = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
              '[data-profile-tab="' + panels[next].id + '"]',
            );
            button?.focus();
            button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }}
        >
          <span>
            <Icon size={16} aria-hidden="true" />
            {name}
          </span>
        </button>
      ))}
    </nav>
  );
}
