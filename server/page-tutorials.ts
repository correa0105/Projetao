import { Router } from 'express';
import { z } from 'zod';
import { pool } from './db.js';
import { tutorialPages } from '../shared/page-tutorials.js';

export function pageTutorialsRouter() {
  const router = Router();
  router.get('/tutorials', async (_req, res) => {
    const result = await pool.query(
      'SELECT page FROM page_tutorial_preferences WHERE user_id=$1 AND dismissed',
      [res.locals.user.id],
    );
    res.set('Cache-Control', 'no-store').json({ dismissed: result.rows.map((row) => row.page) });
  });
  router.put('/tutorials/:page', async (req, res) => {
    const page = z.enum(tutorialPages).parse(req.params.page);
    const { dismissed } = z.object({ dismissed: z.boolean() }).strict().parse(req.body);
    await pool.query(
      `INSERT INTO page_tutorial_preferences(user_id,page,dismissed) VALUES($1,$2,$3)
      ON CONFLICT(user_id,page) DO UPDATE SET dismissed=EXCLUDED.dismissed,updated_at=now()`,
      [res.locals.user.id, page, dismissed],
    );
    res.json({ page, dismissed });
  });
  return router;
}
