import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { basicCompanionTokenBytes } from './companion-token-art.js';
import { basicCompanionToken } from '../shared/companion-token-art.js';
import {
  house2TokenPoint,
  house2TokenUpdate,
  house2TokenClamp,
  house2TokenCanMove,
  house2DoorOccupied,
  house2Doorway,
} from '../shared/house2-tokens.js';
import type { House2Token, House2TokenSource } from '../shared/house2-tokens.js';

const uuid = z.string().uuid();
type DB = Pick<PoolClient, 'query'>;
const select = `SELECT t.*,c.name AS character_name,c.user_id AS controller,
  coalesce(p.name,c.name) AS name,CASE WHEN t.pet_id IS NULL THEN 'character' ELSE 'pet' END AS kind,
  (t.pet_id IS NOT NULL OR ct.image IS NOT NULL) AS top_down,
  CASE WHEN t.pet_id IS NULL THEN coalesce(ct.updated_at::text,c.portrait_revision::text,'0')
    ELSE coalesce(w.image_revision::text,'0')||coalesce(p.appearance,'original') END AS art_version
  FROM house2_tokens t JOIN characters c ON c.id=t.character_id
  LEFT JOIN character_pets p ON p.id=t.pet_id AND p.character_id=c.id
  LEFT JOIN character_tokens ct ON ct.character_id=c.id
  LEFT JOIN companion_wardrobes w ON w.id=p.id
  WHERE c.deleted_at IS NULL AND (t.pet_id IS NULL OR p.id IS NOT NULL)`;
