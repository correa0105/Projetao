import { z } from 'zod';

const target = z.number().int().min(1).max(1_000_000_000);
export const bastionRequirementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('missions'), target }).strict(),
  z.object({ kind: z.literal('monster_tag'), tag_id: z.string().uuid(), target }).strict(),
  z.object({ kind: z.literal('tower_crystals'), target }).strict(),
  z.object({ kind: z.literal('treasury'), target }).strict(),
  z
    .object({
      kind: z.literal('custom'),
      key: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/),
      label: z.string().trim().min(2).max(100),
      target,
    })
    .strict(),
]);
export type BastionRequirement = z.infer<typeof bastionRequirementSchema>;
export const bastionRequirementKey = (r: BastionRequirement) =>
  r.kind === 'monster_tag' ? 'tag:' + r.tag_id : r.kind === 'custom' ? 'custom:' + r.key : r.kind;
export const bastionProgressionSchema = z
  .object({
    levels: z
      .array(
        z
          .object({
            level: z.number().int().min(1).max(10),
            enabled: z.boolean(),
            benefit: z.string().trim().max(1500),
            requirements: z.array(bastionRequirementSchema).max(12),
          })
          .strict(),
      )
      .length(10),
  })
  .strict()
  .superRefine((p, ctx) => {
    for (const [i, tier] of p.levels.entries()) {
      const reject = (message: string) =>
        ctx.addIssue({ code: 'custom', path: ['levels', i], message });
      if (tier.level !== i + 1) reject('Mantenha os níveis de 1 a 10 em ordem.');
      if (tier.enabled && !tier.benefit)
        reject('Informe o benefício de cada nível liberado, inclusive o nível base.');
      if (tier.enabled && i > 0 && !p.levels[i - 1].enabled)
        reject('Libere primeiro os níveis anteriores.');
      if (i === 0 && tier.requirements.length) reject('O benefício base não exige evolução.');
      if (new Set(tier.requirements.map(bastionRequirementKey)).size !== tier.requirements.length)
        reject('Não repita o mesmo requisito no nível.');
    }
  });
export type BastionProgression = z.infer<typeof bastionProgressionSchema>;
export function emptyBastionProgression(): BastionProgression {
  return {
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      enabled: false,
      benefit: '',
      requirements: [],
    })),
  };
}
export type BastionRequirementProgress = {
  key: string;
  label: string;
  kind: BastionRequirement['kind'];
  current: number;
  target: number;
  met: boolean;
  consumed: boolean;
};
export type BastionFacilityState = {
  room: string;
  name: string;
  level: number;
  revision: number;
  available: boolean;
  progression: BastionProgression;
  benefit: string | null;
  next: {
    level: number;
    benefit: string;
    enabled: boolean;
    requirements: BastionRequirementProgress[];
  } | null;
  can_upgrade: boolean;
};
export type BastionState = {
  facilities: BastionFacilityState[];
  can_edit: boolean;
  can_upgrade: boolean;
  progress_visible: boolean;
  custom: { key: string; value: number; revision: number }[];
};
