import { z } from 'zod';
export const profileSettingsSchema = z
  .object({
    bio: z.string().trim().max(2000).default(''),
    tagline: z.string().trim().max(120).default(''),
    avatar: z.string().max(200).default(''),
    background: z.string().max(200).default('/character-camp-v2.png'),
    accent: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .default('#c8a56c'),
    featured: z.array(z.string().uuid()).max(4).default([]),
  })
  .strict();
export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
export const hallSettingsSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    intro: z.string().max(1000),
    weights: z
      .object({
        level: z.number().int().min(0).max(1000),
        achievement: z.number().int().min(0).max(1000),
        mission: z.number().int().min(0).max(1000),
        title: z.number().int().min(0).max(1000),
        rating: z.number().int().min(0).max(1000),
      })
      .strict(),
  })
  .strict();
export const defaultHallSettings = {
  title: 'Hall da Fama',
  intro: 'As histórias que deixam sua marca na Alvorada.',
  weights: { level: 100, achievement: 30, mission: 5, title: 20, rating: 100 },
};
export type HallSettings = z.infer<typeof hallSettingsSchema>;
export function fameScore(
  row: {
    level: number;
    achievements: number;
    missions: number;
    titles: number;
    rating_count: number;
    rating_sum: number;
  },
  weights: HallSettings['weights'],
) {
  const rating = row.rating_count ? (row.rating_sum + 3.5 * 5) / (row.rating_count + 5) : 0;
  const parts = {
    level: Math.max(0, row.level - 1) * weights.level,
    achievements: row.achievements * weights.achievement,
    missions: row.missions * weights.mission,
    titles: row.titles * weights.title,
    rating: row.rating_count ? Math.round((Math.max(0, rating - 1) / 4) * weights.rating) : 0,
  };
  return {
    score: Object.values(parts).reduce((a, b) => a + b, 0),
    parts,
    rating: Number(rating.toFixed(3)),
  };
}
export type HallEntry = {
  id: string;
  user_id: string;
  name: string;
  owner_name: string;
  race: string;
  class: string;
  level: number;
  missions: number;
  achievements: number;
  titles: number;
  rating_count: number;
  rating_sum: number;
  rating: number;
  score: number;
  parts: ReturnType<typeof fameScore>['parts'];
  rank: number;
  portrait: string;
  title: string | null;
};
export type DirectoryEntry = {
  id: string;
  name: string;
  tagline: string;
  avatar: string;
  characters: number;
  rating: number;
  rating_count: number;
};
export type SocialFriend = {
  id: string;
  name: string;
  status: 'pending' | 'accepted';
  incoming: boolean;
  avatar: string;
};
export type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};
