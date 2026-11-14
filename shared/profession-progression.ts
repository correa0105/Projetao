export const professionLevelThresholds = [
  0, 40, 100, 200, 360, 600, 950, 1400, 2000, 2800,
] as const;
export function professionProgress(experience = 0) {
  const level = professionLevelThresholds.reduce(
    (value, threshold, index) => (experience >= threshold ? index + 1 : value),
    1,
  );
  return {
    experience,
    level,
    level_start: professionLevelThresholds[level - 1],
    next_level: professionLevelThresholds[level] ?? null,
    title:
      level < 3
        ? 'Aprendiz'
        : level < 6
          ? 'Artesão'
          : level < 9
            ? 'Especialista'
            : level < 10
              ? 'Mestre'
              : 'Grão-mestre',
  };
}
