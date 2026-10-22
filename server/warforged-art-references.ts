import sharp from 'sharp';
import { join, resolve } from 'node:path';
import {
  warforgedAppearanceSchema,
  warforgedBodies,
  warforgedBodyAtlas,
  warforgedHeadReference,
} from '../shared/warforged-appearance.js';

// Isolate the exact UI selection without resizing or modifying the original atlases.
export async function prepareWarforgedHeadReference(value: unknown, directory: string) {
  const parsed = warforgedAppearanceSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const { atlas, index } = warforgedHeadReference(parsed.data.head);
  const path = join(directory, 'selected-warforged-head.png');
  await sharp(resolve('public' + atlas))
    .extract({ left: (index % 3) * 512, top: index < 3 ? 0 : 512, width: 512, height: 512 })
    .png()
    .toFile(path);
  return path;
}

export async function prepareWarforgedReferences(value: unknown, directory: string) {
  const parsed = warforgedAppearanceSchema.safeParse(value);
  if (!parsed.success) return [];
  const index = warforgedBodies.findIndex((body) => body.id === parsed.data.body);
  const path = join(directory, 'selected-warforged-body.png');
  await sharp(resolve('public' + warforgedBodyAtlas))
    .extract({
      left: (index % 3) * 512,
      top: index < 3 ? 0 : 490,
      width: 512,
      height: index < 3 ? 490 : 534,
    })
    .png()
    .toFile(path);
  return [path, (await prepareWarforgedHeadReference(parsed.data, directory))!];
}
