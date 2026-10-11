import { z } from 'zod';

export const tagCodePattern = /^tag_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const missionTagIds = z
  .array(z.string().uuid())
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, 'Não repita tags.');
export const tagSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(400).default(''),
    active: z.boolean().default(true),
  })
  .strict();
export const rewardSchema = z
  .object({
    kind: z.enum(['title', 'item', 'house']),
    ref: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(99).default(1),
  })
  .strict()
  .refine((r) => r.kind !== 'title' || r.quantity === 1, 'Um título é concedido uma vez.');
export const tagAchievementSchema = z
  .object({
    tag_id: z.string().uuid(),
    target: z.string().regex(/^[1-9][0-9]{0,99}$/, 'Use uma quantidade inteira positiva.'),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000),
    active: z.boolean().default(true),
    rewards: z
      .array(rewardSchema)
      .max(20)
      .refine(
        (rs) => new Set(rs.map((r) => r.kind + ':' + r.ref)).size === rs.length,
        'Não repita recompensas.',
      ),
  })
  .strict();
export type TagReward = z.infer<typeof rewardSchema> & { name: string; image?: string | null };
export type MissionTag = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  revision: number;
};
export type TagAchievement = Omit<z.infer<typeof tagAchievementSchema>, 'rewards'> & {
  code: string;
  revision: number;
  rewards: TagReward[];
  awarded: boolean;
};
export type TagCatalog = { can_edit: boolean; tags: MissionTag[]; achievements: TagAchievement[] };
export type TagState = {
  totals: { tag_id: string; total: string }[];
  grants: { code: string; awarded_at: string; rewards: TagReward[] }[];
};
export type TagRewardOptions = {
  kind: TagReward['kind'];
  ref: string;
  name: string;
  image?: string | null;
  category?: string;
}[];
export const formatTagCount = (value: string) => BigInt(value).toLocaleString('pt-BR');
