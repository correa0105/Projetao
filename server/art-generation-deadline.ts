import { AsyncLocalStorage } from 'node:async_hooks';

export const ART_GENERATION_LIMIT_MS = 5 * 60_000;
export const ART_GENERATION_TIMEOUT_MESSAGE = 'A geração não foi concluída em cinco minutos. O progresso salvo e sua cota foram preservados. Tente novamente.';

export class ArtGenerationDeadlineError extends Error {
  readonly code = 'generation_deadline';
  constructor() { super(ART_GENERATION_TIMEOUT_MESSAGE); }
}

const deadlines = new AsyncLocalStorage<number>();

// Portrait, token, reviews and retries share one absolute deadline. Nested work
// may shorten it, but can never start a fresh five-minute allowance.
export function withArtGenerationDeadline<T>(deadline: Date | string, work: () => Promise<T>): Promise<T> {
  const end = new Date(deadline).getTime();
  if (!Number.isFinite(end)) throw new ArtGenerationDeadlineError();
  return deadlines.run(Math.min(end, deadlines.getStore() ?? Infinity), work);
}

export function artGenerationTimeLeft() {
  const end = deadlines.getStore();
  if (end === undefined) return Infinity;
  const remaining = end - Date.now();
  if (remaining <= 0) throw new ArtGenerationDeadlineError();
  return remaining;
}
