export const worldDayMs = 24 * 60 * 60 * 1000;
export type WorldClockSnapshot = { timeMs: number; revision: number; canEdit: boolean };
export function worldClockTime(anchorMinutes: number, anchorAt: number, now: number) {
  return (anchorMinutes * 60_000 + Math.max(0, now - anchorAt)) % worldDayMs;
}
export function worldClockLabel(timeMs: number) {
  const minutes = Math.floor((((timeMs % worldDayMs) + worldDayMs) % worldDayMs) / 60_000);
  return (
    String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0')
  );
}
export function worldClockPhase(timeMs: number): 'morning' | 'afternoon' | 'dusk' | 'night' {
  const hour = (((timeMs % worldDayMs) + worldDayMs) % worldDayMs) / 3_600_000;
  return hour >= 6 && hour < 12
    ? 'morning'
    : hour >= 12 && hour < 17
      ? 'afternoon'
      : hour >= 17 && hour < 19
        ? 'dusk'
        : 'night';
}
