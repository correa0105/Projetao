export type CardVisualLevel = 1 | 2 | 3;
export function cardVisualLevel(level = 1): CardVisualLevel {
  return Math.max(1, Math.min(3, Number.isFinite(level) ? Math.floor(level) : 1)) as CardVisualLevel;
}
