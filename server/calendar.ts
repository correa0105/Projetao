import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { requireAdministrator, isAdministrator } from './administrators.js';
import { AppError } from './services.js';
import {
  calendarSettingsSchema,
  defaultCalendarSettings,
  type CalendarEntry,
} from '../shared/calendar.js';
export function calendarRouter() {
  const router = Router();
  router.get('/calendar', async (req, res) => {
    const month = z
      .string()
      .regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/)
      .parse(req.query.month);
    await pool.query(
      'INSERT INTO guild_calendar(id,document) VALUES(1,$1) ON CONFLICT DO NOTHING',
      [JSON.stringify(defaultCalendarSettings)],
    );
    const [settings, posts, publications] = await Promise.all([
      pool.query('SELECT document,revision FROM guild_calendar WHERE id=1'),
      pool.query(
        `SELECT b.id,b.kind,b.title,b.description,b.starts_at,b.location,b.status,b.created_at,b.event_revision,b.event_presentation AS presentation,u.name AS author_name FROM board_posts b LEFT JOIN "user" u ON u.id=b.author_id WHERE b.kind IN ('event','mission') AND (b.starts_at AT TIME ZONE 'America/Sao_Paulo')::date >= $1::date AND (b.starts_at AT TIME ZONE 'America/Sao_Paulo')::date < ($1::date+interval '1 month') ORDER BY b.starts_at,b.id`,
        [month + '-01'],
      ),
      pool.query(
        `SELECT id,title,body,starts_at,location FROM home_updates WHERE (starts_at AT TIME ZONE 'America/Sao_Paulo')::date >= $1::date AND (starts_at AT TIME ZONE 'America/Sao_Paulo')::date < ($1::date+interval '1 month') ORDER BY starts_at,id`,
        [month + '-01'],
      ),
    ]);
    const entries: CalendarEntry[] = [
      ...posts.rows.map((item) => ({
        id: item.id,
        source: item.kind,
        title: item.title,
        description: item.description,
        starts_at: item.starts_at,
        location: item.location,
        status: item.status,
        ...(item.kind === 'event' ? { event: item } : {}),
      })),
      ...publications.rows.map((item) => ({
        id: item.id,
        source: 'publication' as const,
        title: item.title,
        description: item.body,
        starts_at: item.starts_at,
        location: item.location,
        status: 'open',
      })),
    ];
    entries.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    res.json({ ...settings.rows[0], can_edit: await isAdministrator(res.locals.user.id), entries });
  });
  router.put('/calendar/settings', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const input = z
      .object({ document: calendarSettingsSchema, revision: z.number().int().min(1) })
      .strict()
      .parse(req.body);
    const result = await transaction(async (client) => {
      await requireAdministrator(res.locals.user.id, client);
      if (
        input.document.background.startsWith('/api/event-images/') &&
        !(
          await client.query('SELECT id FROM event_images WHERE id=$1', [
            input.document.background.split('/').at(-1),
          ])
        ).rowCount
      )
        throw new AppError(400, 'Imagem não encontrada.');
      const updated = await client.query(
        'UPDATE guild_calendar SET document=$1,revision=revision+1,updated_by=$2,updated_at=now() WHERE id=1 AND revision=$3 RETURNING document,revision',
        [JSON.stringify(input.document), res.locals.user.id, input.revision],
      );
      if (!updated.rowCount)
        throw new AppError(
          409,
          'O calendário foi editado por outra pessoa. Atualize antes de salvar.',
        );
      return updated.rows[0];
    });
    res.json({ ...result, can_edit: true });
  });
  return router;
}
