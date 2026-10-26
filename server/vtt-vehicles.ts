import { Router, json } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { translateAttachmentGroup } from '../shared/vtt-attachments.js';
import { attachmentMovementError } from '../shared/vtt-movement.js';
import { newToken, pointSchema, documentSchema, type VttDocument } from '../shared/vtt.js';
import {
  vehicleIds,
  vehicleImage,
  vehicleSize,
  vehicleDefinitions,
  type OwnedVttVehicle,
} from '../shared/vtt-vehicles.js';
type DB = Pick<PoolClient, 'query'>;
type Room = { id: string; owner_id: string; document: VttDocument; revision: number };
type Access = (db: DB, id: string, user: string, lock?: boolean) => Promise<Room>;
async function list(db: DB, r: Room): Promise<OwnedVttVehicle[]> {
  return (
    await db.query(
      `SELECT c.id AS "characterId",c.name AS "characterName",u.name AS "ownerName",i.item_id AS "itemId",i.quantity
 FROM inventory i JOIN characters c ON c.id=i.character_id JOIN "user" u ON u.id=c.user_id
 WHERE c.deleted_at IS NULL AND i.quantity>0 AND i.item_id=ANY($3::text[]) AND(c.user_id=$2 OR EXISTS(SELECT 1 FROM vtt_members m WHERE m.room_id=$1 AND m.user_id=c.user_id AND m.role='player')) ORDER BY c.name,i.item_id`,
      [r.id, r.owner_id, vehicleIds],
    )
  ).rows;
}
export function vttVehiclesRouter(
  access: Access,
  state: (id: string, user: string) => Promise<unknown>,
) {
  const router = Router(),
    uuid = z.string().uuid();
  async function gm(db: DB, id: string, user: string, lock = false) {
    const r = await access(db, id, user, lock);
    if (r.owner_id !== user)
      throw new AppError(403, 'Somente o mestre pode puxar veículos para a mesa.');
    return r;
  }
  router.get('/vtt/rooms/:id/vehicles', async (req, res) => {
    const r = await gm(pool, uuid.parse(req.params.id), res.locals.user.id);
    res.set('Cache-Control', 'no-store').json({ vehicles: await list(pool, r) });
  });
  router.post('/vtt/rooms/:id/vehicles', json({ limit: '8kb' }), async (req, res) => {
    const id = uuid.parse(req.params.id),
      user = res.locals.user.id;
    await gm(pool, id, user);
    const input = z
      .object({
        characterId: uuid,
        itemId: z.enum(vehicleIds),
        copy: z.number().int().min(0).max(9999).default(0),
        position: pointSchema.optional(),
      })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      // Inventory operations lock the character before the inventory row. Keep that order.
      const c = (
        await db.query('SELECT id FROM characters WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [
          input.characterId,
        ])
      ).rows[0];
      if (!c) throw new AppError(404, 'Personagem não disponível nesta mesa.');
      const r = await gm(db, id, user, true),
        owned = (await list(db, r)).find(
          (v) => v.characterId === input.characterId && v.itemId === input.itemId,
        );
      if (!owned || input.copy >= owned.quantity)
        throw new AppError(404, 'Este veículo não pertence a um personagem disponível nesta mesa.');
      const scene = r.document.scenes.find((s) => s.id === r.document.activeScene)!;
      const existing = scene.tokens.find(
        (t) =>
          t.vehicle?.characterId === input.characterId &&
          t.vehicle.itemId === input.itemId &&
          t.vehicle.copy === input.copy,
      );
      if (existing && !input.position) return;
      if (existing?.locked) throw new AppError(403, 'Este veículo está bloqueado.');
      if (existing?.attachment)
        throw new AppError(400, 'Solte o vínculo antes de reposicionar o veículo.');
      if (!existing && scene.tokens.length >= 1000)
        throw new AppError(409, 'O mapa atingiu o limite de tokens.');
      const t = existing || newToken(crypto.randomUUID(), scene),
        d = vehicleDefinitions[input.itemId];
      if (!existing)
        Object.assign(t, vehicleSize(input.itemId, scene), {
          name: `${d.name} · ${owned.characterName}`,
          image: vehicleImage(input.itemId),
          layer: 'map',
          controller: null,
          characterId: null,
          sceneryToken: true,
          bleeds: false,
          vision: 0,
          vehicle: { characterId: input.characterId, itemId: input.itemId, copy: input.copy },
        });
      const at = input.position ?? { x: scene.width / 2, y: scene.height / 2 };
      const to = {
        x: Math.max(
          Math.min(t.width / 2, scene.width / 2),
          Math.min(scene.width - t.width / 2, at.x),
        ),
        y: Math.max(
          Math.min(t.height / 2, scene.height / 2),
          Math.min(scene.height - t.height / 2, at.y),
        ),
      };
      if (existing) {
        if (t.x === to.x && t.y === to.y) return;
        const error = attachmentMovementError(scene, t, [to]);
        if (error) throw new AppError(400, error);
        translateAttachmentGroup(scene, t, to);
      } else {
        Object.assign(t, to);
        scene.tokens.push(t);
      }
      await db.query(
        'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now() WHERE id=$1',
        [id, JSON.stringify(documentSchema.parse(r.document))],
      );
    });
    res.status(201).json(await state(id, user));
  });
  return router;
}
