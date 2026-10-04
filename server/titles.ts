import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { requireAdministrator, isAdministrator, administratorPredicate } from './administrators.js';
import { refreshAchievementProgress } from './achievement-progress.js';
import { titleSchema, type TitleInput } from '../shared/titles.js';
const uuid = z.string().uuid();
export function titlesRouter() {
  const router = Router();
  router.get('/titles/catalog', async (_req, res) =>
    res.json({
      can_edit: await isAdministrator(res.locals.user.id),
      items: (
        await pool.query(
          'SELECT id,document,revision FROM title_catalog WHERE deleted_at IS NULL ORDER BY created_at,id',
        )
      ).rows.map((r) => ({ ...r.document, id: r.id, revision: r.revision })),
    }),
  );
  router.get('/titles/characters', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const query = z.string().trim().min(2).max(80).parse(req.query.q);
    res.json(
      (
        await pool.query(
          'SELECT c.id,c.name,u.name AS player_name FROM characters c JOIN "user" u ON u.id=c.user_id WHERE c.deleted_at IS NULL AND (c.name ILIKE $1 OR u.name ILIKE $1) ORDER BY c.name LIMIT 25',
          ['%' + query.replaceAll('%', '\\%').replaceAll('_', '\\_') + '%'],
        )
      ).rows,
    );
  });
  router.post('/titles/catalog', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const d = titleSchema.parse(req.body);
    const r = await pool.query(
      `INSERT INTO title_catalog(document,created_by)SELECT $1,$2 WHERE ${administratorPredicate(2)} RETURNING id,revision`,
      [JSON.stringify(d), res.locals.user.id],
    );
    if (!r.rowCount) throw new AppError(403, 'Permissão de administrador necessária.');
    res.status(201).json(r.rows[0]);
  });
  router.put('/titles/catalog/:id', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const { revision, ...raw } = z
        .object({ revision: z.number().int().min(1) })
        .passthrough()
        .parse(req.body),
      d = titleSchema.parse(raw);
    const r = await pool.query(
      `UPDATE title_catalog SET document=$1,revision=revision+1 WHERE id=$2 AND revision=$3 AND deleted_at IS NULL AND ${administratorPredicate(4)} RETURNING id,revision`,
      [JSON.stringify(d), uuid.parse(req.params.id), revision, res.locals.user.id],
    );
    if (!r.rowCount) throw new AppError(409, 'O título mudou. Reabra sua versão atual.');
    res.json(r.rows[0]);
  });
  router.delete('/titles/catalog/:id', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const revision = z.number().int().min(1).parse(req.body?.revision);
    const r = await pool.query(
      `UPDATE title_catalog SET deleted_at=now(),revision=revision+1 WHERE id=$1 AND revision=$2 AND deleted_at IS NULL AND ${administratorPredicate(3)} RETURNING id`,
      [uuid.parse(req.params.id), revision, res.locals.user.id],
    );
    if (!r.rowCount) throw new AppError(409, 'O título mudou ou já foi excluído.');
    res.json({ ok: true });
  });
  router.post('/titles/grant', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const d = z
      .object({ character_id: uuid, title_id: uuid, action: z.enum(['grant', 'revoke']) })
      .strict()
      .parse(req.body);
    await transaction(async (client) => {
      await requireAdministrator(res.locals.user.id, client);
      if (
        !(
          await client.query(
            'SELECT id FROM characters WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',
            [d.character_id],
          )
        ).rowCount
      )
        throw new AppError(404, 'Personagem não encontrado.');
      if (
        !(
          await client.query('SELECT id FROM title_catalog WHERE id=$1 AND deleted_at IS NULL', [
            d.title_id,
          ])
        ).rowCount
      )
        throw new AppError(404, 'Título não encontrado.');
      await client.query(
        "INSERT INTO character_titles(character_id,title_id,source,granted_by,revoked) VALUES($1,$2,'manual',$3,$4) ON CONFLICT(character_id,title_id) DO UPDATE SET source='manual',granted_by=$3,granted_at=now(),revoked=$4",
        [d.character_id, d.title_id, res.locals.user.id, d.action === 'revoke'],
      );
      if (d.action === 'revoke')
        await client.query(
          'UPDATE characters SET displayed_title_id=NULL WHERE id=$1 AND displayed_title_id=$2',
          [d.character_id, d.title_id],
        );
      await client.query(
        'INSERT INTO character_title_log(character_id,title_id,action,actor_id)VALUES($1,$2,$3,$4)',
        [d.character_id, d.title_id, d.action, res.locals.user.id],
      );
    });
    res.json({ ok: true });
  });
  router.get('/titles/:characterId', async (req, res) => {
    const id = uuid.parse(req.params.characterId),
      uid = res.locals.user.id;
    const result = await transaction(async (client) => {
      const {
        rows: [character],
      } = await client.query(
        'SELECT id,level,progression_missions,displayed_title_id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [id, uid],
      );
      if (!character) throw new AppError(404, 'Personagem não encontrado.');
      await refreshAchievementProgress(client, id, uid);
      const { rows: unlocked } = await client.query(
        'SELECT code FROM achievements WHERE character_id=$1',
        [id],
      );
      const {
        rows: [spent],
      } = await client.query(
        'SELECT COALESCE(sum(total_cp),0) AS total FROM purchases WHERE character_id=$1',
        [id],
      );
      const { rows: catalog } = await client.query(
        'SELECT id,document,revision FROM title_catalog WHERE deleted_at IS NULL ORDER BY created_at,id',
      );
      const items = [];
      for (const row of catalog) {
        const d = row.document as TitleInput,
          g = d.goal;
        const current =
          g.kind === 'level'
            ? character.level
            : g.kind === 'missions'
              ? character.progression_missions
              : g.kind === 'spent'
                ? Math.floor(Number(spent.total) / 100)
                : g.kind === 'achievement'
                  ? Number(unlocked.some((a) => a.code === g.achievement))
                  : 0;
        const target = g.kind === 'achievement' ? 1 : g.target;
        if (g.kind !== 'manual' && current >= target) {
          const earned = await client.query(
            "INSERT INTO character_titles(character_id,title_id,source)VALUES($1,$2,'automatic') ON CONFLICT DO NOTHING RETURNING title_id",
            [id, row.id],
          );
          if (earned.rowCount)
            await client.query(
              "INSERT INTO character_title_log(character_id,title_id,action)VALUES($1,$2,'automatic')",
              [id, row.id],
            );
        }
        items.push({
          ...d,
          id: row.id,
          revision: row.revision,
          current: Math.min(current, target),
        });
      }
      const { rows: awards } = await client.query(
        'SELECT title_id,source FROM character_titles WHERE character_id=$1 AND NOT revoked',
        [id],
      );
      const combined = items.map((item) => ({
        ...item,
        earned: awards.some((a) => a.title_id === item.id),
        source: awards.find((a) => a.title_id === item.id)?.source,
      }));
      return {
        displayed: combined.some((t) => t.id === character.displayed_title_id && t.earned)
          ? character.displayed_title_id
          : null,
        items: combined,
      };
    });
    res.json({ ...result, can_edit: await isAdministrator(uid) });
  });
  router.put('/titles/:characterId/display', async (req, res) => {
    const id = uuid.parse(req.params.characterId),
      { title_id } = z.object({ title_id: uuid.nullable() }).strict().parse(req.body);
    await transaction(async (client) => {
      if (
        !(
          await client.query(
            'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
            [id, res.locals.user.id],
          )
        ).rowCount
      )
        throw new AppError(404, 'Personagem não encontrado.');
      if (
        title_id &&
        !(
          await client.query(
            'SELECT 1 FROM character_titles t JOIN title_catalog d ON d.id=t.title_id WHERE t.character_id=$1 AND t.title_id=$2 AND NOT t.revoked AND d.deleted_at IS NULL',
            [id, title_id],
          )
        ).rowCount
      )
        throw new AppError(403, 'Este personagem ainda não conquistou o título.');
      await client.query('UPDATE characters SET displayed_title_id=$2 WHERE id=$1', [id, title_id]);
    });
    res.json({ ok: true });
  });
  return router;
}
