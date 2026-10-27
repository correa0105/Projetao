import { z } from 'zod';
import { races, classes } from './rules.js';
export const sheetOverridesSchema = z
  .object({
    hp: z.number().int().min(1).max(32767).optional(),
    armorClass: z.number().int().min(0).max(100).optional(),
    initiative: z.number().int().min(-100).max(100).optional(),
    speed: z.number().min(0).max(1000).optional(),
    passivePerception: z.number().int().min(0).max(100).optional(),
    spellDC: z.number().int().min(0).max(100).optional(),
    spellAttack: z.number().int().min(-100).max(100).optional(),
    saves: z.array(z.number().int().min(-100).max(100)).length(6).optional(),
    skills: z
      .record(
        z.string().max(60),
        z
          .object({
            value: z.number().int().min(-100).max(100),
            trained: z.boolean(),
            expert: z.boolean(),
          })
          .strict(),
      )
      .optional(),
    languages: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
    proficiencies: z.array(z.string().trim().min(1).max(120)).max(60).optional(),
  })
  .strict();
export type SheetOverrides = z.infer<typeof sheetOverridesSchema>;
export const adminSheetResourcesSchema = z
  .object({
    current_hp: z.number().int().min(0).max(32767).nullable(),
    temp_hp: z.number().int().min(0).max(32767),
    inspiration: z.boolean(),
    death_success: z.number().int().min(0).max(3),
    death_failure: z.number().int().min(0).max(3),
    slots_used: z.number().int().min(0).max(99),
    hit_dice_used: z.number().int().min(0).max(20),
    prepared: z.array(z.string().max(100)).max(100),
    notes: z.string().max(20000),
  })
  .strict();
export const adminCharacterEditSchema = z
  .object({
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    reason: z.string().trim().min(1).max(500),
    name: z.string().trim().min(2).max(60),
    race: z.enum(races),
    class: z.enum(classes),
    level: z.number().int().min(1).max(20),
    biography: z.string().max(2000),
    stats: z.array(z.number().int().min(1).max(30)).length(6),
    progression_missions: z.number().int().min(0).max(1000000),
    gold_cp: z.number().int().min(0).max(2147483647),
    choices: z.unknown(),
    overrides: sheetOverridesSchema,
    resources: adminSheetResourcesSchema,
  })
  .strict();
export type AdminCharacterEdit = z.infer<typeof adminCharacterEditSchema>;
