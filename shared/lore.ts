import { z } from 'zod';

export const LORE_IMAGE_FORMATS = ['portrait', 'landscape', 'half-landscape'] as const;
export const LORE_ALIGNMENTS = ['left', 'center', 'right'] as const;
export const LORE_TEXT_STYLES = ['prose', 'parchment', 'inscription', 'quote'] as const;
export const LORE_DEFAULT_FOLDERS = [
  'Cidades',
  'Capital',
  'Religião',
  'Lendas',
  'Criaturas',
  'História',
] as const;
export const LORE_MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const common = { id: z.string().uuid(), alignment: z.enum(LORE_ALIGNMENTS) };
export const loreBlockSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...common,
      type: z.literal('text'),
      title: z.string().trim().max(140),
      text: z.string().max(12000),
      style: z.enum(LORE_TEXT_STYLES),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('image'),
      asset_id: z.string().uuid(),
      alt: z.string().trim().max(300),
      caption: z.string().trim().max(500),
      format: z.enum(LORE_IMAGE_FORMATS),
      fit: z.enum(['cover', 'contain']),
      effect: z.enum(['cinematic', 'still']),
    })
    .strict(),
]);
export const lorePageInput = z
  .object({
    title: z.string().trim().min(2).max(140),
    subtitle: z.string().trim().max(300).default(''),
    region_id: z.string().min(1).max(100),
    folder_id: z.string().uuid(),
    published: z.boolean().default(false),
    blocks: z
      .array(loreBlockSchema)
      .max(50)
      .refine(
        (blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length,
        'Há blocos repetidos na página.',
      ),
  })
  .strict();
export type LoreBlock = z.infer<typeof loreBlockSchema>;
export type LorePageInput = z.infer<typeof lorePageInput>;
export type LoreFolder = {
  id: string;
  region_id: string;
  parent_id: string | null;
  name: string;
  revision: number;
};
export type LoreRegion = { id: string; name: string; description: string };
export type LorePageSummary = {
  id: string;
  region_id: string;
  folder_id: string;
  title: string;
  subtitle: string;
  published: boolean;
  revision: number;
  can_edit: boolean;
  thumbnail: string | null;
};
export type LorePage = LorePageSummary & { blocks: LoreBlock[] };
export type LoreIndex = {
  regions: LoreRegion[];
  folders: LoreFolder[];
  pages: LorePageSummary[];
  can_manage_folders: boolean;
};
export type LoreDeletedFolder = { id: string; name: string; region_id: string; deleted_at: string };
export const loreImageUrl = (id: string) => `/api/lore/images/${id}`;

export function loreFolderPath(folderId: string, folders: LoreFolder[]): string {
  const names: string[] = [],
    visited = new Set<string>();
  let current = folders.find((folder) => folder.id === folderId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = folders.find((folder) => folder.id === current!.parent_id);
  }
  return names.join(' / ');
}

export function loreDescendants(folderId: string, folders: LoreFolder[]): Set<string> {
  const ids = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parent_id && ids.has(folder.parent_id) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return ids;
}
