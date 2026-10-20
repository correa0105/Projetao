export const VTT_STORAGE_LIMIT = 100 * 1024 * 1024;
export type VttStorage = { used: number; limit: number; remaining: number };
export const vttStorageLabel = (storage: VttStorage) =>
  `${(storage.used / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} / 100 MB`;
