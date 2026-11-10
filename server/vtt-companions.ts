import { canManageVtt } from './vtt-permissions.js';
import { randomInt } from 'node:crypto';
import { reuseVttAsset } from './vtt-assets.js';
import express from 'express';
import { z } from 'zod';
import sharp from 'sharp';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { mounts } from '../shared/mounts.js';
import { pets } from '../shared/pets.js';
import {
  newToken,
  pointSchema,
  snapPoint,
  documentSchema,
  type VttDocument,
  type VttToken,
} from '../shared/vtt.js';
import { tokenPlacement } from '../shared/vtt-placement';
import { movementBlocked, attachmentMovementError } from '../shared/vtt-movement.js';
import { translateAttachmentGroup } from '../shared/vtt-attachments.js';
import { vttAssetPath } from '../shared/vtt-token-image.js';
import type { VttCompanion, VttCompanionAid } from '../shared/vtt-companions.js';
import { basicCompanionTokenBytes } from './companion-token-art.js';
import { companionAid } from '../shared/companion-aid.js';
import { deriveSheet, skills, skillAbilities } from '../shared/character-sheet.js';
import { modifier } from '../shared/rules.js';
import { rollFormula } from '../shared/vtt-roll.js';
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
type AidRow = {
  id: string;
  kind: 'mount' | 'pet';
  species: string;
  appearance: string;
  name: string;
  character_id: string;
  character_name: string;
  user_id: string;
  ready_at: Date | null;
};
async function aidRows(db: DB, room: string, ids: string[], lock = false) {
  if (!ids.length) return [];
  const { rows } = await db.query<AidRow>(
    `SELECT a.*, c.name AS character_name, c.user_id,
        CASE WHEN u.last_used_at > now() - interval '24 hours'
          THEN u.last_used_at + interval '24 hours' END AS ready_at
       FROM (
         SELECT id, character_id, 'mount' AS kind, mount_id AS species, coat AS appearance, name
         FROM character_mounts WHERE id=ANY($2::uuid[])
         UNION ALL
         SELECT id, character_id, 'pet', pet_id, appearance, name
         FROM character_pets WHERE id=ANY($2::uuid[])
       ) a
       JOIN characters c ON c.id=a.character_id AND c.deleted_at IS NULL
       JOIN vtt_rooms r ON r.id=$1
       JOIN vtt_character_links l ON l.room_id=r.id AND l.character_id=c.id
       LEFT JOIN vtt_members m ON m.room_id=r.id AND m.user_id=c.user_id
       LEFT JOIN vtt_companion_aid u ON u.character_id=c.id
       WHERE c.user_id=r.owner_id OR m.role='player'
       ORDER BY c.name,a.name,a.id${lock ? ' FOR KEY SHARE OF c' : ''}`,
    [room, ids],
  );
  return rows;
}

function activeAidTokens(room: Room) {
  const scene = room.document.scenes.find((s) => s.id === room.document.activeScene);
  if (!scene || room.document.initiative.length) return [];
  return scene.tokens.filter((t) => t.layer === 'tokens' && !t.hidden && t.hp > 0);
}

function aidOnScene(row: AidRow, tokens: VttToken[]): VttCompanionAid | undefined {
  if (
    !tokens.some((t) => t.characterId === row.character_id && t.controller === row.user_id) ||
    !tokens.some((t) => t.companionId === row.id && t.controller === row.user_id)
  )
    return;
  const aid = companionAid(row.kind, row.species, row.appearance);
  if (!aid) return;
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    characterName: row.character_name,
    aid,
    readyAt: row.ready_at?.toISOString() ?? null,
  };
}

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
  const isGm = canManageVtt(room, user);
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
    ? tokenPlacement(position, token, scene)
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
  if (!isGm && movementBlocked(scene, existing || to, to, token))
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
  const asset = await reuseVttAsset(db, {
    roomId: room.id,
    name: animal.name + ' · token',
    kind: 'image',
    mime: 'image/webp',
    bytes,
    width: meta.width,
    height: meta.height,
    companionId: animal.id,
  });
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
    const user = res.locals.user.id;
    const room = await access(pool, uuid.parse(req.params.id), user);
    const tokens = canManageVtt(room, user) ? activeAidTokens(room) : [];
    const rows = await aidRows(
      pool,
      room.id,
      tokens.flatMap((t) => (t.companionId ? [t.companionId] : [])),
    );
    res.json({
      companions: room.role === 'spectator' ? [] : await owned(pool, user),
      aids: rows.flatMap((row) => aidOnScene(row, tokens) ?? []),
    });
  });
  router.post('/vtt/rooms/:id/companions/:companion/aid', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      id = uuid.parse(req.params.companion);
    const { id: user, name: author } = res.locals.user;
    await transaction(async (db) => {
      if (!canManageVtt(await access(db, rid, user), user))
        throw new AppError(403, 'Somente o mestre pode autorizar o auxílio na mesa.');
      const [row] = await aidRows(db, rid, [id], true);
      if (!row) throw new AppError(404, 'Companheiro não encontrado nesta mesa.');
      const current = await access(db, rid, user, true);
      if (!canManageVtt(current, user))
        throw new AppError(403, 'Somente o mestre pode autorizar o auxílio na mesa.');
      const check = aidOnScene(row, activeAidTokens(current));
      if (!check)
        throw new AppError(409, 'Coloque o personagem e o companheiro em cena fora da iniciativa.');
      const {
        rows: [character],
      } = await db.query(
        `SELECT c.*, s.choices, s.finalized_at
         FROM characters c LEFT JOIN character_sheets s ON s.character_id=c.id
         WHERE c.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL`,
        [row.character_id, row.user_id],
      );
      if (!character) throw new AppError(404, 'Personagem não encontrado.');
      const { aid } = check;
      const skillIndex = skills.indexOf(aid.skill);
      const skill =
        character.finalized_at &&
        deriveSheet(character, character.choices).skills.find((entry) => entry.name === aid.skill);
      const total =
        (skill ? skill.value : modifier(character.stats[skillAbilities[skillIndex]])) + aid.bonus;
      const usage = await db.query(
        `INSERT INTO vtt_companion_aid(character_id) VALUES($1)
         ON CONFLICT(character_id) DO UPDATE SET last_used_at=now()
         WHERE vtt_companion_aid.last_used_at <= now() - interval '24 hours'
         RETURNING last_used_at`,
        [row.character_id],
      );
      if (!usage.rowCount)
        throw new AppError(409, 'Este personagem já recebeu auxílio nas últimas 24 horas.');
      const roll = rollFormula('1d20' + (total < 0 ? total : '+' + total), randomInt);
      await db.query(
        'INSERT INTO vtt_messages(room_id,author_id,author,text,roll) VALUES($1,$2,$3,$4,$5)',
        [
          rid,
          user,
          author,
          `${check.characterName} · ${aid.skill} · ${check.name} · ${aid.name} (+${aid.bonus})`,
          JSON.stringify(roll),
        ],
      );
    });
    res.status(201).json(await state(rid, user));
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
