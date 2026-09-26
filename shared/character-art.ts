import { z } from 'zod';
import { races, classes } from './rules.js';

export const CHARACTER_LIMIT = 2;
export const ART_MONTHLY_LIMIT = 2;
export const ART_MAX_BYTES = 8 * 1024 * 1024;
export const characterSchema = z.object({
  name: z.string().trim().min(2).max(60),
  race: z.enum(races),
  class: z.enum(classes),
  background: z.string().trim().min(2).max(40).default('Aventureiro'),
  biography: z.string().trim().max(2000).default(''),
  stats: z
    .array(z.number().int())
    .length(6)
    .refine(
      (values) => [...values].sort((a, b) => a - b).join() === '8,10,12,13,14,15',
      'Distribua a matriz padrão sem repetir valores.',
    ),
});
export type CharacterCreation = z.infer<typeof characterSchema>;
export type ArtJob = {
  id: string;
  character_id: string | null;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  error: string | null;
  created_at: string;
};
export type ArtState = { available: boolean; jobs: ArtJob[]; pending_new: number };
