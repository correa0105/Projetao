import { z } from 'zod';

export const loreEraSchema = z
  .object({
    id: z.string().uuid(),
    year: z.string().trim().min(1).max(60),
    title: z.string().trim().max(120),
    description: z.string().trim().max(1600),
    revealed: z.boolean(),
    folder_ids: z.array(z.string().uuid()).max(132),
  })
  .strict();
export const loreTimelineSchema = z
  .object({
    title: z.string().trim().max(120),
    eras: z.array(loreEraSchema).min(1).max(24),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.eras.map((era) => era.id);
    const folders = value.eras.flatMap((era) => era.folder_ids);
    if (new Set(ids).size !== ids.length || new Set(folders).size !== folders.length)
      context.addIssue({
        code: 'custom',
        message: 'Não repita eras ou vincule a mesma pasta a duas eras.',
      });
  });
export type LoreTimelineDocument = z.infer<typeof loreTimelineSchema>;
export type LoreEra = z.infer<typeof loreEraSchema>;
export type LoreTimelineResponse = {
  document: LoreTimelineDocument;
  revision: number;
  can_edit: boolean;
};

export const INITIAL_LORE_TIMELINE: LoreTimelineDocument = {
  title: 'Os vestígios das eras',
  eras: ['Indefinido', '10 mil anos', '9.320 anos', '7.320 anos', '3.320 anos', 'Mil anos'].map(
    (year, index) => ({
      id: `dcf66218-0b9f-4ab1-8558-7e1916f8810${index}`,
      year,
      title: index === 5 ? 'Alvorada Cinzenta' : '',
      description:
        index === 5
          ? 'Aqui começam os registros que chegaram até nós. As eras anteriores permanecem sob o véu do desconhecido.'
          : '',
      revealed: index === 5,
      folder_ids: [],
    }),
  ),
};
