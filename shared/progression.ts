/** Progressão própria da guilda; não é a tabela de XP do SRD. */
export const MISSION_THRESHOLDS = [
  0, 2, 6, 14, 22, 30, 38, 46, 53, 60, 67, 74, 80, 86, 92, 98, 102, 106, 110, 114,
] as const;
export const RANKS = ['Ferro', 'Bronze', 'Adamantium', 'Ametista', 'Obsidiana'] as const;
export type Rank = (typeof RANKS)[number];
export const RANK_REWARD_CP: Record<Rank, number> = {
  Ferro: 15000,
  Bronze: 23000,
  Adamantium: 30000,
  Ametista: 39000,
  Obsidiana: 50000,
};
export const RANK_TEST_LEVELS = [4, 8, 12, 16] as const;
export function rankName(level: number) {
  return RANKS[Math.min(4, Math.max(0, Math.floor((level - 1) / 4)))];
}
export function rankCeiling(level: number) {
  return Math.min(20, Math.ceil(level / 4) * 4);
}
export function testEligible(level: number, missions: number, testLevel = level) {
  return (
    RANK_TEST_LEVELS.some((value) => value === level) &&
    level === testLevel &&
    missions >= MISSION_THRESHOLDS[level]
  );
}
export function progressMission(level: number, missions: number, testLevel: number | null = null) {
  if (testLevel !== null) {
    if (!testEligible(level, missions, testLevel))
      throw new Error('Este personagem não está apto a este teste de patente.');
    return { level: level + 1, missions, credited: 0, promoted: true };
  }
  const ceiling = rankCeiling(level);
  const limit = MISSION_THRESHOLDS[Math.min(19, ceiling)];
  const next = Math.min(limit, missions + 1);
  let nextLevel = level;
  while (nextLevel < ceiling && next >= MISSION_THRESHOLDS[nextLevel]) nextLevel++;
  return { level: nextLevel, missions: next, credited: next - missions, promoted: false };
}
export function progressionLabel(level: number, missions: number) {
  if (level === 20) return 'Nível máximo · Obsidiana';
  if (testEligible(level, missions))
    return `Teste para ${rankName(level + 1)} disponível · ${missions} missões válidas`;
  return `${missions}/${MISSION_THRESHOLDS[level]} missões válidas · ${level === rankCeiling(level) ? 'liberar teste de patente' : `nível ${level + 1}`}`;
}
