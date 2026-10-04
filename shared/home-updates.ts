import { z } from 'zod';
export const homeImages = [
  { path: '/alvorada-dawn-banner.png', label: 'Amanhecer nas montanhas' },
  { path: '/character-camp-v2.png', label: 'Acampamento dos viajantes' },
  { path: '/notice-village-tavern-v3.png', label: 'Taverna da vila' },
  { path: '/atlas-world-v2.png', label: 'Terras da Alvorada' },
];
export function safeHomeLink(value: string) {
  if (!value) return true;
  if (
    /^#(overview|characters|profile|inventory|achievements|missions|board|events|titles|cards|hooks|shop|stable|pets|house|world|lore|rules)$/.test(
      value,
    )
  )
    return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
export const homeUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(140),
    body: z.string().trim().max(8000).default(''),
    kind: z.enum(['article', 'meeting', 'image']).default('article'),
    layout: z.enum(['feature', 'landscape', 'portrait', 'compact']).default('feature'),
    image_path: z
      .string()
      .max(200)
      .refine(
        (v) =>
          !v ||
          homeImages.some((i) => i.path === v) ||
          /^\/api\/home-images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
            v,
          ),
      )
      .default(''),
    image_side: z.enum(['left', 'right']).default('right'),
    image_fit: z.enum(['contain', 'cover']).default('contain'),
    link: z
      .string()
      .trim()
      .max(2000)
      .refine(safeHomeLink, 'Informe uma página do site ou um link http/https.')
      .default(''),
    starts_at: z.string().datetime({ offset: true }).nullable().default(null),
    location: z.string().trim().max(160).default(''),
    text_align: z.enum(['left', 'center']).default('left'),
    text_size: z.enum(['normal', 'large']).default('normal'),
    position: z.number().int().min(-10000).max(10000).default(0),
    revision: z.number().int().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'meeting' && !v.starts_at)
      ctx.addIssue({
        code: 'custom',
        path: ['starts_at'],
        message: 'Defina a data e o horário da reunião.',
      });
  });
export type HomeUpdateInput = z.infer<typeof homeUpdateSchema>;
export type HomeUpdate = HomeUpdateInput & {
  id: string;
  author_id: string;
  author_name: string;
  can_edit: boolean;
  created_at: string;
  revision: number;
};
