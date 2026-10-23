import sharp from 'sharp';
import { join, resolve } from 'node:path';
import {
  beardStyles,
  mustacheStyles,
  facialHairAtlases,
  facialHairSchema,
  supportsFacialHair,
  type FacialHair,
} from '../shared/facial-hair.js';

// One temporary sheet keeps beard/moustache independent without exceeding five native refs.
// Originals are never resized or modified; only the two chosen cells are copied.
export async function prepareFacialHairReference(
  race: string,
  choices: { physicalTraits?: { gender?: string }; facialHair?: FacialHair } | undefined,
  directory: string,
) {
  if (!supportsFacialHair(race, choices?.physicalTraits?.gender)) return undefined;
  const parsed = facialHairSchema.safeParse(choices?.facialHair);
  if (!parsed.success) return undefined;
  const cells = await Promise.all(
    (['beard', 'mustache'] as const).map(async (kind) => {
      const atlas = facialHairAtlases[kind];
      const options = kind === 'beard' ? beardStyles : mustacheStyles;
      const index = options.findIndex((v) => v.id === parsed.data[kind]);
      const input = resolve('public' + atlas.path),
        meta = await sharp(input).metadata();
      if (!meta.width || !meta.height) throw new Error('Prancha de barba ou bigode inválida.');
      const column = index % atlas.columns,
        row = Math.floor(index / atlas.columns);
      const left = Math.round((column * meta.width) / atlas.columns),
        top = Math.round((row * meta.height) / atlas.rows);
      const width = Math.round(((column + 1) * meta.width) / atlas.columns) - left;
      const height = Math.round(((row + 1) * meta.height) / atlas.rows) - top;
      return {
        bytes: await sharp(input).extract({ left, top, width, height }).png().toBuffer(),
        width,
        height,
      };
    }),
  );
  const path = join(directory, 'selected-facial-hair.png');
  await sharp({
    create: {
      width: cells[0].width + cells[1].width,
      height: Math.max(...cells.map((c) => c.height)),
      channels: 4,
      background: '#26211d',
    },
  })
    .composite([
      { input: cells[0].bytes, left: 0, top: 0 },
      { input: cells[1].bytes, left: cells[0].width, top: 0 },
    ])
    .png()
    .toFile(path);
  return path;
}
