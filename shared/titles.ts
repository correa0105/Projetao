import { z } from 'zod';
import { achievementCatalog } from './achievements.js';
export const titleGoalNames = {
  manual: 'Concessão do administrador',
  achievement: 'Desbloquear uma conquista',
  level: 'Alcançar um nível',
  missions: 'Concluir missões',
  spent: 'Gastar ouro no empório',
};
export const titleSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(1000),
    symbol: z.enum(['crown', 'shield', 'feather', 'star']),
    tone: z.enum(['copper', 'silver', 'crimson']),
    goal: z
      .object({
        kind: z.enum(['manual', 'achievement', 'level', 'missions', 'spent']),
        target: z.number().int().min(1).max(10000000),
        achievement: z.string().refine((v) => !v || achievementCatalog.some((a) => a.code === v)),
      })
      .strict(),
  })
  .strict()
  .refine(
    (v) => v.goal.kind !== 'achievement' || Boolean(v.goal.achievement),
    'Escolha uma conquista.',
  )
  .refine((v) => v.goal.kind !== 'level' || v.goal.target <= 20, 'Níveis vão de 1 a 20.');
export type TitleInput = z.infer<typeof titleSchema>;
export type CharacterTitle = TitleInput & {
  id: string;
  revision: number;
  earned: boolean;
  current: number;
  source?: 'manual' | 'automatic';
};
export type TitlesResponse = {
  can_edit: boolean;
  displayed: string | null;
  position?: 'below' | 'beside';
  items: CharacterTitle[];
};
export const emptyTitle: TitleInput = {
  name: '',
  description: '',
  symbol: 'crown',
  tone: 'copper',
  goal: { kind: 'manual', target: 1, achievement: '' },
};