function token(row: any, user: string): House2Token {
  return {
    id: row.id,
    source_id: row.pet_id ?? row.character_id,
    kind: row.kind,
    name: row.name,
    character_id: row.character_id,
    character_name: row.character_name,
    image_url: `/api/house-v2/neighborhoods/${row.neighborhood_id}/tokens/${row.id}/image?v=${encodeURIComponent(row.art_version)}`,
    top_down: row.top_down,
    x: row.x,
    y: row.y,
    rotation: row.rotation,
    size: row.size,
    revision: row.revision,
    can_control: row.controller === user,
  };
}
async function neighborhood(db: DB, id: string, lock = false) {
  if (lock)
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['house2-actors:' + id]);
  if (!(await db.query('SELECT id FROM house2_neighborhoods WHERE id=$1', [id])).rowCount)
    throw new AppError(404, 'Vizinhança não encontrada.');
}
async function plots(db: DB, id: string) {
  return (
    await db.query('SELECT * FROM house2_plots WHERE neighborhood_id=$1 AND retired_at IS NULL', [
      id,
    ])
  ).rows;
}
async function ownedToken(db: DB, neighborhoodId: string, id: string, user: string) {
  const row = (
    await db.query(select + ' AND t.neighborhood_id=$1 AND t.id=$2', [neighborhoodId, id])
  ).rows[0];
  if (!row || row.controller !== user)
    throw new AppError(403, 'Você só pode mover ou retirar seus próprios tokens.');
  return row;
}
export function house2TokensRouter() {
  const router = Router();
  router.get('/house-v2/token-library', async (_req, res) => {
    const user = res.locals.user.id;
    const characters = (
      await pool.query(
        `SELECT c.id,c.name,c.portrait_revision,
      (t.image IS NOT NULL) AS top_down,(t.image IS NOT NULL OR p.image IS NOT NULL) AS has_image
      FROM characters c LEFT JOIN character_tokens t ON t.character_id=c.id
      LEFT JOIN character_portraits p ON p.character_id=c.id
      WHERE c.user_id=$1 AND c.deleted_at IS NULL ORDER BY c.created_at,c.id`,
        [user],
      )
    ).rows;
    const pets = (
      await pool.query(
        `SELECT p.id,p.name,p.pet_id,p.appearance,c.id AS character_id,c.name AS character_name,
      w.image_revision,(a.token_image IS NOT NULL) AS has_token FROM character_pets p
      JOIN characters c ON c.id=p.character_id LEFT JOIN companion_wardrobes w ON w.id=p.id
      LEFT JOIN companion_artworks a ON a.wardrobe_id=p.id
      WHERE c.user_id=$1 AND c.deleted_at IS NULL ORDER BY c.name,p.name,p.id`,
        [user],
      )
    ).rows;
    const sources: House2TokenSource[] = [
      ...characters.map((c) => ({
        id: c.id,
        kind: 'character' as const,
        name: c.name,
        character_id: c.id,
        character_name: c.name,
        top_down: c.top_down,
        image_url: c.has_image
          ? `/api/characters/${c.id}/token?v=${c.portrait_revision}`
          : '/character-silhouette-v2.png',
      })),
      ...pets.map((p) => ({
        id: p.id,
        kind: 'pet' as const,
        name: p.name,
        character_id: p.character_id,
        character_name: p.character_name,
        top_down: true,
        image_url: p.has_token
          ? `/api/companions/${p.character_id}/pet/${p.id}/token?v=${p.image_revision}`
          : basicCompanionToken('pet', p.pet_id, p.appearance)!,
      })),
    ];
    res.set('Cache-Control', 'private, no-store').json({ sources });
  });
  router.get('/house-v2/neighborhoods/:id/tokens', async (req, res) => {
    const id = uuid.parse(req.params.id);
    await neighborhood(pool, id);
    const rows = (
      await pool.query(select + ' AND t.neighborhood_id=$1 ORDER BY t.created_at,t.id', [id])
    ).rows;
    res.set('Cache-Control', 'private, no-store').json({
      tokens: rows.map((r) => token(r, res.locals.user.id)),
      doors: Object.fromEntries((await plots(pool, id)).map((p) => [p.id, p.door_open])),
    });
  });
  router.get('/house-v2/neighborhoods/:id/tokens/:token/image', async (req, res) => {
    const id = uuid.parse(req.params.id),
      tid = uuid.parse(req.params.token);
    const row = (
      await pool.query(
        `SELECT t.pet_id,p.pet_id AS species,p.appearance,
      CASE WHEN t.pet_id IS NULL THEN coalesce(ct.image,cp.image) ELSE a.token_image END AS image
      FROM house2_tokens t JOIN characters c ON c.id=t.character_id
      LEFT JOIN character_pets p ON p.id=t.pet_id AND p.character_id=c.id
      LEFT JOIN character_tokens ct ON ct.character_id=c.id LEFT JOIN character_portraits cp ON cp.character_id=c.id
      LEFT JOIN companion_artworks a ON a.wardrobe_id=p.id
      WHERE t.neighborhood_id=$1 AND t.id=$2 AND c.deleted_at IS NULL AND (t.pet_id IS NULL OR p.id IS NOT NULL)`,
        [id, tid],
      )
    ).rows[0];
    if (!row) throw new AppError(404, 'Token não encontrado nesta vizinhança.');
    let bytes: Buffer = row.image;
    if (!bytes && row.pet_id)
      bytes = await basicCompanionTokenBytes('pet', row.species, row.appearance);
    if (!bytes) {
      for (const root of ['public', 'dist/client']) {
        try {
          bytes = await readFile(resolve(root, 'character-silhouette-v2.png'));
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
    }
    if (!bytes) throw new AppError(404, 'Imagem do token não disponível.');
    res
      .set('Cache-Control', 'private, no-store')
      .type('webp')
      .send(
        await sharp(bytes)
          .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 95, alphaQuality: 100 })
          .toBuffer(),
      );
  });
  router.post('/house-v2/neighborhoods/:id/tokens', async (req, res) => {
    const id = uuid.parse(req.params.id),
      user = res.locals.user.id;
    const b = z
      .object({ kind: z.enum(['character', 'pet']), source_id: uuid, position: house2TokenPoint })
      .strict()
      .parse(req.body);
    const result = await transaction(async (db) => {
      await neighborhood(db, id, true);
      const source =
        b.kind === 'character'
          ? (
              await db.query(
                'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR KEY SHARE',
                [b.source_id, user],
              )
            ).rows[0]
          : (
              await db.query(
                'SELECT c.id,p.pet_id FROM character_pets p JOIN characters c ON c.id=p.character_id WHERE p.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL FOR KEY SHARE OF c,p',
                [b.source_id, user],
              )
            ).rows[0];
      if (!source) throw new AppError(403, 'Escolha um personagem ou pet da sua conta.');
      const previous = (
        await db.query(
          select +
            (b.kind === 'character'
              ? ' AND t.neighborhood_id=$1 AND t.character_id=$2 AND t.pet_id IS NULL'
              : ' AND t.neighborhood_id=$1 AND t.pet_id=$2'),
          [id, b.source_id],
        )
      ).rows[0];
      if (previous) return token(previous, user);
      const size = b.kind === 'character' ? 1.1 : source.pet_id === 'dog' ? 1 : 0.7;
      const at = house2TokenClamp({ ...b.position, size });
      if (!house2TokenCanMove(await plots(db, id), at, at, size))
        throw new AppError(400, 'Escolha uma posição livre das paredes.');
      const inserted = (
        await db.query(
          'INSERT INTO house2_tokens(neighborhood_id,character_id,pet_id,x,y,size) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
          [id, source.id, b.kind === 'pet' ? b.source_id : null, at.x, at.y, size],
        )
      ).rows[0];
      return token((await db.query(select + ' AND t.id=$1', [inserted.id])).rows[0], user);
    });
    res.status(201).json(result);
  });
  router.patch('/house-v2/neighborhoods/:id/tokens/:token', async (req, res) => {
    const id = uuid.parse(req.params.id),
      tid = uuid.parse(req.params.token),
      user = res.locals.user.id,
      b = house2TokenUpdate.parse(req.body);
    const result = await transaction(async (db) => {
      await neighborhood(db, id, true);
      const old = await ownedToken(db, id, tid, user);
      if (old.revision !== b.revision)
        throw new AppError(
          409,
          'Este token mudou em outra janela. A posição atual foi preservada.',
        );
      const clamped = house2TokenClamp(b);
      if (Math.abs(clamped.x - b.x) > 0.00001 || Math.abs(clamped.y - b.y) > 0.00001)
        throw new AppError(400, 'O token deve permanecer inteiro dentro do mapa.');
      const houses = await plots(db, id),
        path = [old, ...(b.path ?? []), b];
      for (let i = 1; i < path.length; i++)
        if (!house2TokenCanMove(houses, path[i - 1], path[i], b.size))
          throw new AppError(400, 'Uma parede ou porta fechada bloqueia o caminho.');
      await db.query(
        'UPDATE house2_tokens SET x=$2,y=$3,rotation=$4,size=$5,revision=revision+1 WHERE id=$1',
        [tid, b.x, b.y, b.rotation, b.size],
      );
      return token((await db.query(select + ' AND t.id=$1', [tid])).rows[0], user);
    });
    res.json(result);
  });
  router.delete('/house-v2/neighborhoods/:id/tokens/:token', async (req, res) => {
    const id = uuid.parse(req.params.id),
      tid = uuid.parse(req.params.token),
      b = z
        .object({ revision: z.number().int().min(0) })
        .strict()
        .parse(req.body);
    await transaction(async (db) => {
      await neighborhood(db, id, true);
      const old = await ownedToken(db, id, tid, res.locals.user.id);
      if (old.revision !== b.revision)
        throw new AppError(409, 'O token mudou em outra janela. Atualize antes de retirar.');
      await db.query('DELETE FROM house2_tokens WHERE id=$1', [tid]);
    });
    res.json({ removed: true });
  });
  router.patch('/house-v2/neighborhoods/:id/doors/:plot', async (req, res) => {
    const id = uuid.parse(req.params.id),
      pid = uuid.parse(req.params.plot),
      user = res.locals.user.id;
    const { open } = z.object({ open: z.boolean() }).strict().parse(req.body);
    await transaction(async (db) => {
      await neighborhood(db, id, true);
      const house = (
        await db.query(
          `SELECT p.*,c.user_id=$3 AS owner FROM house2_plots p JOIN characters c ON c.id=p.character_id
        WHERE p.id=$1 AND p.neighborhood_id=$2 AND p.retired_at IS NULL AND c.deleted_at IS NULL AND p.house_id IS NOT NULL FOR UPDATE OF p`,
          [pid, id, user],
        )
      ).rows[0];
      if (!house) throw new AppError(404, 'Casa não encontrada.');
      const actors = (await db.query(select + ' AND t.neighborhood_id=$1', [id])).rows;
      const doorway = house2Doorway(house)!;
      if (
        !house.owner &&
        !actors.some(
          (a) =>
            a.controller === user &&
            !a.pet_id &&
            Math.hypot(a.x - doorway.x, a.y - doorway.y) <= 2 + a.size / 2,
        )
      )
        throw new AppError(403, 'Aproxime seu personagem da porta para abri-la.');
      if (!open && house2DoorOccupied(house, actors))
        throw new AppError(409, 'Afaste o personagem ou pet da passagem antes de fechar.');
      await db.query('UPDATE house2_plots SET door_open=$2 WHERE id=$1', [pid, open]);
    });
    res.json({ plot_id: pid, open });
  });
  return router;
}
