export const calendarBackgrounds = [
  { path: '/calendar/village-night-v1.webp', label: 'Encontros na vila' },
  { path: '/calendar/roadside-camp-v1.webp', label: 'Jornadas ao luar' },
  { path: '/calendar/guild-desk-v1.webp', label: 'Planos da guilda' },
];

export function calendarFallbackImage(source: string | undefined, day: string, custom = '') {
  if (custom) return custom;
  const index =
    source === 'event'
      ? 0
      : source === 'mission'
        ? 1
        : source === 'publication'
          ? 2
          : [...day].reduce((sum, digit) => sum + (Number(digit) || 0), 0) %
            calendarBackgrounds.length;
  return calendarBackgrounds[index].path;
}
