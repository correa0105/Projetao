// Display-only snapshots. Every entry still refreshes authoritative data from the API.
const snapshots = new Map<string, { value: unknown; expires: number }>();
const lifetime = 10 * 60_000;
let generation = 0;
export const sceneSnapshotScope = (userId: string, characterId: string, basic: boolean) =>
  JSON.stringify([generation, userId, characterId, basic]);
export function readSceneSnapshot<T>(scope: string, key: string): T | null {
  const id = scope + ':' + key,
    entry = snapshots.get(id);
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    snapshots.delete(id);
    return null;
  }
  return structuredClone(entry.value) as T;
}
export function writeSceneSnapshot(scope: string, key: string, value: unknown) {
  const id = scope + ':' + key;
  snapshots.delete(id);
  snapshots.set(id, { value: structuredClone(value), expires: Date.now() + lifetime });
  while (snapshots.size > 24) snapshots.delete(snapshots.keys().next().value!);
}
export const removeSceneSnapshot = (scope: string, key: string) =>
  snapshots.delete(scope + ':' + key);
export function clearSceneSnapshots() {
  generation++;
  snapshots.clear();
}
