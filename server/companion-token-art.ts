import { reuseVttAsset } from './vtt-assets.js';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PoolClient } from 'pg';
import type { VttDocument } from '../shared/vtt.js';
import { basicCompanionToken } from '../shared/companion-token-art.js';
import { vttAssetId, vttAssetPath } from '../shared/vtt-token-image.js';
import { AppError } from './services.js';
export async function basicCompanionTokenBytes(
  kind: 'mount' | 'pet',
  species: string,
  appearance: string,
) {
  const file = basicCompanionToken(kind, species, appearance);
  if (!file) throw new AppError(404, 'Token básico não encontrado.');
  for (const root of ['public', 'dist/client']) {
    try {
      return await readFile(resolve(root, file.slice(1)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new AppError(404, 'Token básico não encontrado.');
}
export async function syncCompanionTokenArt(
  db: PoolClient,
  companionId: string,
  userId: string,
  image: Buffer,
) {
  const bytes = await sharp(image).webp({ quality: 95, alphaQuality: 100 }).toBuffer();
  const meta = await sharp(bytes).metadata();
  const { rows: rooms } = await db.query(
    'SELECT r.id,r.document FROM vtt_rooms r WHERE EXISTS(SELECT 1 FROM vtt_assets a WHERE a.room_id=r.id AND a.companion_art_source=$1) ORDER BY r.id FOR UPDATE OF r',
    [companionId],
  );
  const { rows: assets } = await db.query(
    'SELECT id FROM vtt_assets WHERE companion_art_source=$1',
    [companionId],
  );
  const managed = new Set(assets.map((a) => a.id));
  for (const room of rooms) {
    const doc = room.document as VttDocument;
    const tokens = doc.scenes
      .flatMap((s) => s.tokens)
      .filter(
        (t) =>
          t.companionId === companionId &&
          t.controller === userId &&
          (!t.image || managed.has(vttAssetId(t.image))),
      );
    if (!tokens.length) continue;
    const asset = await reuseVttAsset(db, {
      roomId: room.id,
      name: tokens[0].name + ' · token',
      kind: 'image',
      mime: 'image/webp',
      bytes,
      width: meta.width,
      height: meta.height,
      companionId,
    });
    for (const token of tokens) token.image = vttAssetPath(asset.id, true);
    await db.query(
      'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now() WHERE id=$1',
      [room.id, JSON.stringify(doc)],
    );
  }
}
