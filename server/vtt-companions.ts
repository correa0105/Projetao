import express from 'express';
import { z } from 'zod';
import sharp from 'sharp';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { isAdministrator } from './administrators.js';
import { mounts } from '../shared/mounts.js';
import { pets } from '../shared/pets.js';
import {
  newToken,
  pointSchema,
  snapPoint,
  documentSchema,
  type VttDocument,
} from '../shared/vtt.js';
import { movementBlocked, attachmentMovementError } from '../shared/vtt-movement.js';
import { translateAttachmentGroup } from '../shared/vtt-attachments.js';
import { vttAssetPath } from '../shared/vtt-token-image.js';
import type { VttCompanion } from '../shared/vtt-companions.js';
import { basicCompanionTokenBytes } from './companion-token-art.js';
type DB = Pick<PoolClient, 'query'>;
type Room = {
  id: string;
  owner_id: string;
  role: 'player' | 'spectator' | null;
  document: VttDocument;
  revision: number;
};
type Access = (db: DB, id: string, user: string, lock?: boolean) => Promise<Room>;
const uuid = z.string().uuid();
async function owned(db: DB, user: string) {
  const { rows } = await db.query(
    'SELECT a.*,c.name AS character_name,u.name AS owner_name,w.image_revision,(art.image IS NOT NULL) AS has_portrait ' +
      "FROM (SELECT id,character_id,'mount'::text AS kind,mount_id AS species,coat AS appearance,name FROM character_mounts " +
      "UNION ALL SELECT id,character_id,'pet',pet_id,appearance,name FROM character_pets) a " +
      'JOIN characters c ON c.id=a.character_id JOIN "user" u ON u.id=c.user_id ' +
      'LEFT JOIN companion_wardrobes w ON w.id=a.id LEFT JOIN companion_artworks art ON art.wardrobe_id=a.id ' +
      'WHERE c.user_id=$1 AND c.deleted_at IS NULL ORDER BY c.name,a.name,a.id',
    [user],
  );
  return rows.map((a) => ({
    id: a.id,
    kind: a.kind,
    species: a.species,
    appearance: a.appearance,
    name: a.name,
    speciesName:
      (a.kind === 'mount' ? mounts : pets).find((m) => m.id === a.species)?.name || a.species,
    characterId: a.character_id,
    characterName: a.character_name,
    ownerId: user,
    ownerName: a.owner_name,
    tokenUrl:
      '/api/companions/' +
      a.character_id +
      '/' +
      a.kind +
      '/' +
      a.id +
      '/token?v=' +
      (a.image_revision || 0),
    portraitUrl:
      '/api/companions/' +
      a.character_id +
      '/' +
      a.kind +
      '/' +
      a.id +
      (a.has_portrait ? '/image?v=' + a.image_revision : '/base-image'),
  })) as VttCompanion[];
}
async function importCompanion(
  db: DB,
  room: Room,
  user: string,
  animal: VttCompanion,
  position?: { x: number; y: number },
) {
  const scene = room.document.scenes.find((s) => s.id === room.document.activeScene)!;
  const isGm = room.owner_id === user && (await isAdministrator(user, db as PoolClient));
  const existing = scene.tokens.find((t) => t.companionId === animal.id && t.controller === user);
  const token = existing || newToken(crypto.randomUUID(), scene);
  if (existing && (existing.locked || (existing.hidden && !isGm)))
    throw new AppError(403, 'Este animal está bloqueado ou oculto.');
  const mount = mounts.find((m) => m.id === animal.species);
  if (!existing) {
    const scale =
      animal.kind === 'mount' && mount?.size === 'Grande'
        ? 2
        : animal.kind === 'mount' || animal.species === 'dog'
          ? 1
          : 0.6;
    Object.assign(token, {
      name: animal.name,
      controller: user,
      companionId: animal.id,
      characterId: null,
      width: scene.grid.size * scale,
      height: scene.grid.size * scale,
      hp: animal.kind === 'mount' ? mount?.hp || 1 : 1,
      maxHp: animal.kind === 'mount' ? mount?.hp || 1 : 1,
      ac: animal.kind === 'mount' ? mount?.ac || 10 : 10,
      vision: 60,
    });
  }
  if (existing && !position) return { token, changed: false };
  const at = position
    ? snapPoint(position, scene.grid)
    : {
        x:
          scene.width / 2 +
          scene.grid.size * (1 + scene.tokens.filter((t) => t.companionId).length),
        y: scene.height / 2,
      };
  const to = {
    x: Math.max(token.width / 2, Math.min(scene.width - token.width / 2, at.x)),
    y: Math.max(token.height / 2, Math.min(scene.height - token.height / 2, at.y)),
  };
  if (!isGm && movementBlocked(scene, existing || to, to))
    throw new AppError(400, 'Uma barreira bloqueia esta posição.');
  if (existing) {
    if (token.attachment)
      throw new AppError(400, 'Solte o vínculo antes de reposicionar este token.');
    const groupError = attachmentMovementError(scene, token, [to]);
    if (groupError) throw new AppError(400, groupError);
    translateAttachmentGroup(scene, token, to);
    return { token, changed: true };
  }
  const {
    rows: [art],
  } = await db.query('SELECT token_image FROM companion_artworks WHERE wardrobe_id=$1', [
    animal.id,
  ]);
  const bytes = await sharp(
    art?.token_image ||
      (await basicCompanionTokenBytes(animal.kind, animal.species, animal.appearance)),
  )
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 95, alphaQuality: 100 })
    .toBuffer();
  const { rows: wardrobe } = await db.query('SELECT id FROM companion_wardrobes WHERE id=$1', [
    animal.id,
  ]);
  if (!wardrobe.length)
    await db.query(
      'INSERT INTO companion_wardrobes(id,character_id,kind,mount_id,pet_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',
      [
        animal.id,
        animal.characterId,
        animal.kind,
        animal.kind === 'mount' ? animal.id : null,
        animal.kind === 'pet' ? animal.id : null,
      ],
    );
  const meta = await sharp(bytes).metadata();
  const {
    rows: [asset],
  } = await db.query(
    "INSERT INTO vtt_assets(room_id,name,kind,mime,bytes,width,height,companion_art_source) VALUES($1,$2,'image','image/webp',$3,$4,$5,$6) RETURNING id",
    [room.id, animal.name + ' · token', bytes, meta.width, meta.height, animal.id],
  );
  Object.assign(token, to, { image: vttAssetPath(asset.id, true) });
  scene.tokens.push(token);
  return { token, changed: true };
}
export function vttCompanionsRouter(
  access: Access,
  state: (id: string, user: string) => Promise<unknown>,
) {
  const router = express.Router();
  router.get('/vtt/rooms/:id/companions', async (req, res) => {
    const room = await access(pool, uuid.parse(req.params.id), res.locals.user.id);
    res.json({
      companions: room.role === 'spectator' ? [] : await owned(pool, res.locals.user.id),
    });
  });
  router.post(
    '/vtt/rooms/:id/companions/:companion',
    express.json({ limit: '8kb' }),
    async (req, res) => {
      const rid = uuid.parse(req.params.id),
        id = uuid.parse(req.params.companion),
        user = res.locals.user.id;
      const { position } = z
        .object({ position: pointSchema.optional() })
        .strict()
        .parse(req.body || {});
      await transaction(async (db) => {
        // Match the illustrator's owner → character → room order before inserting managed assets.
        await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [user]);
        const animal = (await owned(db, user)).find((a) => a.id === id);
        if (!animal) throw new AppError(404, 'Animal não pertence à sua conta.');
        if (
          !(
            await db.query(
              'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
              [animal.characterId, user],
            )
          ).rowCount
        )
          throw new AppError(404, 'Personagem não encontrado.');
        const room = await access(db, rid, user, true);
        if (room.role === 'spectator')
          throw new AppError(403, 'Espectadores podem somente assistir à mesa.');
        const result = await importCompanion(db, room, user, animal, position);
        if (result.changed)
          await db.query(
            'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now() WHERE id=$1',
            [rid, JSON.stringify(documentSchema.parse(room.document))],
          );
      });
      res.status(201).json(await state(rid, user));
    },
  );
  return router;
}
