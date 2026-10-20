export const monsterVariants = [
  { id: 0, name: 'Original', filter: 'none' },
  { id: 1, name: 'Cor 2', filter: 'hue-rotate(105deg) saturate(1.12)' },
  { id: 2, name: 'Cor 3', filter: 'hue-rotate(220deg) saturate(.85)' },
  { id: 3, name: 'Cor 4', filter: 'sepia(.7) saturate(1.25) brightness(1.08)' },
] as const;
export type MonsterVariant = 0 | 1 | 2 | 3;
export function monsterVariantFilter(variant?: number) {
  return monsterVariants[variant ?? 0]?.filter || 'none';
}
export function overheadMonsterImage(path: string) {
  return path.startsWith('/vtt/monsters/') || path.startsWith('/api/vtt/premium-art/') ||
    path.startsWith('/api/vtt/monster-art/');
}
