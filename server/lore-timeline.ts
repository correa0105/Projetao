import express from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { requireAdministrator, isAdministrator, administratorPredicate } from './administrators.js';
import { AppError } from './services.js';
import { INITIAL_LORE_TIMELINE, loreTimelineSchema } from '../shared/lore-timeline.js';

const inputSchema = z
  .object({ revision: z.number().int().min(0), document: loreTimelineSchema })
  .strict();
export function loreTimelineRouter() {
  const router = express.Router();
  router.get('/lore-timeline', async (_req, res) => {
    await pool.query(
      'INSERT INTO lore_timeline(id,document) VALUES(1,$1) ON CONFLICT(id) DO NOTHING',
      [JSON.stringify(INITIAL_LORE_TIMELINE)],
    );
    const {
      rows: [timeline],
    } = await pool.query('SELECT document,revision FROM lore_timeline WHERE id=1');
    const canEdit = await isAdministrator(res.locals.user.id);
    const document = canEdit
      ? timeline.document
      : {
          ...timeline.document,
          eras: timeline.document.eras.map((era: import('../shared/lore-timeline.js').LoreEra) =>
            era.revealed ? era : { ...era, title: '', description: '' },
          ),
        };
    res.json({ ...timeline, document, can_edit: canEdit });
  });
  router.put('/lore-timeline', async (req, res) => {
    const userId = res.locals.user.id;
    await requireAdministrator(userId);
    const input = inputSchema.parse(req.body);
    const result = await transaction(async (client) => {
      // Serialize with folder moves/deletions, so new links cannot point at deleted folders.
      await client.query('SELECT pg_advisory_xact_lock(74261925)');
      const folderIds = input.document.eras.flatMap((era) => era.folder_ids);
      const folders = await client.query(
        'SELECT id FROM lore_folders WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL',
        [folderIds],
      );
      if (folders.rowCount !== folderIds.length)
        throw new AppError(400, 'Uma das pastas foi excluída. Escolha uma pasta disponível.');
      await client.query(
        'INSERT INTO lore_timeline(id,document) VALUES(1,$1) ON CONFLICT(id) DO NOTHING',
        [JSON.stringify(INITIAL_LORE_TIMELINE)],
      );
      const saved = await client.query(
        `UPDATE lore_timeline SET document=$1,revision=revision+1,updated_by=$2,updated_at=now()
        WHERE id=1 AND revision=$3 AND ${administratorPredicate(2)} RETURNING document,revision`,
        [JSON.stringify(input.document), userId, input.revision],
      );
      if (!saved.rowCount) {
        await requireAdministrator(userId, client);
        throw new AppError(
          409,
          'A linha do tempo foi alterada. Reabra o editor para carregar a versão atual.',
        );
      }
      return saved.rows[0];
    });
    res.json({ ...result, can_edit: true });
  });
  return router;
}
