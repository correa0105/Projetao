import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import type { Character } from './types';

export function ProfileMenu({
  character,
  children,
  open,
  onOpenChange,
}: {
  character?: Character;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => setFailed(false), [character?.id, character?.portrait_revision]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [onOpenChange]);
  return (
    <aside
      ref={root}
      className="topbar player-hud profile-menu"
      aria-label="Personagem e conta"
      data-pinned={open}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onOpenChange(false);
      }}
    >
      <div className="profile-menu-controls" id="profile-menu-controls">
        {children}
      </div>
      <button
        type="button"
        className="profile-avatar"
        aria-label={`Abrir menu de ${character?.name || 'personagem e conta'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span className="profile-face">
          {character && character.portrait_revision > 0 && !failed ? (
            <img
              key={`${character.id}-${character.portrait_revision}`}
              src={`/api/characters/${character.id}/portrait?v=${character.portrait_revision}`}
              alt={`Rosto de ${character.name}`}
              onError={() => setFailed(true)}
              onLoad={(event) => {
                const image = event.currentTarget;
                const canvas = document.createElement('canvas');
                canvas.width = 128;
                canvas.height = Math.round((128 * image.naturalHeight) / image.naturalWidth);
                const context = canvas.getContext('2d', { willReadFrequently: true });
                if (!context) return;
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
                let top = 0;
                for (; top < canvas.height; top++) {
                  let visible = 0;
                  for (let x = 45; x < 83; x++)
                    if (pixels[(top * 128 + x) * 4 + 3] > 100) visible++;
                  if (visible >= 5) break;
                }
                if (top >= canvas.height) return;
                const crop = canvas.height * 0.18;
                image.style.width = `${(128 / crop) * 100}%`;
                image.style.left = `${(0.5 - 64 / crop) * 100}%`;
                image.style.top = `${(-top / crop) * 100}%`;
                image.style.transform = 'none';
              }}
            />
          ) : (
            <UserRound aria-hidden="true" />
          )}
        </span>
      </button>
    </aside>
  );
}
