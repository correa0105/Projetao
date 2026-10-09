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
    <aside className="profile-visit-nav" aria-label="Abas do perfil visitado">
      {panels.map(({ id, name, icon: Icon }) => (
        <button
          type="button"
          className="profile-signboard"
          key={id}
          aria-label={name}
          aria-pressed={selected === id}
          onClick={() => onSelect(id)}
        >
          <span>
            <Icon size={16} aria-hidden="true" />
            {name}
          </span>
        </button>
      ))}
    </aside>
  );
}
