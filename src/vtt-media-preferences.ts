import { useState } from 'react';
type Preferences = {
  mapEffects: boolean;
  masterEffects: boolean;
  soundEnabled: boolean;
  soundVolume: number;
};
const defaults: Preferences = {
  mapEffects: true,
  masterEffects: true,
  soundEnabled: true,
  soundVolume: 0.65,
};
export function useVttMediaPreferences(userId: string) {
  const key = 'alvorada-vtt-media:' + userId;
  const [value, setValue] = useState<Preferences>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      return {
        mapEffects:
          typeof saved.mapEffects === 'boolean' ? saved.mapEffects : saved.visualEffects !== false,
        masterEffects:
          typeof saved.masterEffects === 'boolean'
            ? saved.masterEffects
            : saved.visualEffects !== false,
        soundEnabled: typeof saved.soundEnabled === 'boolean' ? saved.soundEnabled : true,
        soundVolume:
          typeof saved.soundVolume === 'number' && Number.isFinite(saved.soundVolume)
            ? Math.max(0, Math.min(1, saved.soundVolume))
            : 0.65,
      };
    } catch {
      return defaults;
    }
  });
  return {
    ...value,
    update(patch: Partial<Preferences>) {
      setValue((old) => {
        const next = { ...old, ...patch };
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* Transient private browsing preference. */
        }
        return next;
      });
    },
  };
}
