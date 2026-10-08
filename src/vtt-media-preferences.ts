import { useState } from 'react';
type Preferences = { visualEffects: boolean; soundEnabled: boolean; soundVolume: number };
const defaults: Preferences = { visualEffects: true, soundEnabled: true, soundVolume: 0.65 };
export function useVttMediaPreferences(userId: string) {
  const key = 'alvorada-vtt-media:' + userId;
  const [value, setValue] = useState<Preferences>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      return {
        visualEffects: typeof saved.visualEffects === 'boolean' ? saved.visualEffects : true,
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
