import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { isAdministrator, requireAdministrator } from './administrators.js';
import { defaultGuildFacilities, guildFacilities } from '../shared/guild-facilities.js';
export function guildFacilityDefinitionsRouter() {
  const router = Router();
  router.get('/community/facilities', async (_req, res) => {
    const { rows } = await pool.query(
      'SELECT room,name,description,upgrade_description,x,y,scale,revision FROM guild_facility_definitions',
    );
    res.json({
      items: defaultGuildFacilities().map((f) => ({
        ...f,
        ...rows.find((r) => r.room === f.room),
      })),
      can_edit: await isAdministrator(res.locals.user.id),
    });
  });
  router.put('/community/facilities/:room', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const room = z
      .string()
      .refine((value) => guildFacilities.some((f) => f.room === value))
      .parse(req.params.room);
    const input = z
      .object({
        name: z.string().trim().min(2).max(100),
        description: z.string().trim().max(2000),
        upgrade_description: z.string().trim().max(2000),
        x: z.number().finite().min(0.03).max(0.97),
        y: z.number().finite().min(0.4).max(0.97),
        scale: z.number().finite().min(0.04).max(0.6),
        revision: z.number().int().min(0),
      })
      .strict()
      .parse(req.body);
    const result = await transaction(async (db) => {
      await requireAdministrator(res.locals.user.id, db);
      await db.query("SELECT pg_advisory_xact_lock(hashtext('guild-facility:' || $1))", [room]);
      const {
        rows: [previous],
      } = await db.query(
        'SELECT revision FROM guild_facility_definitions WHERE room=$1 FOR UPDATE',
        [room],
      );
      if ((previous?.revision ?? 0) !== input.revision)
        throw new AppError(409, 'O objeto mudou. Reabra a edição para carregar a versão atual.');
      const {
        rows: [saved],
      } = await db.query(
        `INSERT INTO guild_facility_definitions(room,name,description,upgrade_description,x,y,scale,updated_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(room) DO UPDATE SET name=excluded.name,description=excluded.description,upgrade_description=excluded.upgrade_description,x=excluded.x,y=excluded.y,scale=excluded.scale,revision=guild_facility_definitions.revision+1,updated_by=excluded.updated_by,updated_at=now() RETURNING room,name,description,upgrade_description,x,y,scale,revision`,
        [
          room,
          input.name,
          input.description,
          input.upgrade_description,
          input.x,
          input.y,
          input.scale,
          res.locals.user.id,
        ],
      );
      return saved;
    });
    res.json(result);
  });
  return router;
}
