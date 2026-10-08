import sharp from 'sharp';
import type { PoolClient } from 'pg';
import type { VttDocument } from '../shared/vtt.js';
import { vttAssetId, vttAssetPath } from '../shared/vtt-token-image.js';
import { AppError } from './services.js';

export async function normalizeCharacterToken(bytes: Buffer) {
  if (bytes.length > 24 * 1024 * 1024) throw new AppError(400, 'Token excede o tamanho permitido.');
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000 }),
      meta = await image.metadata();
    if (
      !['png', 'webp'].includes(meta.format || '') ||
      (meta.pages || 1) !== 1 ||
      !meta.hasAlpha ||
      !meta.width ||
      meta.width !== meta.height ||
      meta.width < 512
    )
      throw new AppError(
        400,
        'O token deve ser quadrado, com transparência e pelo menos 512 pixels.',
      );
    const stats = await image.stats();
    if (stats.isOpaque || !stats.channels[3]?.max)
      throw new AppError(400, 'O token precisa de uma silhueta e fundo transparente.');
    return image
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'Não foi possível validar a vista de cima.');
  }
}

export async function syncCharacterTokenArt(
  client: PoolClient,
  characterId: string,
  userId: string,
  image: Buffer,
) {
  const bytes = await sharp(image)
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 95, alphaQuality: 100 })
    .toBuffer();
  const meta = await sharp(bytes).metadata();
  const { rows: rooms } = await client.query(
    `SELECT r.id,r.document FROM vtt_rooms r
    JOIN vtt_character_links l ON l.room_id=r.id WHERE l.character_id=$1 ORDER BY r.id FOR UPDATE OF r`,
    [characterId],
  );
  const { rows: assets } = await client.query(
    'SELECT id FROM vtt_assets WHERE character_art_source=$1',
    [characterId],
  );
  const managed = new Set(assets.map((a) => a.id));
  for (const room of rooms) {
    const doc = room.document as VttDocument;
    const tokens = doc.scenes
      .flatMap((s) => s.tokens)
      .filter(
        (t) =>
          t.characterId === characterId &&
          t.controller === userId &&
          (!t.image || managed.has(vttAssetId(t.image))),
      );
    if (!tokens.length) continue;
    const {
      rows: [asset],
    } = await client.query(
      `INSERT INTO vtt_assets(room_id,name,kind,mime,bytes,width,height,character_art_source)
      VALUES($1,$2,'image','image/webp',$3,$4,$5,$6) RETURNING id`,
      [room.id, tokens[0].name + ' · token', bytes, meta.width, meta.height, characterId],
    );
    for (const token of tokens) token.image = vttAssetPath(asset.id, true);
    await client.query(
      'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now() WHERE id=$1',
      [room.id, JSON.stringify(doc)],
    );
  }
}
