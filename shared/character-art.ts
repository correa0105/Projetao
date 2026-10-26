import { z } from 'zod';
import { races, classes } from './rules.js';
import { choicesSchema, validateChoices } from './character-sheet.js';
import { warforgedAppearanceSchema, warforgedArtMode } from './warforged-appearance.js';

export const CHARACTER_LIMIT = 2;
export const characterLimit = (_administrator: boolean) => CHARACTER_LIMIT;
export const ART_MONTHLY_LIMIT = 5;
export const COMPANION_ART_MONTHLY_LIMIT = 2;
export const ART_MAX_BYTES = 8 * 1024 * 1024;
export const characterSchema = z
  .object({
    creation_slot: z.number().int().min(1).max(2).optional(),
    name: z.string().trim().min(2).max(60),
    race: z.enum(races),
    class: z.enum(classes),
    background: z.string().trim().min(2).max(40).default('Aventureiro'),
    biography: z.string().trim().max(2000).default(''),
    choices: choicesSchema.optional(),
    stats: z
      .array(z.number().int())
      .length(6)
      .refine(
        (values) => [...values].sort((a, b) => a - b).join() === '8,10,12,13,14,15',
        'Distribua a matriz padrão sem repetir valores.',
      )
      .default([15, 14, 13, 12, 10, 8]),
  })
  .superRefine((data, ctx) => {
    if (data.choices)
      try {
        validateChoices(data.race, data.class, data.choices);
      } catch (e) {
        ctx.addIssue({ code: 'custom', message: (e as Error).message, path: ['choices'] });
      }
  });
export type CharacterCreation = z.infer<typeof characterSchema>;
// Only an explicitly configured Warforged can be constructed without a player image.
export function canConstructWithoutReference(
  creation:
    | {
        race?: string;
        choices?: {
          warforgedAppearance?: unknown;
          warforgedArtMode?: 'construction' | 'reference';
        };
      }
    | null
    | undefined,
) {
  return (
    creation?.race === 'Warforged' &&
    warforgedArtMode(creation.choices) === 'construction' &&
    warforgedAppearanceSchema.safeParse(creation.choices?.warforgedAppearance).success
  );
}
export type ArtJob = {
  can_retry?: boolean;
  id: string;
  character_id: string | null;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  error: string | null;
  created_at: string;
};
export type ArtState = {
  ready_characters?: string[];
  available: boolean;
  jobs: ArtJob[];
  pending_new: number;
  character_limit?: number;
  quotas?: Record<string, ArtQuota>;
  reviews?: ArtReview[];
};
export type ArtReview = {
  id: string;
  character_id: string;
  name: string;
  current_revision: number;
  has_current_token: boolean;
};
export type ArtQuota = { used: number; limit: number | null };
