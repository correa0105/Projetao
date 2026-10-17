import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { isAdministrator, requireAdministrator } from './administrators.js';
import { AppError } from './services.js';
import { worldClockTime } from '../shared/world-clock.js';
type State = { anchor_minutes: number; anchor_at: Date; revision: number };
const snapshot = (row: State, canEdit: boolean) => ({
  timeMs: worldClockTime(row.anchor_minutes, row.anchor_at.getTime(), Date.now()),
  revision: row.revision,
  canEdit,
});
const update = z
  .object({
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    revision: z.number().int().positive(),
  })
  .strict();
export function worldClockRouter() {
  const router = Router();
  router.get('/world-clock', async (_req, res) => {
    const [
      {
        rows: [row],
      },
      canEdit,
    ] = await Promise.all([
      pool.query<State>(
        'SELECT anchor_minutes,anchor_at,revision FROM world_clock_state WHERE singleton',
      ),
      isAdministrator(res.locals.user.id),
    ]);
    res.json(snapshot(row, canEdit));
  });
  router.post('/world-clock', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const body = update.parse(req.body),
      [hour, minute] = body.time.split(':').map(Number);
    const result = await transaction(async (db) => {
      const {
        rows: [old],
      } = await db.query<State>(
        'SELECT anchor_minutes,anchor_at,revision FROM world_clock_state WHERE singleton FOR UPDATE',
      );
      if (body.revision !== old.revision)
        throw new AppError(
          409,
          'O relógio foi ajustado em outra janela. Atualize antes de salvar.',
        );
      const previous = Math.floor(
        worldClockTime(old.anchor_minutes, old.anchor_at.getTime(), Date.now()) / 60_000,
      );
      const {
        rows: [row],
      } = await db.query<State>(
        'UPDATE world_clock_state SET anchor_minutes=$1,anchor_at=now(),revision=revision+1,changed_by=$2 WHERE singleton RETURNING anchor_minutes,anchor_at,revision',
        [hour * 60 + minute, res.locals.user.id],
      );
      await db.query(
        'INSERT INTO world_clock_changes(actor_id,previous_minutes,new_minutes,revision) VALUES($1,$2,$3,$4)',
        [res.locals.user.id, previous, hour * 60 + minute, row.revision],
      );
      return snapshot(row, true);
    });
    res.json(result);
  });
  return router;
}
