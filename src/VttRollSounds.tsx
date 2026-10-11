import { useEffect, useRef } from 'react';
import type { VttMessage } from '../shared/vtt';
import { useVttEffectAudio } from './vtt-effect-audio';
import { NATURAL_ONE_SOUND, naturalOneOnD20 } from './vtt-roll-sound';

export function VttRollSounds({
  roomId,
  messages,
  enabled,
  volume,
}: {
  roomId: string;
  messages: VttMessage[];
  enabled: boolean;
  volume: number;
}) {
  const { play, stop } = useVttEffectAudio(enabled, volume);
  const initialized = useRef<string | null>(null),
    seen = useRef(new Set<string>());
  useEffect(() => {
    if (initialized.current !== roomId) {
      stop();
      initialized.current = roomId;
      seen.current = new Set(messages.map((m) => m.id));
      return;
    }
    for (const message of messages) {
      if (seen.current.has(message.id)) continue;
      seen.current.add(message.id);
      const created = Date.parse(message.created_at);
      if (
        Number.isFinite(created) &&
        Date.now() - created <= 15000 &&
        naturalOneOnD20(message.roll)
      )
        play(NATURAL_ONE_SOUND);
    }
    // Polling and UI updates must never replay a roll. Stale history also fails
    // the timestamp guard after this bounded set is trimmed.
    if (seen.current.size > 1000) seen.current = new Set(messages.map((m) => m.id));
  }, [roomId, messages, play, stop]);
  return null;
}
