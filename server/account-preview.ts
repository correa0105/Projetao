import { AsyncLocalStorage } from 'node:async_hooks';
// A request-local downgrade never updates the account or another request's capabilities.
export const accountPreview = new AsyncLocalStorage<boolean>();
export const isBasicPreview = () => accountPreview.getStore() === true;

/** Strip privileges computed by legacy reads that still select the real account. */
export function basicPreviewPayload(value: unknown, accountId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => basicPreviewPayload(item, accountId));
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value))
    return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === 'administrador' && (value as { id?: string }).id === accountId
        ? 0
        : ['gold_unlimited', 'canEditKingdom'].includes(key)
          ? false
          : key === 'role' &&
              (value as { id?: string }).id === accountId &&
              ['admin', 'staff'].includes(String(item))
            ? 'player'
            : basicPreviewPayload(item, accountId),
    ]),
  );
}
