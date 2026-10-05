import { z } from 'zod';
export const actionMime = 'application/x-alvorada-action';
const characterActionSchema = z
  .object({
    kind: z.enum(['attack', 'spell', 'consumable']),
    characterId: z.string().uuid(),
    sourceId: z.string().min(1).max(180),
    label: z.string().trim().min(1).max(180),
  })
  .strict();
export const hotbarActionSchema = z.union([
  characterActionSchema,
  z
    .object({
      kind: z.literal('effect'),
      sourceId: z.string().uuid(),
      label: z.string().trim().min(1).max(180),
    })
    .strict(),
  z
    .object({
      kind: z.literal('monster'),
      tokenId: z.string().uuid(),
      sourceId: z.string().min(1).max(180),
      label: z.string().trim().min(1).max(180),
    })
    .strict(),
]);
export type HotbarAction = z.infer<typeof hotbarActionSchema>;
export const hotbarSchema = z
  .object({
    active: z.string().uuid(),
    pages: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().trim().min(1).max(32),
            locked: z.boolean(),
            slots: z.array(hotbarActionSchema.nullable()).length(10),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (
      !d.pages.some((p) => p.id === d.active) ||
      new Set(d.pages.map((p) => p.id)).size !== d.pages.length
    )
      ctx.addIssue({ code: 'custom', message: 'Abas inválidas.' });
  });
export type HotbarDocument = z.infer<typeof hotbarSchema>;
export type HotbarState = { revision: number; document: HotbarDocument };
export const emptyHotbar = (id: string): HotbarDocument => ({
  active: id,
  pages: [{ id, name: 'Ações', locked: false, slots: Array(10).fill(null) }],
});
