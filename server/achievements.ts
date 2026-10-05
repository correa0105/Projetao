import { refreshAchievementProgress } from './achievement-progress.js';
import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { isAdministrator, requireAdministrator } from './administrators.js';
import {
  achievementCatalog,
  emptyShelf,
  defaultPositions,
  defaultShelfRows,
} from '../shared/achievements.js';
const schema = z
  .object({
    material: z.enum(['walnut', 'oak', 'ebony']),
    medal_frame: z.enum(['bronze', 'silver', 'dragon']),
    slots: z.array(
      z
        .string()
        .refine((v) => achievementCatalog.some((a) => a.code === v))
        .nullable(),
    ),
    positions: z.array(z.number().finite().min(0).max(90)).optional(),
    rows: z.array(z.number().int().min(0).max(2)).optional(),
  })
  .strict()
  .refine(
    (v) => new Set(v.slots.filter(Boolean)).size === v.slots.filter(Boolean).length,
    'Não repita conquistas.',
  )
  .refine(
    (v) =>
      (!v.positions || v.positions.length === v.slots.length) &&
      (!v.rows || v.rows.length === v.slots.length),
    'Cada peça precisa de posição e prateleira.',
  );
export function achievementsRouter() {
  const router = Router();
  router.get('/achievements/catalog', async (_req, res) => {
    const { rows } = await pool.query(
      'SELECT code,title,description,revision FROM achievement_definitions',
    );
    res.json({
      can_edit: await isAdministrator(res.locals.user.id),
      items: achievementCatalog.map((a) => ({
        ...a,
        revision: 0,
        ...rows.find((r) => r.code === a.code),
      })),
    });
  });
  router.put('/achievements/catalog/:code', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const code = z
      .string()
      .refine((v) => achievementCatalog.some((a) => a.code === v))
      .parse(req.params.code);
    const input = z
      .object({
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().max(1000),
        revision: z.number().int().min(0),
        title_id: z.string().uuid().nullable(),
      })
      .strict()
      .parse(req.body);
    const result = await transaction(async (client) => {
      await requireAdministrator(res.locals.user.id, client);
      // A definition may still use its shared default (revision 0). Serialize
      // that first insert as well as later edits and the title association.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('achievement-definition:' || $1))",
        [code],
      );
      const {
        rows: [current],
      } = await client.query(
        'SELECT revision FROM achievement_definitions WHERE code=$1 FOR UPDATE',
        [code],
      );
      if ((current?.revision ?? 0) !== input.revision)
        throw new AppError(409, 'A conquista mudou. Reabra sua versão atual.');
      const { rows: linked } = await client.query(
        "SELECT id FROM title_catalog WHERE deleted_at IS NULL AND ((document->'goal'->>'kind'='achievement' AND document->'goal'->>'achievement'=$1) OR id=$2::uuid) ORDER BY id FOR UPDATE",
        [code, input.title_id],
      );
      if (input.title_id && !linked.some((t) => t.id === input.title_id))
        throw new AppError(404, 'Título não encontrado.');
      const previous = linked.filter((t) => t.id !== input.title_id).map((t) => t.id);
      if (previous.length)
        await client.query(
          "UPDATE title_catalog SET document=jsonb_set(document,'{goal}', $1::jsonb),revision=revision+1 WHERE id=ANY($2::uuid[])",
          [JSON.stringify({ kind: 'manual', target: 1, achievement: '' }), previous],
        );
      if (input.title_id)
        await client.query(
          "UPDATE title_catalog SET document=jsonb_set(document,'{goal}', $1::jsonb),revision=revision+1 WHERE id=$2 AND document->'goal' IS DISTINCT FROM $1::jsonb",
          [JSON.stringify({ kind: 'achievement', target: 1, achievement: code }), input.title_id],
        );
      const {
        rows: [saved],
      } = await client.query(
        'INSERT INTO achievement_definitions(code,title,description,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(code) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,revision=achievement_definitions.revision+1,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING code,title,description,revision',
        [code, input.title, input.description, res.locals.user.id],
      );
      return saved;
    });
    res.json(result);
  });
  for (const method of ['get', 'post'] as const)
    router[method]('/characters/:id/achievements', async (req, res) => {
      const id = z.string().uuid().parse(req.params.id),
        config = method === 'post' ? schema.parse(req.body) : null;
      res.json(
        await transaction(async (client) => {
          const owned = await client.query(
            'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
            [id, res.locals.user.id],
          );
          if (!owned.rowCount) throw new AppError(404, 'Personagem não encontrado.');
          const progress = await refreshAchievementProgress(client, id, res.locals.user.id);
          const { rows: unlocked } = await client.query(
            'SELECT a.code,a.unlocked_at FROM achievements a JOIN characters c ON c.id=a.character_id WHERE c.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL',
            [id, res.locals.user.id],
          );
          if (config) {
            if (config.slots.some((code) => code && !unlocked.some((a) => a.code === code)))
              throw new AppError(
                400,
                'Escolha apenas conquistas desbloqueadas por este personagem.',
              );
            await client.query(
              'INSERT INTO achievement_shelves(character_id,material,medal_frame,slots,positions,rows) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb) ON CONFLICT(character_id) DO UPDATE SET material=EXCLUDED.material,medal_frame=EXCLUDED.medal_frame,slots=EXCLUDED.slots,positions=EXCLUDED.positions,rows=EXCLUDED.rows,updated_at=now()',
              [
                id,
                config.material,
                config.medal_frame,
                JSON.stringify(config.slots),
                JSON.stringify(config.positions ?? defaultPositions(config.slots.length)),
                JSON.stringify(config.rows ?? defaultShelfRows(config.slots.length)),
              ],
            );
          }
          const { rows } = await client.query(
            'SELECT s.material,s.medal_frame,s.slots,s.positions,s.rows FROM achievement_shelves s JOIN characters c ON c.id=s.character_id WHERE c.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL',
            [id, res.locals.user.id],
          );
          return { unlocked, progress, shelf: rows[0] ?? emptyShelf() };
        }),
      );
    });
  return router;
}
