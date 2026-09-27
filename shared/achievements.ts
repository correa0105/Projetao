export const achievementCatalog = [
  { code: 'first_character', title: 'O primeiro capítulo', description: 'Dê vida a um personagem.' },
  { code: 'first_purchase', title: 'Pronto para a estrada', description: 'Faça sua primeira compra no empório.' },
  { code: 'first_mission', title: 'Atenda ao chamado', description: 'Inscreva-se em uma missão da guilda.' },
  { code: 'north_veteran', title: 'Veterano do Norte', description: 'Participe de 10 missões concluídas no Reino do Norte.' },
  { code: 'first_story', title: 'Conte uma história', description: 'Conclua uma mesa como mestre. Conta para os personagens desta conta.' },
  { code: 'shop_patron', title: 'Fortuna em circulação', description: 'Gaste um total de 1.000 PO no empório com este personagem.' },
  { code: 'north_renown', title: 'Honra do Norte', description: 'Alcance 300 de reputação com o Reino do Norte.' },
] as const;
export const materials = { walnut: 'Nogueira', oak: 'Carvalho envelhecido', ebony: 'Ébano' } as const;
export const medalFrames = { bronze: 'Folhas de bronze', silver: 'Lua élfica', dragon: 'Dragões dourados' } as const;
export type ShelfConfig = { material: keyof typeof materials; medal_frame: keyof typeof medalFrames; slots: (string | null)[] };
export type AchievementProgress = { current: number; target: number; unit: string; available: boolean };
export type AchievementState = { progress: Record<string, AchievementProgress>; unlocked: { code: string; unlocked_at: string }[]; shelf: ShelfConfig };
export const emptyShelf = (): ShelfConfig => ({ material: 'walnut', medal_frame: 'bronze', slots: Array(18).fill(null) });
