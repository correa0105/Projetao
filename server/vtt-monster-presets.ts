import { Router } from 'express';
import { z } from 'zod';
import { pool } from './db.js';
import { requireAdministrator } from './administrators.js';
import { AppError } from './services.js';
import { tokenSchema, type VttDocument } from '../shared/vtt.js';
import type { PoolClient } from 'pg';
type DB = Pick<PoolClient, 'query'>;
export async function saveMonsterPresets(db: DB, user: string, roomId: string, doc: VttDocument) {
  for (const token of doc.scenes
    .flatMap((s) => s.tokens)
    .filter((t) => t.sheet && !t.characterId && t.layer !== 'map')) {
    await db.query(
      `INSERT INTO vtt_monster_presets(user_id,source_room_id,source_token_id,token)
      VALUES($1,$2,$3,$4) ON CONFLICT(user_id,source_token_id) DO UPDATE SET token=EXCLUDED.token,
      updated_at=now() WHERE vtt_monster_presets.token IS DISTINCT FROM EXCLUDED.token`,
      [user, roomId, token.id, JSON.stringify(token)],
    );
  }
}
export function vttMonsterPresetRouter() {
  const router = Router();
  router.get('/vtt/monster-presets', async (_req, res) => {
    await requireAdministrator(res.locals.user.id);
    const { rows } = await pool.query(
      'SELECT id,token,updated_at FROM vtt_monster_presets WHERE user_id=$1 ORDER BY updated_at DESC',
      [res.locals.user.id],
    );
    res.json(
      rows.map((r) => ({
        ...r,
        token: tokenSchema.parse(r.token),
        name: r.token.name,
        image: r.token.image,
      })),
    );
  });
  router.delete('/vtt/monster-presets/:id', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const { rowCount } = await pool.query(
      'DELETE FROM vtt_monster_presets WHERE id=$1 AND user_id=$2',
      [z.string().uuid().parse(req.params.id), res.locals.user.id],
    );
    if (!rowCount) throw new AppError(404, 'Preset não encontrado.');
    res.json({ ok: true });
  });
  return router;
}
