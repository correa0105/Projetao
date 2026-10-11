import type { MapAtmosphere } from '../shared/vtt-atmosphere';

// Keep the latest selection while serializing writes to the active scene.
export function createAtmosphereQueue(events: {
  send: (value: MapAtmosphere) => Promise<void>;
  preview: (value: MapAtmosphere | null) => void;
  status: (pending: boolean, error?: string) => void;
}) {
  let pending: MapAtmosphere | null = null,
    running = false,
    disposed = false,
    version = 0;
  async function drain() {
    if (running || disposed) return;
    running = true;
    while (pending && !disposed) {
      const value = pending,
        sentVersion = version;
      pending = null;
      try {
        await events.send(value);
        if (!disposed && sentVersion === version) {
          events.preview(null);
          events.status(false);
        }
      } catch (error) {
        if (!disposed && sentVersion === version) {
          events.preview(null);
          events.status(false, (error as Error).message);
        }
      }
    }
    running = false;
  }
  return {
    select(value: MapAtmosphere) {
      if (disposed) return;
      pending = value;
      version++;
      events.preview(value);
      events.status(true, '');
      void drain();
    },
    dispose() {
      disposed = true;
      pending = null;
    },
  };
}
