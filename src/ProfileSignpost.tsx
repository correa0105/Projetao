import type { CSSProperties } from 'react';
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
      <svg className="profile-signpost-pole" viewBox="520 15 100 1355" aria-hidden="true">
        <image href="/profile-signpost-v1.webp" width="1139" height="1381" />
      </svg>
      {panels.map(({ id, name, icon: Icon }, i) => (
        <button
          type="button"
          className="profile-signboard"
          key={id}
          aria-label={name}
          aria-pressed={selected === id}
          onClick={() => onSelect(id)}
          style={{ '--plank-tilt': `${[-3, 3, -2, 2, -1][i]}deg` } as CSSProperties}
        >
          <svg className="profile-signboard-art" viewBox="15 100 2145 510" aria-hidden="true">
            <image href="/profile-signboard-v1.webp" width="2172" height="724" />
          </svg>
          <span>
            <Icon size={16} aria-hidden="true" />
            {name}
          </span>
        </button>
      ))}
    </aside>
  );
}
